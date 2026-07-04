import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import { rotX } from '@core/render/engine2d'
import type { SceneNode, Vec3 } from '@core/render/engine2d'

const DEG = Math.PI / 180
const TAU = Math.PI * 2

/**
 * Camera tilt / FOV side view for the tilt calculator (engine-based).
 * Hovering the FOV cone edges, horizon ray, camera box or airframe shows
 * the angles derived from tiltDeg/fovDeg.
 */
@customElement('tilt-viz')
export class TiltViz extends FpvCanvas {
  @property({ type: Number }) tiltDeg = 30
  @property({ type: Number }) fovDeg = 120

  constructor() {
    super()
    // Near side-profile: the tilt/FOV angles live in the YZ plane, so they
    // read truly from the side; slight yaw keeps the 3D depth legible.
    this.initialPitchDeg = -10
    this.initialYawDeg = 78
    // Gentle pitch range so the cone can't be collapsed into a top-down view
    this.pitchMin = -0.9
    this.pitchMax = 0.3
    this.resetOrbit()
  }

  protected buildScene(f: FrameInfo): SceneNode[] {
    const scale = f.cam.scale
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrBorder = f.color('--fpv-border', '#2a2a3e')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')

    const tiltRad = this.tiltDeg * DEG
    const fovHalf = (this.fovDeg / 2) * DEG

    // Angle from horizontal (positive = below the horizon, as drawn)
    const fmtSlope = (deg: number): string =>
      Math.abs(deg) < 0.05 ? 'level' : `${Math.abs(deg).toFixed(1)}° ${deg > 0 ? 'down' : 'up'}`

    // Where the horizon sits in the camera frame (% from top of frame)
    const horizonRaw = 50 + (this.tiltDeg / (this.fovDeg / 2)) * 50
    const horizonInFrame = horizonRaw < 0
      ? 'above frame'
      : horizonRaw > 100
        ? 'below frame'
        : `${horizonRaw.toFixed(0)}% from top`

    const nodes: SceneNode[] = []

    // ── Ground plane grid ──
    const groundY = -0.55
    nodes.push({
      id: 'grid', kind: 'grid', depth: -100,
      draw: (ctx) => {
        ctx.globalAlpha = 0.12
        ctx.strokeStyle = clrMuted
        ctx.lineWidth = 0.5
        for (let i = -4; i <= 4; i++) {
          const t = (i / 4) * 1.8
          const a = f.project([t, groundY, -1.8]), b = f.project([t, groundY, 1.8])
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          const c = f.project([-1.8, groundY, t]), d = f.project([1.8, groundY, t])
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
        }
        ctx.globalAlpha = 1
      },
    })

    // ── Camera mount on front-centre ──
    // Camera sits on the nose, tilted by tiltDeg (pitch up = negative X rotation in model)
    const camMountPos: Vec3 = [0, 0, -0.55]
    const camW = 0.12, camH = 0.10, camD = 0.08
    const boxVerts: Vec3[] = [
      [-camW, -camH, -camD], [ camW, -camH, -camD],
      [ camW,  camH, -camD], [-camW,  camH, -camD],
      [-camW, -camH,  camD], [ camW, -camH,  camD],
      [ camW,  camH,  camD], [-camW,  camH,  camD],
    ]
    const tiltedBox = boxVerts.map(v => {
      const tv = rotX(v, -tiltRad) // tilt around X axis
      return [tv[0] + camMountPos[0], tv[1] + camMountPos[1], tv[2] + camMountPos[2]] as Vec3
    })
    const faces = [
      [0,1,2,3], // back
      [4,5,6,7], // front (lens side)
      [0,1,5,4], // bottom
      [2,3,7,6], // top
      [0,3,7,4], // left
      [1,2,6,5], // right
    ]
    const pbox = tiltedBox.map(v => f.project(v))
    const lensCenter = tiltedBox[4].map((v, i) =>
      (v + tiltedBox[5][i] + tiltedBox[6][i] + tiltedBox[7][i]) / 4
    ) as Vec3
    const lp = f.project(lensCenter)
    const mp0 = f.project(camMountPos)
    const boxCx = pbox.reduce((s, p) => s + p.x, 0) / pbox.length
    const boxCy = pbox.reduce((s, p) => s + p.y, 0) / pbox.length

    nodes.push({
      id: 'camera', kind: 'entity', depth: -60,
      meta: {
        label: 'Camera',
        tilt: `${this.tiltDeg.toFixed(1)}°`,
        fov: `${this.fovDeg.toFixed(0)}°`,
      },
      hit: { type: 'circle', x: boxCx, y: boxCy, r: 0.16 * scale * mp0.depth },
      draw: (ctx, { hovered }) => {
        // Sort faces back-to-front
        const faceSorted = faces.map(face => ({
          face,
          z: face.reduce((s, i) => s + pbox[i].depth, 0) / face.length,
        })).sort((a, b) => a.z - b.z)
        for (const { face } of faceSorted) {
          ctx.beginPath()
          ctx.moveTo(pbox[face[0]].x, pbox[face[0]].y)
          for (let i = 1; i < face.length; i++) ctx.lineTo(pbox[face[i]].x, pbox[face[i]].y)
          ctx.closePath()
          ctx.fillStyle = clrPrimary + (hovered ? '38' : '28')
          ctx.strokeStyle = clrPrimary + '90'
          ctx.lineWidth = 1
          ctx.fill(); ctx.stroke()
        }
        // Camera lens dot on front face
        ctx.beginPath()
        ctx.arc(lp.x, lp.y, 3 * lp.depth, 0, TAU)
        ctx.fillStyle = clrPrimary
        ctx.fill()
      },
    })

    // ── FOV cone ──
    // Two bounding rays from camera mount in tilt plane (XZ plane of quad)
    const coneLen = 1.7
    const topDir = rotX([0, 0, -1], -(tiltRad - fovHalf))
    const botDir = rotX([0, 0, -1], -(tiltRad + fovHalf))
    const topEnd: Vec3 = [
      camMountPos[0] + topDir[0] * coneLen,
      camMountPos[1] + topDir[1] * coneLen,
      camMountPos[2] + topDir[2] * coneLen,
    ]
    const botEnd: Vec3 = [
      camMountPos[0] + botDir[0] * coneLen,
      camMountPos[1] + botDir[1] * coneLen,
      camMountPos[2] + botDir[2] * coneLen,
    ]

    // Clamp bottom ray to ground
    const groundBot: Vec3 = (() => {
      if (botDir[1] < -0.001) {
        const t = (groundY - camMountPos[1]) / botDir[1]
        if (t > 0 && t < coneLen) {
          return [
            camMountPos[0] + botDir[0] * t,
            groundY,
            camMountPos[2] + botDir[2] * t,
          ] as Vec3
        }
      }
      return botEnd
    })()
    const hitsGround = groundBot[1] <= groundY + 0.01

    const tp = f.project(topEnd)
    const bp = f.project(groundBot)

    nodes.push({
      id: 'fov-cone', kind: 'entity', depth: -50,
      draw: (ctx) => {
        ctx.globalAlpha = 0.18
        ctx.fillStyle = clrAccent
        ctx.beginPath()
        ctx.moveTo(mp0.x, mp0.y)
        ctx.lineTo(tp.x, tp.y)
        ctx.lineTo(bp.x, bp.y)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
      },
    })

    const edgeNode = (id: string, ex: number, ey: number, offsetDeg: number): SceneNode => ({
      id, kind: 'vector', depth: -49,
      meta: {
        label: 'FOV edge',
        'from horizontal': fmtSlope(this.tiltDeg + offsetDeg),
      },
      hit: { type: 'segment', x1: mp0.x, y1: mp0.y, x2: ex, y2: ey, width: 6 },
      draw: (ctx, { hovered }) => {
        ctx.save()
        ctx.strokeStyle = clrAccent
        ctx.lineWidth = hovered ? 2.5 : 1.5
        ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(mp0.x, mp0.y); ctx.lineTo(ex, ey); ctx.stroke()
        ctx.restore()
      },
    })
    nodes.push(edgeNode('fov-edge-top', tp.x, tp.y, -this.fovDeg / 2))
    nodes.push(edgeNode('fov-edge-bottom', bp.x, bp.y, this.fovDeg / 2))

    // Ground contact dot where bottom ray hits
    if (hitsGround) {
      nodes.push({
        id: 'ground-hit', kind: 'entity', depth: -48,
        meta: {
          label: 'Ground intersection',
          'look angle': fmtSlope(this.tiltDeg + this.fovDeg / 2),
        },
        hit: { type: 'circle', x: bp.x, y: bp.y, r: 6 },
        draw: (ctx, { hovered }) => {
          ctx.beginPath()
          ctx.arc(bp.x, bp.y, hovered ? 5 : 4, 0, TAU)
          ctx.fillStyle = clrAccent
          ctx.fill()
        },
      })
    }

    // ── Horizon ray (centre of FOV) ──
    const midDir = rotX([0, 0, -1], -tiltRad)
    const midEnd: Vec3 = [
      camMountPos[0] + midDir[0] * coneLen * 0.7,
      camMountPos[1] + midDir[1] * coneLen * 0.7,
      camMountPos[2] + midDir[2] * coneLen * 0.7,
    ]
    const midP = f.project(midEnd)
    nodes.push({
      id: 'horizon', kind: 'vector', depth: -47,
      meta: {
        label: 'Horizon',
        'in frame': horizonInFrame,
        'from horizontal': fmtSlope(this.tiltDeg),
      },
      hit: { type: 'segment', x1: mp0.x, y1: mp0.y, x2: midP.x, y2: midP.y, width: 6 },
      draw: (ctx, { hovered }) => {
        ctx.strokeStyle = clrPrimary
        ctx.lineWidth = 1.5
        ctx.globalAlpha = hovered ? 0.9 : 0.6
        ctx.beginPath(); ctx.moveTo(mp0.x, mp0.y); ctx.lineTo(midP.x, midP.y); ctx.stroke()
        ctx.globalAlpha = 1
      },
    })

    // ── Quad body + arms + motors (drawn over the cone, as before) ──
    const armLen = 0.95
    const motorPos: Vec3[] = [
      [-armLen * 0.707, 0, -armLen * 0.707],
      [ armLen * 0.707, 0, -armLen * 0.707],
      [-armLen * 0.707, 0,  armLen * 0.707],
      [ armLen * 0.707, 0,  armLen * 0.707],
    ]
    const cp = f.project([0, 0, 0])

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
        'camera tilt': `${this.tiltDeg.toFixed(1)}°`,
      },
      hit: { type: 'circle', x: cp.x, y: cp.y, r: 0.18 * scale * cp.depth },
      draw: (ctx) => {
        ctx.beginPath()
        ctx.arc(cp.x, cp.y, 0.18 * scale * cp.depth, 0, TAU)
        ctx.fillStyle = clrBorder
        ctx.fill()
      },
    })

    // Motors + prop discs
    for (let i = 0; i < 4; i++) {
      const mp = f.project(motorPos[i])
      nodes.push({
        id: `motor-${i}`, kind: 'entity', depth: mp.depth,
        draw: (ctx) => {
          const discR = 0.32 * scale * mp.depth
          ctx.beginPath()
          ctx.ellipse(mp.x, mp.y, discR, discR * 0.35, 0, 0, TAU)
          ctx.fillStyle = clrMuted + '18'
          ctx.strokeStyle = clrMuted + '50'
          ctx.lineWidth = 1
          ctx.fill(); ctx.stroke()
          ctx.beginPath()
          ctx.arc(mp.x, mp.y, 0.08 * scale * mp.depth, 0, TAU)
          ctx.fillStyle = clrMuted
          ctx.fill()
        },
      })
    }

    return nodes
  }

  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    ctx.font = `bold 12px ${fontMono}`
    ctx.fillStyle = f.color('--fpv-primary', '#00d4aa')
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${this.tiltDeg.toFixed(1)}°`, f.W - 10, 10)

    ctx.font = `11px ${fontSans}`
    ctx.fillStyle = f.color('--fpv-accent', '#ff6b35')
    ctx.fillText(`FOV ${this.fovDeg}°`, f.W - 10, 28)

    ctx.font = `9px ${fontSans}`
    ctx.fillStyle = f.color('--fpv-text-muted', '#8888a0')
    ctx.globalAlpha = 0.4
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('drag · hover · dbl-click reset', f.W / 2, f.H - 2)
    ctx.globalAlpha = 1
  }
}

declare global {
  interface HTMLElementTagNameMap { 'tilt-viz': TiltViz }
}
