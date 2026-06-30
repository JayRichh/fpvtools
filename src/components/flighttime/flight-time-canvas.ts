import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import type { FlightTimeResult } from '@core/flighttime/types.js'
import { voltageAtDischarge } from '@core/flighttime/calculate.js'

@customElement('flight-time-canvas')
export class FlightTimeCanvas extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
        min-height: 220px;
        position: relative;
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        overflow: hidden;
      }
      canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
    `,
  ]

  @property({ type: Object }) result: FlightTimeResult | null = null
  @property({ type: String }) chemistry: 'lipo' | 'liion' = 'liion'
  @property({ type: Number }) cellCount = 6

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
    const clrAccent = get('--fpv-accent', '#ff6b35')
    const clrInfo = get('--fpv-info', '#4488ff')
    const clrBorder = get('--fpv-border', '#2a2a3a')
    const clrText = get('--fpv-text', '#e0e0e8')
    const clrMuted = get('--fpv-text-muted', '#8888a0')
    const clrSurface2 = get('--fpv-surface-2', '#1e1e2e')
    const fontMono = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    if (!this.result) {
      ctx.fillStyle = clrMuted
      ctx.font = `13px ${fontSans}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Enter inputs to see discharge curve', W / 2, H / 2)
      ctx.restore()
      return
    }

    const r = this.result
    const pad = { top: 20, right: 20, bottom: 40, left: 52 }
    const cW = W - pad.left - pad.right
    const cH = H - pad.top - pad.bottom

    // Time range: 0 → hoverTime + 20%
    const maxTime = r.hoverTimeMin * 1.2
    const cells = this.cellCount
    const [vMin, vMax] = this.chemistry === 'lipo' ? [3.0 * cells, 4.2 * cells] : [2.8 * cells, 4.2 * cells]
    const vRange = vMax - vMin

    const xScale = (t: number) => pad.left + (t / maxTime) * cW
    const yScale = (v: number) => pad.top + (1 - (v - vMin) / vRange) * cH

    // Zone fills
    const hoverEndX = xScale(r.hoverTimeMin)
    const cruiseEndX = xScale(Math.min(r.cruiseTimeMin, maxTime))

    // Hover zone (blue-tinted)
    ctx.fillStyle = clrInfo + '18'
    ctx.fillRect(pad.left, pad.top, Math.min(hoverEndX, pad.left + cW) - pad.left, cH)

    // Cruise zone (primary-tinted)
    if (r.cruiseTimeMin < r.hoverTimeMin) {
      ctx.fillStyle = clrPrimary + '14'
      ctx.fillRect(cruiseEndX, pad.top, hoverEndX - cruiseEndX, cH)
    }

    // Reserve zone (crosshatch with border colour)
    const reserveEndX = xScale(maxTime)
    ctx.save()
    ctx.beginPath()
    ctx.rect(hoverEndX, pad.top, reserveEndX - hoverEndX, cH)
    ctx.clip()
    ctx.strokeStyle = clrBorder
    ctx.lineWidth = 1
    for (let x = hoverEndX; x < reserveEndX + cH; x += 10) {
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x - cH, pad.top + cH); ctx.stroke()
    }
    ctx.restore()

    // Axes
    ctx.strokeStyle = clrBorder
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top)
    ctx.lineTo(pad.left, pad.top + cH)
    ctx.lineTo(pad.left + cW, pad.top + cH)
    ctx.stroke()

    // Y axis labels (voltage)
    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = clrMuted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const yTicks = 5
    for (let i = 0; i <= yTicks; i++) {
      const v = vMin + (vRange * i / yTicks)
      const y = yScale(v)
      ctx.fillText(v.toFixed(1) + 'V', pad.left - 4, y)
      ctx.strokeStyle = clrBorder
      ctx.beginPath(); ctx.moveTo(pad.left - 3, y); ctx.lineTo(pad.left, y); ctx.stroke()
    }

    // X axis labels (minutes)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const xTicks = Math.min(6, Math.floor(maxTime))
    for (let i = 0; i <= xTicks; i++) {
      const t = maxTime * i / xTicks
      const x = xScale(t)
      ctx.fillStyle = clrMuted
      ctx.fillText(t.toFixed(1) + 'm', x, pad.top + cH + 5)
      ctx.strokeStyle = clrBorder
      ctx.beginPath(); ctx.moveTo(x, pad.top + cH); ctx.lineTo(x, pad.top + cH + 3); ctx.stroke()
    }

    // Discharge curve (linear approx)
    const steps = 100
    ctx.beginPath()
    ctx.strokeStyle = clrPrimary
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (let i = 0; i <= steps; i++) {
      const t = maxTime * i / steps
      const pct = Math.min(1, t / r.hoverTimeMin)
      const v = voltageAtDischarge(this.chemistry, pct) * cells
      const x = xScale(t), y = yScale(Math.max(vMin, v))
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Vertical markers
    const drawMarker = (t: number, label: string, color: string) => {
      if (t > maxTime) return
      const x = xScale(t)
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + cH); ctx.stroke()
      ctx.setLineDash([])
      // Badge
      ctx.font = `bold 10px ${fontSans}`
      const bW = ctx.measureText(label).width + 10
      const bH = 16
      const bY = pad.top + 4
      const bX = Math.min(x + 3, pad.left + cW - bW - 2)
      ctx.fillStyle = color + 'dd'
      ctx.beginPath()
      ctx.roundRect(bX, bY, bW, bH, 3)
      ctx.fill()
      ctx.fillStyle = '#000'
      ctx.textAlign = 'left'
      ctx.fillText(label, bX + 5, bY + bH / 2 + 1)
    }

    ctx.textBaseline = 'middle'
    drawMarker(r.hoverTimeMin, `Hover ${r.hoverTimeMin.toFixed(1)}m`, clrInfo)
    if (r.cruiseTimeMin < r.hoverTimeMin) {
      drawMarker(r.cruiseTimeMin, `Cruise ${r.cruiseTimeMin.toFixed(1)}m`, clrPrimary)
    }

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'flight-time-canvas': FlightTimeCanvas }
}
