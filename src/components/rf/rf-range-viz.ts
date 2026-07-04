import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import type { SceneNode } from '@core/render/engine2d'

const TAU = Math.PI * 2
const LEGEND_H = 50
const RING_SEGMENTS = 72

/** Ring outline as a screen-space polyline (matches the stroked circle). */
function ringPoints(cx: number, cy: number, r: number): Array<readonly [number, number]> {
  const pts: Array<readonly [number, number]> = []
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * TAU
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

/**
 * Top-down range comparison for control vs video links (engine-based).
 * Hovering a range ring shows the link's label, range and margin.
 */
@customElement('rf-range-viz')
export class RfRangeViz extends FpvCanvas {
  @property({ type: Number }) primaryRangeKm = 0
  @property({ type: Number }) primaryMarginDb = 0
  @property({ type: String }) primaryLabel = 'Control'
  @property({ type: Number }) secondaryRangeKm = 0
  @property({ type: Number }) secondaryMarginDb = 0
  @property({ type: String }) secondaryLabel = 'Video'
  @property({ type: Boolean }) dualLink = false

  protected orbitEnabled = false

  private _marginColor(margin: number, clrSuccess: string, clrAccent: string, clrError: string): string {
    if (margin >= 15) return clrSuccess
    if (margin >= 6) return clrAccent
    return clrError
  }

  private _maxRange(): number {
    return this.dualLink
      ? Math.max(this.primaryRangeKm, this.secondaryRangeKm)
      : this.primaryRangeKm
  }

  protected buildScene(f: FrameInfo): SceneNode[] {
    const clrSuccess = f.color('--fpv-success', '#44cc88')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')
    const clrError = f.color('--fpv-error', '#ff4466')
    const clrText = f.color('--fpv-text', '#e0e0e8')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const cx = f.W / 2, cy = (f.H - LEGEND_H) / 2
    const maxRange = this._maxRange()

    if (maxRange <= 0) {
      return [{
        id: 'empty', kind: 'label', depth: 0,
        draw: (ctx) => {
          ctx.fillStyle = clrMuted
          ctx.font = `13px ${fontSans}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('Enter link parameters to see range', cx, cy)
        },
      }]
    }

    const maxR = Math.min(cx - 16, cy - 16)
    const primaryR = (this.primaryRangeKm / maxRange) * maxR
    const primaryColor = this._marginColor(this.primaryMarginDb, clrSuccess, clrAccent, clrError)

    const linkMeta = (label: string, rangeKm: number, marginDb: number) => ({
      label,
      range: `${rangeKm.toFixed(2)} km`,
      margin: `${marginDb > 0 ? '+' : ''}${marginDb.toFixed(1)} dB`,
    })

    const nodes: SceneNode[] = []

    // Primary range ring
    nodes.push({
      id: 'primary-ring', kind: 'chart', depth: 0,
      meta: linkMeta(this.primaryLabel, this.primaryRangeKm, this.primaryMarginDb),
      hit: { type: 'polyline', points: ringPoints(cx, cy, primaryR), width: 10 },
      draw: (ctx, { hovered }) => {
        ctx.beginPath()
        ctx.arc(cx, cy, primaryR, 0, TAU)
        ctx.fillStyle = primaryColor + (hovered ? '22' : '15')
        ctx.fill()
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = hovered ? 2.5 : 2
        ctx.stroke()
      },
    })

    // Secondary range ring (if dual link)
    if (this.dualLink && this.secondaryRangeKm > 0) {
      const secR = (this.secondaryRangeKm / maxRange) * maxR
      const secColor = this._marginColor(this.secondaryMarginDb, clrSuccess, clrAccent, clrError)
      nodes.push({
        id: 'secondary-ring', kind: 'chart', depth: 1,
        meta: linkMeta(this.secondaryLabel, this.secondaryRangeKm, this.secondaryMarginDb),
        hit: { type: 'polyline', points: ringPoints(cx, cy, secR), width: 10 },
        draw: (ctx, { hovered }) => {
          ctx.beginPath()
          ctx.arc(cx, cy, secR, 0, TAU)
          ctx.fillStyle = secColor + (hovered ? '18' : '10')
          ctx.fill()
          ctx.strokeStyle = clrAccent
          ctx.lineWidth = hovered ? 2 : 1.5
          ctx.setLineDash([5, 3])
          ctx.stroke()
          ctx.setLineDash([])
        },
      })
    }

    // Centre dot (pilot position)
    nodes.push({
      id: 'centre', kind: 'entity', depth: 2,
      draw: (ctx) => {
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU)
        ctx.fillStyle = clrText; ctx.fill()
      },
    })

    return nodes
  }

  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const { W, H } = f
    const maxRange = this._maxRange()
    if (maxRange <= 0) return

    const clrSuccess = f.color('--fpv-success', '#44cc88')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')
    const clrError = f.color('--fpv-error', '#ff4466')
    const clrText = f.color('--fpv-text', '#e0e0e8')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const cx = W / 2, cy = (H - LEGEND_H) / 2
    const maxR = Math.min(cx - 16, cy - 16)
    const primaryColor = this._marginColor(this.primaryMarginDb, clrSuccess, clrAccent, clrError)

    // Scale bar (bottom left)
    const scaleBarKm = maxRange > 10 ? Math.round(maxRange / 3) : Math.round(maxRange / 3 * 10) / 10
    const scaleBarPx = (scaleBarKm / maxRange) * maxR
    const sbX = 14, sbY = H - LEGEND_H - 14
    ctx.strokeStyle = clrMuted; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + scaleBarPx, sbY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sbX, sbY - 4); ctx.lineTo(sbX, sbY + 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sbX + scaleBarPx, sbY - 4); ctx.lineTo(sbX + scaleBarPx, sbY + 4); ctx.stroke()
    ctx.font = `10px ${fontMono}`; ctx.fillStyle = clrMuted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText(`${scaleBarKm} km`, sbX, sbY - 5)

    // Legend
    const legY = H - LEGEND_H + 10
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
  }
}

declare global {
  interface HTMLElementTagNameMap { 'rf-range-viz': RfRangeViz }
}
