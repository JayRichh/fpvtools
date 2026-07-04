import { customElement, property } from 'lit/decorators.js'
import { FpvCanvas, type FrameInfo } from '../render/fpv-canvas.js'
import { createOrbitCamera, projectPoint, rotX } from '@core/render/engine2d'
import type { OrbitCamera, SceneNode, Vec3, Projected } from '@core/render/engine2d'
import { createSimState, stepSim, qRotate } from '@core/sim/flight'
import type { Quat, SimMode, SimState, StickInput } from '@core/sim/types'
import { SIM_PRESETS, DEFAULT_SIM_PRESET } from '@core/sim/presets'
import { mulberry32 } from '@core/shared/prng'

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const FIXED_DT = 1 / 120
const PYLON_COUNT = 8
const PYLON_SEED = 7
const FPV_UPTILT = 20 * DEG

export type CamMode = 'follow' | 'orbit' | 'fpv'

interface Pylon { x: number; z: number; h: number }

function buildPylons(): Pylon[] {
  const rng = mulberry32(PYLON_SEED)
  const pylons: Pylon[] = []
  for (let i = 0; i < PYLON_COUNT; i++) {
    // Keep a clear spawn area around the origin
    const angle = rng() * TAU
    const dist = 8 + rng() * 22
    pylons.push({
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      h: 3 + rng() * 4,
    })
  }
  return pylons
}

/** Rotate a world vector into the body frame (inverse of qRotate). */
function qInvRotate(q: Quat, v: Vec3): Vec3 {
  return qRotate([q[0], -q[1], -q[2], -q[3]], v)
}

/** Shortest signed angular difference a→b. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/**
 * Flyable FPV simulator canvas. Physics from @core/sim (pure, fixed-step),
 * rendering + hover from the render engine. Keyboard flies the quad; three
 * camera modes: follow (chase cam that tracks the quad's heading), orbit
 * (free camera) and fpv (through the nose camera, 20° uptilt).
 */
@customElement('fpv-sim')
export class FpvSim extends FpvCanvas {
  @property({ type: String }) mode: SimMode = 'easy'
  @property({ type: String }) presetKey = DEFAULT_SIM_PRESET
  @property({ type: Boolean }) mouseSteer = false
  @property({ type: String }) camMode: CamMode = 'follow'

  private _state: SimState = createSimState()
  private _keys = new Set<string>()
  private _throttle = 0
  private _stick = { roll: 0, pitch: 0, yaw: 0 }
  private _camTarget: Vec3 = [0, 0, 0]
  private _followYaw = Math.PI
  private _yawOffset = 0
  private _lastCamYaw = 0
  private _pylons = buildPylons()
  private _simRafId = 0
  private _lastTs = 0
  private _acc = 0

  protected sceneScaleFactor = 0.16
  protected focalLen = 6
  protected pitchMax = 0.6 // allow looking up at the quad

  constructor() {
    super()
    this.initialPitchDeg = -14
    this.resetOrbit()
    this._lastCamYaw = this.camYaw
  }

  protected resetOrbit() {
    super.resetOrbit()
    this._yawOffset = 0
    this._lastCamYaw = this.camYaw
  }

  // ── Public controls (also reachable from the wrapper UI) ──────────────────
  arm(on?: boolean) {
    if (this._state.crashed) return
    this._state = { ...this._state, armed: on ?? !this._state.armed }
    // Easy mode arms at hover throttle so the quad doesn't drop
    if (this._state.armed && this.mode === 'easy') this._throttle = 0.5
  }

  resetSim() {
    this._state = createSimState()
    this._throttle = 0
    this._stick = { roll: 0, pitch: 0, yaw: 0 }
    this._camTarget = [0, 0, 0]
    this._followYaw = Math.PI
    this._yawOffset = 0
    this.markDirty()
  }

  cycleCam() {
    const order: CamMode[] = ['follow', 'orbit', 'fpv']
    this.camMode = order[(order.indexOf(this.camMode) + 1) % order.length]
    this.dispatchEvent(new CustomEvent('sim-cam-change', {
      detail: this.camMode, bubbles: true, composed: true,
    }))
  }

  get armed(): boolean { return this._state.armed }
  get crashed(): boolean { return this._state.crashed }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  private _onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault()
    if (e.repeat) return
    switch (k) {
      case ' ': this.arm(); break
      case 'r': this.resetSim(); break
      case 'c': this.cycleCam(); break
      case '1':
      case '2': {
        const mode: SimMode = k === '1' ? 'easy' : 'normal'
        this.mode = mode
        this.dispatchEvent(new CustomEvent('sim-mode-change', {
          detail: mode, bubbles: true, composed: true,
        }))
        break
      }
      case 'm':
        this.mouseSteer = !this.mouseSteer
        this.dispatchEvent(new CustomEvent('sim-steer-change', {
          detail: this.mouseSteer, bubbles: true, composed: true,
        }))
        break
      default: this._keys.add(k)
    }
  }
  private _onKeyUp = (e: KeyboardEvent) => {
    this._keys.delete(e.key.toLowerCase())
  }
  private _onBlur = () => { this._keys.clear() }

  // ── Sim loop (continuous driver on top of the base dirty-loop) ────────────
  firstUpdated() {
    super.firstUpdated()
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('blur', this._onBlur)
    this._lastTs = performance.now()
    this._simLoop()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('blur', this._onBlur)
    cancelAnimationFrame(this._simRafId)
  }

  private _simLoop = () => {
    this._simRafId = requestAnimationFrame(this._simLoop)
    const now = performance.now()
    const frameS = Math.min(0.05, (now - this._lastTs) / 1000)
    this._lastTs = now
    this._acc += frameS
    while (this._acc >= FIXED_DT) {
      this._tick(FIXED_DT)
      this._acc -= FIXED_DT
    }
    this._updateCamera(frameS)
    this.drawNow()
  }

  private _updateCamera(frameS: number) {
    const s = this._state
    // Chase target leads the quad slightly along its velocity so fast passes
    // don't lag behind the frame
    const lead = this.camMode === 'orbit' ? 0 : 0.25
    const goal: Vec3 = [
      s.pos[0] + s.vel[0] * lead,
      s.pos[1] + s.vel[1] * lead,
      s.pos[2] + s.vel[2] * lead,
    ]
    const a = 1 - Math.exp(-frameS * 6)
    this._camTarget = [
      this._camTarget[0] + (goal[0] - this._camTarget[0]) * a,
      this._camTarget[1] + (goal[1] - this._camTarget[1]) * a,
      this._camTarget[2] + (goal[2] - this._camTarget[2]) * a,
    ]

    if (this.camMode === 'follow') {
      // Track the quad's heading: camera settles behind the nose. User drag
      // accumulates as a persistent offset (dblclick clears it).
      const fwd = qRotate(s.quat, [0, 0, -1])
      const heading = Math.atan2(fwd[0], -fwd[2])
      const speed = Math.hypot(s.vel[0], s.vel[2])
      // Turn-follow strength grows with speed so hovering doesn't spin the view
      const k = 1.2 + Math.min(2.2, speed * 0.18)
      this._followYaw += angleDelta(this._followYaw, heading + Math.PI) * (1 - Math.exp(-frameS * k))
      const userDelta = this.camYaw - this._lastCamYaw
      this._yawOffset += userDelta
      this.camYaw = this._followYaw + this._yawOffset
    }
    this._lastCamYaw = this.camYaw
  }

  private _axis(neg: string, pos: string): number {
    return (this._keys.has(pos) ? 1 : 0) - (this._keys.has(neg) ? 1 : 0)
  }

  private _tick(dt: number) {
    // Throttle: W/S slews fast enough to punch out / chop within ~0.45 s
    this._throttle = Math.max(0, Math.min(1, this._throttle + this._axis('s', 'w') * 2.2 * dt))

    // Sticks ease toward key targets (snappy attack and release)
    let rollT = this._axis('arrowleft', 'arrowright')
    let pitchT = this._axis('arrowdown', 'arrowup')
    const yawT = this._axis('a', 'd')

    // Mouse steering: pointer offset from canvas center commands roll/pitch
    if (this.mouseSteer && this.pointerPos) {
      const W = this.offsetWidth, H = this.offsetHeight
      const span = Math.min(W, H) * 0.35
      rollT = Math.max(-1, Math.min(1, (this.pointerPos.x - W / 2) / span))
      pitchT = Math.max(-1, Math.min(1, (H / 2 - this.pointerPos.y) / span))
    }

    const ease = 1 - Math.exp(-dt * 22)
    this._stick.roll += (rollT - this._stick.roll) * ease
    this._stick.pitch += (pitchT - this._stick.pitch) * ease
    this._stick.yaw += (yawT - this._stick.yaw) * ease

    const input: StickInput = {
      throttle: this._throttle,
      roll: this._stick.roll,
      pitch: this._stick.pitch,
      yaw: this._stick.yaw,
    }
    const cfg = SIM_PRESETS[this.presetKey] ?? SIM_PRESETS[DEFAULT_SIM_PRESET]
    this._state = stepSim(this._state, input, cfg, this.mode, dt)
  }

  // ── Scene ──────────────────────────────────────────────────────────────────
  protected buildScene(f: FrameInfo): SceneNode[] {
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const clrBorder = f.color('--fpv-border', '#2a2a3e')
    const clrError = f.color('--fpv-error', '#ff4466')
    const clrAccent = f.color('--fpv-accent', '#ff6b35')
    const clrInfo = f.color('--fpv-info', '#4488ff')

    const s = this._state
    const fpv = this.camMode === 'fpv'

    // FPV projects through the quad's own camera (body frame + uptilt);
    // follow/orbit project through the engine's orbit camera around the target
    let proj: (w: Vec3) => Projected
    let S: number // px-per-world-unit at depth 1
    if (fpv) {
      const fpvCam: OrbitCamera = createOrbitCamera({
        yaw: 0, pitch: 0,
        scale: f.W / 2.4, // ≈100° horizontal FOV
        focalLen: 1,
        cx: f.W / 2, cy: f.H / 2,
      })
      S = fpvCam.scale
      proj = (w: Vec3): Projected => {
        const rel: Vec3 = [w[0] - s.pos[0], w[1] - s.pos[1], w[2] - s.pos[2]]
        const v = qInvRotate(s.quat, rel)
        return projectPoint(fpvCam, rotX([v[0], v[1], -v[2]], FPV_UPTILT))
      }
    } else {
      const cam = this._camTarget
      S = f.cam.scale
      proj = (w: Vec3): Projected => f.project([w[0] - cam[0], w[1] - cam[1], w[2] - cam[2]])
    }
    const visible = (p: Projected) => p.depth > (fpv ? 0.018 : 0.05)

    const nodes: SceneNode[] = []
    const camRef = fpv ? s.pos : this._camTarget

    // ── Sky cue + ground grid (world-fixed 2 m cells around the camera) ──
    nodes.push({
      id: 'grid', kind: 'grid', depth: -100,
      draw: (ctx) => {
        // Vertical sky gradient: constant up/down cue even while orbiting
        const sky = ctx.createLinearGradient(0, 0, 0, f.H * 0.6)
        sky.addColorStop(0, clrInfo + '14')
        sky.addColorStop(1, clrInfo + '00')
        ctx.fillStyle = sky
        ctx.fillRect(0, 0, f.W, f.H * 0.6)

        ctx.strokeStyle = clrMuted
        ctx.lineWidth = 0.5
        const span = 24
        const stepM = 2
        const cx0 = Math.round(camRef[0] / stepM) * stepM
        const cz0 = Math.round(camRef[2] / stepM) * stepM
        for (let i = -span; i <= span; i += stepM) {
          // Major line every 10 m for a sense of distance
          const majorX = (cx0 + i) % 10 === 0
          for (let j = -span; j < span; j += stepM) {
            const a = proj([cx0 + i, 0, cz0 + j])
            const b = proj([cx0 + i, 0, cz0 + j + stepM])
            if (visible(a) && visible(b)) {
              ctx.globalAlpha = majorX ? 0.3 : 0.14
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
            }
            const majorZ = (cz0 + i) % 10 === 0
            const c = proj([cx0 + j, 0, cz0 + i])
            const d = proj([cx0 + j + stepM, 0, cz0 + i])
            if (visible(c) && visible(d)) {
              ctx.globalAlpha = majorZ ? 0.3 : 0.14
              ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
            }
          }
        }
        ctx.globalAlpha = 1
        // Home pad
        const pad = proj([0, 0.01, 0])
        if (visible(pad)) {
          ctx.globalAlpha = 0.4
          ctx.strokeStyle = clrPrimary
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.ellipse(pad.x, pad.y, S * pad.depth * 1.2, S * pad.depth * 0.45, 0, 0, TAU)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      },
    })

    // ── Altitude drop-line + shadow under the quad ──
    const shadow = proj([s.pos[0], 0.02, s.pos[2]])
    if (visible(shadow) && !fpv) {
      const quadAt = proj(s.pos)
      const fade = Math.max(0.04, 0.22 - s.pos[1] * 0.02)
      nodes.push({
        id: 'shadow', kind: 'grid', depth: -99,
        draw: (ctx) => {
          if (s.pos[1] > 0.3 && visible(quadAt)) {
            ctx.globalAlpha = 0.3
            ctx.strokeStyle = clrMuted
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.beginPath(); ctx.moveTo(quadAt.x, quadAt.y); ctx.lineTo(shadow.x, shadow.y); ctx.stroke()
            ctx.setLineDash([])
          }
          ctx.globalAlpha = fade
          ctx.fillStyle = clrPrimary
          ctx.beginPath()
          ctx.ellipse(shadow.x, shadow.y, S * shadow.depth * 0.4, S * shadow.depth * 0.15, 0, 0, TAU)
          ctx.fill()
          ctx.globalAlpha = 1
        },
      })
    }

    // ── Pylons ──
    for (let i = 0; i < this._pylons.length; i++) {
      const p = this._pylons[i]
      const base = proj([p.x, 0, p.z])
      const top = proj([p.x, p.h, p.z])
      if (!visible(base) || !visible(top)) continue
      const dist = Math.hypot(p.x - s.pos[0], p.h / 2 - s.pos[1], p.z - s.pos[2])
      nodes.push({
        id: `pylon-${i}`, kind: 'entity', depth: base.depth,
        meta: { label: `Pylon ${i + 1}`, height: `${p.h.toFixed(1)} m`, distance: `${dist.toFixed(1)} m` },
        hit: { type: 'segment', x1: base.x, y1: base.y, x2: top.x, y2: top.y, width: 6 },
        draw: (ctx, { hovered }) => {
          ctx.strokeStyle = hovered ? clrAccent : clrAccent + '77'
          ctx.lineWidth = Math.max(2, 6 * base.depth)
          ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke()
          ctx.fillStyle = clrAccent
          ctx.beginPath()
          ctx.arc(top.x, top.y, Math.max(2, 5 * top.depth), 0, TAU)
          ctx.fill()
        },
      })
    }

    // ── Quad (hidden in FPV — you're inside it) ──
    if (!fpv) {
      const armM = 0.34
      const body = (p: Vec3): Vec3 => {
        const w = qRotate(s.quat, p)
        return [w[0] + s.pos[0], w[1] + s.pos[1], w[2] + s.pos[2]]
      }
      const cp = proj(body([0, 0, 0]))
      const motorPos: Vec3[] = [
        [-armM, 0, -armM], [armM, 0, -armM], [-armM, 0, armM], [armM, 0, armM],
      ]
      if (visible(cp)) {
        const speed = Math.hypot(...s.vel)
        const quadColor = s.crashed ? clrError : s.armed ? clrPrimary : clrMuted

        for (let i = 0; i < 4; i++) {
          const mp = proj(body(motorPos[i]))
          if (!visible(mp)) continue
          nodes.push({
            id: `qarm-${i}`, kind: 'entity', depth: (cp.depth + mp.depth) / 2,
            draw: (ctx) => {
              ctx.beginPath(); ctx.moveTo(cp.x, cp.y); ctx.lineTo(mp.x, mp.y)
              ctx.strokeStyle = clrBorder
              ctx.lineWidth = 3.5
              ctx.lineCap = 'round'
              ctx.stroke()
            },
          })
          const discR = Math.max(2.5, 0.18 * S * mp.depth)
          nodes.push({
            id: `qmotor-${i}`, kind: 'entity', depth: mp.depth,
            draw: (ctx) => {
              ctx.beginPath()
              ctx.ellipse(mp.x, mp.y, discR, discR * 0.35, 0, 0, TAU)
              ctx.fillStyle = quadColor + '20'
              ctx.strokeStyle = quadColor + '60'
              ctx.lineWidth = 1
              ctx.fill(); ctx.stroke()
            },
          })
        }

        nodes.push({
          id: 'quad', kind: 'entity', depth: cp.depth + 0.0005,
          meta: {
            label: `Quad — ${this.presetKey}`,
            altitude: `${s.pos[1].toFixed(1)} m`,
            speed: `${speed.toFixed(1)} m/s`,
            mode: this.mode === 'easy' ? 'Easy (angle)' : 'Normal (acro)',
          },
          hit: { type: 'circle', x: cp.x, y: cp.y, r: Math.max(6, 0.16 * S * cp.depth) },
          draw: (ctx) => {
            ctx.beginPath()
            ctx.arc(cp.x, cp.y, Math.max(3, 0.11 * S * cp.depth), 0, TAU)
            ctx.fillStyle = quadColor
            ctx.fill()
            // Nose indicator
            const nose = proj(body([0, 0, -0.5]))
            if (visible(nose)) {
              ctx.beginPath(); ctx.moveTo(cp.x, cp.y); ctx.lineTo(nose.x, nose.y)
              ctx.strokeStyle = clrAccent
              ctx.lineWidth = 2.5
              ctx.stroke()
            }
          },
        })

        // Velocity vector
        if (speed > 0.5) {
          const vScale = Math.min(0.4, 1.5 / speed) // capped length
          const tip = proj([
            s.pos[0] + s.vel[0] * vScale,
            s.pos[1] + s.vel[1] * vScale,
            s.pos[2] + s.vel[2] * vScale,
          ])
          if (visible(tip)) {
            nodes.push({
              id: 'velocity', kind: 'vector', depth: cp.depth + 0.001,
              meta: { label: 'Velocity', speed: `${speed.toFixed(1)} m/s` },
              hit: { type: 'segment', x1: cp.x, y1: cp.y, x2: tip.x, y2: tip.y, width: 3 },
              draw: (ctx, { hovered }) => {
                ctx.beginPath(); ctx.moveTo(cp.x, cp.y); ctx.lineTo(tip.x, tip.y)
                ctx.strokeStyle = clrInfo
                ctx.globalAlpha = hovered ? 1 : 0.7
                ctx.lineWidth = 2
                ctx.lineCap = 'round'
                ctx.stroke()
                ctx.globalAlpha = 1
              },
            })
          }
        }
      }
    }

    return nodes
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  protected drawOverlay(ctx: CanvasRenderingContext2D, f: FrameInfo): void {
    const fontMono = f.color('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans = f.color('--fpv-font-sans', 'Inter, system-ui, sans-serif')
    const clrPrimary = f.color('--fpv-primary', '#00d4aa')
    const clrMuted = f.color('--fpv-text-muted', '#8888a0')
    const clrError = f.color('--fpv-error', '#ff4466')
    const clrText = f.color('--fpv-text', '#e8e8f0')
    const s = this._state

    // FPV crosshair
    if (this.camMode === 'fpv') {
      ctx.strokeStyle = clrPrimary
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(f.W / 2 - 8, f.H / 2); ctx.lineTo(f.W / 2 - 3, f.H / 2)
      ctx.moveTo(f.W / 2 + 3, f.H / 2); ctx.lineTo(f.W / 2 + 8, f.H / 2)
      ctx.moveTo(f.W / 2, f.H / 2 - 8); ctx.lineTo(f.W / 2, f.H / 2 - 3)
      ctx.moveTo(f.W / 2, f.H / 2 + 3); ctx.lineTo(f.W / 2, f.H / 2 + 8)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Top-left: mode + preset + camera
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = `bold 11px ${fontSans}`
    ctx.fillStyle = clrMuted
    ctx.fillText(
      `${this.mode === 'easy' ? 'EASY' : 'NORMAL'} · ${this.presetKey} · CAM ${this.camMode.toUpperCase()}${this.mouseSteer ? ' · MOUSE STEER' : ''}`,
      8, 8,
    )

    // Top-right: arm state
    ctx.textAlign = 'right'
    ctx.font = `bold 11px ${fontSans}`
    ctx.fillStyle = s.crashed ? clrError : s.armed ? clrPrimary : clrMuted
    ctx.fillText(s.crashed ? 'CRASHED' : s.armed ? 'ARMED' : 'DISARMED', f.W - 8, 8)

    // Bottom-left: throttle bar + telemetry
    const barW = 110
    const barH = 6
    const bx = 8
    const by = f.H - 18
    ctx.globalAlpha = 0.25
    ctx.fillStyle = clrMuted
    ctx.fillRect(bx, by, barW, barH)
    ctx.globalAlpha = 1
    ctx.fillStyle = clrPrimary
    ctx.fillRect(bx, by, barW * this._throttle, barH)
    ctx.font = `10px ${fontMono}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = clrText
    const speed = Math.hypot(...s.vel)
    ctx.fillText(
      `THR ${(this._throttle * 100).toFixed(0).padStart(3)}%  ALT ${s.pos[1].toFixed(1)} m  SPD ${speed.toFixed(1)} m/s`,
      bx, by - 4,
    )

    // Bottom-right: key hints
    ctx.textAlign = 'right'
    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = clrMuted
    ctx.fillText('SPACE arm · W/S thr · A/D yaw · ARROWS · C cam · M mouse · wheel zoom · R reset · 1/2 mode', f.W - 8, f.H - 6)

    // Center banners
    if (s.crashed) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold 16px ${fontSans}`
      ctx.fillStyle = clrError
      ctx.fillText('CRASHED: press R to reset', f.W / 2, f.H / 2)
    } else if (!s.armed) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold 13px ${fontSans}`
      ctx.fillStyle = clrMuted
      ctx.fillText('Press SPACE to arm', f.W / 2, f.H * 0.42)
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-sim': FpvSim
  }
}
