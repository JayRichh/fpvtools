import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import '../primitives/index.js'
import './tilt-viz.js'

const G = 9.81
const RHO = 1.225 // air density kg/m³ at sea level

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
  @state() private _fovDeg = 120
  @state() private _altitudeM = 30
  @state() private _auwG = 650
  @state() private _cdaCm2 = 300 // drag area Cd·A

  private _speedMS(): number {
    return this._unit === 'mph' ? this._speed * 0.44704 : this._speed
  }

  private _horizonPct(): number {
    return 50 + (this._tilt / (this._fovDeg / 2)) * 50
  }

  private _groundDist(): number {
    const tiltRad = (this._tilt * Math.PI) / 180
    const fovHalfRad = ((this._fovDeg / 2) * Math.PI) / 180
    const angle = tiltRad + fovHalfRad
    if (angle >= Math.PI / 2) return Infinity
    return this._altitudeM * Math.tan(angle)
  }

  // Steady level flight: tan(tilt) = drag / weight, with quadratic drag
  // D = ½·ρ·CdA·v². AoA is the prop-disk angle to the (horizontal) airflow.
  private _equilibriumTiltDeg(): number {
    const v = this._speedMS()
    const massKg = this._auwG / 1000
    const dragN = 0.5 * RHO * (this._cdaCm2 / 10000) * v * v
    return (Math.atan(dragN / (massKg * G)) * 180) / Math.PI
  }

  private _aoa(): number {
    return 90 - this._equilibriumTiltDeg()
  }

  private _fmt(n: number, digits = 1): string {
    if (!isFinite(n) || isNaN(n)) return '-'
    return parseFloat(n.toFixed(digits)).toString()
  }

  render() {
    const horizPct  = this._horizonPct()
    const groundDist = this._groundDist()
    const aoa        = this._aoa()
    const eqTilt     = this._equilibriumTiltDeg()

    return html`
      <div class="layout">
        <tilt-viz
          style="height:clamp(320px,48vh,520px)"
          .tiltDeg=${this._tilt}
          .fovDeg=${this._fovDeg}
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
            <fpv-number
              label="Camera FOV"
              .value=${this._fovDeg}
              min="60" max="180" step="5" unit="°"
              @value-change=${(e: CustomEvent<number>) => { this._fovDeg = e.detail }}
            ></fpv-number>
            <fpv-number
              label="Altitude"
              .value=${this._altitudeM}
              min="1" max="500" step="5" unit="m"
              @value-change=${(e: CustomEvent<number>) => { this._altitudeM = e.detail }}
            ></fpv-number>
            <fpv-number
              .label=${this._i18n.t('common.auw')}
              .value=${this._auwG}
              min="50" max="10000" step="50" unit="g"
              @value-change=${(e: CustomEvent<number>) => { this._auwG = e.detail }}
            ></fpv-number>
            <fpv-number
              label="Drag area Cd·A"
              .value=${this._cdaCm2}
              min="20" max="2000" step="10" unit="cm²"
              @value-change=${(e: CustomEvent<number>) => { this._cdaCm2 = e.detail }}
            ></fpv-number>
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
            <div class="result-row">
              <span class="result-label">Tilt to hold speed</span>
              <span class="result-value">${this._fmt(eqTilt)}</span>
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
