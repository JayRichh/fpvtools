import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { CELL_LIBRARY } from '@core/power/cells'
import { computePack } from '@core/power/pack'
import type { PackConfig, FlightModel, PackResult } from '@core/power/types'
import '../primitives/index.js'

const DEFAULT_CELL_KEY = 'Molicel P42A'

@customElement('pack-calculator')
export class PackCalculator extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }

      .layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--fpv-space-md);
      }

      @media (max-width: 768px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }

      .inputs {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
      }

      .results {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
      }

      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-sm);
      }

      .result-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--fpv-space-xs) var(--fpv-space-sm);
      }

      .result-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--fpv-space-sm);
        padding: 2px 0;
        border-bottom: 1px solid var(--fpv-border);
      }

      .result-row:last-child {
        border-bottom: none;
      }

      .result-label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        flex-shrink: 0;
      }

      .result-value {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        color: var(--fpv-text);
        text-align: right;
      }

      .verdicts {
        display: flex;
        gap: var(--fpv-space-sm);
        flex-wrap: wrap;
        padding-top: var(--fpv-space-xs);
      }

      .no-result {
        color: var(--fpv-text-muted);
        font-size: var(--fpv-font-label);
        padding: var(--fpv-space-md) 0;
      }
    `,
  ]

  @state() private _packConfig: PackConfig = {
    cell: CELL_LIBRARY[DEFAULT_CELL_KEY],
    series: 6,
    parallel: 1,
    wiringOverheadPct: 5,
  }

  @state() private _flightModel: FlightModel = {
    auwG: 1200,
    hoverEfficiencyGPerW: 5,
    cruiseFactor: 0.7,
    cruiseSpeedMs: 15,
    usableCapacityPct: 80,
  }

  @state() private _result: PackResult | null = null

  connectedCallback() {
    super.connectedCallback()
    this._recompute()
  }

  private _recompute() {
    this._result = computePack(this._packConfig, this._flightModel)
  }

  private _updatePack(partial: Partial<PackConfig>) {
    this._packConfig = { ...this._packConfig, ...partial }
    this._recompute()
  }

  private _updateFlight(partial: Partial<FlightModel>) {
    this._flightModel = { ...this._flightModel, ...partial }
    this._recompute()
  }

  private _renderCellSelect() {
    const cellKeys = Object.keys(CELL_LIBRARY)
    const options = cellKeys.map(k => ({ value: k, label: k }))
    const selectedKey = this._packConfig.cell.name
    return html`
      <fpv-card header="Cell">
        <fpv-select
          label="Model"
          .value=${selectedKey}
          .options=${options}
          @select-change=${(e: CustomEvent<string>) => {
            const cell = CELL_LIBRARY[e.detail]
            if (cell) this._updatePack({ cell })
          }}
        ></fpv-select>
      </fpv-card>
    `
  }

  private _renderPackConfig() {
    const p = this._packConfig
    return html`
      <fpv-card header="Pack Config">
        <div class="rows">
          <fpv-number
            label="Series"
            .value=${p.series}
            min="1" max="14" step="1"
            @value-change=${(e: CustomEvent<number>) => this._updatePack({ series: e.detail })}
          ></fpv-number>
          <fpv-number
            label="Parallel"
            .value=${p.parallel}
            min="1" max="4" step="1"
            @value-change=${(e: CustomEvent<number>) => this._updatePack({ parallel: e.detail })}
          ></fpv-number>
          <fpv-number
            label="Wiring"
            .value=${p.wiringOverheadPct}
            min="0" max="20" step="1"
            unit="%"
            @value-change=${(e: CustomEvent<number>) => this._updatePack({ wiringOverheadPct: e.detail })}
          ></fpv-number>
        </div>
      </fpv-card>
    `
  }

  private _renderFlightModel() {
    const f = this._flightModel
    return html`
      <fpv-card header="Flight Model">
        <div class="rows">
          <fpv-number
            label="AUW"
            .value=${f.auwG}
            min="100" max="10000" step="50"
            unit="g"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ auwG: e.detail })}
          ></fpv-number>
          <fpv-number
            label="Hover Eff"
            .value=${f.hoverEfficiencyGPerW}
            min="1" max="20" step="0.5"
            unit="g/W"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ hoverEfficiencyGPerW: e.detail })}
          ></fpv-number>
          <fpv-number
            label="Cruise Fac"
            .value=${f.cruiseFactor}
            min="0.3" max="1.0" step="0.05"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ cruiseFactor: e.detail })}
          ></fpv-number>
          <fpv-number
            label="Speed"
            .value=${f.cruiseSpeedMs}
            min="1" max="50" step="1"
            unit="m/s"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ cruiseSpeedMs: e.detail })}
          ></fpv-number>
          <fpv-number
            label="Usable Cap"
            .value=${f.usableCapacityPct}
            min="50" max="100" step="5"
            unit="%"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ usableCapacityPct: e.detail })}
          ></fpv-number>
        </div>
      </fpv-card>
    `
  }

  private _renderResults() {
    const r = this._result
    if (!r) {
      return html`<fpv-card header="Results"><p class="no-result">Configure inputs above.</p></fpv-card>`
    }

    return html`
      <fpv-card header="Pack">
        <div class="rows">
          <div class="result-row">
            <span class="result-label">Voltage</span>
            <span class="result-value">${r.nominalV.toFixed(1)} V</span>
          </div>
          <div class="result-row">
            <span class="result-label">Capacity</span>
            <span class="result-value">${r.capacityMah} mAh · ${r.energyWh.toFixed(1)} Wh</span>
          </div>
          <div class="result-row">
            <span class="result-label">Weight</span>
            <span class="result-value">${r.weightG.toFixed(0)} g</span>
          </div>
          <div class="result-row">
            <span class="result-label">Max Cont</span>
            <span class="result-value">${r.maxContinuousA.toFixed(0)} A</span>
          </div>
          <div class="result-row">
            <span class="result-label">Pack IR</span>
            <span class="result-value">${r.packIRmohm.toFixed(1)} mΩ</span>
          </div>
        </div>
      </fpv-card>

      <fpv-card header="Flight">
        <div class="rows">
          <div class="result-row">
            <span class="result-label">Hover I</span>
            <span class="result-value">${r.hoverCurrentA.toFixed(1)} A</span>
          </div>
          <div class="result-row">
            <span class="result-label">Cruise I</span>
            <span class="result-value">${r.cruiseCurrentA.toFixed(1)} A</span>
          </div>
          <div class="result-row">
            <span class="result-label">Hover Time</span>
            <span class="result-value">${r.hoverTimeMin.toFixed(1)} min</span>
          </div>
          <div class="result-row">
            <span class="result-label">Cruise Time</span>
            <span class="result-value">${r.cruiseTimeMin.toFixed(1)} min</span>
          </div>
          <div class="result-row">
            <span class="result-label">Voltage Sag</span>
            <span class="result-value">${r.voltageSagV.toFixed(2)} V</span>
          </div>
          <div class="result-row">
            <span class="result-label">Range</span>
            <span class="result-value">${r.rangeKm.toFixed(1)} km</span>
          </div>
        </div>
      </fpv-card>

      <fpv-card header="Verdicts">
        <div class="verdicts">
          <fpv-badge variant=${r.cRateOk ? 'success' : 'error'}>
            C-rate ${r.cRateOk ? `OK ×${r.cRateMargin.toFixed(1)}` : 'OVER'}
          </fpv-badge>
          ${r.sagWarning
            ? html`<fpv-badge variant="warning">Sag warning ${r.voltageSagV.toFixed(2)} V</fpv-badge>`
            : html`<fpv-badge variant="success">Sag OK</fpv-badge>`
          }
        </div>
      </fpv-card>
    `
  }

  render() {
    return html`
      <div class="layout">
        <div class="inputs">
          ${this._renderCellSelect()}
          ${this._renderPackConfig()}
          ${this._renderFlightModel()}
        </div>
        <div class="results">
          ${this._renderResults()}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pack-calculator': PackCalculator
  }
}
