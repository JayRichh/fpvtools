import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

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
      canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
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

  private _lerpColor(t: number): string {
    // green (t=0) → yellow (t=0.5) → red (t=1)
    const r = t < 0.5 ? Math.round(255 * t * 2) : 255
    const g = t < 0.5 ? 200 : Math.round(200 * (1 - (t - 0.5) * 2))
    return `rgb(${r},${g},60)`
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
    const clrBorder = get('--fpv-border', '#2a2a3a')
    const clrText = get('--fpv-text', '#e0e0e8')
    const clrMuted = get('--fpv-text-muted', '#8888a0')
    const clrPrimary = get('--fpv-primary', '#00d4aa')
    const fontMono = get('--fpv-font-mono', 'JetBrains Mono, monospace')

    const S = this.cellCount
    const P = this.parallelCount
    const total = S * P
    if (total === 0) { ctx.restore(); return }

    const gridPadX = 12, gridPadY = 12
    const gridH = Math.min(H * 0.55, (H - gridPadY * 2))
    const gridW = W - gridPadX * 2
    const cellW = Math.min(gridW / S - 4, 40)
    const cellH = Math.min(gridH / P - 4, 30)
    const startX = gridPadX + (gridW - (cellW + 4) * S) / 2
    const startY = gridPadY

    const dPct = Math.max(0, Math.min(1, this.dischargePct))
    const cellColor = this._lerpColor(dPct)

    // Draw cell grid (S columns = series, P rows = parallel)
    for (let p = 0; p < P; p++) {
      for (let s = 0; s < S; s++) {
        const x = startX + s * (cellW + 4)
        const y = startY + p * (cellH + 4)
        const r = 4
        ctx.beginPath()
        ctx.roundRect(x, y, cellW, cellH, r)
        ctx.fillStyle = cellColor + '40'
        ctx.fill()
        ctx.strokeStyle = cellColor
        ctx.lineWidth = 1.5
        ctx.stroke()
        // Voltage label
        const v = this.voltagePerCell
        ctx.font = `bold ${Math.min(10, cellH * 0.4)}px ${fontMono}`
        ctx.fillStyle = clrText
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(v.toFixed(2) + 'V', x + cellW / 2, y + cellH / 2)
      }
    }

    // Pack voltage label
    const packV = this.voltagePerCell * S
    ctx.font = `bold 13px ${fontMono}`
    ctx.fillStyle = clrPrimary
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`${packV.toFixed(1)}V  ${S}S${P > 1 ? P + 'P' : ''}`, W / 2, startY + P * (cellH + 4) + 4)

    // Discharge bar below grid
    const barY = startY + P * (cellH + 4) + 24
    const barH = 8
    const barW = W - gridPadX * 2
    ctx.fillStyle = clrBorder
    ctx.beginPath(); ctx.roundRect(gridPadX, barY, barW, barH, 4); ctx.fill()
    if (dPct > 0) {
      ctx.fillStyle = cellColor
      ctx.beginPath(); ctx.roundRect(gridPadX, barY, barW * dPct, barH, 4); ctx.fill()
    }
    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = clrMuted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${Math.round(dPct * 100)}% used`, W - gridPadX, barY + barH + 2)

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'pack-viz': PackViz }
}
