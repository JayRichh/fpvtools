import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

const TAU = Math.PI * 2

@customElement('build-progress')
export class BuildProgress extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
        min-height: 100px;
        position: relative;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0; left: 0;
      }
    `,
  ]

  @property({ type: Number }) total = 0
  @property({ type: Number }) spent = 0
  @property({ type: Number }) itemCount = 0
  @property({ type: Number }) boughtCount = 0

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
    const w = this.offsetWidth
    const h = this.offsetHeight
    if (!w || !h) return
    this._canvas.width = Math.round(w * dpr)
    this._canvas.height = Math.round(h * dpr)
    this._dirty = true
  }

  private _draw() {
    const ctx = this._ctx
    const canvas = this._canvas
    if (!ctx || !canvas.width) return

    const dpr = window.devicePixelRatio || 1
    const W = canvas.width / dpr
    const H = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const cs = getComputedStyle(this)
    const get = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb
    const clrPrimary = get('--fpv-primary', '#00d4aa')
    const clrBorder = get('--fpv-border', '#2a2a3a')
    const clrText = get('--fpv-text', '#e0e0e8')
    const clrMuted = get('--fpv-text-muted', '#8888a0')
    const clrSuccess = get('--fpv-success', '#44cc88')
    const fontMono = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const cx = W / 2
    const cy = H / 2
    const r = Math.min(cx, cy) - 12
    const pct = this.total > 0 ? Math.min(1, this.spent / this.total) : 0

    // Background arc
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU)
    ctx.strokeStyle = clrBorder
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.stroke()

    // Progress arc
    if (pct > 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * pct)
      ctx.strokeStyle = clrPrimary
      ctx.lineWidth = 8
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Center text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold 18px ${fontMono}`
    ctx.fillStyle = clrText
    ctx.fillText(`${Math.round(pct * 100)}%`, cx, cy - 8)

    ctx.font = `10px ${fontSans}`
    ctx.fillStyle = clrMuted
    ctx.fillText(`${this.boughtCount}/${this.itemCount} items`, cx, cy + 10)

    // Item progress dots ring (if items > 0)
    if (this.itemCount > 0) {
      const dotR = r + 16
      const step = TAU / this.itemCount
      for (let i = 0; i < this.itemCount; i++) {
        const angle = -Math.PI / 2 + step * i
        const dx = cx + Math.cos(angle) * dotR
        const dy = cy + Math.sin(angle) * dotR
        ctx.beginPath()
        ctx.arc(dx, dy, 3, 0, TAU)
        ctx.fillStyle = i < this.boughtCount ? clrSuccess : clrBorder
        ctx.fill()
      }
    }

    ctx.restore()
  }

  render() {
    return html`<canvas></canvas>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'build-progress': BuildProgress
  }
}
