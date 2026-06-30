import { LitElement, html, css } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import '../primitives/index.js'
import './tilt-viz.js'

const FOV_DEG = 120
const ALTITUDE_M = 30
const G = 9.81
const DRAG_K = 0.3

@customElement('tilt-calculator')
export class TiltCalculator extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }
      .layout {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-sm);
      }
      .speed-row {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-sm);
      }
      .speed-row fpv-number {
        flex: 1;
      }
      .result-row {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-sm);
      }
      .result-label {
        min-width: 110px;
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        flex-shrink: 0;
      }
      .result-value {
        flex: 1;
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        color: var(--fpv-text);
        text-align: right;
      }
      .result-unit {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        flex-shrink: 0;
        min-width: 36px;
      }
      canvas {
        display: block;
        width: 100%;
        height: 220px;
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
      }
    `,
  ]

  private _i18n = new I18nController(this)

  @state() private _tilt = 30
  @state() private _speed = 20
  @state() private _unit = 'm/s'

  @query('canvas') private _canvas!: HTMLCanvasElement

  private _speedMS(): number {
    return this._unit === 'mph' ? this._speed * 0.44704 : this._speed
  }

  private _horizonPct(): number {
    return 50 + (this._tilt / (FOV_DEG / 2)) * 50
  }

  private _groundDist(): number {
    const tiltRad = (this._tilt * Math.PI) / 180
    const fovHalfRad = ((FOV_DEG / 2) * Math.PI) / 180
    const angle = tiltRad + fovHalfRad
    if (angle >= Math.PI / 2) return Infinity
    return ALTITUDE_M * Math.tan(angle)
  }

  private _aoa(): number {
    const speedMS = this._speedMS()
    if (speedMS < 0.01) return 90
    return (Math.atan(G / (speedMS * DRAG_K)) * 180) / Math.PI
  }

  private _fmtDisplay(n: number, digits = 1, unit = ''): string {
    if (!isFinite(n) || isNaN(n)) return '—'
    return parseFloat(n.toFixed(digits)).toString() + (unit ? ' ' + unit : '')
  }

  private _ro: ResizeObserver | null = null
  private _rafId = 0
  private _dirty = true

  override firstUpdated() {
    this._ro = new ResizeObserver(() => { this._dirty = true })
    this._ro.observe(this._canvas)
    this._dirty = true
    this._loop()
  }

  override updated() {
    this._dirty = true
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._ro?.disconnect()
    cancelAnimationFrame(this._rafId)
  }

  private _loop() {
    this._rafId = requestAnimationFrame(() => {
      if (this._dirty) {
        this._draw()
        this._dirty = false
      }
      this._loop()
    })
  }

  private _draw() {
    const canvas = this._canvas
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const W = Math.max(rect.width, 100)
    const H = Math.max(rect.height, 100)
    const bw = Math.round(W * dpr)
    const bh = Math.round(H * dpr)
    if (canvas.width !== bw) canvas.width = bw
    if (canvas.height !== bh) canvas.height = bh

    ctx.save()
    ctx.scale(dpr, dpr)

    const cs = getComputedStyle(this)
    const primary = cs.getPropertyValue('--fpv-primary').trim() || '#00d4aa'
    const textMuted = cs.getPropertyValue('--fpv-text-muted').trim() || '#8888a0'
    const textColor = cs.getPropertyValue('--fpv-text').trim() || '#e0e0e8'
    const surface2 = cs.getPropertyValue('--fpv-surface-2').trim() || '#1e1e2e'
    const border = cs.getPropertyValue('--fpv-border').trim() || '#2a2a3e'
    const fontMono = cs.getPropertyValue('--fpv-font-mono').trim() || 'JetBrains Mono, monospace'
    const fontSans = cs.getPropertyValue('--fpv-font-sans').trim() || 'Inter, system-ui, sans-serif'
    const accent = '#ffaa33'

    ctx.clearRect(0, 0, W, H)

    const groundY = H - 32
    const quadX = Math.round(W * 0.2)
    const quadY = 60
    const tiltRad = (this._tilt * Math.PI) / 180
    const fovHalfRad = ((FOV_DEG / 2) * Math.PI) / 180
    const upperAngle = tiltRad - fovHalfRad
    const lowerAngle = tiltRad + fovHalfRad

    // Ground with gradient
    const gGrad = ctx.createLinearGradient(0, groundY, 0, H)
    gGrad.addColorStop(0, surface2)
    gGrad.addColorStop(1, border)
    ctx.fillStyle = gGrad
    ctx.fillRect(0, groundY, W, H - groundY)

    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(W, groundY)
    ctx.strokeStyle = textMuted
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.font = `11px ${fontMono}`
    ctx.fillStyle = textMuted
    ctx.textBaseline = 'top'
    ctx.fillText(this._i18n.t('tilt.canvas_ground'), 4, groundY + 4)

    // Altitude dashed line (quad to ground)
    ctx.beginPath()
    ctx.moveTo(quadX, quadY + 8)
    ctx.lineTo(quadX, groundY)
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = textMuted
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.4
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.setLineDash([])

    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = textMuted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${ALTITUDE_M}m`, quadX - 6, (quadY + groundY) / 2)
    ctx.textAlign = 'left'

    // FOV cone endpoint helper
    const fovEndpoint = (angle: number): [number, number] => {
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      let t = 800
      if (dx > 0) t = Math.min(t, (W - quadX - 4) / dx)
      if (dy > 0) t = Math.min(t, (groundY - quadY) / dy)
      if (dy < 0) t = Math.min(t, (4 - quadY) / dy)
      if (t <= 0) t = 0
      return [quadX + dx * t, quadY + dy * t]
    }

    const [ux, uy] = fovEndpoint(upperAngle)
    const [lx, ly] = fovEndpoint(lowerAngle)

    // FOV fill with gradient
    const fovGrad = ctx.createLinearGradient(quadX, quadY, quadX + 200, quadY + 100)
    fovGrad.addColorStop(0, primary + '25')
    fovGrad.addColorStop(1, primary + '08')
    ctx.beginPath()
    ctx.moveTo(quadX, quadY)
    ctx.lineTo(ux, uy)
    ctx.lineTo(lx, ly)
    ctx.closePath()
    ctx.fillStyle = fovGrad
    ctx.fill()

    // FOV boundary lines
    ctx.strokeStyle = primary
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(quadX, quadY); ctx.lineTo(ux, uy)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(quadX, quadY); ctx.lineTo(lx, ly)
    ctx.stroke()

    // Center tilt direction (dashed)
    const [cxp, cyp] = fovEndpoint(tiltRad)
    ctx.beginPath()
    ctx.moveTo(quadX, quadY)
    ctx.lineTo(cxp, cyp)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = primary
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.45
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.setLineDash([])

    // Tilt angle arc
    const arcR = 28
    ctx.beginPath()
    ctx.arc(quadX, quadY, arcR, 0, tiltRad)
    ctx.strokeStyle = primary
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.7
    ctx.stroke()
    ctx.globalAlpha = 1

    // Tilt angle label near arc
    const labelAngle = tiltRad / 2
    const labelR = arcR + 10
    ctx.font = `bold 11px ${fontSans}`
    ctx.fillStyle = primary
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `${this._tilt}°`,
      quadX + Math.cos(labelAngle) * labelR,
      quadY + Math.sin(labelAngle) * labelR
    )

    // Horizon line
    const horizInFov = 0 >= upperAngle && 0 <= lowerAngle
    if (horizInFov) {
      ctx.beginPath()
      ctx.moveTo(quadX, quadY)
      ctx.lineTo(W - 10, quadY)
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `11px ${fontMono}`
      ctx.fillStyle = accent
      ctx.textAlign = 'right'
      ctx.fillText(
        this._i18n.t('tilt.canvas_horizon', { pct: this._horizonPct().toFixed(0) }),
        W - 8,
        quadY - 6
      )
      ctx.textAlign = 'left'
    }

    // Ground contact dot
    if (lowerAngle > 0 && lowerAngle < Math.PI / 2) {
      const t = (groundY - quadY) / Math.sin(lowerAngle)
      if (t > 0) {
        const gx = quadX + Math.cos(lowerAngle) * t
        if (gx > 0 && gx < W) {
          // Distance label on ground
          const distPx = gx - quadX
          if (distPx > 30) {
            ctx.beginPath()
            ctx.moveTo(quadX, groundY + 8)
            ctx.lineTo(gx, groundY + 8)
            ctx.strokeStyle = primary
            ctx.lineWidth = 1
            ctx.globalAlpha = 0.5
            ctx.stroke()
            ctx.globalAlpha = 1
            ctx.font = `10px ${fontMono}`
            ctx.fillStyle = primary
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            const dist = this._groundDist()
            if (isFinite(dist)) {
              ctx.fillText(`${dist.toFixed(1)}m`, (quadX + gx) / 2, groundY + 12)
            }
            ctx.textAlign = 'left'
          }

          ctx.beginPath()
          ctx.arc(gx, groundY, 5, 0, Math.PI * 2)
          ctx.fillStyle = primary
          ctx.fill()
          ctx.beginPath()
          ctx.arc(gx, groundY, 5, 0, Math.PI * 2)
          ctx.strokeStyle = primary + '40'
          ctx.lineWidth = 3
          ctx.stroke()
        }
      }
    }

    // Speed vector arrow
    const speedMS = this._speedMS()
    const arrowLen = Math.max(24, Math.min(120, speedMS * 2.5))
    const ax = quadX + arrowLen
    const ay = quadY - 4

    ctx.beginPath()
    ctx.moveTo(quadX + 18, quadY)
    ctx.lineTo(ax, ay)
    ctx.strokeStyle = textColor
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax - 7, ay - 4)
    ctx.lineTo(ax - 7, ay + 4)
    ctx.closePath()
    ctx.fillStyle = textColor
    ctx.fill()

    ctx.font = `11px ${fontMono}`
    ctx.fillStyle = textColor
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${this._speed} ${this._unit}`, quadX + 22, quadY - 8)

    // Quad body (side profile - rounded rectangle)
    ctx.beginPath()
    const bodyW = 32, bodyH = 8
    const bx = quadX - bodyW / 2, by = quadY - bodyH / 2
    const br = 3
    ctx.moveTo(bx + br, by)
    ctx.lineTo(bx + bodyW - br, by)
    ctx.quadraticCurveTo(bx + bodyW, by, bx + bodyW, by + br)
    ctx.lineTo(bx + bodyW, by + bodyH - br)
    ctx.quadraticCurveTo(bx + bodyW, by + bodyH, bx + bodyW - br, by + bodyH)
    ctx.lineTo(bx + br, by + bodyH)
    ctx.quadraticCurveTo(bx, by + bodyH, bx, by + bodyH - br)
    ctx.lineTo(bx, by + br)
    ctx.quadraticCurveTo(bx, by, bx + br, by)
    ctx.closePath()
    ctx.fillStyle = border
    ctx.fill()
    ctx.strokeStyle = textMuted
    ctx.lineWidth = 1
    ctx.stroke()

    // Camera lens indicator (small circle on front)
    ctx.beginPath()
    ctx.arc(quadX + bodyW / 2 - 2, quadY, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = primary
    ctx.fill()

    // Props (wider ellipses at arm tips)
    for (const ox of [-20, 20]) {
      ctx.beginPath()
      ctx.ellipse(quadX + ox, quadY - 4, 8, 2.5, 0, 0, Math.PI * 2)
      ctx.fillStyle = textMuted + '40'
      ctx.fill()
      ctx.strokeStyle = textMuted
      ctx.lineWidth = 1
      ctx.stroke()
    }

    ctx.restore()
  }

  render() {
    const horizPct = this._horizonPct()
    const groundDist = this._groundDist()
    const aoa = this._aoa()

    return html`
      <div class="layout">
        <fpv-card .header=${this._i18n.t('common.inputs')}>
          <div class="rows">
            <fpv-slider
              .label=${this._i18n.t('tilt.label_tilt_angle')}
              .value=${this._tilt}
              min="0"
              max="60"
              step="1"
              unit="°"
              @value-change=${(e: CustomEvent<number>) => {
                this._tilt = e.detail
              }}
            ></fpv-slider>
            <div class="speed-row">
              <fpv-number
                .label=${this._i18n.t('common.speed')}
                .value=${this._speed}
                min="0"
                step="1"
                @value-change=${(e: CustomEvent<number>) => {
                  this._speed = e.detail
                }}
              ></fpv-number>
              <fpv-select
                .value=${this._unit}
                .options=${[
                  { value: 'm/s', label: 'm/s' },
                  { value: 'mph', label: 'mph' },
                ]}
                @select-change=${(e: CustomEvent<string>) => {
                  this._unit = e.detail
                }}
              ></fpv-select>
            </div>
          </div>
        </fpv-card>
        <fpv-card .header=${this._i18n.t('tilt.section_computed')}>
          <div class="rows">
            <div class="result-row">
              <span class="result-label">${this._i18n.t('tilt.label_horizon_pos')}</span>
              <span class="result-value">${this._fmtDisplay(horizPct, 1)}</span>
              <span class="result-unit">% top</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('tilt.label_ground_dist')}</span>
              <span class="result-value">
                ${isFinite(groundDist) ? this._fmtDisplay(groundDist, 1) : '—'}
              </span>
              <span class="result-unit">m</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('tilt.label_aoa')}</span>
              <span class="result-value">${this._fmtDisplay(aoa, 1)}</span>
              <span class="result-unit">°</span>
            </div>
          </div>
        </fpv-card>
        <fpv-card .header=${this._i18n.t('tilt.section_viz')}>
          <tilt-viz
            style="height:160px;margin-bottom:var(--fpv-space-sm)"
            .tiltDeg=${this._tilt}
            .fovDeg=${FOV_DEG}
          ></tilt-viz>
          <canvas></canvas>
        </fpv-card>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tilt-calculator': TiltCalculator
  }
}
