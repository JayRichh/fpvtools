import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

type V3 = [number, number, number]

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function rotX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}
function rotY(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]
}
function project(p: V3, fl: number, cx: number, cy: number): [number, number, number] {
  const z = p[2] + fl
  if (z < 0.1) return [cx, cy, 0]
  const s = fl / z
  return [cx + p[0] * s, cy - p[1] * s, s]
}

function lerpColor(t: number): [number, number, number] {
  const r = t < 0.5 ? Math.round(60 + 195 * t * 2) : 255
  const g = t < 0.5 ? 200 : Math.round(200 * (1 - (t - 0.5) * 2))
  return [r, g, 60]
}

@customElement('pack-viz')
export class PackViz extends LitElement {
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
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        cursor: grab;
      }
      canvas:active { cursor: grabbing; }
    `,
  ]

  @property({ type: Number }) cellCount = 6
  @property({ type: Number }) parallelCount = 1
  @property({ type: Number }) voltagePerCell = 3.7
  @property({ type: Number }) dischargePct = 0

  private _canvas!: HTMLCanvasElement
  private _ctx!: CanvasRenderingContext2D
  private _rafId = 0
  private _running = false
  private _dirty = true
  private _observer!: ResizeObserver

  private _camPitch = -30 * DEG
  private _camYaw   = -38 * DEG
  private _orbiting = false
  private _orbitX   = 0
  private _orbitY   = 0

  private _startOrbit = (e: MouseEvent) => {
    this._orbiting = true; this._orbitX = e.clientX; this._orbitY = e.clientY
  }
  private _moveOrbit = (e: MouseEvent) => {
    if (!this._orbiting) return
    this._camYaw   += (e.clientX - this._orbitX) * 0.006
    this._camPitch  = Math.max(-1.45, Math.min(-0.04, this._camPitch + (e.clientY - this._orbitY) * 0.006))
    this._orbitX = e.clientX; this._orbitY = e.clientY
    this._dirty = true
  }
  private _endOrbit   = () => { this._orbiting = false }
  private _touchOrbitStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    this._orbiting = true; this._orbitX = e.touches[0].clientX; this._orbitY = e.touches[0].clientY
  }
  private _touchOrbitMove = (e: TouchEvent) => {
    if (!this._orbiting || e.touches.length !== 1) return
    this._camYaw   += (e.touches[0].clientX - this._orbitX) * 0.006
    this._camPitch  = Math.max(-1.45, Math.min(-0.04, this._camPitch + (e.touches[0].clientY - this._orbitY) * 0.006))
    this._orbitX = e.touches[0].clientX; this._orbitY = e.touches[0].clientY
    this._dirty = true
  }
  private _resetOrbit = () => { this._camPitch = -30 * DEG; this._camYaw = -38 * DEG; this._dirty = true }

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
    this._canvas.addEventListener('mousedown', this._startOrbit)
    window.addEventListener('mousemove', this._moveOrbit)
    window.addEventListener('mouseup', this._endOrbit)
    this._canvas.addEventListener('touchstart', this._touchOrbitStart, { passive: true })
    window.addEventListener('touchmove', this._touchOrbitMove, { passive: true })
    window.addEventListener('touchend', this._endOrbit)
    this._canvas.addEventListener('dblclick', this._resetOrbit)
  }

  updated() { this._dirty = true }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._running = false
    cancelAnimationFrame(this._rafId)
    this._observer?.disconnect()
    window.removeEventListener('mousemove', this._moveOrbit)
    window.removeEventListener('mouseup', this._endOrbit)
    window.removeEventListener('touchmove', this._touchOrbitMove)
    window.removeEventListener('touchend', this._endOrbit)
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
    const clrBorder  = get('--fpv-border', '#2a2a3a')
    const clrText    = get('--fpv-text', '#e0e0e8')
    const clrMuted   = get('--fpv-text-muted', '#8888a0')
    const clrPrimary = get('--fpv-primary', '#00d4aa')
    const fontMono   = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans   = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const S = Math.max(1, this.cellCount)
    const P = Math.max(1, this.parallelCount)
    const dPct = clamp(this.dischargePct, 0, 1)
    const [cr, cg, cb] = lerpColor(dPct)
    const cellRgb = `${cr},${cg},${cb}`

    const cx = W * 0.5, cy = H * 0.46
    const focalLen = 4.0
    const camPitch = this._camPitch
    const camYaw   = this._camYaw

    // Scale so each cell stays legible: larger packs shrink slightly
    const scale = Math.min(W, H) / Math.max(S, P, 2) * 1.25

    const xform = (p: V3): [number, number, number] => {
      let v = rotX(p, camPitch)
      v = rotY(v, camYaw)
      return project([v[0] * scale, v[1] * scale, v[2] * scale], focalLen * scale, cx, cy)
    }

    // Cell box dimensions in world units
    const cSpacingX = 0.82
    const cSpacingZ = 0.82
    const hw = 0.31   // half-width X
    const hh = 0.58   // half-height Y
    const hd = 0.31   // half-depth Z

    type CellDraw = { avgZ: number; draw: () => void }
    const cells: CellDraw[] = []

    for (let s = 0; s < S; s++) {
      for (let p = 0; p < P; p++) {
        const wx = (p - (P - 1) / 2) * cSpacingX
        const wz = (s - (S - 1) / 2) * cSpacingZ
        const wy = 0

        const verts: V3[] = [
          [wx - hw, wy - hh, wz - hd],
          [wx + hw, wy - hh, wz - hd],
          [wx + hw, wy + hh, wz - hd],
          [wx - hw, wy + hh, wz - hd],
          [wx - hw, wy - hh, wz + hd],
          [wx + hw, wy - hh, wz + hd],
          [wx + hw, wy + hh, wz + hd],
          [wx - hw, wy + hh, wz + hd],
        ]
        const pv = verts.map(v => xform(v))
        const avgZ = pv.reduce((acc, v) => acc + v[2], 0) / pv.length

        cells.push({
          avgZ,
          draw: () => {
            // Draw: top face, then side faces based on camera angle
            const faces = [
              { idxs: [3, 2, 6, 7], bright: 0.65 },  // top
              { idxs: [4, 5, 6, 7], bright: 0.30 },   // front (+Z)
              { idxs: [1, 5, 6, 2], bright: 0.20 },   // right (+X)
            ]

            faces.sort((a, b) => {
              const za = a.idxs.reduce((acc, i) => acc + pv[i][2], 0) / a.idxs.length
              const zb = b.idxs.reduce((acc, i) => acc + pv[i][2], 0) / b.idxs.length
              return za - zb
            })

            for (const face of faces) {
              const pts = face.idxs.map(i => pv[i])
              ctx.beginPath()
              ctx.moveTo(pts[0][0], pts[0][1])
              for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1])
              ctx.closePath()
              ctx.fillStyle = `rgba(${cellRgb},${face.bright})`
              ctx.strokeStyle = `rgba(${cellRgb},0.7)`
              ctx.lineWidth = 0.7
              ctx.fill(); ctx.stroke()
            }

            // Voltage on top face centroid
            const tCx = pv[3][0] + pv[2][0] + pv[6][0] + pv[7][0]
            const tCy = pv[3][1] + pv[2][1] + pv[6][1] + pv[7][1]
            const topScale = (pv[3][2] + pv[2][2] + pv[6][2] + pv[7][2]) / 4
            const fs = Math.max(6, Math.min(11, 9 * topScale))
            ctx.font = `bold ${fs}px ${fontMono}`
            ctx.fillStyle = clrText
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(this.voltagePerCell.toFixed(2) + 'V', tCx / 4, tCy / 4)

            // (+) terminal nub on series-first cell
            if (s === 0 && p === 0) {
              const nub = pv[2]
              ctx.beginPath(); ctx.arc(nub[0], nub[1], 3.5 * topScale, 0, TAU)
              ctx.fillStyle = clrPrimary; ctx.fill()
            }

            // Bus wire connection along series direction
            if (s < S - 1) {
              const nextWZ = wz + cSpacingZ
              const a = xform([wx, wy + hh, wz + hd])
              const b = xform([wx, wy + hh, nextWZ - hd])
              ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
              ctx.strokeStyle = clrBorder; ctx.lineWidth = 1.5; ctx.stroke()
            }
          },
        })
      }
    }

    cells.sort((a, b) => a.avgZ - b.avgZ)
    for (const c of cells) c.draw()

    // Pack label
    const packV = this.voltagePerCell * S
    ctx.font = `bold 12px ${fontMono}`
    ctx.fillStyle = clrPrimary
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText(
      `${packV.toFixed(1)}V  ${S}S${P > 1 ? P + 'P' : ''}`,
      W / 2, H - 14
    )

    // Discharge bar
    const barY = H - 10, barH = 5, barW = W * 0.68, barX = (W - barW) / 2
    ctx.fillStyle = clrBorder
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill()
    if (dPct > 0) {
      ctx.fillStyle = `rgb(${cellRgb})`
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * dPct, barH, 3); ctx.fill()
    }
    ctx.font = `9px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(dPct * 100)}% used`, barX - 4, barY + barH / 2)

    // Hint
    ctx.font = `9px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.globalAlpha = 0.4; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText('drag to orbit · dbl-click to reset', W / 2, H - 20)
    ctx.globalAlpha = 1

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'pack-viz': PackViz }
}
