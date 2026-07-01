import { LitElement, html, css, PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import { welchPsd } from '@core/blackbox/fft'
import { extractStepEvents } from '@core/blackbox/stepExtract'
import { fitNoiseFromSpectrum } from '@core/noise/spectrum'
import type { BlackboxLog, StepEvent } from '@core/blackbox/types'
import type { Spectrum } from '@core/blackbox/fft'
import type { SpectralNoise } from '@core/noise/types'
import type { ScopeSeries } from '../scope/fpv-scope.js'
import '../primitives/fpv-tabs.js'
import '../primitives/fpv-badge.js'
import '../scope/fpv-scope.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_COLORS = ['#00d4aa', '#4488ff', '#ff4466', '#ffaa33', '#aa44ff', '#44ccaa']
const MAX_STEPS   = 8

// ─── Component ────────────────────────────────────────────────────────────────

@customElement('bbl-overlay')
export class BblOverlay extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }

      .overlay {
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        overflow: hidden;
      }

      .tab-content {
        padding: var(--fpv-space-md);
      }

      .axis-hint {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        margin-bottom: var(--fpv-space-xs);
      }

      .noise-model {
        display: flex;
        flex-wrap: wrap;
        gap: var(--fpv-space-xs);
        margin-top: var(--fpv-space-md);
      }

      .no-data {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
      }

      .log-summary {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        padding: var(--fpv-space-sm) var(--fpv-space-md);
        border-bottom: 1px solid var(--fpv-border);
        display: flex;
        gap: var(--fpv-space-md);
      }
    `,
  ]

  // ─── External properties ─────────────────────────────────────────────────

  private _i18n = new I18nController(this)

  /** Pass the BlackboxLog directly as a DOM property from Vue or JS. */
  @property({ attribute: false }) log: BlackboxLog | null = null

  // ─── Internal state ───────────────────────────────────────────────────────

  @state() private _activeTab = 0
  @state() private _spectrum:   Spectrum      | null = null
  @state() private _stepEvents: StepEvent[]         = []
  @state() private _noiseModel: SpectralNoise | null = null

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  updated(changed: PropertyValues) {
    if (changed.has('log')) {
      if (this.log) {
        this._computeAnalysis()
      } else {
        this._spectrum   = null
        this._stepEvents = []
        this._noiseModel = null
      }
    }
  }

  // ─── Analysis ─────────────────────────────────────────────────────────────

  private _computeAnalysis() {
    const log = this.log!
    const fs  = log.loopRateHz > 0 ? log.loopRateHz : 1000

    this._spectrum   = welchPsd(log.channels.gyro, fs)
    this._stepEvents = extractStepEvents(log)
    this._noiseModel = fitNoiseFromSpectrum(this._spectrum)
  }

  // ─── Sub-renders ──────────────────────────────────────────────────────────

  private _renderFftView() {
    const spectrum = this._spectrum
    if (!spectrum) return html``

    const fftSeries: ScopeSeries[] = [
      {
        name:  this._i18n.t('blackbox.series_gyro_psd'),
        color: '#4488ff',
        data:  spectrum.psd,
      },
    ]

    // Map the frequency axis to fpv-scope's timeMs (treated as "Hz" on the X-axis)
    const nBins    = spectrum.freqHz.length
    const nyquistHz = nBins > 0 ? spectrum.freqHz[nBins - 1] : 1000

    return html`
      <div>
        <div class="axis-hint">X-axis: frequency (Hz) &nbsp;|&nbsp; Y-axis: PSD (dB)</div>
        <fpv-scope
          .series=${fftSeries}
          .timeMs=${nyquistHz}
          .gridDivisions=${8}
        ></fpv-scope>
        ${this._noiseModel ? this._renderNoiseModel() : ''}
      </div>
    `
  }

  private _renderStepView() {
    const events = this._stepEvents
    if (events.length === 0) {
      return html`<div class="no-data">${this._i18n.t('blackbox.no_steps')}</div>`
    }

    const log = this.log!
    const fs  = log.loopRateHz > 0 ? log.loopRateHz : 1000
    const captureMs = Math.round((200 / 1000) * fs) / fs * 1000  // nominally 200 ms

    const stepSeries: ScopeSeries[] = events
      .slice(0, MAX_STEPS)
      .map((evt, i) => ({
        name:  this._i18n.t('blackbox.step_series_name', {
          n: i + 1,
          sign: evt.amplitude > 0 ? '+' : '',
          amplitude: evt.amplitude.toFixed(0),
        }),
        color: STEP_COLORS[i % STEP_COLORS.length],
        data:  evt.samples,
      }))

    return html`
      <div>
        <div class="axis-hint">
          X-axis: time after step (ms) &nbsp;|&nbsp; Y-axis: gyro (°/s)
          &nbsp;&mdash;&nbsp; ${events.length} event${events.length !== 1 ? 's' : ''} found
          ${events.length > MAX_STEPS ? html` (showing first ${MAX_STEPS})` : ''}
        </div>
        <fpv-scope
          .series=${stepSeries}
          .timeMs=${captureMs}
          .gridDivisions=${8}
        ></fpv-scope>
      </div>
    `
  }

  private _renderNoiseModel() {
    const m = this._noiseModel!
    const activeHarmonics = m.harmonicAmps
      .map((amp, i) => ({ amp, h: i + 2 }))
      .filter(({ amp }) => amp > 0)

    return html`
      <div class="noise-model">
        <fpv-badge variant="info">
          ${this._i18n.t('blackbox.noise_fundamental', { hz: m.fundamentalHz.toFixed(1) })}
        </fpv-badge>

        ${activeHarmonics.map(
          ({ amp, h }) => html`
            <fpv-badge variant="warning">
              ${this._i18n.t('blackbox.noise_harmonic', { n: h, dB: (20 * Math.log10(amp + 1e-12)).toFixed(1) })}
            </fpv-badge>
          `
        )}

        ${m.resonance
          ? html`
              <fpv-badge variant="error">
                ${this._i18n.t('blackbox.noise_resonance', { hz: m.resonance.freqHz.toFixed(1), q: m.resonance.q.toFixed(1) })}
              </fpv-badge>
            `
          : ''}

        <fpv-badge variant="success">
          ${this._i18n.t('blackbox.noise_broadband', { rms: m.broadbandStdDegS.toFixed(3) })}
        </fpv-badge>
      </div>
    `
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render() {
    if (!this.log) return html``

    const log   = this.log
    const samps = log.channels.gyro.length
    const durS  = log.duration > 0
      ? log.duration.toFixed(2) + ' s'
      : samps > 0 && log.loopRateHz > 0
        ? (samps / log.loopRateHz).toFixed(2) + ' s'
        : '—'

    return html`
      <div class="overlay">
        <div class="log-summary">
          <span>${this._i18n.t('blackbox.summary_samples', { n: samps.toLocaleString() })}</span>
          <span>${log.loopRateHz > 0 ? this._i18n.t('blackbox.summary_loop', { hz: log.loopRateHz.toLocaleString() }) : '—'}</span>
          <span>${durS}</span>
          <span>${this._i18n.t('blackbox.summary_steps', { n: this._stepEvents.length })}</span>
        </div>

        <fpv-tabs
          .tabs=${[this._i18n.t('blackbox.tab_fft'), this._i18n.t('blackbox.tab_step')]}
          .active=${this._activeTab}
          @tab-change=${(e: CustomEvent) => { this._activeTab = e.detail }}
        ></fpv-tabs>

        <div class="tab-content">
          ${this._activeTab === 0
            ? this._renderFftView()
            : this._renderStepView()}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbl-overlay': BblOverlay
  }
}
