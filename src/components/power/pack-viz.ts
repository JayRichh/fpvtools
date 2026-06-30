import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function lerpColor(t: number): [number, number, number] {
  // green → yellow → red
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

    // ── Isometric layout ─────────────────────────────────────────────────────
    // Each cell is a box. We use a fixed iso step and scale to fit W×H.
    // iso basis vectors:
    //   s direction (series): right+down → (cos30, sin30*0.5)
    //   p direction (parallel): left+down → (-cos30, sin30*0.5)
    // box height: goes upward in screen (negative y)

    const COS30 = Math.cos(Math.PI / 6)
    const SIN30 = Math.sin(Math.PI / 6)

    // Rough cell size fitting: total iso width ≈ (S+P)*COS30*cellW
    const availW = W * 0.88
    const availH = H * 0.72
    const cellW = Math.min(
      availW / ((S + P) * COS30),
      availH / ((S + P) * SIN30 * 0.5 + 1.4),
      38
    )
    const cellH = cellW * 1.4  // cylinder height

    // iso step per cell in each direction
    const stepS  = [ COS30 * cellW,  SIN30 * cellW * 0.5]
    const stepP  = [-COS30 * cellW,  SIN30 * cellW * 0.5]

    // Grid centre in screen space
    // offset so the whole grid is centered
    const gridW_px = (S + P) * COS30 * cellW
    const gridH_px = (S + P) * SIN30 * cellW * 0.5 + cellH
    const ox = W / 2
    const oy = (H - gridH_px) / 2 + cellH * 0.6

    // Draw back-to-front: high s+p index first
    for (let pOuter = P - 1; pOuter >= 0; pOuter--) {
      for (let sOuter = S - 1; sOuter >= 0; sOuter--) {
        const s = sOuter, p = pOuter

        // Screen-space origin of this cell's bottom-centre
        const cx = ox + s * stepS[0] + p * stepP[0]
        const cy = oy + s * stepS[1] + p * stepP[1]

        // 8 corners of the isometric box:
        //  Top face (y-up = -cellH on screen), corners relative to cx,cy
        //  Using iso coords: dx = ±COS30*cellW/2, dy_iso = ±SIN30*cellW/2*0.5
        const hw = COS30 * cellW * 0.46   // half-width in screen x
        const hd = SIN30 * cellW * 0.46   // half-depth contribution

        // Bottom 4 corners (on ground plane)
        const bl = [cx - hw, cy + hd]         // bottom-left
        const br = [cx + hw, cy + hd]         // bottom-right
        const bt = [cx,       cy - hd * 2]    // bottom-top (back)
        const bb = [cx,       cy + hd * 2]    // bottom-bottom (front)

        // Top 4 corners (shifted up by cellH)
        const uH = cellH * 0.95
        const tl = [bl[0], bl[1] - uH]
        const tr = [br[0], br[1] - uH]
        const tt = [bt[0], bt[1] - uH]
        const tb = [bb[0], bb[1] - uH]

        // ── Left face (series side) ──
        ctx.beginPath()
        ctx.moveTo(bl[0], bl[1])
        ctx.lineTo(bt[0], bt[1])
        ctx.lineTo(tt[0], tt[1])
        ctx.lineTo(tl[0], tl[1])
        ctx.closePath()
        ctx.fillStyle = `rgba(${cellRgb},0.12)`
        ctx.strokeStyle = `rgba(${cellRgb},0.5)`
        ctx.lineWidth = 0.8
        ctx.fill(); ctx.stroke()

        // ── Right face (parallel side) ──
        ctx.beginPath()
        ctx.moveTo(br[0], br[1])
        ctx.lineTo(bb[0], bb[1])
        ctx.lineTo(tb[0], tb[1])
        ctx.lineTo(tr[0], tr[1])
        ctx.closePath()
        ctx.fillStyle = `rgba(${cellRgb},0.18)`
        ctx.strokeStyle = `rgba(${cellRgb},0.5)`
        ctx.fill(); ctx.stroke()

        // ── Top face (charged cap) ──
        ctx.beginPath()
        ctx.moveTo(tl[0], tl[1])
        ctx.lineTo(tt[0], tt[1])
        ctx.lineTo(tr[0], tr[1])
        ctx.lineTo(tb[0], tb[1])
        ctx.closePath()
        ctx.fillStyle = `rgba(${cellRgb},${0.55 - dPct * 0.25})`
        ctx.strokeStyle = `rgba(${cellRgb},0.9)`
        ctx.lineWidth = 1
        ctx.fill(); ctx.stroke()

        // Voltage text on top face
        const topCx = (tl[0] + tr[0] + tt[0] + tb[0]) / 4
        const topCy = (tl[1] + tr[1] + tt[1] + tb[1]) / 4

        const fontSize = Math.max(7, Math.min(11, cellW * 0.22))
        ctx.font = `bold ${fontSize}px ${fontMono}`
        ctx.fillStyle = clrText
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.voltagePerCell.toFixed(2) + 'V', topCx, topCy)

        // Positive terminal nub on top
        if (s === 0 && p === 0) {
          ctx.beginPath()
          ctx.arc(tt[0], tt[1] + 3, 3, 0, Math.PI * 2)
          ctx.fillStyle = clrPrimary
          ctx.fill()
        }
      }
    }

    // ── Pack label ─────────────────────────────────────────────────────────────
    const packV = this.voltagePerCell * S
    ctx.font = `bold 12px ${fontMono}`
    ctx.fillStyle = clrPrimary
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(
      `${packV.toFixed(1)}V  ${S}S${P > 1 ? P + 'P' : ''}`,
      W / 2, H - 14
    )

    // ── Discharge bar at bottom ────────────────────────────────────────────────
    const barY = H - 10
    const barW = W * 0.7
    const barH = 5
    const barX = (W - barW) / 2
    ctx.fillStyle = clrBorder
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill()
    if (dPct > 0) {
      ctx.fillStyle = `rgb(${cellRgb})`
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * dPct, barH, 3); ctx.fill()
    }
    ctx.font = `9px ${fontSans}`
    ctx.fillStyle = clrMuted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(dPct * 100)}% used`, barX - 4, barY + barH / 2)

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'pack-viz': PackViz }
}
