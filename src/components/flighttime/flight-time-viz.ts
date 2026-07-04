import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import type { SceneNode, Vec3 } from '@core/render/engine2d'
import type { FlightTimeResult } from '@core/flighttime/types.js'

const TAU = Math.PI * 2

/**
 * 3D flight-range view for the flight time tool (engine-based). Hovering the
 * range rings, forward path, range marker or airframe shows the endurance
 * numbers behind each element.
 */
@customElement('flight-time-viz')
export class FlightTimeViz extends FpvCanvas {
  @property({ type: Object }) result: FlightTimeResult | null = null
  @property({ type: String }) chemistry: 'lipo' | 'liion' = 'liion'
  @property({ type: Number }) cellCount = 6

  protected buildScene(f: FrameInfo): SceneNode[] {
    const scale = f.cam.scale
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrBorder = f.color('--fpv-border', '#2a2a3e')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')
    const clrInfo = f.color('--fpv-info', '#4488ff')
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')

    const groundY = -0.55
    const res = this.result
    const nodes: SceneNode[] = []

    // Ground grid
    nodes.push({
      id: 'grid', kind: 'grid', depth: -100,
      draw: (ctx) => {
        ctx.globalAlpha = 0.11
        ctx.strokeStyle = clrMuted
        ctx.lineWidth = 0.5
        for (let i = -5; i <= 5; i++) {
          const t = (i / 5) * 2.0
          const a = f.project([t, groundY, -2.0]), b = f.project([t, groundY, 2.0])
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          const c = f.project([-2.0, groundY, t]), d = f.project([2.0, groundY, t])
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
        }
        ctx.globalAlpha = 1
      },
    })

    // ── Range rings on ground ───────────────────────────────────────────────
    if (res) {
      const ringRadius = 0.85
      const N = 48
      const ringPts = (radius: number): [number, number][] => {
        const pts: [number, number][] = []
        for (let i = 0; i <= N; i++) {
          const angle = (i / N) * TAU - Math.PI * 0.5
          const sp = f.project([Math.cos(angle) * radius, groundY, Math.sin(angle) * radius])
          pts.push([sp.x, sp.y])
        }
        return pts
      }

      // Outer ring: max range (+ spokes and km label)
      const outerPts = ringPts(ringRadius)
      nodes.push({
        id: 'range-ring', kind: 'chart', depth: -50,
        meta: {
          label: 'Max range',
          range: `${res.maxRangeKm.toFixed(2)} km`,
          'cruise time': `${res.cruiseTimeMin.toFixed(1)} min`,
        },
        hit: { type: 'polyline', points: outerPts, width: 6 },
        draw: (ctx, { hovered }) => {
          ctx.beginPath()
          outerPts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
          ctx.closePath()
          ctx.strokeStyle = clrPrimary + (hovered ? '99' : '55')
          ctx.lineWidth = 1.5
          ctx.stroke()

          // Radial spokes every 90°
          ctx.strokeStyle = clrPrimary + '22'
          ctx.lineWidth = 0.8
          const origin = f.project([0, groundY, 0])
          for (const a of [0, 0.5, 1, 1.5].map((k) => k * Math.PI)) {
            const edge = f.project([
              Math.cos(a - Math.PI * 0.5) * ringRadius, groundY, Math.sin(a - Math.PI * 0.5) * ringRadius,
            ])
            ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(edge.x, edge.y); ctx.stroke()
          }

          // Range label near ring (forward-most point)
          const fwdP = f.project([0, groundY, -ringRadius])
          ctx.font = `bold 10px ${fontMono}`
          ctx.fillStyle = clrPrimary
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText(`${res.maxRangeKm.toFixed(2)} km`, fwdP.x, fwdP.y - 3)
        },
      })

      // Cruise ring (shorter ring if cruise != hover)
      if (res.cruiseTimeMin < res.hoverTimeMin * 0.95) {
        const cruisePts = ringPts(ringRadius * (res.cruiseTimeMin / res.hoverTimeMin))
        nodes.push({
          id: 'cruise-ring', kind: 'chart', depth: -49,
          meta: {
            label: 'Cruise endurance',
            'cruise time': `${res.cruiseTimeMin.toFixed(1)} min`,
            'vs hover': `${((res.cruiseTimeMin / res.hoverTimeMin) * 100).toFixed(0)} %`,
          },
          hit: { type: 'polyline', points: cruisePts, width: 6 },
          draw: (ctx, { hovered }) => {
            ctx.beginPath()
            cruisePts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
            ctx.closePath()
            ctx.strokeStyle = clrInfo + (hovered ? '77' : '45')
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.stroke()
            ctx.setLineDash([])
          },
        })
      }

      // Forward path from quad to ring edge
      const qbP = f.project([0, groundY + 0.1, 0])
      const rfP = f.project([0, groundY, -ringRadius])
      nodes.push({
        id: 'flight-path', kind: 'vector', depth: -48,
        meta: {
          label: 'Forward flight path',
          range: `${res.maxRangeKm.toFixed(2)} km`,
          'cruise time': `${res.cruiseTimeMin.toFixed(1)} min`,
        },
        hit: { type: 'segment', x1: qbP.x, y1: qbP.y, x2: rfP.x, y2: rfP.y, width: 6 },
        draw: (ctx, { hovered }) => {
          ctx.beginPath()
          ctx.moveTo(qbP.x, qbP.y)
          ctx.lineTo(rfP.x, rfP.y)
          ctx.strokeStyle = clrAccent + (hovered ? '99' : '60')
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 3])
          ctx.stroke()
          ctx.setLineDash([])
        },
      })

      // Arrow tip at ring (max-range marker)
      nodes.push({
        id: 'range-marker', kind: 'entity', depth: -47,
        meta: { label: 'Max range', range: `${res.maxRangeKm.toFixed(2)} km` },
        hit: { type: 'circle', x: rfP.x, y: rfP.y, r: 6 },
        draw: (ctx) => {
          ctx.beginPath()
          ctx.arc(rfP.x, rfP.y, 3, 0, TAU)
          ctx.fillStyle = clrAccent
          ctx.fill()
        },
      })
    }

    // ── Quad X-frame ────────────────────────────────────────────────────────
    const quadY = 0.15
    const armLen = 0.95
    const motorPos: Vec3[] = [
      [-armLen * 0.707, quadY, -armLen * 0.707],
      [ armLen * 0.707, quadY, -armLen * 0.707],
      [-armLen * 0.707, quadY,  armLen * 0.707],
      [ armLen * 0.707, quadY,  armLen * 0.707],
    ]
    const cp = f.project([0, quadY, 0])

    // Arms
    for (let i = 0; i < 4; i++) {
      const mp = f.project(motorPos[i])
      nodes.push({
        id: `arm-${i}`, kind: 'entity', depth: (cp.depth + mp.depth) / 2,
        draw: (ctx) => {
          ctx.beginPath()
          ctx.moveTo(cp.x, cp.y)
          ctx.lineTo(mp.x, mp.y)
          ctx.strokeStyle = clrBorder
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.stroke()
        },
      })
    }

    // Body
    nodes.push({
      id: 'body', kind: 'entity', depth: cp.depth,
      meta: res ? {
        label: 'Airframe',
        'hover time': `${res.hoverTimeMin.toFixed(1)} min`,
        'cruise time': `${res.cruiseTimeMin.toFixed(1)} min`,
        pack: `${this.cellCount}S ${this.chemistry.toUpperCase()}`,
      } : undefined,
      hit: res ? { type: 'circle', x: cp.x, y: cp.y, r: 0.16 * scale * cp.depth } : undefined,
      draw: (ctx) => {
        ctx.beginPath()
        ctx.arc(cp.x, cp.y, 0.16 * scale * cp.depth, 0, TAU)
        ctx.fillStyle = clrBorder
        ctx.fill()
      },
    })

    // Motor hubs + prop discs
    for (let i = 0; i < 4; i++) {
      const mp = f.project(motorPos[i])
      nodes.push({
        id: `motor-${i}`, kind: 'entity', depth: mp.depth,
        draw: (ctx) => {
          const discR = 0.3 * scale * mp.depth
          ctx.beginPath()
          ctx.ellipse(mp.x, mp.y, discR, discR * 0.35, 0, 0, TAU)
          ctx.fillStyle = clrMuted + '18'
          ctx.strokeStyle = clrMuted + '45'
          ctx.lineWidth = 1
          ctx.fill(); ctx.stroke()
          ctx.beginPath()
          ctx.arc(mp.x, mp.y, 0.07 * scale * mp.depth, 0, TAU)
          ctx.fillStyle = clrMuted
          ctx.fill()
        },
      })
    }

    // Vertical "shadow" line from quad to ground (drawn on top of the frame)
    const gcp = f.project([0, groundY, 0])
    nodes.push({
      id: 'shadow', kind: 'entity', depth: 10,
      draw: (ctx) => {
        ctx.beginPath()
        ctx.moveTo(cp.x, cp.y)
        ctx.lineTo(gcp.x, gcp.y)
        ctx.strokeStyle = clrMuted + '30'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      },
    })

    return nodes
  }

  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const { W, H } = f
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const clrInfo = f.color('--fpv-info', '#4488ff')
    const clrText = f.color('--fpv-text', '#e0e0e8')
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const res = this.result
    if (res) {
      const pad = 12
      const lineH = 18

      // Hover time badge (top-left)
      ctx.font = `bold 12px ${fontMono}`
      const htLabel = `${res.hoverTimeMin.toFixed(1)}m`
      const htW = ctx.measureText(htLabel).width + 20
      ctx.fillStyle = clrInfo + 'cc'
      ctx.beginPath(); ctx.roundRect(pad, pad, htW, 22, 4); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(htLabel, pad + 10, pad + 11)
      ctx.font = `9px ${fontSans}`
      ctx.fillStyle = clrInfo
      ctx.fillText('HOVER', pad, pad + 11 + lineH)

      // Cruise time badge (top-left, below hover)
      const ctLabel = `${res.cruiseTimeMin.toFixed(1)}m`
      const ctW = ctx.measureText(htLabel).width + 20
      ctx.font = `bold 12px ${fontMono}`
      const badgeY2 = pad + lineH * 2.4
      ctx.fillStyle = clrPrimary + 'cc'
      ctx.beginPath(); ctx.roundRect(pad, badgeY2, ctW, 22, 4); ctx.fill()
      ctx.fillStyle = '#000'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(ctLabel, pad + 10, badgeY2 + 11)
      ctx.font = `9px ${fontSans}`
      ctx.fillStyle = clrPrimary
      ctx.fillText('CRUISE', pad, badgeY2 + 11 + lineH)

      // Pack info (top-right)
      ctx.font = `11px ${fontMono}`
      ctx.fillStyle = clrText
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(`${this.cellCount}S ${this.chemistry.toUpperCase()}`, W - pad, pad)
      ctx.font = `10px ${fontSans}`
      ctx.fillStyle = clrMuted
      ctx.fillText(`${res.usableCapacityMah.toFixed(0)} mAh`, W - pad, pad + 14)
      ctx.fillText(`${res.packDischargeC.toFixed(1)}C hover`, W - pad, pad + 27)
    } else {
      ctx.font = `13px ${fontSans}`
      ctx.fillStyle = clrMuted
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Enter inputs to see flight range', W / 2, H / 2 + 40)
    }

    // Hint
    ctx.font = `9px ${fontSans}`
    ctx.fillStyle = clrMuted
    ctx.globalAlpha = 0.4
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('drag · hover · dbl-click reset', W / 2, H - 2)
    ctx.globalAlpha = 1
  }
}

declare global {
  interface HTMLElementTagNameMap { 'flight-time-viz': FlightTimeViz }
}
