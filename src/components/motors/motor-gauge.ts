import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

const TAU = Math.PI * 2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

@customElement('motor-gauge')
export class MotorGauge extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
        min-height: 140px;
        position: relative;
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        overflow: hidden;
      }
      canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
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

  private _drawArcDial(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    value: number, maxValue: number,
    label: string, sublabel: string,
    fillColor: string, bgColor: string,
    fontMono: string, fontSans: string,
    clrText: string, clrMuted: string,
    startAngle = Math.PI * 0.75, sweepAngle = Math.PI * 1.5,
  ) {
    // Background arc
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, startAngle + sweepAngle)
    ctx.strokeStyle = bgColor
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.stroke()

    // Value arc
    const pct = clamp(value / maxValue, 0, 1)
    if (pct > 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, startAngle, startAngle + sweepAngle * pct)
      ctx.strokeStyle = fillColor
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Center labels
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold 14px ${fontMono}`
    ctx.fillStyle = clrText
    ctx.fillText(label, cx, cy - 6)
    ctx.font = `10px ${fontSans}`
    ctx.fillStyle = clrMuted
    ctx.fillText(sublabel, cx, cy + 10)
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
    const clrAccent = get('--fpv-accent', '#ff6b35')
    const clrError = get('--fpv-error', '#ff4466')
    const clrBorder = get('--fpv-border', '#2a2a3a')
    const clrText = get('--fpv-text', '#e0e0e8')
    const clrMuted = get('--fpv-text-muted', '#8888a0')
    const fontMono = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const halfW = W / 2
    const r = Math.min(halfW / 2 - 16, H / 2 - 20)
    const cy = H / 2 + 5

    // --- Left dial: Thrust to Weight ---
    const twMax = 4
    const tw = clamp(this.thrustToWeight, 0, twMax)
    const twColor = tw >= 2 ? clrSuccess : tw >= 1.5 ? clrAccent : clrError
    this._drawArcDial(ctx, halfW / 2, cy, r,
      tw, twMax,
      `${tw.toFixed(1)}×`, 'T:W',
      twColor, clrBorder, fontMono, fontSans, clrText, clrMuted)

    // Target zone tick (2–3×)
    const startA = Math.PI * 0.75, sweepA = Math.PI * 1.5
    const t2x = startA + sweepA * (2 / twMax)
    const t3x = startA + sweepA * (3 / twMax)
    ctx.strokeStyle = clrSuccess + '60'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(halfW / 2, cy, r, t2x, t3x)
    ctx.stroke()

    // T:W label
    ctx.font = `9px ${fontSans}`
    ctx.fillStyle = clrSuccess
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('Target 2–3×', halfW / 2, cy + r - 10)

    // --- Right dial: ESC headroom ---
    const totalPeakA = this.motorMaxCurrentA * this.motorCount
    const escRated = this.escRatedA
    const escPct = clamp(totalPeakA / escRated, 0, 1.5)
    const escOverloaded = totalPeakA > escRated * 0.85
    const escColor = escOverloaded ? clrError : totalPeakA > escRated * 0.7 ? clrAccent : clrPrimary

    this._drawArcDial(ctx, halfW + halfW / 2, cy, r,
      escPct, 1.5,
      `${totalPeakA.toFixed(0)}A`, `of ${escRated}A ESC`,
      escColor, clrBorder, fontMono, fontSans, clrText, clrMuted)

    if (escOverloaded) {
      ctx.font = `bold 9px ${fontSans}`
      ctx.fillStyle = clrError
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('Check ESC headroom', halfW + halfW / 2, cy + r - 10)
    }

    // Divider
    ctx.strokeStyle = clrBorder
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(halfW, 8)
    ctx.lineTo(halfW, H - 8)
    ctx.stroke()

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'motor-gauge': MotorGauge }
}
