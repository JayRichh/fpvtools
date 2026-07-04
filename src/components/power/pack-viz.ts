import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import type { SceneNode, Vec3 } from '@core/render/engine2d'

const TAU = Math.PI * 2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function lerpColor(t: number): [number, number, number] {
  const r = t < 0.5 ? Math.round(60 + 195 * t * 2) : 255
  const g = t < 0.5 ? 200 : Math.round(200 * (1 - (t - 0.5) * 2))
  return [r, g, 60]
}

/**
 * 3D battery cell-array view for the pack calculator (engine-based).
 * Hovering a cell shows its S×P grid position, nominal voltage and usage.
 */
@customElement('pack-viz')
export class PackViz extends FpvCanvas {
  @property({ type: Number }) cellCount = 6
  @property({ type: Number }) parallelCount = 1
  @property({ type: Number }) voltagePerCell = 3.7
  @property({ type: Number }) dischargePct = 0

  constructor() {
    super()
    this.initialPitchDeg = -30
    this.initialYawDeg = -38
    this.resetOrbit()
  }

  protected willUpdate(): void {
    // Scale so each cell stays legible: larger packs shrink slightly
    this.sceneScaleFactor = 1.25 / Math.max(this.cellCount, this.parallelCount, 2)
  }

  protected buildScene(f: FrameInfo): SceneNode[] {
    const clrBorder = f.color('--fpv-border', '#2a2a3a')
    const clrText = f.color('--fpv-text', '#e0e0e8')
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')

    const S = Math.max(1, this.cellCount)
    const P = Math.max(1, this.parallelCount)
    const dPct = clamp(this.dischargePct, 0, 1)
    const [cr, cg, cb] = lerpColor(dPct)
    const cellRgb = `${cr},${cg},${cb}`

    // Cell box dimensions in world units
    const cSpacingX = 0.82
    const cSpacingZ = 0.82
    const hw = 0.31   // half-width X
    const hh = 0.58   // half-height Y
    const hd = 0.31   // half-depth Z

    const nodes: SceneNode[] = []

    for (let s = 0; s < S; s++) {
      for (let p = 0; p < P; p++) {
        const wx = (p - (P - 1) / 2) * cSpacingX
        const wz = (s - (S - 1) / 2) * cSpacingZ
        const wy = 0

        const verts: Vec3[] = [
          [wx - hw, wy - hh, wz - hd],
          [wx + hw, wy - hh, wz - hd],
          [wx + hw, wy + hh, wz - hd],
          [wx - hw, wy + hh, wz - hd],
          [wx - hw, wy - hh, wz + hd],
          [wx + hw, wy - hh, wz + hd],
          [wx + hw, wy + hh, wz + hd],
          [wx - hw, wy + hh, wz + hd],
        ]
        const pv = verts.map(v => f.project(v))
        const depth = pv.reduce((acc, v) => acc + v.depth, 0) / pv.length

        // Screen-space bounding ellipse for hover picking
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const v of pv) {
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y)
        }

        // Bus wire connection along series direction
        const busA = s < S - 1 ? f.project([wx, wy + hh, wz + hd]) : null
        const busB = s < S - 1 ? f.project([wx, wy + hh, wz + cSpacingZ - hd]) : null

        nodes.push({
          id: `cell-${s}-${p}`, kind: 'entity', depth,
          meta: {
            label: `Cell S${s + 1}·P${p + 1}`,
            voltage: `${this.voltagePerCell.toFixed(2)} V`,
            series: `${s + 1} of ${S}`,
            parallel: `${p + 1} of ${P}`,
            used: `${Math.round(dPct * 100)}%`,
          },
          hit: {
            type: 'ellipse',
            x: (minX + maxX) / 2, y: (minY + maxY) / 2,
            rx: (maxX - minX) / 2, ry: (maxY - minY) / 2,
          },
          draw: (ctx, { hovered }) => {
            // Draw: top face, then side faces based on camera angle
            const faces = [
              { idxs: [3, 2, 6, 7], bright: 0.65 },  // top
              { idxs: [4, 5, 6, 7], bright: 0.30 },   // front (+Z)
              { idxs: [1, 5, 6, 2], bright: 0.20 },   // right (+X)
            ]

            faces.sort((a, b) => {
              const za = a.idxs.reduce((acc, i) => acc + pv[i].depth, 0) / a.idxs.length
              const zb = b.idxs.reduce((acc, i) => acc + pv[i].depth, 0) / b.idxs.length
              return za - zb
            })

            for (const face of faces) {
              const pts = face.idxs.map(i => pv[i])
              ctx.beginPath()
              ctx.moveTo(pts[0].x, pts[0].y)
              for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y)
              ctx.closePath()
              ctx.fillStyle = `rgba(${cellRgb},${face.bright + (hovered ? 0.12 : 0)})`
              ctx.strokeStyle = `rgba(${cellRgb},0.7)`
              ctx.lineWidth = 0.7
              ctx.fill(); ctx.stroke()
            }

            // Voltage on top face centroid
            const tCx = (pv[3].x + pv[2].x + pv[6].x + pv[7].x) / 4
            const tCy = (pv[3].y + pv[2].y + pv[6].y + pv[7].y) / 4
            const topScale = (pv[3].depth + pv[2].depth + pv[6].depth + pv[7].depth) / 4
            const fs = Math.max(6, Math.min(11, 9 * topScale))
            ctx.font = `bold ${fs}px ${fontMono}`
            ctx.fillStyle = clrText
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(this.voltagePerCell.toFixed(2) + 'V', tCx, tCy)

            if (busA && busB) {
              ctx.beginPath(); ctx.moveTo(busA.x, busA.y); ctx.lineTo(busB.x, busB.y)
              ctx.strokeStyle = clrBorder; ctx.lineWidth = 1.5; ctx.stroke()
            }
          },
        })

        // (+) terminal nub on series-first cell
        if (s === 0 && p === 0) {
          const nub = pv[2]
          const nubR = 3.5 * nub.depth
          nodes.push({
            id: 'terminal-pos', kind: 'entity', depth: depth + 0.001,
            meta: {
              label: 'Pack (+) terminal',
              'pack voltage': `${(this.voltagePerCell * S).toFixed(1)} V`,
              config: `${S}S${P}P`,
            },
            hit: { type: 'circle', x: nub.x, y: nub.y, r: nubR },
            draw: (ctx) => {
              ctx.beginPath(); ctx.arc(nub.x, nub.y, nubR, 0, TAU)
              ctx.fillStyle = clrPrimary; ctx.fill()
            },
          })
        }
      }
    }

    return nodes
  }

  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const { W, H } = f
    const clrBorder = f.color('--fpv-border', '#2a2a3a')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const S = Math.max(1, this.cellCount)
    const P = Math.max(1, this.parallelCount)
    const dPct = clamp(this.dischargePct, 0, 1)
    const [cr, cg, cb] = lerpColor(dPct)
    const cellRgb = `${cr},${cg},${cb}`

    // Pack label
    const packV = this.voltagePerCell * S
    ctx.font = `bold 12px ${fontMono}`
    ctx.fillStyle = clrPrimary
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText(
      `${packV.toFixed(1)}V  ${S}S${P > 1 ? P + 'P' : ''}`,
      W / 2, H - 14
    )

    // Discharge bar
    const barY = H - 10, barH = 5, barW = W * 0.68, barX = (W - barW) / 2
    ctx.fillStyle = clrBorder
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill()
    if (dPct > 0) {
      ctx.fillStyle = `rgb(${cellRgb})`
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * dPct, barH, 3); ctx.fill()
    }
    ctx.font = `9px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(dPct * 100)}% used`, barX - 4, barY + barH / 2)

    // Hint
    ctx.font = `9px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.globalAlpha = 0.4; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText('drag · hover · dbl-click reset', W / 2, H - 20)
    ctx.globalAlpha = 1
  }
}

declare global {
  interface HTMLElementTagNameMap { 'pack-viz': PackViz }
}
