import { LitElement, html, css } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import '../primitives/index.js'

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
        height: 200px;
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

  override firstUpdated() {
    this._draw()
  }

  override updated() {
    this._draw()
  }

  private _draw() {
    const canvas = this._canvas
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth || 500
    const H = 200
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)

    ctx.save()
    ctx.scale(dpr, dpr)

    const cs = getComputedStyle(this)
    const primary = cs.getPropertyValue('--fpv-primary').trim() || '#00d4aa'
    const textMuted = cs.getPropertyValue('--fpv-text-muted').trim() || '#8888a0'
    const textColor = cs.getPropertyValue('--fpv-text').trim() || '#e0e0e8'
    const surface2 = cs.getPropertyValue('--fpv-surface-2').trim() || '#1e1e2e'
    const fontMono = cs.getPropertyValue('--fpv-font-mono').trim() || 'JetBrains Mono, monospace'
    const accent = '#ffaa33'

    ctx.clearRect(0, 0, W, H)

    const groundY = H - 28
    const quadX = Math.round(W * 0.22)
    const quadY = 55

    // Ground shading
    ctx.fillStyle = surface2
    ctx.fillRect(0, groundY, W, H - groundY)

    // Ground line
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(W, groundY)
    ctx.strokeStyle = textMuted
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()

    // Ground label
    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = textMuted
    ctx.fillText(this._i18n.t('tilt.canvas_ground'), 4, groundY - 4)

    // FOV cone calculations
    const tiltRad = (this._tilt * Math.PI) / 180
    const fovHalfRad = ((FOV_DEG / 2) * Math.PI) / 180
    const upperAngle = tiltRad - fovHalfRad
    const lowerAngle = tiltRad + fovHalfRad

    // Compute endpoint for an angle, clamped to canvas/ground bounds
    const fovEndpoint = (angle: number): [number, number] => {
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      let t = 800 // large max distance
      if (dx > 0) t = Math.min(t, (W - quadX - 4) / dx)
      if (dy > 0) t = Math.min(t, (groundY - quadY) / dy)
      if (dy < 0) t = Math.min(t, (4 - quadY) / dy)
      if (t <= 0) t = 0
      return [quadX + dx * t, quadY + dy * t]
    }

    const [ux, uy] = fovEndpoint(upperAngle)
    const [lx, ly] = fovEndpoint(lowerAngle)

    // FOV fill
    ctx.beginPath()
    ctx.moveTo(quadX, quadY)
    ctx.lineTo(ux, uy)
    ctx.lineTo(lx, ly)
    ctx.closePath()
    ctx.fillStyle = primary + '18'
    ctx.fill()

    // FOV boundary lines
    ctx.strokeStyle = primary
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(quadX, quadY)
    ctx.lineTo(ux, uy)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(quadX, quadY)
    ctx.lineTo(lx, ly)
    ctx.stroke()

    // Center tilt direction (dashed)
    const [cx, cy] = fovEndpoint(tiltRad)
    ctx.beginPath()
    ctx.moveTo(quadX, quadY)
    ctx.lineTo(cx, cy)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = primary
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.5
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.setLineDash([])

    // Horizon dashed line (horizontal at quad altitude)
    const horizInFov = 0 >= upperAngle && 0 <= lowerAngle
    if (horizInFov) {
      ctx.beginPath()
      ctx.moveTo(quadX, quadY)
      ctx.lineTo(W - 10, quadY)
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `10px ${fontMono}`
      ctx.fillStyle = accent
      ctx.fillText(
        this._i18n.t('tilt.canvas_horizon', { pct: this._horizonPct().toFixed(0) }),
        W - 160,
        quadY - 4
      )
    }

    // Ground contact dot (where lower FOV hits the ground)
    if (lowerAngle > 0 && lowerAngle < Math.PI / 2) {
      const t = (groundY - quadY) / Math.sin(lowerAngle)
      if (t > 0) {
        const gx = quadX + Math.cos(lowerAngle) * t
        if (gx > 0 && gx < W) {
          ctx.beginPath()
          ctx.arc(gx, groundY, 4, 0, Math.PI * 2)
          ctx.fillStyle = primary
          ctx.fill()
        }
      }
    }

    // Speed vector arrow
    const speedMS = this._speedMS()
    const arrowLen = Math.max(20, Math.min(100, speedMS * 2.5))
    const ax = quadX + arrowLen
    const ay = quadY - 6

    ctx.beginPath()
    ctx.moveTo(quadX, quadY)
    ctx.lineTo(ax, ay)
    ctx.strokeStyle = textColor
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()

    // Arrow head
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax - 8, ay - 4)
    ctx.lineTo(ax - 8, ay + 4)
    ctx.closePath()
    ctx.fillStyle = textColor
    ctx.fill()

    // Speed label
    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = textColor
    ctx.fillText(`${this._speed} ${this._unit}`, quadX + 4, quadY - 10)

    // Quad body
    ctx.fillStyle = textColor
    ctx.fillRect(quadX - 14, quadY - 5, 28, 10)

    // Quad props (small circles at each arm tip)
    ctx.fillStyle = textMuted
    for (const ox of [-16, 16]) {
      ctx.beginPath()
      ctx.arc(quadX + ox, quadY - 5, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // Tilt label
    ctx.font = `10px ${fontMono}`
    ctx.fillStyle = primary
    ctx.fillText(
      this._i18n.t('tilt.canvas_tilt', { tilt: this._tilt }),
      quadX + 18,
      quadY + 16
    )

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
