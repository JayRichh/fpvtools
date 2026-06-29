import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { computeLinkBudget } from '@core/rf/linkBudget'
import type { LinkBudgetInput, LinkBudgetResult } from '@core/rf/types'
import '../primitives/index.js'

const FREQ_OPTIONS = [
  { value: '915', label: '915 MHz (ELRS Long Range)' },
  { value: '2400', label: '2400 MHz (2.4 GHz ELRS)' },
  { value: '5800', label: '5800 MHz (5.8 GHz Video)' },
]

const DEFAULT_INPUT: LinkBudgetInput = {
  txPowerMw: 100,
  txGainDbi: 2,
  rxGainDbi: 2,
  frequencyMhz: 2400,
  packetRateHz: 50,
}

@customElement('link-budget')
export class LinkBudget extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }

      .sections {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
      }

      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-sm);
      }

      .result-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--fpv-space-xs) 0;
        border-bottom: 1px solid var(--fpv-border);
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
      }

      .result-row:last-child {
        border-bottom: none;
      }

      .result-label {
        color: var(--fpv-text-muted);
        font-size: var(--fpv-font-label);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .result-value {
        color: var(--fpv-text);
        font-weight: 600;
      }

      .result-value.highlight {
        color: var(--fpv-primary);
        font-size: 1.1em;
      }
    `,
  ]

  @state() private _input: LinkBudgetInput = { ...DEFAULT_INPUT }
  @state() private _result: LinkBudgetResult = computeLinkBudget(DEFAULT_INPUT)

  private _update(partial: Partial<LinkBudgetInput>) {
    this._input = { ...this._input, ...partial }
    this._result = computeLinkBudget(this._input)
  }

  render() {
    const r = this._result
    return html`
      <div class="sections">
        <fpv-card header="Transmitter">
          <div class="rows">
            <fpv-number
              label="TX Power"
              .value=${this._input.txPowerMw}
              min="1"
              max="4000"
              step="25"
              unit="mW"
              @value-change=${(e: CustomEvent<number>) => this._update({ txPowerMw: e.detail })}
            ></fpv-number>
            <fpv-number
              label="TX Gain"
              .value=${this._input.txGainDbi}
              min="-5"
              max="20"
              step="0.5"
              unit="dBi"
              @value-change=${(e: CustomEvent<number>) => this._update({ txGainDbi: e.detail })}
            ></fpv-number>
          </div>
        </fpv-card>

        <fpv-card header="Receiver">
          <div class="rows">
            <fpv-number
              label="RX Gain"
              .value=${this._input.rxGainDbi}
              min="-5"
              max="20"
              step="0.5"
              unit="dBi"
              @value-change=${(e: CustomEvent<number>) => this._update({ rxGainDbi: e.detail })}
            ></fpv-number>
          </div>
        </fpv-card>

        <fpv-card header="Link Parameters">
          <div class="rows">
            <fpv-select
              label="Frequency"
              .value=${String(this._input.frequencyMhz)}
              .options=${FREQ_OPTIONS}
              @select-change=${(e: CustomEvent<string>) => this._update({ frequencyMhz: Number(e.detail) })}
            ></fpv-select>
            <fpv-number
              label="Packet Rate"
              .value=${this._input.packetRateHz}
              min="25"
              max="500"
              step="25"
              unit="Hz"
              @value-change=${(e: CustomEvent<number>) => this._update({ packetRateHz: e.detail })}
            ></fpv-number>
          </div>
        </fpv-card>

        <fpv-card header="Results">
          <div class="rows">
            <div class="result-row">
              <span class="result-label">TX Power</span>
              <span class="result-value">${r.txPowerDbm.toFixed(1)} dBm</span>
            </div>
            <div class="result-row">
              <span class="result-label">Sensitivity</span>
              <span class="result-value">${r.sensitivityDbm.toFixed(1)} dBm</span>
            </div>
            <div class="result-row">
              <span class="result-label">Path Loss @ 1km</span>
              <span class="result-value">${r.pathLossDb.toFixed(1)} dB</span>
            </div>
            <div class="result-row">
              <span class="result-label">Link Margin</span>
              <span class="result-value">${r.linkMarginDb.toFixed(1)} dB</span>
            </div>
            <div class="result-row">
              <span class="result-label">Theoretical Range</span>
              <span class="result-value highlight">${r.theoreticalRangeKm.toFixed(2)} km</span>
            </div>
          </div>
        </fpv-card>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'link-budget': LinkBudget
  }
}
