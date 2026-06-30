import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import { computeFlightTime, FLIGHTTIME_DEFAULTS } from '@core/flighttime/calculate.js'
import type { FlightTimeInput, FlightTimeResult } from '@core/flighttime/types.js'
import '../primitives/index.js'
import './flight-time-canvas.js'
import './flight-time-viz.js'

@customElement('flight-time-calculator')
export class FlightTimeCalculator extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host { display: block; }

      .layout {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-lg);
      }
      .lower {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: var(--fpv-space-lg);
        align-items: start;
      }
      @media (max-width: 768px) { .lower { grid-template-columns: 1fr; } }
      flight-time-viz { height: 260px; }

      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-sm);
      }

      .results {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
      }

      .result-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--fpv-space-xs) 0;
        border-bottom: 1px solid var(--fpv-border);
      }
      .result-row:last-child { border-bottom: none; }

      .result-label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .result-value {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        color: var(--fpv-text);
        text-align: right;
        margin-left: var(--fpv-space-sm);
      }
      .result-value.warn { color: var(--fpv-accent); }
      .result-value.error { color: var(--fpv-error); }

      .chem-seg {
        display: flex;
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        overflow: hidden;
      }
      .chem-seg button {
        flex: 1;
        padding: 10px;
        background: transparent;
        color: var(--fpv-text-muted);
        border: none;
        cursor: pointer;
        font-family: var(--fpv-font-sans);
        font-size: var(--fpv-font-body);
        min-height: 44px;
        border-right: 1px solid var(--fpv-border);
        transition: background 0.12s, color 0.12s;
      }
      .chem-seg button:last-child { border-right: none; }
      .chem-seg button.active { background: var(--fpv-primary); color: var(--fpv-surface); font-weight: 600; }

      flight-time-canvas { height: 220px; }

      .warn-msg {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-xs);
        font-size: var(--fpv-font-label);
        padding: var(--fpv-space-xs) var(--fpv-space-sm);
        border-radius: var(--fpv-radius-sm);
        border: 1px solid;
        color: var(--fpv-accent);
        border-color: color-mix(in srgb, var(--fpv-accent) 40%, transparent);
        background: color-mix(in srgb, var(--fpv-accent) 8%, transparent);
      }
      .warn-msg.error {
        color: var(--fpv-error);
        border-color: color-mix(in srgb, var(--fpv-error) 40%, transparent);
        background: color-mix(in srgb, var(--fpv-error) 8%, transparent);
      }
    `,
  ]

  private _i18n = new I18nController(this)

  @state() private _input: FlightTimeInput = { ...FLIGHTTIME_DEFAULTS }
  @state() private _result: FlightTimeResult | null = null

  private get _computed(): FlightTimeResult {
    return computeFlightTime(this._input)
  }

  private _set<K extends keyof FlightTimeInput>(k: K, v: FlightTimeInput[K]) {
    this._input = { ...this._input, [k]: v }
    this._result = this._computed
  }

  // Called externally by FlightTimeView to pre-fill from motor calc
  setFromMotors(hoverEfficiencyGPerW: number, totalHoverCurrentA: number, auwG: number) {
    this._input = { ...this._input, hoverEfficiencyGPerW, totalHoverCurrentA, auwG }
    this._result = this._computed
  }

  connectedCallback() {
    super.connectedCallback()
    this._result = this._computed
  }

  private _cDischargeWarn(c: number): string {
    if (c > 10) return 'error'
    if (c > 6) return 'warn'
    return ''
  }

  render() {
    const inp = this._input
    const res = this._result

    return html`
      <div class="layout">
        <flight-time-viz
          .result=${res}
          chemistry=${inp.chemistry}
          .cellCount=${inp.cellCount}
        ></flight-time-viz>

        <div class="lower">
        <!-- Controls -->
        <div class="controls">
          <fpv-card header="Battery">
            <div class="rows">
              <div>
                <div style="font-size:var(--fpv-font-label);color:var(--fpv-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Chemistry</div>
                <div class="chem-seg">
                  <button class=${inp.chemistry === 'liion' ? 'active' : ''} @click=${() => this._set('chemistry', 'liion')}>Li-ion</button>
                  <button class=${inp.chemistry === 'lipo' ? 'active' : ''} @click=${() => this._set('chemistry', 'lipo')}>LiPo</button>
                </div>
              </div>
              <fpv-number label="Cell count (S)" .value=${inp.cellCount} min="1" max="14" step="1" unit="S"
                @value-change=${(e: CustomEvent<number>) => this._set('cellCount', e.detail)}></fpv-number>
              <fpv-number label="Parallel count (P)" .value=${inp.parallelCount} min="1" max="8" step="1" unit="P"
                @value-change=${(e: CustomEvent<number>) => this._set('parallelCount', e.detail)}></fpv-number>
              <fpv-number label="Capacity per cell" .value=${inp.capacityPerCellMah} min="100" max="10000" step="100" unit="mAh"
                @value-change=${(e: CustomEvent<number>) => this._set('capacityPerCellMah', e.detail)}></fpv-number>
              <fpv-number label="Usable %" .value=${Math.round(inp.usablePct * 100)} min="50" max="100" step="5" unit="%"
                @value-change=${(e: CustomEvent<number>) => this._set('usablePct', e.detail / 100)}></fpv-number>
              <fpv-number label="Reserve %" .value=${Math.round(inp.reservePct * 100)} min="0" max="40" step="5" unit="%"
                @value-change=${(e: CustomEvent<number>) => this._set('reservePct', e.detail / 100)}></fpv-number>
            </div>
          </fpv-card>

          <fpv-card header="Craft">
            <div class="rows">
              <fpv-number label="AUW" .value=${inp.auwG} min="100" max="10000" step="50" unit="g"
                @value-change=${(e: CustomEvent<number>) => this._set('auwG', e.detail)}></fpv-number>
              <fpv-number label="Total hover current" .value=${inp.totalHoverCurrentA} min="1" max="200" step="0.5" unit="A"
                @value-change=${(e: CustomEvent<number>) => this._set('totalHoverCurrentA', e.detail)}></fpv-number>
              <fpv-number label="Hover efficiency" .value=${inp.hoverEfficiencyGPerW} min="1" max="20" step="0.1" unit="g/W"
                @value-change=${(e: CustomEvent<number>) => this._set('hoverEfficiencyGPerW', e.detail)}></fpv-number>
            </div>
          </fpv-card>

          <fpv-card header="Cruise">
            <div class="rows">
              <fpv-number label="Throttle vs hover" .value=${Math.round(inp.cruiseThrottlePct * 100)} min="10" max="150" step="5" unit="%"
                @value-change=${(e: CustomEvent<number>) => this._set('cruiseThrottlePct', e.detail / 100)}></fpv-number>
              <fpv-number label="Cruise speed" .value=${inp.cruiseSpeedKmh} min="10" max="300" step="5" unit="km/h"
                @value-change=${(e: CustomEvent<number>) => this._set('cruiseSpeedKmh', e.detail)}></fpv-number>
            </div>
          </fpv-card>
        </div>

        <!-- Results -->
        <div class="results">
          <flight-time-canvas
            .result=${res}
            .chemistry=${inp.chemistry}
            .cellCount=${inp.cellCount}
          ></flight-time-canvas>

          <fpv-card header="Results">
            <div class="rows">
              ${res ? html`
                <div class="result-row">
                  <span class="result-label">Usable capacity</span>
                  <span class="result-value">${res.usableCapacityMah.toFixed(0)} mAh</span>
                </div>
                <div class="result-row">
                  <span class="result-label">Hover time</span>
                  <span class="result-value">${res.hoverTimeMin.toFixed(1)} min</span>
                </div>
                <div class="result-row">
                  <span class="result-label">Cruise time</span>
                  <span class="result-value">${res.cruiseTimeMin.toFixed(1)} min</span>
                </div>
                <div class="result-row">
                  <span class="result-label">Max range</span>
                  <span class="result-value">${res.maxRangeKm.toFixed(2)} km</span>
                </div>
                <div class="result-row">
                  <span class="result-label">Hover current</span>
                  <span class="result-value">${res.hoverCurrentA.toFixed(1)} A</span>
                </div>
                <div class="result-row">
                  <span class="result-label">Cruise current</span>
                  <span class="result-value">${res.cruiseCurrentA.toFixed(1)} A</span>
                </div>
                <div class="result-row">
                  <span class="result-label">C-rate at hover</span>
                  <span class="result-value ${this._cDischargeWarn(res.packDischargeC)}">${res.packDischargeC.toFixed(1)}C</span>
                </div>
                ${res.packDischargeC > 6 ? html`
                  <div class="warn-msg ${res.packDischargeC > 10 ? 'error' : ''}">
                    ${res.packDischargeC > 10 ? '⚠ High C-rate — check cell specs for pack integrity.' : '↑ Moderate C-rate — verify cell max discharge rating.'}
                  </div>
                ` : ''}
              ` : ''}
            </div>
          </fpv-card>
        </div>
        </div><!-- end .lower -->
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'flight-time-calculator': FlightTimeCalculator }
}
