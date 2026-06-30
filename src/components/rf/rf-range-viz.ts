import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

const TAU = Math.PI * 2

@customElement('rf-range-viz')
export class RfRangeViz extends LitElement {
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
      canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
    `,
  ]

  @property({ type: Number }) primaryRangeKm = 0
  @property({ type: Number }) primaryMarginDb = 0
  @property({ type: String }) primaryLabel = 'Control'
  @property({ type: Number }) secondaryRangeKm = 0
  @property({ type: Number }) secondaryMarginDb = 0
  @property({ type: String }) secondaryLabel = 'Video'
  @property({ type: Boolean }) dualLink = false

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

  private _marginColor(margin: number, clrSuccess: string, clrAccent: string, clrError: string): string {
    if (margin >= 15) return clrSuccess
    if (margin >= 6) return clrAccent
    return clrError
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
    const clrSuccess = get('--fpv-success', '#44cc88')
    const clrAccent = get('--fpv-accent', '#ff6b35')
    const clrError = get('--fpv-error', '#ff4466')
    const clrPrimary = get('--fpv-primary', '#00d4aa')
    const clrBorder = get('--fpv-border', '#2a2a3a')
    const clrText = get('--fpv-text', '#e0e0e8')
    const clrMuted = get('--fpv-text-muted', '#8888a0')
    const fontMono = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const legendH = 50
    const cx = W / 2, cy = (H - legendH) / 2
    const maxRange = this.dualLink
      ? Math.max(this.primaryRangeKm, this.secondaryRangeKm)
      : this.primaryRangeKm
    if (maxRange <= 0) {
      ctx.fillStyle = clrMuted
      ctx.font = `13px ${fontSans}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Enter link parameters to see range', cx, cy)
      ctx.restore()
      return
    }

    const maxR = Math.min(cx - 16, cy - 16)
    const primaryR = maxRange > 0 ? (this.primaryRangeKm / maxRange) * maxR : 0
    const primaryColor = this._marginColor(this.primaryMarginDb, clrSuccess, clrAccent, clrError)

    // Primary circle
    ctx.beginPath()
    ctx.arc(cx, cy, primaryR, 0, TAU)
    ctx.fillStyle = primaryColor + '15'
    ctx.fill()
    ctx.strokeStyle = primaryColor
    ctx.lineWidth = 2
    ctx.stroke()

    // Secondary circle (if dual link)
    if (this.dualLink && this.secondaryRangeKm > 0) {
      const secR = (this.secondaryRangeKm / maxRange) * maxR
      const secColor = this._marginColor(this.secondaryMarginDb, clrSuccess, clrAccent, clrError)
      ctx.beginPath()
      ctx.arc(cx, cy, secR, 0, TAU)
      ctx.fillStyle = secColor + '10'
      ctx.fill()
      ctx.strokeStyle = clrAccent
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Centre dot
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU)
    ctx.fillStyle = clrText; ctx.fill()

    // Scale bar (bottom left)
    const scaleBarKm = maxRange > 10 ? Math.round(maxRange / 3) : Math.round(maxRange / 3 * 10) / 10
    const scaleBarPx = (scaleBarKm / maxRange) * maxR
    const sbX = 14, sbY = H - legendH - 14
    ctx.strokeStyle = clrMuted; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + scaleBarPx, sbY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sbX, sbY - 4); ctx.lineTo(sbX, sbY + 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sbX + scaleBarPx, sbY - 4); ctx.lineTo(sbX + scaleBarPx, sbY + 4); ctx.stroke()
    ctx.font = `10px ${fontMono}`; ctx.fillStyle = clrMuted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText(`${scaleBarKm} km`, sbX, sbY - 5)

    // Legend
    const legY = H - legendH + 10
    const drawLegendItem = (x: number, color: string, label: string, rangeKm: number, marginDb: number) => {
      ctx.beginPath(); ctx.arc(x, legY + 6, 5, 0, TAU); ctx.fillStyle = color; ctx.fill()
      ctx.font = `11px ${fontSans}`; ctx.fillStyle = clrText; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(label, x + 10, legY)
      ctx.font = `10px ${fontMono}`; ctx.fillStyle = clrMuted
      ctx.fillText(`${rangeKm.toFixed(1)} km  ${marginDb > 0 ? '+' : ''}${marginDb.toFixed(1)} dB`, x + 10, legY + 14)
    }

    drawLegendItem(12, primaryColor, this.primaryLabel, this.primaryRangeKm, this.primaryMarginDb)
    if (this.dualLink) {
      const secColor = this._marginColor(this.secondaryMarginDb, clrSuccess, clrAccent, clrError)
      drawLegendItem(W / 2 + 4, secColor, this.secondaryLabel, this.secondaryRangeKm, this.secondaryMarginDb)
    }

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'rf-range-viz': RfRangeViz }
}
