import { css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import type { SceneNode } from '@core/render/engine2d'
import type { FlightTimeResult } from '@core/flighttime/types.js'
import { voltageAtDischarge } from '@core/flighttime/calculate.js'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Pack discharge chart for the flight time tool (engine-based). Hovering the
 * discharge curve shows time / pack voltage / remaining capacity at the
 * pointer; the hover and cruise markers carry their endurance numbers.
 */
@customElement('flight-time-canvas')
export class FlightTimeCanvas extends FpvCanvas {
  static styles = [
    ...FpvCanvas.styles,
    css`:host { min-height: 220px; }`,
  ]

  @property({ type: Object }) result: FlightTimeResult | null = null
  @property({ type: String }) chemistry: 'lipo' | 'liion' = 'liion'
  @property({ type: Number }) cellCount = 6

  constructor() {
    super()
    this.orbitEnabled = false
  }

  /** Chart geometry shared by the scene and the axis overlay. */
  private _layout(f: FrameInfo) {
    const r = this.result!
    const pad = { top: 20, right: 20, bottom: 40, left: 52 }
    const cW = f.W - pad.left - pad.right
    const cH = f.H - pad.top - pad.bottom

    // Time range: 0 → hoverTime + 20%
    const maxTime = r.hoverTimeMin * 1.2
    const cells = this.cellCount
    const [vMin, vMax] = this.chemistry === 'lipo' ? [3.0 * cells, 4.2 * cells] : [2.8 * cells, 4.2 * cells]
    const vRange = vMax - vMin

    const xScale = (t: number) => pad.left + (t / maxTime) * cW
    const yScale = (v: number) => pad.top + (1 - (v - vMin) / vRange) * cH
    return { pad, cW, cH, maxTime, cells, vMin, vRange, xScale, yScale }
  }

  protected buildScene(f: FrameInfo): SceneNode[] {
    const r = this.result
    if (!r) return []

    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrInfo = f.color('--fpv-info', '#4488ff')
    const clrBorder = f.color('--fpv-border', '#2a2a3a')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const { pad, cW, cH, maxTime, cells, vMin, xScale, yScale } = this._layout(f)
    const nodes: SceneNode[] = []

    const hoverEndX = xScale(r.hoverTimeMin)
    const cruiseEndX = xScale(Math.min(r.cruiseTimeMin, maxTime))
    const reserveEndX = xScale(maxTime)

    // Zone fills (hover / cruise / reserve crosshatch)
    nodes.push({
      id: 'zones', kind: 'chart', depth: 0,
      draw: (ctx) => {
        // Hover zone (blue-tinted)
        ctx.fillStyle = clrInfo + '18'
        ctx.fillRect(pad.left, pad.top, Math.min(hoverEndX, pad.left + cW) - pad.left, cH)

        // Cruise zone (primary-tinted)
        if (r.cruiseTimeMin < r.hoverTimeMin) {
          ctx.fillStyle = clrPrimary + '14'
          ctx.fillRect(cruiseEndX, pad.top, hoverEndX - cruiseEndX, cH)
        }

        // Reserve zone (crosshatch with border colour)
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
      },
    })

    // Discharge curve (linear approx) with a pointer-tracked readout
    const steps = 100
    const curvePts: [number, number][] = []
    for (let i = 0; i <= steps; i++) {
      const t = maxTime * i / steps
      const pct = Math.min(1, t / r.hoverTimeMin)
      const v = voltageAtDischarge(this.chemistry, pct) * cells
      curvePts.push([xScale(t), yScale(Math.max(vMin, v))])
    }
    const curveMeta: Record<string, unknown> = { label: 'Discharge curve' }
    let dotX = 0, dotY = 0
    if (this.pointerPos) {
      const t = clamp((this.pointerPos.x - pad.left) / cW, 0, 1) * maxTime
      const pct = Math.min(1, t / r.hoverTimeMin)
      const v = Math.max(vMin, voltageAtDischarge(this.chemistry, pct) * cells)
      curveMeta.time = `${t.toFixed(1)} min`
      curveMeta['pack voltage'] = `${v.toFixed(2)} V`
      curveMeta['per cell'] = `${(v / cells).toFixed(2)} V`
      curveMeta.remaining = `${(r.usableCapacityMah * (1 - pct)).toFixed(0)} mAh`
      dotX = xScale(t); dotY = yScale(v)
    }
    nodes.push({
      id: 'discharge-curve', kind: 'chart', depth: 2,
      meta: curveMeta,
      hit: { type: 'polyline', points: curvePts, width: 9 },
      draw: (ctx, { hovered }) => {
        ctx.beginPath()
        curvePts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
        ctx.strokeStyle = clrPrimary
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.stroke()
        if (hovered && this.pointerPos) {
          ctx.beginPath()
          ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = clrPrimary
          ctx.fill()
        }
      },
    })

    // Vertical markers
    const marker = (
      id: string, t: number, label: string, color: string, meta: Record<string, unknown>,
    ) => {
      if (t > maxTime) return
      const x = xScale(t)
      nodes.push({
        id, kind: 'chart', depth: 3,
        meta,
        hit: { type: 'segment', x1: x, y1: pad.top, x2: x, y2: pad.top + cH, width: 8 },
        draw: (ctx) => {
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
          ctx.textBaseline = 'middle'
          ctx.fillText(label, bX + 5, bY + bH / 2 + 1)
        },
      })
    }

    marker('hover-marker', r.hoverTimeMin, `Hover ${r.hoverTimeMin.toFixed(1)}m`, clrInfo, {
      label: 'Hover endurance',
      time: `${r.hoverTimeMin.toFixed(1)} min`,
      current: `${r.hoverCurrentA.toFixed(1)} A`,
      'C-rate': `${r.packDischargeC.toFixed(1)}C`,
      reserve: `${r.reserveCapacityMah.toFixed(0)} mAh`,
    })
    if (r.cruiseTimeMin < r.hoverTimeMin) {
      marker('cruise-marker', r.cruiseTimeMin, `Cruise ${r.cruiseTimeMin.toFixed(1)}m`, clrPrimary, {
        label: 'Cruise endurance',
        time: `${r.cruiseTimeMin.toFixed(1)} min`,
        current: `${r.cruiseCurrentA.toFixed(1)} A`,
        range: `${r.maxRangeKm.toFixed(2)} km`,
      })
    }

    return nodes
  }

  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const clrBorder = f.color('--fpv-border', '#2a2a3a')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    if (!this.result) {
      ctx.fillStyle = clrMuted
      ctx.font = `13px ${fontSans}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Enter inputs to see discharge curve', f.W / 2, f.H / 2)
      return
    }

    const { pad, cW, cH, maxTime, vMin, vRange, xScale, yScale } = this._layout(f)

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
  }
}

declare global {
  interface HTMLElementTagNameMap { 'flight-time-canvas': FlightTimeCanvas }
}
