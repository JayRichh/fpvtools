import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

const DEG = Math.PI / 180

@customElement('tilt-viz')
export class TiltViz extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
        min-height: 160px;
        position: relative;
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        overflow: hidden;
      }
      canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
    `,
  ]

  @property({ type: Number }) tiltDeg = 30
  @property({ type: Number }) fovDeg = 120

  private _canvas!: HTMLCanvasElement
  private _ctx!: CanvasRenderingContext2D
  private _rafId = 0
  private _running = false
  private _dirty = true
  private _observer!: ResizeObserver

  firstUpdated() {
    this._canvas = this.shadowRoot!.querySelector('canvas')!
    const ctx = this._canvas.getContext('2d')
    if (!ctx) return
    this._ctx = ctx
    this._observer = new ResizeObserver(() => this._resize())
    this._observer.observe(this)
    this._resize()
    this._running = true
    this._loop()
  }

  updated() { this._dirty = true }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._running = false
    cancelAnimationFrame(this._rafId)
    this._observer?.disconnect()
  }

  private _loop() {
    if (!this._running) return
    this._rafId = requestAnimationFrame(() => {
      if (!this._running) return
      if (this._dirty) { this._draw(); this._dirty = false }
      this._loop()
    })
  }

  private _resize() {
    const dpr = window.devicePixelRatio || 1
    const w = this.offsetWidth, h = this.offsetHeight
    if (!w || !h) return
    this._canvas.width = Math.round(w * dpr)
    this._canvas.height = Math.round(h * dpr)
    this._dirty = true
  }

  private _draw() {
    const ctx = this._ctx, canvas = this._canvas
    if (!ctx || !canvas.width) return

    const dpr = window.devicePixelRatio || 1
    const W = canvas.width / dpr, H = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const cs = getComputedStyle(this)
    const get = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb
    const clrPrimary = get('--fpv-primary', '#00d4aa')
    const clrBorder = get('--fpv-border', '#2a2a3a')
    const clrText = get('--fpv-text', '#e0e0e8')
    const clrMuted = get('--fpv-text-muted', '#8888a0')
    const clrAccent = get('--fpv-accent', '#ff6b35')
    const fontMono = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const cx = W * 0.42, cy = H * 0.55

    // Ground / horizon line
    ctx.strokeStyle = clrBorder
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()
    ctx.setLineDash([])
    ctx.font = `10px ${fontSans}`; ctx.fillStyle = clrMuted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText('Horizon', 4, cy - 2)

    const scale = Math.min(W, H) * 0.22

    // Quad body (centre rect)
    const bodyW = scale * 0.3, bodyH = scale * 0.2
    ctx.fillStyle = clrBorder
    ctx.beginPath(); ctx.roundRect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, 3); ctx.fill()

    // Quad arms (X-frame)
    const armLen = scale * 0.8
    ctx.strokeStyle = clrBorder; ctx.lineWidth = 4; ctx.lineCap = 'round'
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + dx * armLen * 0.5, cy + dy * armLen * 0.25)
      ctx.stroke()
      // Motor dot
      ctx.beginPath(); ctx.arc(cx + dx * armLen * 0.5, cy + dy * armLen * 0.25, 5, 0, Math.PI * 2); ctx.fillStyle = clrBorder; ctx.fill()
    }

    // Camera rectangle (rotated by tiltDeg)
    const camW = scale * 0.18, camH = scale * 0.12
    const tiltRad = this.tiltDeg * DEG
    const camOriginX = cx, camOriginY = cy - bodyH / 2

    ctx.save()
    ctx.translate(camOriginX, camOriginY)
    ctx.rotate(-tiltRad)
    ctx.strokeStyle = clrPrimary; ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect(-camW / 2, -camH / 2, camW, camH, 2); ctx.stroke()
    ctx.restore()

    // Tilt arc
    const arcR = scale * 0.35
    ctx.strokeStyle = clrPrimary + '80'; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(camOriginX, camOriginY, arcR, -Math.PI / 2 - tiltRad, -Math.PI / 2)
    ctx.stroke()

    // Tilt angle label
    ctx.font = `bold 12px ${fontMono}`; ctx.fillStyle = clrPrimary; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(`${this.tiltDeg.toFixed(1)}°`, camOriginX - arcR - 4, camOriginY - arcR / 2)

    // FOV cone from camera centre
    const fovRad = this.fovDeg * DEG / 2
    const coneLen = scale * 1.2
    const fovDir = -tiltRad // pointing direction in canvas space

    ctx.save()
    ctx.translate(camOriginX, camOriginY)
    ctx.rotate(-tiltRad)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-Math.sin(fovRad) * coneLen, -Math.cos(fovRad) * coneLen)
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.sin(fovRad) * coneLen, -Math.cos(fovRad) * coneLen)
    ctx.strokeStyle = clrAccent + '50'; ctx.lineWidth = 1; ctx.stroke()
    ctx.restore()

    // FOV label
    ctx.font = `10px ${fontSans}`; ctx.fillStyle = clrAccent; ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(`FOV ${this.fovDeg}°`, W - 8, 8)

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'tilt-viz': TiltViz }
}
