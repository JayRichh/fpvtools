import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import type { FlightTimeResult } from '@core/flighttime/types.js'

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

@customElement('flight-time-viz')
export class FlightTimeViz extends LitElement {
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

  @property({ type: Object }) result: FlightTimeResult | null = null
  @property({ type: String }) chemistry: 'lipo' | 'liion' = 'liion'
  @property({ type: Number }) cellCount = 6

  private _canvas!: HTMLCanvasElement
  private _ctx!: CanvasRenderingContext2D
  private _rafId = 0
  private _running = false
  private _dirty = true
  private _observer!: ResizeObserver

  private _camPitch = -28 * DEG
  private _camYaw   =  22 * DEG
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
  private _resetOrbit = () => { this._camPitch = -28 * DEG; this._camYaw = 22 * DEG; this._dirty = true }

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
    const w = this.offsetWidth || 400, h = this.offsetHeight || 260
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
    const clrPrimary = get('--fpv-primary', '#00d4aa')
    const clrBorder  = get('--fpv-border', '#2a2a3e')
    const clrMuted   = get('--fpv-text-muted', '#8888a0')
    const clrAccent  = get('--fpv-accent', '#ff6b35')
    const clrInfo    = get('--fpv-info', '#4488ff')
    const clrText    = get('--fpv-text', '#e0e0e8')
    const fontMono   = get('--fpv-font-mono', 'JetBrains Mono, monospace')
    const fontSans   = get('--fpv-font-sans', 'Inter, system-ui, sans-serif')

    const cx = W * 0.5, cy = H * 0.53
    const scale = Math.min(W, H) * 0.28
    const focalLen = 4.0

    // Camera view (orbit-controlled)
    const camPitch = this._camPitch
    const camYaw   = this._camYaw

    const xform = (p: V3): [number, number, number] => {
      let v = rotX(p, camPitch)
      v = rotY(v, camYaw)
      return project([v[0] * scale, v[1] * scale, v[2] * scale], focalLen * scale, cx, cy)
    }

    const groundY = -0.55

    // ── Ground grid ─────────────────────────────────────────────────────────
    ctx.globalAlpha = 0.11
    ctx.strokeStyle = clrMuted
    ctx.lineWidth = 0.5
    for (let i = -5; i <= 5; i++) {
      const t = (i / 5) * 2.0
      const a = xform([t, groundY, -2.0]), b = xform([t, groundY, 2.0])
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
      const c = xform([-2.0, groundY, t]), d = xform([2.0, groundY, t])
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke()
    }
    ctx.globalAlpha = 1

    // ── Range rings on ground ───────────────────────────────────────────────
    const res = this.result
    if (res) {
      const ringRadius = 0.85

      // Outer ring: max range (hover)
      const N = 48
      ctx.beginPath()
      for (let i = 0; i <= N; i++) {
        const angle = (i / N) * TAU - Math.PI * 0.5
        const p: V3 = [Math.cos(angle) * ringRadius, groundY, Math.sin(angle) * ringRadius]
        const sp = xform(p)
        if (i === 0) ctx.moveTo(sp[0], sp[1]); else ctx.lineTo(sp[0], sp[1])
      }
      ctx.closePath()
      ctx.strokeStyle = clrPrimary + '55'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Radial spokes every 90°
      const spokeAngles = [0, 0.5, 1, 1.5].map(f => f * Math.PI)
      ctx.strokeStyle = clrPrimary + '22'
      ctx.lineWidth = 0.8
      const groundOrigin = xform([0, groundY, 0])
      for (const a of spokeAngles) {
        const edge = xform([Math.cos(a - Math.PI * 0.5) * ringRadius, groundY, Math.sin(a - Math.PI * 0.5) * ringRadius])
        ctx.beginPath()
        ctx.moveTo(groundOrigin[0], groundOrigin[1])
        ctx.lineTo(edge[0], edge[1])
        ctx.stroke()
      }

      // Range label near ring (forward-most point)
      const fwdRing: V3 = [0, groundY, -ringRadius]
      const fwdP = xform(fwdRing)
      ctx.font = `bold 10px ${fontMono}`
      ctx.fillStyle = clrPrimary
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${res.maxRangeKm.toFixed(2)} km`, fwdP[0], fwdP[1] - 3)

      // Cruise ring (shorter ring if cruise != hover)
      if (res.cruiseTimeMin < res.hoverTimeMin * 0.95) {
        const cruiseR = ringRadius * (res.cruiseTimeMin / res.hoverTimeMin)
        ctx.beginPath()
        for (let i = 0; i <= N; i++) {
          const angle = (i / N) * TAU - Math.PI * 0.5
          const p: V3 = [Math.cos(angle) * cruiseR, groundY, Math.sin(angle) * cruiseR]
          const sp = xform(p)
          if (i === 0) ctx.moveTo(sp[0], sp[1]); else ctx.lineTo(sp[0], sp[1])
        }
        ctx.closePath()
        ctx.strokeStyle = clrInfo + '45'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Forward path from quad to ring edge
      const quadBase: V3 = [0, groundY + 0.1, 0]
      const ringFwd: V3 = [0, groundY, -ringRadius]
      const qbP = xform(quadBase), rfP = xform(ringFwd)
      ctx.beginPath()
      ctx.moveTo(qbP[0], qbP[1])
      ctx.lineTo(rfP[0], rfP[1])
      ctx.strokeStyle = clrAccent + '60'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Arrow tip at ring
      ctx.beginPath()
      ctx.arc(rfP[0], rfP[1], 3, 0, TAU)
      ctx.fillStyle = clrAccent
      ctx.fill()
    }

    // ── Quad X-frame ────────────────────────────────────────────────────────
    const quadY = 0.15  // floating slightly above ground
    const armLen = 0.9

    const motorPos: V3[] = [
      [-armLen * 0.707, quadY,  -armLen * 0.707],
      [ armLen * 0.707, quadY,  -armLen * 0.707],
      [-armLen * 0.707, quadY,   armLen * 0.707],
      [ armLen * 0.707, quadY,   armLen * 0.707],
    ]
    const cp = xform([0, quadY, 0])

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
          ctx.lineWidth = 3
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
        ctx.arc(cp[0], cp[1], 0.16 * scale * cp[2], 0, TAU)
        ctx.fillStyle = clrBorder
        ctx.fill()
      },
    })

    // Motor hubs + prop discs
    for (let i = 0; i < 4; i++) {
      const mp = xform(motorPos[i])
      drawables.push({
        z: mp[2],
        draw: () => {
          const discR = 0.3 * scale * mp[2]
          ctx.beginPath()
          ctx.ellipse(mp[0], mp[1], discR, discR * 0.35, 0, 0, TAU)
          ctx.fillStyle = clrMuted + '18'
          ctx.strokeStyle = clrMuted + '45'
          ctx.lineWidth = 1
          ctx.fill(); ctx.stroke()
          ctx.beginPath()
          ctx.arc(mp[0], mp[1], 0.07 * scale * mp[2], 0, TAU)
          ctx.fillStyle = clrMuted
          ctx.fill()
        },
      })
    }

    drawables.sort((a, b) => a.z - b.z)
    for (const d of drawables) d.draw()

    // Vertical "shadow" line from quad to ground
    const gcp = xform([0, groundY, 0])
    ctx.beginPath()
    ctx.moveTo(cp[0], cp[1])
    ctx.lineTo(gcp[0], gcp[1])
    ctx.strokeStyle = clrMuted + '30'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // ── Overlay labels ──────────────────────────────────────────────────────
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

    ctx.restore()
  }

  render() { return html`<canvas></canvas>` }
}

declare global {
  interface HTMLElementTagNameMap { 'flight-time-viz': FlightTimeViz }
}
