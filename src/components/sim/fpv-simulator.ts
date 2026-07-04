import { LitElement, html, css } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { SIM_PRESETS, DEFAULT_SIM_PRESET } from '@core/sim/presets'
import type { SimMode } from '@core/sim/types'
import '../primitives/index.js'
import './fpv-sim.js'
import type { FpvSim, CamMode } from './fpv-sim.js'

@customElement('fpv-simulator')
export class FpvSimulator extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host { display: block; }
      .layout {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
      }
      fpv-sim { height: clamp(380px, 62vh, 720px); }

      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--fpv-space-md);
      }
      .control-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 160px;
      }
      .control-label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .seg {
        display: flex;
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        overflow: hidden;
      }
      .seg button {
        flex: 1;
        padding: 8px 14px;
        background: transparent;
        color: var(--fpv-text-muted);
        border: none;
        cursor: pointer;
        font-family: var(--fpv-font-sans);
        font-size: var(--fpv-font-body);
        min-height: 40px;
        border-right: 1px solid var(--fpv-border);
        transition: background 0.12s, color 0.12s;
        white-space: nowrap;
      }
      .seg button:last-child { border-right: none; }
      .seg button.active { background: var(--fpv-primary); color: var(--fpv-surface); font-weight: 600; }

      .btn {
        background: transparent;
        border: 1px solid color-mix(in srgb, var(--fpv-primary) 40%, transparent);
        color: var(--fpv-primary);
        border-radius: var(--fpv-radius-sm);
        padding: 8px 18px;
        cursor: pointer;
        font-family: var(--fpv-font-sans);
        font-size: var(--fpv-font-body);
        min-height: 40px;
        transition: background 0.12s;
      }
      .btn:hover { background: color-mix(in srgb, var(--fpv-primary) 10%, transparent); }
      .btn.danger {
        border-color: color-mix(in srgb, var(--fpv-error) 40%, transparent);
        color: var(--fpv-error);
      }

      .help {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--fpv-space-xs) var(--fpv-space-md);
      }
      .help-row {
        display: flex;
        justify-content: space-between;
        gap: var(--fpv-space-sm);
        font-size: var(--fpv-font-label);
        padding: 2px 0;
      }
      .help-key {
        font-family: var(--fpv-font-mono);
        color: var(--fpv-primary);
        white-space: nowrap;
      }
      .help-desc { color: var(--fpv-text-muted); text-align: right; }
    `,
  ]

  @state() private _mode: SimMode = 'easy'
  @state() private _presetKey = DEFAULT_SIM_PRESET
  @state() private _mouseSteer = false
  @state() private _camMode: CamMode = 'follow'
  @query('fpv-sim') private _sim!: FpvSim

  private _setMode(mode: SimMode) {
    this._mode = mode
  }

  render() {
    const presetOptions = Object.keys(SIM_PRESETS).map((k) => ({ value: k, label: k }))
    const helpRows: Array<[string, string]> = [
      ['SPACE', 'arm / disarm'],
      ['W / S', 'throttle up / down'],
      ['A / D', 'yaw left / right'],
      ['↑ / ↓', 'pitch forward / back'],
      ['← / →', 'roll left / right'],
      ['MOUSE DRAG', 'orbit / offset camera'],
      ['WHEEL', 'zoom'],
      ['C', 'camera: follow / orbit / FPV'],
      ['M', 'toggle mouse steering'],
      ['DBL-CLICK', 'reset camera'],
      ['R', 'reset flight'],
      ['1 / 2', 'Easy / Normal mode'],
    ]

    return html`
      <div class="layout">
        <fpv-sim
          .mode=${this._mode}
          .presetKey=${this._presetKey}
          .mouseSteer=${this._mouseSteer}
          .camMode=${this._camMode}
          @sim-mode-change=${(e: CustomEvent<SimMode>) => (this._mode = e.detail)}
          @sim-steer-change=${(e: CustomEvent<boolean>) => (this._mouseSteer = e.detail)}
          @sim-cam-change=${(e: CustomEvent<CamMode>) => (this._camMode = e.detail)}
        ></fpv-sim>

        <div class="controls">
          <div class="control-group">
            <span class="control-label">Mode</span>
            <div class="seg">
              <button class=${this._mode === 'easy' ? 'active' : ''} @click=${() => this._setMode('easy')}>
                Easy (angle)
              </button>
              <button class=${this._mode === 'normal' ? 'active' : ''} @click=${() => this._setMode('normal')}>
                Normal (acro)
              </button>
            </div>
          </div>

          <div class="control-group">
            <fpv-select
              label="Quad preset"
              .value=${this._presetKey}
              .options=${presetOptions}
              @select-change=${(e: CustomEvent<string>) => (this._presetKey = e.detail)}
            ></fpv-select>
          </div>

          <div class="control-group" style="min-width:auto">
            <span class="control-label">Camera</span>
            <div class="seg">
              <button class=${this._camMode === 'follow' ? 'active' : ''} @click=${() => (this._camMode = 'follow')}>
                Follow
              </button>
              <button class=${this._camMode === 'orbit' ? 'active' : ''} @click=${() => (this._camMode = 'orbit')}>
                Orbit
              </button>
              <button class=${this._camMode === 'fpv' ? 'active' : ''} @click=${() => (this._camMode = 'fpv')}>
                FPV
              </button>
            </div>
          </div>

          <div class="control-group" style="min-width:auto">
            <span class="control-label">Steering</span>
            <div class="seg">
              <button class=${this._mouseSteer ? '' : 'active'} @click=${() => (this._mouseSteer = false)}>
                Keyboard
              </button>
              <button class=${this._mouseSteer ? 'active' : ''} @click=${() => (this._mouseSteer = true)}>
                Mouse
              </button>
            </div>
          </div>

          <button class="btn" @click=${() => { this._sim.arm(); this.requestUpdate() }}>
            Arm / Disarm
          </button>
          <button class="btn danger" @click=${() => this._sim.resetSim()}>
            Reset
          </button>
        </div>

        <fpv-card header="Controls">
          <div class="help">
            ${helpRows.map(([key, desc]) => html`
              <div class="help-row">
                <span class="help-key">${key}</span>
                <span class="help-desc">${desc}</span>
              </div>
            `)}
          </div>
        </fpv-card>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-simulator': FpvSimulator
  }
}
