import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

type V3 = [number, number, number]

const DEG = Math.PI / 180
const TAU = Math.PI * 2
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

@customElement('motor-gauge')
export class MotorGauge extends LitElement {
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
        cursor: grab;
      }
      canvas:active { cursor: grabbing; }
    `,
  ]

  @property({ type: Number }) thrustToWeight = 0
  @property({ type: Number }) motorMaxCurrentA = 42
  @property({ type: Number }) motorCount = 4
  @property({ type: Number }) escRatedA = 55

  private _canvas!: HTMLCanvasElement
  private _ctx!: CanvasRenderingContext2D
  private _rafId = 0
  private _running = false
  private _dirty = true
  private _observer!: ResizeObserver

  private _camPitch = -38 * DEG
  private _camYaw   =  18 * DEG
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
  private _resetOrbit = () => { this._camPitch = -38 * DEG; this._camYaw = 18 * DEG; this._dirty = true }

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
    const clrPrimary = get('--fpv-primary', '#00d4aa')
    const clrSuccess = get('--fpv-success', '#44cc88')
    const clrAccent  = get('--fpv-accent', '#ff6b35')
    const clrError   = get('--fpv-error', '#ff4466')
    const clrBorder  = get('--fpv-border', '#2a2a3e')
    const clrMuted   = get('--fpv-text-muted', '#8888a0')
    const fontMono   = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans   = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    // Metrics
    const tw = clamp(this.thrustToWeight, 0, 6)
    const totalPeakA = this.motorMaxCurrentA * this.motorCount
    const escPct = totalPeakA / this.escRatedA
    const escOverloaded = escPct > 0.85

    const motorClr = escPct > 0.85 ? clrError : escPct > 0.70 ? clrAccent : clrPrimary
    const thrustH = clamp(tw / 5, 0, 1.1)  // column height per motor

    // ── 3D scene ─────────────────────────────────────────────────────────────
    const cx = W * 0.5, cy = H * 0.50
    const scale = Math.min(W, H) * 0.32
    const focalLen = 4.0
    const camPitch = this._camPitch
    const camYaw   = this._camYaw

    const xform = (p: V3): [number, number, number] => {
      let v = rotX(p, camPitch)
      v = rotY(v, camYaw)
      return project([v[0] * scale, v[1] * scale, v[2] * scale], focalLen * scale, cx, cy)
    }

    const groundY = -0.45

    // Ground grid
    ctx.globalAlpha = 0.1
    ctx.strokeStyle = clrMuted
    ctx.lineWidth = 0.5
    for (let i = -4; i <= 4; i++) {
      const t = (i / 4) * 1.4
      const a = xform([t, groundY, -1.4]), b = xform([t, groundY, 1.4])
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
      const c = xform([-1.4, groundY, t]), d = xform([1.4, groundY, t])
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke()
    }
    ctx.globalAlpha = 1

    const armLen = 0.95
    const motorPos: V3[] = [
      [-armLen * 0.707, 0, -armLen * 0.707],
      [ armLen * 0.707, 0, -armLen * 0.707],
      [-armLen * 0.707, 0,  armLen * 0.707],
      [ armLen * 0.707, 0,  armLen * 0.707],
    ]
    const cp = xform([0, 0, 0])

    type Drawable = { z: number; draw: () => void }
    const drawables: Drawable[] = []

    // Arms
    for (let i = 0; i < 4; i++) {
      const mp = xform(motorPos[i])
      drawables.push({
        z: (cp[2] + mp[2]) / 2,
        draw: () => {
          ctx.beginPath()
          ctx.moveTo(cp[0], cp[1]); ctx.lineTo(mp[0], mp[1])
          ctx.strokeStyle = clrBorder
          ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke()
        },
      })
    }

    // Body
    drawables.push({
      z: cp[2],
      draw: () => {
        ctx.beginPath()
        ctx.arc(cp[0], cp[1], 0.16 * scale * cp[2], 0, TAU)
        ctx.fillStyle = clrBorder; ctx.fill()
        const front = xform([0, 0, -0.22])
        ctx.beginPath(); ctx.moveTo(cp[0], cp[1]); ctx.lineTo(front[0], front[1])
        ctx.strokeStyle = clrPrimary; ctx.lineWidth = 2; ctx.stroke()
      },
    })

    // Motors + thrust columns
    for (let i = 0; i < 4; i++) {
      const mBase = motorPos[i]
      const mp = xform(mBase)
      drawables.push({
        z: mp[2],
        draw: () => {
          // Thrust column
          if (thrustH > 0.01) {
            const colTop: V3 = [mBase[0], mBase[1] + thrustH, mBase[2]]
            const tp = xform(colTop)
            const grad = ctx.createLinearGradient(mp[0], mp[1], tp[0], tp[1])
            grad.addColorStop(0, motorClr + 'cc')
            grad.addColorStop(1, motorClr + '11')
            ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.lineTo(tp[0], tp[1])
            ctx.strokeStyle = grad; ctx.lineWidth = 7 * mp[2]; ctx.lineCap = 'round'; ctx.stroke()
            ctx.beginPath()
            ctx.arc(tp[0], tp[1], 4 * mp[2], 0, TAU)
            ctx.fillStyle = motorClr; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1
          }

          // ESC ring
          const discR = 0.28 * scale * mp[2]
          ctx.beginPath()
          ctx.ellipse(mp[0], mp[1], discR * 1.2, discR * 0.42, 0, 0, TAU)
          ctx.strokeStyle = motorClr + (escOverloaded ? 'cc' : '55')
          ctx.lineWidth = 2.5; ctx.stroke()

          // Prop disc
          ctx.beginPath()
          ctx.ellipse(mp[0], mp[1], discR, discR * 0.32, 0, 0, TAU)
          ctx.fillStyle = motorClr + '18'; ctx.strokeStyle = motorClr + '55'
          ctx.lineWidth = 1; ctx.fill(); ctx.stroke()

          // Motor hub
          ctx.beginPath()
          ctx.arc(mp[0], mp[1], 0.065 * scale * mp[2], 0, TAU)
          ctx.fillStyle = motorClr; ctx.fill()
        },
      })
    }

    // Drop shadow
    const gcp = xform([0, groundY, 0])
    ctx.globalAlpha = 0.07
    ctx.fillStyle = motorClr
    ctx.beginPath()
    ctx.ellipse(gcp[0], gcp[1], scale * 0.42, scale * 0.16, 0, 0, TAU)
    ctx.fill(); ctx.globalAlpha = 1

    drawables.sort((a, b) => a.z - b.z)
    for (const d of drawables) d.draw()

    // ── Compact arc meters (bottom corners) ──────────────────────────────────
    const mR = Math.min(W * 0.13, H * 0.15, 42)
    const startA = Math.PI * 0.75, sweepA = Math.PI * 1.5

    // T:W (left)
    const ax1 = mR + 16, ay1 = H - mR - 12
    ctx.beginPath(); ctx.arc(ax1, ay1, mR, startA, startA + sweepA)
    ctx.strokeStyle = clrBorder; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke()
    const twClr = tw >= 2 ? clrSuccess : tw >= 1.2 ? clrAccent : clrError
    if (tw > 0) {
      ctx.beginPath(); ctx.arc(ax1, ay1, mR, startA, startA + sweepA * clamp(tw / 4, 0, 1))
      ctx.strokeStyle = twClr; ctx.lineWidth = 5; ctx.stroke()
    }
    ctx.font = `bold 12px ${fontMono}`; ctx.fillStyle = twClr
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${tw.toFixed(1)}×`, ax1, ay1 - 2)
    ctx.font = `8px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.fillText('T:W', ax1, ay1 + 11)
    // target zone
    ctx.beginPath(); ctx.arc(ax1, ay1, mR + 2, startA + sweepA * (2 / 4), startA + sweepA * (3 / 4))
    ctx.strokeStyle = clrSuccess + '44'; ctx.lineWidth = 2; ctx.stroke()

    // ESC load (right)
    const ax2 = W - mR - 16, ay2 = H - mR - 12
    ctx.beginPath(); ctx.arc(ax2, ay2, mR, startA, startA + sweepA)
    ctx.strokeStyle = clrBorder; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke()
    const escFrac = clamp(escPct, 0, 1.5) / 1.5
    if (escFrac > 0) {
      ctx.beginPath(); ctx.arc(ax2, ay2, mR, startA, startA + sweepA * escFrac)
      ctx.strokeStyle = motorClr; ctx.lineWidth = 5; ctx.stroke()
    }
    ctx.font = `bold 11px ${fontMono}`; ctx.fillStyle = motorClr
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${totalPeakA.toFixed(0)}A`, ax2, ay2 - 2)
    ctx.font = `8px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.fillText(`/${this.escRatedA}A`, ax2, ay2 + 11)

    if (escOverloaded) {
      ctx.font = `bold 9px ${fontSans}`; ctx.fillStyle = clrError
      ctx.textAlign = 'center'
      ctx.fillText('OVERLOAD', ax2, ay2 + mR + 10)
    }

    // Hint
    ctx.font = `9px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.globalAlpha = 0.4; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText('drag · dbl-click reset', W / 2, H - 2)
    ctx.globalAlpha = 1

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'motor-gauge': MotorGauge }
}
