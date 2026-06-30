import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import { CELL_LIBRARY } from '@core/power/cells'
import { computePack } from '@core/power/pack'
import type { PackConfig, FlightModel, PackResult } from '@core/power/types'
import '../primitives/index.js'
import './pack-viz.js'

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

  private _i18n = new I18nController(this)

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
      <fpv-card .header=${this._i18n.t('power.section_cell')}>
        <fpv-select
          .label=${this._i18n.t('power.label_model')}
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
      <fpv-card .header=${this._i18n.t('power.section_pack_config')}>
        <div class="rows">
          <fpv-number
            .label=${this._i18n.t('power.label_series')}
            .value=${p.series}
            min="1" max="14" step="1"
            @value-change=${(e: CustomEvent<number>) => this._updatePack({ series: e.detail })}
          ></fpv-number>
          <fpv-number
            .label=${this._i18n.t('power.label_parallel')}
            .value=${p.parallel}
            min="1" max="4" step="1"
            @value-change=${(e: CustomEvent<number>) => this._updatePack({ parallel: e.detail })}
          ></fpv-number>
          <fpv-number
            .label=${this._i18n.t('power.label_wiring')}
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
      <fpv-card .header=${this._i18n.t('power.section_flight_model')}>
        <div class="rows">
          <fpv-number
            .label=${this._i18n.t('common.auw')}
            .value=${f.auwG}
            min="100" max="10000" step="50"
            unit="g"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ auwG: e.detail })}
          ></fpv-number>
          <fpv-number
            .label=${this._i18n.t('power.label_hover_eff')}
            .value=${f.hoverEfficiencyGPerW}
            min="1" max="20" step="0.5"
            unit="g/W"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ hoverEfficiencyGPerW: e.detail })}
          ></fpv-number>
          <fpv-number
            .label=${this._i18n.t('power.label_cruise_fac')}
            .value=${f.cruiseFactor}
            min="0.3" max="1.0" step="0.05"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ cruiseFactor: e.detail })}
          ></fpv-number>
          <fpv-number
            .label=${this._i18n.t('common.speed')}
            .value=${f.cruiseSpeedMs}
            min="1" max="50" step="1"
            unit="m/s"
            @value-change=${(e: CustomEvent<number>) => this._updateFlight({ cruiseSpeedMs: e.detail })}
          ></fpv-number>
          <fpv-number
            .label=${this._i18n.t('power.label_usable_cap')}
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
      return html`<fpv-card .header=${this._i18n.t('common.results')}><p class="no-result">${this._i18n.t('power.empty')}</p></fpv-card>`
    }

    return html`
      <fpv-card .header=${this._i18n.t('power.section_pack')}>
        <div class="rows">
          <div class="result-row">
            <span class="result-label">${this._i18n.t('common.voltage')}</span>
            <span class="result-value">${r.nominalV.toFixed(1)} V</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_capacity')}</span>
            <span class="result-value">${r.capacityMah} mAh · ${r.energyWh.toFixed(1)} Wh</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('common.weight')}</span>
            <span class="result-value">${r.weightG.toFixed(0)} g</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_max_cont')}</span>
            <span class="result-value">${r.maxContinuousA.toFixed(0)} A</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_pack_ir')}</span>
            <span class="result-value">${r.packIRmohm.toFixed(1)} mΩ</span>
          </div>
        </div>
      </fpv-card>

      <fpv-card .header=${this._i18n.t('power.section_flight')}>
        <div class="rows">
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_hover_i')}</span>
            <span class="result-value">${r.hoverCurrentA.toFixed(1)} A</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_cruise_i')}</span>
            <span class="result-value">${r.cruiseCurrentA.toFixed(1)} A</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_hover_time')}</span>
            <span class="result-value">${r.hoverTimeMin.toFixed(1)} min</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_cruise_time')}</span>
            <span class="result-value">${r.cruiseTimeMin.toFixed(1)} min</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('power.label_voltage_sag')}</span>
            <span class="result-value">${r.voltageSagV.toFixed(2)} V</span>
          </div>
          <div class="result-row">
            <span class="result-label">${this._i18n.t('common.range')}</span>
            <span class="result-value">${r.rangeKm.toFixed(1)} km</span>
          </div>
        </div>
      </fpv-card>

      <fpv-card .header=${this._i18n.t('power.section_verdicts')}>
        <div class="verdicts">
          <fpv-badge variant=${r.cRateOk ? 'success' : 'error'}>
            ${r.cRateOk
              ? this._i18n.t('power.verdict_crate_ok', { margin: r.cRateMargin.toFixed(1) })
              : this._i18n.t('power.verdict_crate_over')}
          </fpv-badge>
          ${r.sagWarning
            ? html`<fpv-badge variant="warning">${this._i18n.t('power.verdict_sag_warning', { v: r.voltageSagV.toFixed(2) })}</fpv-badge>`
            : html`<fpv-badge variant="success">${this._i18n.t('power.verdict_sag_ok')}</fpv-badge>`
          }
        </div>
      </fpv-card>
    `
  }

  render() {
    const p = this._packConfig
    const r = this._result
    const dischargePct = r
      ? Math.min(1, (r.hoverCurrentA / (p.cell.maxContinuousA * p.parallel)))
      : 0

    return html`
      <div class="layout">
        <div class="inputs">
          ${this._renderCellSelect()}
          ${this._renderPackConfig()}
          ${this._renderFlightModel()}
        </div>
        <div class="results">
          <pack-viz
            style="height:clamp(260px,36vh,380px)"
            .cellCount=${p.series}
            .parallelCount=${p.parallel}
            .voltagePerCell=${p.cell.nominalV}
            .dischargePct=${dischargePct}
          ></pack-viz>
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
