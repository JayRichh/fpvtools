import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import type { SceneNode, Vec3 } from '@core/render/engine2d'

const TAU = Math.PI * 2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * 3D thrust/quad view for the motor sizing tool (engine-based). Hovering a
 * motor or its thrust column shows thrust, hover current and max RPM.
 */
@customElement('motor-gauge')
export class MotorGauge extends FpvCanvas {
  @property({ type: Number }) thrustToWeight = 0
  @property({ type: Number }) motorMaxCurrentA = 42
  @property({ type: Number }) motorCount = 4
  @property({ type: Number }) escRatedA = 55
  @property({ type: Number }) thrustPerMotorG = 0
  @property({ type: Number }) hoverCurrentPerMotorA = 0
  @property({ type: Number }) maxRpm = 0

  constructor() {
    super()
    this.initialPitchDeg = -38
    this.initialYawDeg = 18
    this.resetOrbit()
  }

  protected buildScene(f: FrameInfo): SceneNode[] {
    const scale = f.cam.scale
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')
    const clrError = f.color('--fpv-error', '#ff4466')
    const clrBorder = f.color('--fpv-border', '#2a2a3e')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')

    const tw = clamp(this.thrustToWeight, 0, 6)
    const totalPeakA = this.motorMaxCurrentA * this.motorCount
    const escPct = totalPeakA / this.escRatedA
    const escOverloaded = escPct > 0.85
    const motorClr = escPct > 0.85 ? clrError : escPct > 0.70 ? clrAccent : clrPrimary
    const thrustH = clamp(tw / 5, 0, 1.1)

    const groundY = -0.45
    const armLen = 0.95
    const motorPos: Vec3[] = [
      [-armLen * 0.707, 0, -armLen * 0.707],
      [ armLen * 0.707, 0, -armLen * 0.707],
      [-armLen * 0.707, 0,  armLen * 0.707],
      [ armLen * 0.707, 0,  armLen * 0.707],
    ]
    const cp = f.project([0, 0, 0])

    const motorMeta = (i: number) => ({
      label: `Motor M${i + 1}`,
      thrust: `${this.thrustPerMotorG.toFixed(0)} g`,
      'hover current': `${this.hoverCurrentPerMotorA.toFixed(1)} A`,
      'max current': `${this.motorMaxCurrentA.toFixed(0)} A`,
      'max rpm': this.maxRpm ? this.maxRpm.toLocaleString() : '—',
    })

    const nodes: SceneNode[] = []

    // Ground grid + drop shadow
    nodes.push({
      id: 'grid', kind: 'grid', depth: -100,
      draw: (ctx) => {
        ctx.globalAlpha = 0.1
        ctx.strokeStyle = clrMuted
        ctx.lineWidth = 0.5
        for (let i = -4; i <= 4; i++) {
          const t = (i / 4) * 1.4
          const a = f.project([t, groundY, -1.4]), b = f.project([t, groundY, 1.4])
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          const c = f.project([-1.4, groundY, t]), d = f.project([1.4, groundY, t])
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
        }
        ctx.globalAlpha = 0.07
        ctx.fillStyle = motorClr
        const gcp = f.project([0, groundY, 0])
        ctx.beginPath()
        ctx.ellipse(gcp.x, gcp.y, scale * 0.42, scale * 0.16, 0, 0, TAU)
        ctx.fill()
        ctx.globalAlpha = 1
      },
    })

    // Arms
    for (let i = 0; i < 4; i++) {
      const mp = f.project(motorPos[i])
      nodes.push({
        id: `arm-${i}`, kind: 'entity', depth: (cp.depth + mp.depth) / 2,
        draw: (ctx) => {
          ctx.beginPath()
          ctx.moveTo(cp.x, cp.y); ctx.lineTo(mp.x, mp.y)
          ctx.strokeStyle = clrBorder
          ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke()
        },
      })
    }

    // Body
    nodes.push({
      id: 'body', kind: 'entity', depth: cp.depth,
      meta: {
        label: 'Airframe',
        'thrust:weight': `${tw.toFixed(2)} : 1`,
        motors: `${this.motorCount}`,
      },
      hit: { type: 'circle', x: cp.x, y: cp.y, r: 0.16 * scale * cp.depth },
      draw: (ctx) => {
        ctx.beginPath()
        ctx.arc(cp.x, cp.y, 0.16 * scale * cp.depth, 0, TAU)
        ctx.fillStyle = clrBorder; ctx.fill()
        const front = f.project([0, 0, -0.22])
        ctx.beginPath(); ctx.moveTo(cp.x, cp.y); ctx.lineTo(front.x, front.y)
        ctx.strokeStyle = clrPrimary; ctx.lineWidth = 2; ctx.stroke()
      },
    })

    // Motors + thrust columns
    for (let i = 0; i < 4; i++) {
      const mBase = motorPos[i]
      const mp = f.project(mBase)
      const discR = 0.28 * scale * mp.depth

      if (thrustH > 0.01) {
        const tp = f.project([mBase[0], mBase[1] + thrustH, mBase[2]])
        nodes.push({
          id: `thrust-${i}`, kind: 'vector', depth: mp.depth + 0.001,
          meta: motorMeta(i),
          hit: { type: 'segment', x1: mp.x, y1: mp.y, x2: tp.x, y2: tp.y, width: 7 * mp.depth },
          draw: (ctx, { hovered }) => {
            const grad = ctx.createLinearGradient(mp.x, mp.y, tp.x, tp.y)
            grad.addColorStop(0, motorClr + 'cc')
            grad.addColorStop(1, motorClr + (hovered ? '55' : '11'))
            ctx.beginPath(); ctx.moveTo(mp.x, mp.y); ctx.lineTo(tp.x, tp.y)
            ctx.strokeStyle = grad
            ctx.lineWidth = 7 * mp.depth
            ctx.lineCap = 'round'; ctx.stroke()
            ctx.beginPath()
            ctx.arc(tp.x, tp.y, 4 * mp.depth, 0, TAU)
            ctx.fillStyle = motorClr; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1
          },
        })
      }

      nodes.push({
        id: `motor-${i}`, kind: 'entity', depth: mp.depth,
        meta: motorMeta(i),
        hit: { type: 'ellipse', x: mp.x, y: mp.y, rx: discR * 1.2, ry: discR * 0.42 },
        draw: (ctx, { hovered }) => {
          // ESC ring
          ctx.beginPath()
          ctx.ellipse(mp.x, mp.y, discR * 1.2, discR * 0.42, 0, 0, TAU)
          ctx.strokeStyle = motorClr + (escOverloaded ? 'cc' : hovered ? '99' : '55')
          ctx.lineWidth = 2.5; ctx.stroke()

          // Prop disc
          ctx.beginPath()
          ctx.ellipse(mp.x, mp.y, discR, discR * 0.32, 0, 0, TAU)
          ctx.fillStyle = motorClr + (hovered ? '30' : '18')
          ctx.strokeStyle = motorClr + '55'
          ctx.lineWidth = 1; ctx.fill(); ctx.stroke()

          // Motor hub
          ctx.beginPath()
          ctx.arc(mp.x, mp.y, 0.065 * scale * mp.depth, 0, TAU)
          ctx.fillStyle = motorClr; ctx.fill()
        },
      })
    }

    return nodes
  }

  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const { W, H } = f
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrSuccess = f.color('--fpv-success', '#44cc88')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')
    const clrError = f.color('--fpv-error', '#ff4466')
    const clrBorder = f.color('--fpv-border', '#2a2a3e')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const tw = clamp(this.thrustToWeight, 0, 6)
    const totalPeakA = this.motorMaxCurrentA * this.motorCount
    const escPct = totalPeakA / this.escRatedA
    const escOverloaded = escPct > 0.85
    const motorClr = escPct > 0.85 ? clrError : escPct > 0.70 ? clrAccent : clrPrimary

    // ── Compact arc meters (bottom corners) ──
    const mR = Math.min(W * 0.13, H * 0.15, 42)
    const startA = Math.PI * 0.75, sweepA = Math.PI * 1.5

    // T:W (left)
    const ax1 = mR + 16, ay1 = H - mR - 12
    ctx.beginPath(); ctx.arc(ax1, ay1, mR, startA, startA + sweepA)
    ctx.strokeStyle = clrBorder; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke()
    const twClr = tw >= 2 ? clrSuccess : tw >= 1.2 ? clrAccent : clrError
    if (tw > 0) {
      ctx.beginPath(); ctx.arc(ax1, ay1, mR, startA, startA + sweepA * clamp(tw / 4, 0, 1))
      ctx.strokeStyle = twClr; ctx.lineWidth = 5; ctx.stroke()
    }
    ctx.font = `bold 12px ${fontMono}`; ctx.fillStyle = twClr
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${tw.toFixed(1)}×`, ax1, ay1 - 2)
    ctx.font = `8px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.fillText('T:W', ax1, ay1 + 11)
    // target zone
    ctx.beginPath(); ctx.arc(ax1, ay1, mR + 2, startA + sweepA * (2 / 4), startA + sweepA * (3 / 4))
    ctx.strokeStyle = clrSuccess + '44'; ctx.lineWidth = 2; ctx.stroke()

    // ESC load (right)
    const ax2 = W - mR - 16, ay2 = H - mR - 12
    ctx.beginPath(); ctx.arc(ax2, ay2, mR, startA, startA + sweepA)
    ctx.strokeStyle = clrBorder; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke()
    const escFrac = clamp(escPct, 0, 1.5) / 1.5
    if (escFrac > 0) {
      ctx.beginPath(); ctx.arc(ax2, ay2, mR, startA, startA + sweepA * escFrac)
      ctx.strokeStyle = motorClr; ctx.lineWidth = 5; ctx.stroke()
    }
    ctx.font = `bold 11px ${fontMono}`; ctx.fillStyle = motorClr
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${totalPeakA.toFixed(0)}A`, ax2, ay2 - 2)
    ctx.font = `8px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.fillText(`/${this.escRatedA}A`, ax2, ay2 + 11)

    if (escOverloaded) {
      ctx.font = `bold 9px ${fontSans}`; ctx.fillStyle = clrError
      ctx.textAlign = 'center'
      ctx.fillText('OVERLOAD', ax2, ay2 + mR + 10)
    }

    // Hint
    ctx.font = `9px ${fontSans}`; ctx.fillStyle = clrMuted
    ctx.globalAlpha = 0.4; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText('drag · hover · dbl-click reset', W / 2, H - 2)
    ctx.globalAlpha = 1
  }
}

declare global {
  interface HTMLElementTagNameMap { 'motor-gauge': MotorGauge }
}
