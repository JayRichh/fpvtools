import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'

type V3 = [number, number, number]

const DEG = Math.PI / 180
const TAU = Math.PI * 2

function rotX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}
function rotY(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a)
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]
}

function project(p: V3, focalLen: number, cx: number, cy: number): [number, number, number] {
  const z = p[2] + focalLen
  if (z < 0.1) return [cx, cy, 0]
  const s = focalLen / z
  return [cx + p[0] * s, cy - p[1] * s, s]
}

@customElement('tilt-viz')
export class TiltViz extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
        min-height: 200px;
        position: relative;
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        overflow: hidden;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        cursor: grab;
      }
      canvas:active { cursor: grabbing; }
    `,
  ]

  @property({ type: Number }) tiltDeg = 30
  @property({ type: Number }) fovDeg = 120

  private _canvas!: HTMLCanvasElement
  private _ctx!: CanvasRenderingContext2D
  private _rafId = 0
  private _running = false
  private _dirty = true
  private _observer!: ResizeObserver

  private _camPitch = -22 * DEG
  private _camYaw   =  28 * DEG
  private _orbiting = false
  private _orbitX   = 0
  private _orbitY   = 0

  private _startOrbit = (e: MouseEvent) => {
    this._orbiting = true; this._orbitX = e.clientX; this._orbitY = e.clientY
  }
  private _moveOrbit = (e: MouseEvent) => {
    if (!this._orbiting) return
    this._camYaw   += (e.clientX - this._orbitX) * 0.006
    this._camPitch  = Math.max(-1.45, Math.min(-0.04, this._camPitch + (e.clientY - this._orbitY) * 0.006))
    this._orbitX = e.clientX; this._orbitY = e.clientY
    this._dirty = true
  }
  private _endOrbit   = () => { this._orbiting = false }
  private _touchOrbitStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    this._orbiting = true; this._orbitX = e.touches[0].clientX; this._orbitY = e.touches[0].clientY
  }
  private _touchOrbitMove = (e: TouchEvent) => {
    if (!this._orbiting || e.touches.length !== 1) return
    this._camYaw   += (e.touches[0].clientX - this._orbitX) * 0.006
    this._camPitch  = Math.max(-1.45, Math.min(-0.04, this._camPitch + (e.touches[0].clientY - this._orbitY) * 0.006))
    this._orbitX = e.touches[0].clientX; this._orbitY = e.touches[0].clientY
    this._dirty = true
  }
  private _resetOrbit = () => { this._camPitch = -22 * DEG; this._camYaw = 28 * DEG; this._dirty = true }

  firstUpdated() {
    this._canvas = this.shadowRoot!.querySelector('canvas')!
    const ctx = this._canvas.getContext('2d')
    if (!ctx) return
    this._ctx = ctx
    this._observer = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      const w = this.offsetWidth, h = this.offsetHeight
      if (!w || !h) return
      this._canvas.width = Math.round(w * dpr)
      this._canvas.height = Math.round(h * dpr)
      this._dirty = true
    })
    this._observer.observe(this)
    const dpr = window.devicePixelRatio || 1
    const w = this.offsetWidth || 400, h = this.offsetHeight || 240
    this._canvas.width = Math.round(w * dpr)
    this._canvas.height = Math.round(h * dpr)
    this._running = true
    this._loop()
    this._canvas.addEventListener('mousedown', this._startOrbit)
    window.addEventListener('mousemove', this._moveOrbit)
    window.addEventListener('mouseup', this._endOrbit)
    this._canvas.addEventListener('touchstart', this._touchOrbitStart, { passive: true })
    window.addEventListener('touchmove', this._touchOrbitMove, { passive: true })
    window.addEventListener('touchend', this._endOrbit)
    this._canvas.addEventListener('dblclick', this._resetOrbit)
  }

  updated() { this._dirty = true }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._running = false
    cancelAnimationFrame(this._rafId)
    this._observer?.disconnect()
    window.removeEventListener('mousemove', this._moveOrbit)
    window.removeEventListener('mouseup', this._endOrbit)
    window.removeEventListener('touchmove', this._touchOrbitMove)
    window.removeEventListener('touchend', this._endOrbit)
  }

  private _loop() {
    if (!this._running) return
    this._rafId = requestAnimationFrame(() => {
      if (!this._running) return
      if (this._dirty) { this._draw(); this._dirty = false }
      this._loop()
    })
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
    const clrPrimary  = get('--fpv-primary', '#00d4aa')
    const clrBorder   = get('--fpv-border', '#2a2a3e')
    const clrMuted    = get('--fpv-text-muted', '#8888a0')
    const clrAccent   = get('--fpv-accent', '#ff6b35')
    const fontMono    = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans    = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const cx = W * 0.5, cy = H * 0.52
    const scale = Math.min(W, H) * 0.32
    const focalLen = 4.0

    // Camera view (orbit-controlled)
    const camPitch = this._camPitch
    const camYaw   = this._camYaw

    const xform = (p: V3): [number, number, number] => {
      let v = rotX(p, camPitch)
      v = rotY(v, camYaw)
      return project([v[0] * scale, v[1] * scale, v[2] * scale], focalLen * scale, cx, cy)
    }

    // ── Ground plane grid ──────────────────────────────────────────────
    const groundY = -0.55
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = clrMuted
    ctx.lineWidth = 0.5
    for (let i = -4; i <= 4; i++) {
      const t = (i / 4) * 1.8
      const a = xform([t, groundY, -1.8]), b = xform([t, groundY, 1.8])
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
      const c = xform([-1.8, groundY, t]), d = xform([1.8, groundY, t])
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke()
    }
    ctx.globalAlpha = 1

    // ── Quad body + arms ───────────────────────────────────────────────
    const armLen = 0.95
    const motorPos: V3[] = [
      [-armLen * 0.707, 0, -armLen * 0.707],
      [ armLen * 0.707, 0, -armLen * 0.707],
      [-armLen * 0.707, 0,  armLen * 0.707],
      [ armLen * 0.707, 0,  armLen * 0.707],
    ]
    const cp = xform([0, 0, 0])

    // Depth-sort drawables
    type Drawable = { z: number; draw: () => void }
    const drawables: Drawable[] = []

    // Arms
    for (let i = 0; i < 4; i++) {
      const mp = xform(motorPos[i])
      drawables.push({
        z: (cp[2] + mp[2]) / 2,
        draw: () => {
          ctx.beginPath()
          ctx.moveTo(cp[0], cp[1])
          ctx.lineTo(mp[0], mp[1])
          ctx.strokeStyle = clrBorder
          ctx.lineWidth = 3.5
          ctx.lineCap = 'round'
          ctx.stroke()
        },
      })
    }

    // Body
    drawables.push({
      z: cp[2],
      draw: () => {
        ctx.beginPath()
        ctx.arc(cp[0], cp[1], 0.18 * scale * cp[2], 0, TAU)
        ctx.fillStyle = clrBorder
        ctx.fill()
      },
    })

    // Motors + prop discs
    for (let i = 0; i < 4; i++) {
      const mp = xform(motorPos[i])
      drawables.push({
        z: mp[2],
        draw: () => {
          const discR = 0.32 * scale * mp[2]
          ctx.beginPath()
          ctx.ellipse(mp[0], mp[1], discR, discR * 0.35, 0, 0, TAU)
          ctx.fillStyle = clrMuted + '18'
          ctx.strokeStyle = clrMuted + '50'
          ctx.lineWidth = 1
          ctx.fill(); ctx.stroke()
          ctx.beginPath()
          ctx.arc(mp[0], mp[1], 0.08 * scale * mp[2], 0, TAU)
          ctx.fillStyle = clrMuted
          ctx.fill()
        },
      })
    }

    // ── Camera mount on front-centre ───────────────────────────────────
    // Camera sits on the nose, tilted by tiltDeg (pitch up = negative X rotation in model)
    const camMountPos: V3 = [0, 0, -0.55]
    const tiltRad = this.tiltDeg * DEG
    const fovHalf = (this.fovDeg / 2) * DEG

    // Camera box corners in camera-local space, then tilt, then place at mount
    const camW = 0.12, camH = 0.10, camD = 0.08
    const boxVerts: V3[] = [
      [-camW, -camH, -camD], [ camW, -camH, -camD],
      [ camW,  camH, -camD], [-camW,  camH, -camD],
      [-camW, -camH,  camD], [ camW, -camH,  camD],
      [ camW,  camH,  camD], [-camW,  camH,  camD],
    ]
    const tiltedBox = boxVerts.map(v => {
      const tv = rotX(v, -tiltRad) // tilt around X axis
      return [tv[0] + camMountPos[0], tv[1] + camMountPos[1], tv[2] + camMountPos[2]] as V3
    })
    const faces = [
      [0,1,2,3], // back
      [4,5,6,7], // front (lens side)
      [0,1,5,4], // bottom
      [2,3,7,6], // top
      [0,3,7,4], // left
      [1,2,6,5], // right
    ]
    const pbox = tiltedBox.map(v => xform(v))

    // Sort faces back-to-front
    const faceSorted = faces.map(f => ({
      f,
      z: f.reduce((s, i) => s + pbox[i][2], 0) / f.length,
    })).sort((a, b) => a.z - b.z)

    for (const { f } of faceSorted) {
      const pts = f.map(i => pbox[i])
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fillStyle = clrPrimary + '28'
      ctx.strokeStyle = clrPrimary + '90'
      ctx.lineWidth = 1
      ctx.fill(); ctx.stroke()
    }

    // Camera lens dot on front face
    const lensCenter = tiltedBox[4].map((v, i) =>
      (v + tiltedBox[5][i] + tiltedBox[6][i] + tiltedBox[7][i]) / 4
    ) as V3
    const lp = xform(lensCenter)
    ctx.beginPath()
    ctx.arc(lp[0], lp[1], 3 * lp[2], 0, TAU)
    ctx.fillStyle = clrPrimary
    ctx.fill()

    // ── FOV cone ──────────────────────────────────────────────────────
    // Two bounding rays from camera mount in tilt plane (XZ plane of quad)
    const coneLen = 1.7
    const topDir: V3 = rotX([0, 0, -1], -(tiltRad - fovHalf))
    const botDir: V3 = rotX([0, 0, -1], -(tiltRad + fovHalf))
    const topEnd: V3 = [
      camMountPos[0] + topDir[0] * coneLen,
      camMountPos[1] + topDir[1] * coneLen,
      camMountPos[2] + topDir[2] * coneLen,
    ]
    const botEnd: V3 = [
      camMountPos[0] + botDir[0] * coneLen,
      camMountPos[1] + botDir[1] * coneLen,
      camMountPos[2] + botDir[2] * coneLen,
    ]

    // Clamp bottom ray to ground
    const groundBot: V3 = (() => {
      if (botDir[1] < -0.001) {
        const t = (groundY - camMountPos[1]) / botDir[1]
        if (t > 0 && t < coneLen) {
          return [
            camMountPos[0] + botDir[0] * t,
            groundY,
            camMountPos[2] + botDir[2] * t,
          ] as V3
        }
      }
      return botEnd
    })()

    const mp0 = xform(camMountPos)
    const tp  = xform(topEnd)
    const bp  = xform(groundBot)

    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = clrAccent
    ctx.beginPath()
    ctx.moveTo(mp0[0], mp0[1])
    ctx.lineTo(tp[0],  tp[1])
    ctx.lineTo(bp[0],  bp[1])
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.strokeStyle = clrAccent
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(mp0[0], mp0[1]); ctx.lineTo(tp[0],  tp[1]); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mp0[0], mp0[1]); ctx.lineTo(bp[0],  bp[1]); ctx.stroke()
    ctx.setLineDash([])

    // Ground contact dot where bottom ray hits
    if (groundBot[1] <= groundY + 0.01) {
      ctx.beginPath()
      ctx.arc(bp[0], bp[1], 4, 0, TAU)
      ctx.fillStyle = clrAccent
      ctx.fill()
    }
    ctx.restore()

    // ── Horizon ray (centre of FOV) ────────────────────────────────────
    const midDir: V3 = rotX([0, 0, -1], -tiltRad)
    const midEnd: V3 = [
      camMountPos[0] + midDir[0] * coneLen * 0.7,
      camMountPos[1] + midDir[1] * coneLen * 0.7,
      camMountPos[2] + midDir[2] * coneLen * 0.7,
    ]
    const midP = xform(midEnd)
    ctx.strokeStyle = clrPrimary
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.6
    ctx.beginPath(); ctx.moveTo(mp0[0], mp0[1]); ctx.lineTo(midP[0], midP[1]); ctx.stroke()
    ctx.globalAlpha = 1

    // ── Sort and draw depth-sorted quad pieces ─────────────────────────
    drawables.sort((a, b) => a.z - b.z)
    for (const d of drawables) d.draw()

    // ── Labels ─────────────────────────────────────────────────────────
    ctx.font = `bold 12px ${fontMono}`
    ctx.fillStyle = clrPrimary
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${this.tiltDeg.toFixed(1)}°`, W - 10, 10)

    ctx.font = `11px ${fontSans}`
    ctx.fillStyle = clrAccent
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`FOV ${this.fovDeg}°`, W - 10, 28)

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'tilt-viz': TiltViz }
}
