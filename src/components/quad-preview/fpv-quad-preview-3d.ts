import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import { rotX, rotY, rotZ } from '@core/render/engine2d'
import type { SceneNode, Vec3, Projected } from '@core/render/engine2d'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const DEG = Math.PI / 180
const TAU = Math.PI * 2

const MOTOR_LABELS = ['M1 front-left', 'M2 front-right', 'M3 rear-left', 'M4 rear-right']

/**
 * 3D quad preview — reference consumer of the render engine
 * (src/core/render + FpvCanvas). Orbit, depth-sort, hover metadata and
 * outline come from the engine; this component only builds the scene.
 */
@customElement('fpv-quad-preview-3d')
export class FpvQuadPreview3d extends FpvCanvas {
  @property({ type: Array })   motorOutputs: number[] = [0, 0, 0, 0]
  @property({ type: Number })  setpointDegS = 0
  @property({ type: Number })  gyroDegS = 0
  @property({ type: Number })  errorDegS = 0
  @property({ type: Boolean }) saturated = false
  @property({ type: String })  axis: 'roll' | 'pitch' | 'yaw' = 'roll'

  /**
   * Imperative fast path for the PID sim driver: push new values and draw in
   * the SAME animation frame (flushes Lit's update synchronously, then draws
   * now). Hover state is read inside the shared draw, so driver ticks never
   * clobber pointer highlights.
   */
  renderFrame(props: {
    motorOutputs: number[]
    setpointDegS: number
    gyroDegS: number
    errorDegS: number
    saturated: boolean
  }): void {
    this.motorOutputs = props.motorOutputs
    this.setpointDegS = props.setpointDegS
    this.gyroDegS = props.gyroDegS
    this.errorDegS = props.errorDegS
    this.saturated = props.saturated
    this.performUpdate()
    this.drawNow()
  }

  protected buildScene(f: FrameInfo): SceneNode[] {
    const scale = f.cam.scale
    const armLen = 1.0
    const motorR = 0.22
    const propR = 0.32
    const bodyR = 0.18

    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const clrBorder = f.color('--fpv-border', '#2a2a3e')
    const clrError = f.color('--fpv-error', '#ff4466')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')

    // Gyro-driven rotation of the quad; the ground plane stays world-fixed so
    // the quad visibly banks against a level horizon.
    const gyroAngle = clamp(this.gyroDegS / 720 * 45, -60, 60) * DEG
    const applyAttitude = (p: Vec3): Vec3 => {
      if (this.axis === 'roll') return rotX(p, gyroAngle)
      if (this.axis === 'pitch') return rotZ(p, -gyroAngle)
      return rotY(p, gyroAngle)
    }
    const xform = (p: Vec3): Projected => f.project(applyAttitude(p))
    const xformWorld = (p: Vec3): Projected => f.project(p)

    const nodes: SceneNode[] = []

    // ── Grid floor + shadow (non-pickable, always behind) ──
    nodes.push({
      id: 'grid', kind: 'grid', depth: -100,
      draw: (ctx) => {
        ctx.globalAlpha = 0.15
        ctx.strokeStyle = clrMuted
        ctx.lineWidth = 0.5
        const gridN = 4
        const gridSpan = 2.0
        for (let i = -gridN; i <= gridN; i++) {
          const t = (i / gridN) * gridSpan
          const a = xformWorld([t, -0.5, -gridSpan])
          const b = xformWorld([t, -0.5, gridSpan])
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          const c = xformWorld([-gridSpan, -0.5, t])
          const d = xformWorld([gridSpan, -0.5, t])
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
        }
        ctx.globalAlpha = 0.08
        ctx.fillStyle = clrPrimary
        const sc = xformWorld([0, -0.5, 0])
        ctx.beginPath()
        ctx.ellipse(sc.x, sc.y, scale * 0.3, scale * 0.12, 0, 0, TAU)
        ctx.fill()
        ctx.globalAlpha = 1
      },
    })

    // Motor positions (X-frame, in XZ plane, Y=0)
    const motorPos: Vec3[] = [
      [-armLen * 0.707, 0, -armLen * 0.707],
      [ armLen * 0.707, 0, -armLen * 0.707],
      [-armLen * 0.707, 0,  armLen * 0.707],
      [ armLen * 0.707, 0,  armLen * 0.707],
    ]

    // Motor colors based on tracking quality
    const absError = Math.abs(this.errorDegS)
    const absSP = Math.abs(this.setpointDegS)
    const motorColor = this.saturated
      ? clrError
      : (absSP < 5 ? absError < 5 : absError < absSP * 0.2)
        ? clrPrimary
        : clrAccent

    const cp = xform([0, 0, 0])

    // ── Arms ──
    for (let i = 0; i < 4; i++) {
      const mp = xform(motorPos[i])
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

    // ── Center body ──
    nodes.push({
      id: 'frame', kind: 'entity', depth: cp.depth,
      meta: {
        label: `Frame — ${this.axis}`,
        gyro: `${this.gyroDegS.toFixed(1)}°/s`,
        setpoint: `${this.setpointDegS.toFixed(1)}°/s`,
        error: `${this.errorDegS.toFixed(1)}°/s`,
      },
      hit: { type: 'circle', x: cp.x, y: cp.y, r: bodyR * scale * cp.depth },
      draw: (ctx) => {
        ctx.beginPath()
        ctx.arc(cp.x, cp.y, bodyR * scale * cp.depth, 0, TAU)
        ctx.fillStyle = clrBorder
        ctx.fill()
        const front = xform([0, 0, -0.25])
        ctx.beginPath()
        ctx.moveTo(cp.x, cp.y)
        ctx.lineTo(front.x, front.y)
        ctx.strokeStyle = clrPrimary
        ctx.lineWidth = 2
        ctx.stroke()
      },
    })

    // ── Motors (prop disc + hub) and thrust force columns ──
    for (let i = 0; i < 4; i++) {
      const mp = xform(motorPos[i])
      const mOut = typeof this.motorOutputs[i] === 'number'
        ? clamp(this.motorOutputs[i], -1, 1)
        : 0
      const thrust = Math.abs(mOut)
      const discR = propR * scale * mp.depth

      nodes.push({
        id: `motor-${i}`, kind: 'entity', depth: mp.depth,
        meta: {
          label: MOTOR_LABELS[i],
          output: `${(mOut * 100).toFixed(0)}%`,
          state: this.saturated ? 'saturated' : 'ok',
        },
        hit: { type: 'ellipse', x: mp.x, y: mp.y, rx: discR, ry: discR * 0.35 },
        draw: (ctx, { hovered }) => {
          ctx.beginPath()
          ctx.ellipse(mp.x, mp.y, discR, discR * 0.35, 0, 0, TAU)
          ctx.fillStyle = motorColor + (hovered ? '38' : '20')
          ctx.strokeStyle = motorColor + (hovered ? 'aa' : '60')
          ctx.lineWidth = 1
          ctx.fill()
          ctx.stroke()

          const hubR = motorR * 0.5 * scale * mp.depth
          ctx.beginPath()
          ctx.arc(mp.x, mp.y, hubR, 0, TAU)
          ctx.fillStyle = motorColor
          ctx.fill()
        },
      })

      if (thrust > 0.01) {
        // Signed column: up for +thrust, down for −, so a roll/pitch couple
        // (opposite-sign motors) reads as the differential that drives it.
        const tp = xform([motorPos[i][0], motorPos[i][1] + mOut * 0.8, motorPos[i][2]])
        nodes.push({
          id: `thrust-${i}`, kind: 'vector', depth: mp.depth + 0.001,
          meta: {
            label: `${MOTOR_LABELS[i]} thrust`,
            output: `${(mOut * 100).toFixed(0)}%`,
          },
          hit: { type: 'segment', x1: mp.x, y1: mp.y, x2: tp.x, y2: tp.y, width: 3 },
          draw: (ctx, { hovered }) => {
            ctx.beginPath()
            ctx.moveTo(mp.x, mp.y)
            ctx.lineTo(tp.x, tp.y)
            ctx.strokeStyle = motorColor
            ctx.lineWidth = hovered ? 4 : 3
            ctx.globalAlpha = hovered ? 0.9 : 0.5
            ctx.lineCap = 'round'
            ctx.stroke()
            ctx.globalAlpha = 1
          },
        })
      }
    }

    // ── Rotation arcs (setpoint ghost + gyro solid), always on top ──
    const maxDegS = 720
    const spNorm = clamp(this.setpointDegS / maxDegS, -1, 1)
    if (Math.abs(spNorm) > 0.01) {
      nodes.push(this._arcNode(
        'arc-setpoint', xform, 1.35, Math.abs(spNorm) * Math.PI * 1.2, spNorm > 0,
        clrMuted, 0.35, 1.5,
        { label: 'Setpoint', rate: `${this.setpointDegS.toFixed(1)}°/s` },
      ))
    }
    const gyroNorm = clamp(this.gyroDegS / maxDegS, -1, 1)
    if (Math.abs(gyroNorm) > 0.01) {
      nodes.push(this._arcNode(
        'arc-gyro', xform, 1.35 * 0.95, Math.abs(gyroNorm) * Math.PI * 1.2, gyroNorm > 0,
        clrPrimary, 0.8, 2.5,
        { label: 'Gyro', rate: `${this.gyroDegS.toFixed(1)}°/s` },
      ))
    }

    return nodes
  }

  private _arcNode(
    id: string,
    xform: (p: Vec3) => Projected,
    radius: number,
    sweep: number,
    clockwise: boolean,
    color: string,
    alpha: number,
    lineWidth: number,
    meta: Record<string, unknown>,
  ): SceneNode {
    const segments = 48
    const startAngle = -Math.PI / 2
    const dir = clockwise ? 1 : -1
    const points: [number, number][] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = startAngle + dir * sweep * t
      let p: Vec3
      if (this.axis === 'roll') {
        p = [0, Math.cos(angle) * radius, Math.sin(angle) * radius]
      } else if (this.axis === 'pitch') {
        p = [Math.sin(angle) * radius, Math.cos(angle) * radius, 0]
      } else {
        p = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
      }
      const proj = xform(p)
      points.push([proj.x, proj.y])
    }

    return {
      id, kind: 'vector', depth: 10, meta,
      hit: { type: 'polyline', points, width: lineWidth + 2 },
      draw: (ctx, { hovered }) => {
        if (points.length < 2) return
        ctx.save()
        ctx.globalAlpha = hovered ? Math.min(1, alpha + 0.3) : alpha
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(points[0][0], points[0][1])
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
        ctx.stroke()

        // Arrowhead at the end
        const last = points[points.length - 1]
        const prev = points[points.length - 2]
        const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0])
        const ah = Math.max(6, lineWidth * 3)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(last[0], last[1])
        ctx.lineTo(last[0] - ah * Math.cos(angle - 0.4), last[1] - ah * Math.sin(angle - 0.4))
        ctx.lineTo(last[0] - ah * Math.cos(angle + 0.4), last[1] - ah * Math.sin(angle + 0.4))
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      },
    }
  }

  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')
    ctx.font = `bold 11px ${fontSans}`
    ctx.fillStyle = f.color('--fpv-text-muted', '#8888a0')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(this.axis.toUpperCase(), 8, 8)

    ctx.font = `11px ${fontMono}`
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'right'
    ctx.fillStyle = f.color('--fpv-primary', '#00d4aa')
    ctx.fillText(`SP ${this.setpointDegS.toFixed(1)}°/s`, f.W / 2 - 4, f.H - 6)
    ctx.textAlign = 'left'
    ctx.fillStyle = f.color('--fpv-info', '#4488ff')
    ctx.fillText(`GY ${this.gyroDegS.toFixed(1)}°/s`, f.W / 2 + 4, f.H - 6)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-quad-preview-3d': FpvQuadPreview3d
  }
}
