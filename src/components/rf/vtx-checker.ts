import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { checkVtxRules, COUNTRIES } from '@core/rf/rules'
import type { VtxRuleQuery, VtxRuleResult } from '@core/rf/types'
import '../primitives/index.js'

const BAND_OPTIONS = [
  { value: '5.8', label: '5.8 GHz (FPV Video)' },
  { value: '2.4', label: '2.4 GHz (RC Link)' },
  { value: '915', label: '915 MHz (Long Range)' },
]

const DEFAULT_QUERY: VtxRuleQuery = {
  country: 'USA (FCC)',
  band: '5.8',
  powerMw: 200,
  channelMhz: 5800,
}

@customElement('vtx-checker')
export class VtxChecker extends LitElement {
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

      .verdict {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-sm);
        padding: var(--fpv-space-sm) 0;
      }

      .verdict-label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
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

      .note {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        line-height: 1.5;
        padding-top: var(--fpv-space-xs);
      }
    `,
  ]

  @state() private _query: VtxRuleQuery = { ...DEFAULT_QUERY }
  @state() private _result: VtxRuleResult = checkVtxRules(DEFAULT_QUERY)

  private _update(partial: Partial<VtxRuleQuery>) {
    this._query = { ...this._query, ...partial }
    this._result = checkVtxRules(this._query)
  }

  render() {
    const r = this._result
    const countryOptions = COUNTRIES.map(c => ({ value: c, label: c }))
    return html`
      <div class="sections">
        <fpv-card header="Setup">
          <div class="rows">
            <fpv-select
              label="Country"
              .value=${this._query.country}
              .options=${countryOptions}
              @select-change=${(e: CustomEvent<string>) => this._update({ country: e.detail })}
            ></fpv-select>
            <fpv-select
              label="Band"
              .value=${this._query.band}
              .options=${BAND_OPTIONS}
              @select-change=${(e: CustomEvent<string>) => this._update({ band: e.detail as VtxRuleQuery['band'] })}
            ></fpv-select>
            <fpv-number
              label="Power"
              .value=${this._query.powerMw}
              min="1"
              max="4000"
              step="25"
              unit="mW"
              @value-change=${(e: CustomEvent<number>) => this._update({ powerMw: e.detail })}
            ></fpv-number>
          </div>
        </fpv-card>

        <fpv-card header="Compliance">
          <div class="rows">
            <div class="verdict">
              <span class="verdict-label">Status</span>
              <fpv-badge variant=${r.compliant ? 'success' : 'error'}>
                ${r.compliant ? 'Compliant' : 'Non-Compliant'}
              </fpv-badge>
            </div>
            <div class="result-row">
              <span class="result-label">Limit</span>
              <span class="result-value">${r.limitMw} mW (${r.limitDbm.toFixed(1)} dBm)</span>
            </div>
            <div class="result-row">
              <span class="result-label">Your Power</span>
              <span class="result-value">${this._query.powerMw} mW</span>
            </div>
            ${r.note ? html`<p class="note">${r.note}</p>` : ''}
          </div>
        </fpv-card>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vtx-checker': VtxChecker
  }
}
