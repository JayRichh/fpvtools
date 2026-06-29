import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

// Motor indices: 0=M1=front-left, 1=M2=front-right, 2=M3=rear-left, 3=M4=rear-right
// Angles in canvas coordinates (y-down). 0=right, π/2=down, π=left, -π/2=up.
const MOTOR_ANGLES = [
  -Math.PI * 0.75, // M1 front-left  : -135°
  -Math.PI * 0.25, // M2 front-right : -45°
   Math.PI * 0.75, // M3 rear-left   :  135°
   Math.PI * 0.25, // M4 rear-right  :   45°
]

// Visually clockwise spin on screen (top-down view): M1=CW, M2=CCW, M3=CCW, M4=CW
const MOTOR_CW = [true, false, false, true]

const MOTOR_LABELS = ['M1', 'M2', 'M3', 'M4']

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Draw a circular-arc arrow with an arrowhead at the end.
 *
 * @param clockwise  visual clockwise on screen (canvas y-down convention)
 */
function drawCurvedArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: string,
  clockwise = true,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'

  // Arc (anticlockwise param is the inverse of visual clockwise in canvas y-down)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, endAngle, !clockwise)
  ctx.stroke()

  // Arrowhead at the tip (endAngle point on the circle).
  // Rotation derivation (canvas y-down):
  //   CW travel direction at angle θ = (-sin θ, cos θ)
  //   Drawing a triangle pointing in local -y gives (sin R, -cos R) after rotate(R).
  //   Matching: CW → R = π + θ,  CCW → R = θ
  const tipX = cx + Math.cos(endAngle) * radius
  const tipY = cy + Math.sin(endAngle) * radius
  const rot = clockwise ? Math.PI + endAngle : endAngle
  const ah = Math.max(3, radius * 0.22)

  ctx.translate(tipX, tipY)
  ctx.rotate(rot)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-ah * 0.65, ah * 1.3)
  ctx.lineTo(ah * 0.65, ah * 1.3)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

/**
 * Net torque per axis, clamped loosely to [-2, 2] (sum of two pairs).
 *  roll  → left  - right  : (M1+M3) - (M2+M4)
 *  pitch → front - rear   : (M1+M2) - (M3+M4)
 *  yaw   → CW   - CCW    : (M1+M4) - (M2+M3)
 */
function calcNetTorque(m: number[], axis: 'roll' | 'pitch' | 'yaw'): number {
  switch (axis) {
    case 'roll':  return (m[0] + m[2]) - (m[1] + m[3])
    case 'pitch': return (m[0] + m[1]) - (m[2] + m[3])
    case 'yaw':   return (m[0] + m[3]) - (m[1] + m[2])
  }
}

// ─── component ──────────────────────────────────────────────────────────────

@customElement('fpv-quad-preview')
export class FpvQuadPreview extends LitElement {
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
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    `,
  ]

  /** Four motor output values [-1..1]: front-left, front-right, rear-left, rear-right */
  @property({ type: Array }) motorOutputs: number[] = [0, 0, 0, 0]
  /** Commanded rotation rate in deg/s */
  @property({ type: Number }) setpointDegS = 0
  /** Actual gyro rotation rate in deg/s */
  @property({ type: Number }) gyroDegS = 0
  /** PID tracking error in deg/s */
  @property({ type: Number }) errorDegS = 0
  /** Whether any motor is saturated */
  @property({ type: Boolean }) saturated = false
  /** Which axis is visualised */
  @property({ type: String }) axis: 'roll' | 'pitch' | 'yaw' = 'roll'

  // ── internal state ────────────────────────────────────────────────────────

  private _canvas!: HTMLCanvasElement
  private _ctx!: CanvasRenderingContext2D
  private _rafId = 0
  private _running = false
  private _dirty = true
  private _observer!: ResizeObserver

  // ── lifecycle ─────────────────────────────────────────────────────────────

  firstUpdated(): void {
    this._canvas = this.shadowRoot!.querySelector('canvas')!
    const ctx = this._canvas.getContext('2d')
    if (!ctx) return
    this._ctx = ctx

    this._observer = new ResizeObserver(() => {
      this._dirty = true
    })
    this._observer.observe(this)

    this._running = true
    this._loop()
  }

  updated(): void {
    this._dirty = true
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this._running = false
    cancelAnimationFrame(this._rafId)
    this._observer?.disconnect()
  }

  // ── render loop ───────────────────────────────────────────────────────────

  private _loop(): void {
    if (!this._running) return
    this._rafId = requestAnimationFrame(() => {
      if (!this._running) return
      if (this._dirty) {
        this._resize()
        this._draw()
        this._dirty = false
      }
      this._loop()
    })
  }

  private _resize(): void {
    const dpr = window.devicePixelRatio || 1
    const w = this.offsetWidth
    const h = this.offsetHeight
    if (!w || !h) return
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (this._canvas.width !== bw) this._canvas.width = bw
    if (this._canvas.height !== bh) this._canvas.height = bh
  }

  // ── drawing ───────────────────────────────────────────────────────────────

  private _draw(): void {
    const canvas = this._canvas
    const ctx = this._ctx
    if (!ctx || !canvas.width || !canvas.height) return

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, cssW, cssH)

    // ── resolve design tokens (CSS vars are opaque to canvas — must use getComputedStyle)
    const cs = getComputedStyle(this)
    const get = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb
    const clrPrimary = get('--fpv-primary',   '#00d4aa')
    const clrAccent  = get('--fpv-accent',    '#ff6b35')
    const clrError   = get('--fpv-error',     '#ff4466')
    const clrBorder  = get('--fpv-border',    '#2a2a3a')
    const clrText    = get('--fpv-text',      '#e0e0e8')
    const clrMuted   = get('--fpv-text-muted','#8888a0')
    const clrInfo    = get('--fpv-info',      '#4488ff')
    const fontSans   = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')
    const fontMono   = get('--fpv-font-mono', 'JetBrains Mono, monospace')

    // ── layout
    const cx = cssW / 2
    const cy = cssH / 2
    const size = Math.min(cssW, cssH)

    // Scale constants relative to drawing area
    const armLen    = size * 0.32
    const motorMinR = size * 0.04
    const motorMaxR = size * 0.10
    const thrustMax = size * 0.08

    // ── sanitise motor outputs
    const motors = Array.from({ length: 4 }, (_, i) => {
      const v = this.motorOutputs[i]
      return Math.max(-1, Math.min(1, typeof v === 'number' ? v : 0))
    })

    // ── tracking quality (colour logic, per advisor: saturated first, then quality)
    const absSetpoint = Math.abs(this.setpointDegS)
    const absError    = Math.abs(this.errorDegS)
    const goodTracking = absSetpoint < 5 ? absError < 5 : absError < absSetpoint * 0.2

    const motorColor = (): string => {
      if (this.saturated) return clrError
      return goodTracking ? clrPrimary : clrAccent
    }

    // ── motor world positions
    const mPos = MOTOR_ANGLES.map(a => ({
      x: cx + Math.cos(a) * armLen,
      y: cy + Math.sin(a) * armLen,
    }))

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Frame arms
    // ─────────────────────────────────────────────────────────────────────────
    ctx.lineWidth = 2
    ctx.strokeStyle = clrBorder
    ctx.lineCap = 'round'
    mPos.forEach(p => {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    })

    // 2. Center body
    const bodyR = size * 0.04
    ctx.beginPath()
    ctx.arc(cx, cy, bodyR, 0, Math.PI * 2)
    ctx.fillStyle = clrBorder
    ctx.fill()

    // ─────────────────────────────────────────────────────────────────────────
    // 3–4. Motor circles, spin arrows, thrust arrows, labels
    // ─────────────────────────────────────────────────────────────────────────
    const col = motorColor()

    motors.forEach((output, i) => {
      const { x: mx, y: my } = mPos[i]
      const absOut = Math.abs(output)
      const mR     = motorMinR + (motorMaxR - motorMinR) * absOut
      const isCW   = MOTOR_CW[i]

      // Motor circle (filled ring)
      ctx.beginPath()
      ctx.arc(mx, my, mR, 0, Math.PI * 2)
      ctx.fillStyle = col + '28'   // ~16 % fill
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = col
      ctx.stroke()

      // Spin direction arc inside motor circle
      const spinR = mR * 0.55
      const spinStart = isCW ? -Math.PI * 0.75 : Math.PI * 0.75
      const spinEnd   = isCW ?  Math.PI * 0.75 : -Math.PI * 0.75
      drawCurvedArrow(ctx, mx, my, spinR, spinStart, spinEnd, col, isCW)

      // Thrust arrow (upward = toward viewer from above, –y in canvas)
      const thrustLen = absOut * thrustMax
      if (thrustLen > 1) {
        const tx = mx
        const ty = my - mR - 3
        ctx.save()
        ctx.strokeStyle = col
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(tx, ty - thrustLen)
        ctx.stroke()
        const ah = 4
        ctx.beginPath()
        ctx.moveTo(tx, ty - thrustLen)
        ctx.lineTo(tx - ah, ty - thrustLen + ah * 1.5)
        ctx.lineTo(tx + ah, ty - thrustLen + ah * 1.5)
        ctx.closePath()
        ctx.fillStyle = col
        ctx.fill()
        ctx.restore()
      }

      // Motor label — pushed outward along the arm direction
      const labelDist = mR + 12
      const angle = MOTOR_ANGLES[i]
      ctx.font = `11px ${fontSans}`
      ctx.fillStyle = clrMuted
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        MOTOR_LABELS[i],
        mx + Math.cos(angle) * labelDist,
        my + Math.sin(angle) * labelDist,
      )
    })

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Net torque arrow at CoG
    // ─────────────────────────────────────────────────────────────────────────
    const netTorque = calcNetTorque(motors, this.axis)
    const torqueR   = size * 0.09
    // Normalise: max sum is ±2 (two pairs each ±1)
    const torqueMag = Math.min(Math.abs(netTorque) / 2, 1)
    const torqueSweep = torqueMag * Math.PI * 1.25

    if (torqueMag > 0.01) {
      const tCW    = netTorque > 0
      const tStart = -Math.PI / 2
      const tEnd   = tStart + (tCW ? torqueSweep : -torqueSweep)
      drawCurvedArrow(ctx, cx, cy, torqueR, tStart, tEnd, clrPrimary, tCW)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Setpoint ghost arrow (semi-transparent, slightly offset radius)
    // ─────────────────────────────────────────────────────────────────────────
    const maxDegS = 720
    const spNorm  = this.setpointDegS / maxDegS
    const spMag   = Math.min(Math.abs(spNorm), 1)
    const spSweep = spMag * Math.PI * 1.25

    if (spMag > 0.01) {
      const spCW    = this.setpointDegS > 0
      const spR     = torqueR * 1.45
      const spStart = -Math.PI / 2 + Math.PI * 0.18   // slight angular offset from torque
      const spEnd   = spStart + (spCW ? spSweep : -spSweep)
      ctx.save()
      ctx.globalAlpha = 0.4
      drawCurvedArrow(ctx, cx, cy, spR, spStart, spEnd, clrMuted, spCW)
      ctx.restore()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Labels
    // ─────────────────────────────────────────────────────────────────────────
    const drawLeft   = cx - size / 2
    const drawTop    = cy - size / 2
    const drawBottom = cy + size / 2

    // Axis label — top-left corner of drawing area
    ctx.font = `bold 11px ${fontSans}`
    ctx.fillStyle = clrMuted
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(this.axis.toUpperCase(), drawLeft + 8, drawTop + 8)

    // Setpoint and gyro values — bottom row
    ctx.font = `11px ${fontMono}`
    ctx.textBaseline = 'bottom'

    ctx.textAlign = 'right'
    ctx.fillStyle = clrPrimary
    ctx.fillText(`SP ${this.setpointDegS.toFixed(1)}°/s`, cx - 4, drawBottom - 6)

    ctx.textAlign = 'left'
    ctx.fillStyle = clrInfo
    ctx.fillText(`GY ${this.gyroDegS.toFixed(1)}°/s`, cx + 4, drawBottom - 6)

    ctx.restore()
  }

  // ── template ──────────────────────────────────────────────────────────────

  render() {
    return html`<canvas></canvas>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-quad-preview': FpvQuadPreview
  }
}
