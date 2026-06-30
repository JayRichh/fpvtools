import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
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
      :host { display: block; }
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
      .speed-row fpv-number { flex: 1; }
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
    `,
  ]

  private _i18n = new I18nController(this)

  @state() private _tilt = 30
  @state() private _speed = 20
  @state() private _unit = 'm/s'

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

  private _fmt(n: number, digits = 1): string {
    if (!isFinite(n) || isNaN(n)) return '-'
    return parseFloat(n.toFixed(digits)).toString()
  }

  render() {
    const horizPct  = this._horizonPct()
    const groundDist = this._groundDist()
    const aoa        = this._aoa()

    return html`
      <div class="layout">
        <tilt-viz
          style="height:clamp(320px,48vh,520px)"
          .tiltDeg=${this._tilt}
          .fovDeg=${FOV_DEG}
        ></tilt-viz>

        <fpv-card .header=${this._i18n.t('common.inputs')}>
          <div class="rows">
            <fpv-slider
              .label=${this._i18n.t('tilt.label_tilt_angle')}
              .value=${this._tilt}
              min="0" max="60" step="1" unit="°"
              @value-change=${(e: CustomEvent<number>) => { this._tilt = e.detail }}
            ></fpv-slider>
            <div class="speed-row">
              <fpv-number
                .label=${this._i18n.t('common.speed')}
                .value=${this._speed}
                min="0" step="1"
                @value-change=${(e: CustomEvent<number>) => { this._speed = e.detail }}
              ></fpv-number>
              <fpv-select
                .value=${this._unit}
                .options=${[{ value: 'm/s', label: 'm/s' }, { value: 'mph', label: 'mph' }]}
                @select-change=${(e: CustomEvent<string>) => { this._unit = e.detail }}
              ></fpv-select>
            </div>
          </div>
        </fpv-card>

        <fpv-card .header=${this._i18n.t('tilt.section_computed')}>
          <div class="rows">
            <div class="result-row">
              <span class="result-label">${this._i18n.t('tilt.label_horizon_pos')}</span>
              <span class="result-value">${this._fmt(horizPct)}</span>
              <span class="result-unit">% top</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('tilt.label_ground_dist')}</span>
              <span class="result-value">${isFinite(groundDist) ? this._fmt(groundDist) : '-'}</span>
              <span class="result-unit">m</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('tilt.label_aoa')}</span>
              <span class="result-value">${this._fmt(aoa)}</span>
              <span class="result-unit">°</span>
            </div>
          </div>
        </fpv-card>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'tilt-calculator': TiltCalculator }
}
