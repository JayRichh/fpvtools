import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import { computeLinkBudget } from '@core/rf/linkBudget'
import type { LinkBudgetInput, LinkBudgetResult } from '@core/rf/types'
import '../primitives/index.js'
import './rf-range-viz.js'

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

  private _i18n = new I18nController(this)

  @state() private _input: LinkBudgetInput = { ...DEFAULT_INPUT }
  @state() private _result: LinkBudgetResult = computeLinkBudget(DEFAULT_INPUT)
  @state() private _dualLink = false
  @state() private _secondaryInput: LinkBudgetInput = {
    txPowerMw: 25, txGainDbi: 2, rxGainDbi: 2, frequencyMhz: 5800, packetRateHz: 50,
  }
  @state() private _secondaryResult: LinkBudgetResult = computeLinkBudget({
    txPowerMw: 25, txGainDbi: 2, rxGainDbi: 2, frequencyMhz: 5800, packetRateHz: 50,
  })

  private _update(partial: Partial<LinkBudgetInput>) {
    this._input = { ...this._input, ...partial }
    this._result = computeLinkBudget(this._input)
  }

  private _updateSecondary(partial: Partial<LinkBudgetInput>) {
    this._secondaryInput = { ...this._secondaryInput, ...partial }
    this._secondaryResult = computeLinkBudget(this._secondaryInput)
  }

  render() {
    const r = this._result
    const freqOptions = [
      { value: '915', label: this._i18n.t('rf.freq_915') },
      { value: '2400', label: this._i18n.t('rf.freq_2400') },
      { value: '5800', label: this._i18n.t('rf.freq_5800') },
    ]
    return html`
      <div class="sections">
        <fpv-card .header=${this._i18n.t('rf.section_transmitter')}>
          <div class="rows">
            <fpv-number
              .label=${this._i18n.t('rf.label_tx_power')}
              .value=${this._input.txPowerMw}
              min="1"
              max="4000"
              step="25"
              unit="mW"
              @value-change=${(e: CustomEvent<number>) => this._update({ txPowerMw: e.detail })}
            ></fpv-number>
            <fpv-number
              .label=${this._i18n.t('rf.label_tx_gain')}
              .value=${this._input.txGainDbi}
              min="-5"
              max="20"
              step="0.5"
              unit="dBi"
              @value-change=${(e: CustomEvent<number>) => this._update({ txGainDbi: e.detail })}
            ></fpv-number>
          </div>
        </fpv-card>

        <fpv-card .header=${this._i18n.t('rf.section_receiver')}>
          <div class="rows">
            <fpv-number
              .label=${this._i18n.t('rf.label_rx_gain')}
              .value=${this._input.rxGainDbi}
              min="-5"
              max="20"
              step="0.5"
              unit="dBi"
              @value-change=${(e: CustomEvent<number>) => this._update({ rxGainDbi: e.detail })}
            ></fpv-number>
          </div>
        </fpv-card>

        <fpv-card .header=${this._i18n.t('rf.section_link_params')}>
          <div class="rows">
            <fpv-select
              .label=${this._i18n.t('common.frequency')}
              .value=${String(this._input.frequencyMhz)}
              .options=${freqOptions}
              @select-change=${(e: CustomEvent<string>) => this._update({ frequencyMhz: Number(e.detail) })}
            ></fpv-select>
            <fpv-number
              .label=${this._i18n.t('rf.label_packet_rate')}
              .value=${this._input.packetRateHz}
              min="25"
              max="500"
              step="25"
              unit="Hz"
              @value-change=${(e: CustomEvent<number>) => this._update({ packetRateHz: e.detail })}
            ></fpv-number>
          </div>
        </fpv-card>

        <fpv-card header="Dual Link">
          <div style="display:flex;align-items:center;gap:var(--fpv-space-sm);min-height:44px">
            <fpv-toggle
              label="Show second link (e.g. Walksnail 5.8GHz)"
              .checked=${this._dualLink}
              @toggle-change=${(e: CustomEvent<boolean>) => (this._dualLink = e.detail)}
            ></fpv-toggle>
          </div>
          ${this._dualLink ? html`
            <div class="rows" style="margin-top:var(--fpv-space-sm)">
              <fpv-number label="Video TX power" .value=${this._secondaryInput.txPowerMw} min="1" max="4000" step="25" unit="mW"
                @value-change=${(e: CustomEvent<number>) => this._updateSecondary({ txPowerMw: e.detail })}></fpv-number>
              <fpv-number label="Video TX gain" .value=${this._secondaryInput.txGainDbi} min="-5" max="20" step="0.5" unit="dBi"
                @value-change=${(e: CustomEvent<number>) => this._updateSecondary({ txGainDbi: e.detail })}></fpv-number>
              <fpv-number label="Video RX gain" .value=${this._secondaryInput.rxGainDbi} min="-5" max="20" step="0.5" unit="dBi"
                @value-change=${(e: CustomEvent<number>) => this._updateSecondary({ rxGainDbi: e.detail })}></fpv-number>
            </div>
          ` : ''}
        </fpv-card>

        <rf-range-viz
          style="height:220px"
          .primaryRangeKm=${r.theoreticalRangeKm}
          .primaryMarginDb=${r.linkMarginDb}
          primaryLabel="Control (ELRS)"
          .secondaryRangeKm=${this._secondaryResult.theoreticalRangeKm}
          .secondaryMarginDb=${this._secondaryResult.linkMarginDb}
          secondaryLabel="Video (5.8G)"
          .dualLink=${this._dualLink}
        ></rf-range-viz>

        <fpv-card .header=${this._i18n.t('common.results')}>
          <div class="rows">
            <div class="result-row">
              <span class="result-label">${this._i18n.t('rf.label_tx_power')}</span>
              <span class="result-value">${r.txPowerDbm.toFixed(1)} dBm</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('rf.label_sensitivity')}</span>
              <span class="result-value">${r.sensitivityDbm.toFixed(1)} dBm</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('rf.label_path_loss')}</span>
              <span class="result-value">${r.pathLossDb.toFixed(1)} dB</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('rf.label_link_margin')}</span>
              <span class="result-value">${r.linkMarginDb.toFixed(1)} dB</span>
            </div>
            <div class="result-row">
              <span class="result-label">${this._i18n.t('rf.label_theoretical_range')}</span>
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
