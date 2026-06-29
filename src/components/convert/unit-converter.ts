import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import '../primitives/index.js'
import {
  mwToDbm,
  dbmToMw,
  mahToWh,
  whToMah,
  kvToRpm,
  rpmToHz,
  hzToRpm,
  rpmToRadS,
  awgAmpacity,
  voltageDropV,
} from '@core/rf/convert'

function radSToRpm(rads: number): number {
  return (rads * 60) / (2 * Math.PI)
}

const AWG_OPTIONS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map((n) => ({
  value: String(n),
  label: `AWG ${n}`,
}))

@customElement('unit-converter')
export class UnitConverter extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }
      .panels {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
        padding-top: var(--fpv-space-md);
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-sm);
      }
      .result-row {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-sm);
      }
      .result-label {
        min-width: 80px;
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
        color: var(--fpv-primary);
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        padding: 4px var(--fpv-space-sm);
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

  @state() private _tab = 0

  // Power: dBm <-> mW (canonical: mw)
  @state() private _mw = 1

  // Power: mAh <-> Wh (canonical: mah)
  @state() private _mah = 1000
  @state() private _powerV = 3.7

  // Frequency: KV -> RPM
  @state() private _kv = 2300
  @state() private _kvV = 4.2

  // Frequency: RPM <-> Hz <-> rad/s (canonical: rpm)
  @state() private _rpm = 10000

  // Electrical
  @state() private _awg = '18'
  @state() private _currentA = 10
  @state() private _lengthM = 1

  // Angle: deg <-> rad (canonical: deg)
  @state() private _angleDeg = 45

  private _safeNum(n: number, fallback = 0): number {
    return isFinite(n) && !isNaN(n) ? n : fallback
  }

  private _fmtDisplay(n: number, digits = 4): string {
    if (!isFinite(n) || isNaN(n)) return '—'
    return parseFloat(n.toFixed(digits)).toString()
  }

  private _renderPower() {
    const dbm = mwToDbm(Math.max(this._mw, 0.0001))
    const wh = mahToWh(this._mah, this._powerV)
    return html`
      <fpv-card header="dBm ⇄ mW">
        <div class="rows">
          <fpv-number
            label="mW"
            .value=${this._mw}
            min="0.001"
            step="0.1"
            unit="mW"
            @value-change=${(e: CustomEvent<number>) => {
              this._mw = e.detail
            }}
          ></fpv-number>
          <fpv-number
            label="dBm"
            .value=${this._safeNum(parseFloat(dbm.toFixed(4)))}
            step="0.1"
            unit="dBm"
            @value-change=${(e: CustomEvent<number>) => {
              this._mw = dbmToMw(e.detail)
            }}
          ></fpv-number>
        </div>
      </fpv-card>
      <fpv-card header="mAh ⇄ Wh">
        <div class="rows">
          <fpv-number
            label="Voltage"
            .value=${this._powerV}
            min="0.1"
            max="100"
            step="0.1"
            unit="V"
            @value-change=${(e: CustomEvent<number>) => {
              this._powerV = e.detail
            }}
          ></fpv-number>
          <fpv-number
            label="mAh"
            .value=${this._mah}
            min="0"
            step="10"
            unit="mAh"
            @value-change=${(e: CustomEvent<number>) => {
              this._mah = e.detail
            }}
          ></fpv-number>
          <fpv-number
            label="Wh"
            .value=${this._safeNum(parseFloat(wh.toFixed(4)))}
            min="0"
            step="0.01"
            unit="Wh"
            @value-change=${(e: CustomEvent<number>) => {
              if (this._powerV > 0) {
                this._mah = whToMah(e.detail, this._powerV)
              }
            }}
          ></fpv-number>
        </div>
      </fpv-card>
    `
  }

  private _renderFrequency() {
    const kvRpm = kvToRpm(this._kv, this._kvV)
    const hz = rpmToHz(this._rpm)
    const rads = rpmToRadS(this._rpm)
    return html`
      <fpv-card header="KV → RPM">
        <div class="rows">
          <fpv-number
            label="KV"
            .value=${this._kv}
            min="0"
            max="20000"
            step="100"
            unit="KV"
            @value-change=${(e: CustomEvent<number>) => {
              this._kv = e.detail
            }}
          ></fpv-number>
          <fpv-number
            label="Voltage"
            .value=${this._kvV}
            min="0.1"
            max="60"
            step="0.1"
            unit="V"
            @value-change=${(e: CustomEvent<number>) => {
              this._kvV = e.detail
            }}
          ></fpv-number>
          <div class="result-row">
            <span class="result-label">RPM</span>
            <span class="result-value">${this._fmtDisplay(kvRpm, 0)}</span>
            <span class="result-unit">RPM</span>
          </div>
        </div>
      </fpv-card>
      <fpv-card header="RPM ⇄ Hz ⇄ rad/s">
        <div class="rows">
          <fpv-number
            label="RPM"
            .value=${this._rpm}
            min="0"
            step="100"
            unit="RPM"
            @value-change=${(e: CustomEvent<number>) => {
              this._rpm = e.detail
            }}
          ></fpv-number>
          <fpv-number
            label="Hz"
            .value=${this._safeNum(parseFloat(hz.toFixed(4)))}
            min="0"
            step="1"
            unit="Hz"
            @value-change=${(e: CustomEvent<number>) => {
              this._rpm = hzToRpm(e.detail)
            }}
          ></fpv-number>
          <fpv-number
            label="rad/s"
            .value=${this._safeNum(parseFloat(rads.toFixed(4)))}
            min="0"
            step="0.1"
            unit="rad/s"
            @value-change=${(e: CustomEvent<number>) => {
              this._rpm = radSToRpm(e.detail)
            }}
          ></fpv-number>
        </div>
      </fpv-card>
    `
  }

  private _renderElectrical() {
    const awgNum = Number(this._awg)
    const ampacity = awgAmpacity(awgNum)
    const drop = voltageDropV(this._currentA, awgNum, this._lengthM)
    return html`
      <fpv-card header="AWG → Ampacity">
        <div class="rows">
          <fpv-select
            label="AWG"
            .value=${this._awg}
            .options=${AWG_OPTIONS}
            @select-change=${(e: CustomEvent<string>) => {
              this._awg = e.detail
            }}
          ></fpv-select>
          <div class="result-row">
            <span class="result-label">Ampacity</span>
            <span class="result-value">${this._fmtDisplay(ampacity, 2)}</span>
            <span class="result-unit">A</span>
          </div>
        </div>
      </fpv-card>
      <fpv-card header="Voltage Drop">
        <div class="rows">
          <fpv-number
            label="Current"
            .value=${this._currentA}
            min="0"
            step="0.5"
            unit="A"
            @value-change=${(e: CustomEvent<number>) => {
              this._currentA = e.detail
            }}
          ></fpv-number>
          <fpv-select
            label="AWG"
            .value=${this._awg}
            .options=${AWG_OPTIONS}
            @select-change=${(e: CustomEvent<string>) => {
              this._awg = e.detail
            }}
          ></fpv-select>
          <fpv-number
            label="Length"
            .value=${this._lengthM}
            min="0"
            step="0.1"
            unit="m"
            @value-change=${(e: CustomEvent<number>) => {
              this._lengthM = e.detail
            }}
          ></fpv-number>
          <div class="result-row">
            <span class="result-label">V Drop</span>
            <span class="result-value">${this._fmtDisplay(drop, 4)}</span>
            <span class="result-unit">V</span>
          </div>
        </div>
      </fpv-card>
    `
  }

  private _renderAngle() {
    const rad = this._angleDeg * (Math.PI / 180)
    return html`
      <fpv-card header="Degrees ⇄ Radians">
        <div class="rows">
          <fpv-number
            label="Degrees"
            .value=${this._angleDeg}
            step="1"
            unit="°"
            @value-change=${(e: CustomEvent<number>) => {
              this._angleDeg = e.detail
            }}
          ></fpv-number>
          <fpv-number
            label="Radians"
            .value=${this._safeNum(parseFloat(rad.toFixed(6)))}
            step="0.01"
            unit="rad"
            @value-change=${(e: CustomEvent<number>) => {
              this._angleDeg = e.detail * (180 / Math.PI)
            }}
          ></fpv-number>
        </div>
      </fpv-card>
    `
  }

  render() {
    return html`
      <fpv-tabs
        .tabs=${['Power', 'Frequency', 'Electrical', 'Angle']}
        .active=${this._tab}
        @tab-change=${(e: CustomEvent<number>) => {
          this._tab = e.detail
        }}
      ></fpv-tabs>
      <div class="panels">
        ${this._tab === 0 ? this._renderPower() : ''}
        ${this._tab === 1 ? this._renderFrequency() : ''}
        ${this._tab === 2 ? this._renderElectrical() : ''}
        ${this._tab === 3 ? this._renderAngle() : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'unit-converter': UnitConverter
  }
}
