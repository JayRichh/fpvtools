import { LitElement, html, css } from 'lit'
import { tokenStyles } from '../primitives/tokens.css.js'
import { ThemeColors } from '../primitives/theme-colors.js'
import {
  createOrbitCamera, projectPoint, applyOrbit, renderScene, resolveHover,
} from '@core/render/engine2d'
import type { OrbitCamera, Projected, SceneNode, Vec3 } from '@core/render/engine2d'

export interface FrameInfo {
  W: number
  H: number
  /** Resolve a --fpv-* token (cached per ThemeColors) */
  color: (name: string, fallback: string) => string
  cam: OrbitCamera
  /** World point → screen point through the frame's camera */
  project: (v: Vec3) => Projected
}

const DEG = Math.PI / 180

/**
 * Base class for canvas visualizations. Absorbs the boilerplate previously
 * re-implemented per component: DPR-aware resize (ResizeObserver), the
 * requestAnimationFrame dirty-loop, ThemeColors token caching, orbit drag
 * (mouse + touch, double-click reset) and hover picking with a metadata
 * tooltip + outline for scene nodes carrying `meta`/`hit`.
 *
 * Consumers subclass and implement `buildScene()`. Imperative drivers keep
 * their fast path via `drawNow()` — hover state is read inside the shared
 * draw, so driver ticks never clobber pointer highlights.
 */
export abstract class FpvCanvas extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
        min-height: 200px;
        position: relative;
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        overflow: hidden;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
      }
      :host([data-orbit]) canvas { cursor: grab; }
      :host([data-orbit]) canvas:active { cursor: grabbing; }
    `,
  ]

  // ── Subclass configuration ─────────────────────────────────────────────────
  protected orbitEnabled = true
  protected hoverEnabled = true
  protected initialYawDeg = 22
  protected initialPitchDeg = -28
  protected pitchMin = -1.45
  protected pitchMax = -0.04
  protected sceneScaleFactor = 0.32
  protected focalLen = 4

  /** Build the frame's scene. Called on every draw. */
  protected abstract buildScene(f: FrameInfo): SceneNode[]
  /** Optional screen-space HUD pass drawn after the scene + tooltip. */
  protected drawOverlay?(ctx: CanvasRenderingContext2D, f: FrameInfo): void

  // ── Internals ──────────────────────────────────────────────────────────────
  private _canvas!: HTMLCanvasElement
  private _ctx!: CanvasRenderingContext2D
  private _rafId = 0
  private _running = false
  private _observer!: ResizeObserver
  private _dirty = true
  private _theme = new ThemeColors(this)
  private _lastScene: SceneNode[] = []

  protected camYaw = 0
  protected camPitch = 0
  protected hoveredId: string | null = null
  protected pointerPos: { x: number; y: number } | null = null

  private _orbiting = false
  private _orbitX = 0
  private _orbitY = 0

  constructor() {
    super()
    this.resetOrbit()
  }

  /** Restore the initial orbit angles (call after overriding initial*Deg). */
  protected resetOrbit() {
    this.camYaw = this.initialYawDeg * DEG
    this.camPitch = this.initialPitchDeg * DEG
    this.markDirty()
  }

  // ── Pointer wiring ─────────────────────────────────────────────────────────
  private _onMouseDown = (e: MouseEvent) => {
    if (!this.orbitEnabled) return
    this._orbiting = true; this._orbitX = e.clientX; this._orbitY = e.clientY
  }
  private _onMouseMove = (e: MouseEvent) => {
    if (this._orbiting) {
      const next = applyOrbit(
        { yaw: this.camYaw, pitch: this.camPitch },
        e.clientX - this._orbitX, e.clientY - this._orbitY,
        { pitchMin: this.pitchMin, pitchMax: this.pitchMax },
      )
      this.camYaw = next.yaw
      this.camPitch = next.pitch
      this._orbitX = e.clientX; this._orbitY = e.clientY
      this._dirty = true
    }
  }
  private _onMouseUp = () => { this._orbiting = false }
  private _onCanvasMove = (e: MouseEvent) => {
    if (!this.hoverEnabled || this._orbiting) return
    const rect = this._canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    this.pointerPos = { x, y }
    const hit = resolveHover(this._lastScene, x, y)
    const nextId = hit?.id ?? null
    if (nextId !== this.hoveredId) {
      this.hoveredId = nextId
      this._dirty = true
    } else if (nextId && hit?.meta) {
      this._dirty = true // tooltip follows the pointer
    }
  }
  private _onCanvasLeave = () => {
    this.pointerPos = null
    if (this.hoveredId !== null) {
      this.hoveredId = null
      this._dirty = true
    }
  }
  private _onTouchStart = (e: TouchEvent) => {
    if (!this.orbitEnabled || e.touches.length !== 1) return
    this._orbiting = true
    this._orbitX = e.touches[0].clientX; this._orbitY = e.touches[0].clientY
  }
  private _onTouchMove = (e: TouchEvent) => {
    if (!this._orbiting || e.touches.length !== 1) return
    const next = applyOrbit(
      { yaw: this.camYaw, pitch: this.camPitch },
      e.touches[0].clientX - this._orbitX, e.touches[0].clientY - this._orbitY,
      { pitchMin: this.pitchMin, pitchMax: this.pitchMax },
    )
    this.camYaw = next.yaw
    this.camPitch = next.pitch
    this._orbitX = e.touches[0].clientX; this._orbitY = e.touches[0].clientY
    this._dirty = true
  }
  private _onDblClick = () => {
    this.resetOrbit()
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  firstUpdated() {
    this._canvas = this.shadowRoot!.querySelector('canvas')!
    const ctx = this._canvas.getContext('2d')
    if (!ctx) return
    this._ctx = ctx
    if (this.orbitEnabled) this.setAttribute('data-orbit', '')
    this._observer = new ResizeObserver(() => this._resize())
    this._observer.observe(this)
    this._resize()
    this._running = true
    this._loop()
    this._canvas.addEventListener('mousedown', this._onMouseDown)
    this._canvas.addEventListener('mousemove', this._onCanvasMove)
    this._canvas.addEventListener('mouseleave', this._onCanvasLeave)
    this._canvas.addEventListener('dblclick', this._onDblClick)
    this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: true })
    window.addEventListener('mousemove', this._onMouseMove)
    window.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('touchmove', this._onTouchMove, { passive: true })
    window.addEventListener('touchend', this._onMouseUp)
  }

  updated() { this._dirty = true }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._running = false
    cancelAnimationFrame(this._rafId)
    this._observer?.disconnect()
    window.removeEventListener('mousemove', this._onMouseMove)
    window.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('touchmove', this._onTouchMove)
    window.removeEventListener('touchend', this._onMouseUp)
  }

  private _loop() {
    if (!this._running) return
    this._rafId = requestAnimationFrame(() => {
      if (!this._running) return
      if (this._dirty) {
        this._draw()
        this._dirty = false
      }
      this._loop()
    })
  }

  private _resize() {
    const dpr = window.devicePixelRatio || 1
    const w = this.offsetWidth
    const h = this.offsetHeight
    if (!w || !h) return
    this._canvas.width = Math.round(w * dpr)
    this._canvas.height = Math.round(h * dpr)
    this._dirty = true
  }

  /** Request a redraw on the next animation frame. */
  protected markDirty() { this._dirty = true }

  /**
   * Imperative fast path for continuously-running drivers: draw synchronously
   * in the current frame instead of waiting for the own rAF loop.
   */
  protected drawNow() {
    this._draw()
    this._dirty = false
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  private _draw() {
    const ctx = this._ctx
    const canvas = this._canvas
    if (!ctx || !canvas?.width) return

    const dpr = window.devicePixelRatio || 1
    const W = canvas.width / dpr
    const H = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    this._theme.frame()
    const color = (v: string, fb: string) => this._theme.get(v, fb)

    const cam = createOrbitCamera({
      yaw: this.camYaw,
      pitch: this.camPitch,
      scale: Math.min(W, H) * this.sceneScaleFactor,
      focalLen: this.focalLen,
      cx: W / 2,
      cy: H / 2,
    })
    const f: FrameInfo = { W, H, color, cam, project: (v) => projectPoint(cam, v) }

    const scene = this.buildScene(f)
    this._lastScene = scene

    renderScene(ctx, scene, {
      hoveredId: this.hoveredId,
      outlineStyle: color('--fpv-primary', '#00d4aa'),
      outlineWidth: 1.5,
    })

    this._drawTooltip(ctx, f)
    this.drawOverlay?.(ctx, f)
    ctx.restore()
  }

  private _drawTooltip(ctx: CanvasRenderingContext2D, f: FrameInfo) {
    if (!this.hoveredId || !this.pointerPos) return
    const node = this._lastScene.find((n) => n.id === this.hoveredId)
    if (!node?.meta) return

    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')
    const title = String(node.meta.label ?? node.id)
    const lines = Object.entries(node.meta)
      .filter(([k]) => k !== 'label')
      .map(([k, v]) => `${k}  ${v}`)

    ctx.save()
    ctx.font = `bold 11px ${fontSans}`
    let boxW = ctx.measureText(title).width
    ctx.font = `10px ${fontMono}`
    for (const line of lines) boxW = Math.max(boxW, ctx.measureText(line).width)

    const padX = 8
    const lineH = 14
    const w = boxW + padX * 2
    const h = 8 + lineH + lines.length * lineH
    let x = this.pointerPos.x + 14
    let y = this.pointerPos.y + 14
    if (x + w > f.W - 4) x = this.pointerPos.x - w - 10
    if (y + h > f.H - 4) y = this.pointerPos.y - h - 10
    x = Math.max(4, x)
    y = Math.max(4, y)

    ctx.fillStyle = f.color('--fpv-surface-2', '#1e1e2e')
    ctx.strokeStyle = f.color('--fpv-border', '#2a2a3e')
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.96
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 4)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = 1

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = `bold 11px ${fontSans}`
    ctx.fillStyle = f.color('--fpv-primary', '#00d4aa')
    ctx.fillText(title, x + padX, y + 6)
    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = f.color('--fpv-text', '#e8e8f0')
    lines.forEach((line, i) => {
      ctx.fillText(line, x + padX, y + 6 + lineH + i * lineH)
    })
    ctx.restore()
  }

  render() {
    return html`<canvas></canvas>`
  }
}
