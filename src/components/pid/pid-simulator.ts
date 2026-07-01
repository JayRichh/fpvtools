import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import { SimRunner } from '@core/pid/sim-runner'
import { computeMetrics } from '@core/pid/metrics'
import { GAIN_PRESETS, PLANT_PRESETS } from '@core/pid/presets'
import type { SimConfig, SimResult, SimSample } from '@core/pid/types'
import type { ScopeSeries } from '../scope/fpv-scope.js'
import '../primitives/index.js'
import '../scope/fpv-scope.js'
import '../quad-preview/fpv-quad-preview-3d.js'
import './pid-controls.js'

// ── Default config ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SimConfig = {
  controller: {
    gains: { ...GAIN_PRESETS['BF 4.4 Default'] },
    filters: { gyroLowpassHz: 100, dtermLowpassHz: 70 },
    loopRateHz: 4000,
    iTermLimitNm: 0.3,
    iTermRelax: true,
  },
  plant: { ...PLANT_PRESETS['5" Freestyle'] },
  noise: { kind: 'gaussian', gaussianStdDegS: 0, seed: 42 },
  setpoint: { kind: 'step', amplitudeDegS: 200, startMs: 100 },
  disturbances: [],
  durationMs: 1000,
}

// ── Series colors ─────────────────────────────────────────────────────────────

const COLOR_SETPOINT = '#00d4aa'
const COLOR_GYRO     = '#4488ff'
const COLOR_ERROR    = '#ff4466'
const COLOR_P        = '#ffaa33'
const COLOR_I        = '#aa44ff'
const COLOR_D        = '#44ccaa'
const COLOR_MOTOR    = '#888888'

/**
 * Cap on retained full-run samples (~20s at 1 kHz decimation) so a
 * continuously-running sim never grows memory without bound. The step response
 * used for metrics is at the start of the run, so keeping the earliest samples
 * preserves metric accuracy.
 */
const MAX_FULL_SAMPLES = 20000

/**
 * Recompute live metrics ~3×/second (every N frames at 60fps) so the always-
 * visible metrics strip (and the Metrics tab) update as gains are tuned instead
 * of only appearing on Stop. Throttled because recompute is O(samples).
 */
const METRICS_EVERY = 20

/**
 * Time-constant (ms) for the exponential moving average that smooths the values
 * driving the 3D quad preview. The control loop carries high-frequency content
 * (D-term / motor output) so the raw last-sample values jitter frame-to-frame;
 * the preview is an at-a-glance attitude/activity indicator, not a precise plot,
 * so its display values are low-passed. ~70ms stays responsive (follows real
 * attitude changes well under a fifth of a second) while removing the jitter.
 * NOTE: smoothing is applied ONLY to the quad-preview display path — the scope
 * series and the computed metrics still use the true, unsmoothed samples.
 */
const QUAD_SMOOTH_TAU_MS = 70

// ── Component ─────────────────────────────────────────────────────────────────

@customElement('pid-simulator')
export class PidSimulator extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }

      .hud-toolbar {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-sm);
        padding: var(--fpv-space-sm) 0;
      }

      .hud-btn {
        padding: var(--fpv-space-xs) var(--fpv-space-md);
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        color: var(--fpv-text);
        font-size: var(--fpv-font-label);
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;
        min-height: 36px;
      }

      .hud-btn:hover {
        border-color: var(--fpv-primary);
        background-color: var(--fpv-border);
      }

      .hud-time {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        color: var(--fpv-text-muted);
        margin-left: auto;
      }

      .layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: var(--fpv-space-lg);
        align-items: start;
      }

      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .controls-col {
          position: static;
          max-height: none;
          overflow-y: visible;
        }
      }

      .controls-col {
        position: sticky;
        top: var(--fpv-space-md);
        max-height: calc(100vh - var(--fpv-space-xl));
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--fpv-border) transparent;
      }

      .viz-col {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
        min-width: 0;
      }

      .tab-panel {
        min-height: 340px;
      }

      fpv-scope {
        width: 100%;
        min-height: 300px;
      }

      fpv-quad-preview-3d {
        height: clamp(300px, 42vh, 480px);
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--fpv-space-sm);
      }

      .metric-card {
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        padding: var(--fpv-space-md);
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-xs);
      }

      .metric-label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .metric-value {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        color: var(--fpv-text);
        font-weight: 600;
      }

      .metric-null {
        color: var(--fpv-text-muted);
        font-style: italic;
      }

      /* Compact always-visible live metrics strip (independent of active tab) */
      .metrics-strip {
        display: flex;
        flex-wrap: wrap;
        gap: var(--fpv-space-md);
        padding: var(--fpv-space-sm) var(--fpv-space-md);
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
      }

      .strip-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .strip-label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }

      .strip-value {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        color: var(--fpv-text);
        font-weight: 600;
        white-space: nowrap;
      }
    `,
  ]

  // ── i18n ──────────────────────────────────────────────────────────────────
  private _i18n = new I18nController(this)

  // ── State ──────────────────────────────────────────────────────────────────
  @state() private _config: SimConfig = DEFAULT_CONFIG
  @state() private _result: SimResult | null = null
  @state() private _activeTab = 0
  @state() private _running = true
  // Plain (NON-reactive) field. It's written every sim frame, so making it
  // @state would force a full parent re-render 60×/s. The HUD reads it on
  // render; _tick explicitly requests an update only when the displayed
  // tenths-of-a-second label actually changes (~10×/s).
  private _elapsedMs = 0

  // ── Continuous simulation internals ───────────────────────────────────────
  private _rafId = 0
  private _lastFrameTs = 0
  private _runner: SimRunner | null = null
  private _rollingBuf: SimSample[] = []
  private _fullSamples: SimSample[] = []
  private _windowMs = 2000
  private _metricsTick = 0

  // Cached child ref (unconditionally present) + last-rendered HUD label, used
  // to drive the viz imperatively and throttle the parent template re-render.
  private _quadEl: HTMLElementTagNameMap['fpv-quad-preview-3d'] | null = null
  private _lastHudLabel = ''

  // ── Smoothed display values for the 3D quad preview (EMA, see
  //    QUAD_SMOOTH_TAU_MS). These are DISPLAY-ONLY and never feed the scope or
  //    the metrics, which keep showing the true simulated response. ──────────
  private _qGyro = 0
  private _qSetpoint = 0
  private _qError = 0
  private _qMotor = 0
  private _qSat = 0

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  firstUpdated() {
    // Cache the (unconditionally rendered) quad element so _tick can drive it
    // imperatively without a per-frame querySelector.
    this._quadEl = this.renderRoot.querySelector('fpv-quad-preview-3d')
    this._resetSim()
    this._startLoop()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    cancelAnimationFrame(this._rafId)
  }

  // ── Continuous simulation ─────────────────────────────────────────────────

  private _resetSim() {
    this._runner = new SimRunner(this._config)
    this._rollingBuf = []
    this._fullSamples = []
    this._elapsedMs = 0
    // Reset quad-preview smoothing so the quad snaps level, then eases into the
    // new response instead of drifting from the previous run's attitude.
    this._qGyro = 0
    this._qSetpoint = 0
    this._qError = 0
    this._qMotor = 0
    this._qSat = 0
    // Force the HUD label to re-render on the next running frame.
    this._lastHudLabel = ''
  }

  private _startLoop() {
    // Idempotent: cancel any existing rAF chain first
    cancelAnimationFrame(this._rafId)
    this._running = true
    this._lastFrameTs = performance.now()
    this._tick()
  }

  private _stopLoop() {
    this._running = false
    cancelAnimationFrame(this._rafId)
    this._result = this._computeMetrics()
  }

  /** Compute step-response metrics from the accumulated full-run samples. */
  private _computeMetrics(): SimResult {
    let spAmplitude = 0
    const sp = this._config.setpoint
    if (sp.kind === 'step' || sp.kind === 'ramp' || sp.kind === 'sine') {
      spAmplitude = sp.amplitudeDegS
    } else if (sp.kind === 'trace') {
      spAmplitude = sp.samplesDegS.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    }
    return { samples: this._fullSamples, metrics: computeMetrics(this._fullSamples, spAmplitude) }
  }

  private _tick() {
    if (!this._running || !this._runner) return

    this._rafId = requestAnimationFrame((ts) => {
      if (!this._running) return

      const deltaMs = ts - this._lastFrameTs
      this._lastFrameTs = ts

      // Cap delta to avoid huge jumps on tab-switch
      const clampedDelta = Math.min(deltaMs, 50)

      const newSamples = this._runner!.tick(clampedDelta)

      // Accumulate for metrics (computed on Stop), bounded so a long-running
      // sim doesn't grow memory without limit (see MAX_FULL_SAMPLES).
      if (this._fullSamples.length < MAX_FULL_SAMPLES) {
        this._fullSamples.push(...newSamples)
      }

      // Rolling window for display
      this._rollingBuf.push(...newSamples)
      this._elapsedMs = this._runner!.elapsedMs

      // Trim to windowMs
      const cutoff = this._elapsedMs - this._windowMs
      while (this._rollingBuf.length > 0 && this._rollingBuf[0].tMs < cutoff) {
        this._rollingBuf.shift()
      }

      // Advance the quad-preview EMA. Take the mean of this frame's new samples
      // (pre-averages intra-frame high-frequency content) and low-pass across
      // frames. alpha is derived from the real frame delta so the smoothing
      // time-constant is frame-rate independent. Display-only — does not touch
      // the scope data or metrics.
      if (newSamples.length > 0) {
        let sumSp = 0, sumGy = 0, sumErr = 0, sumMot = 0, sumSat = 0
        for (const s of newSamples) {
          sumSp += s.setpointDegS
          sumGy += s.gyroDegS
          sumErr += s.errorDegS
          sumMot += s.motorOutput
          sumSat += s.saturated ? 1 : 0
        }
        const inv = 1 / newSamples.length
        const alpha = 1 - Math.exp(-clampedDelta / QUAD_SMOOTH_TAU_MS)
        this._qSetpoint += (sumSp * inv - this._qSetpoint) * alpha
        this._qGyro += (sumGy * inv - this._qGyro) * alpha
        this._qError += (sumErr * inv - this._qError) * alpha
        this._qMotor += (sumMot * inv - this._qMotor) * alpha
        this._qSat += (sumSat * inv - this._qSat) * alpha
      }

      // Live metrics (throttled — recompute is O(samples)). Computed every frame
      // regardless of the active tab so the always-visible metrics strip stays
      // live; lets the user watch metrics change as they tune gains.
      if (this._metricsTick++ % METRICS_EVERY === 0) {
        this._result = this._computeMetrics()
      }

      // Drive the scope + quad imperatively in THIS frame (same-frame draw,
      // eliminating the ~1-frame rAF latency) from the just-updated
      // _rollingBuf / EMA state above.
      this._drawViz()

      // Re-render the Lit template (HUD time, tabs, metrics strip, pid-controls
      // binding check, quad-props) only when the displayed elapsed label
      // actually changes — ~10×/s instead of every frame. The metrics strip
      // also rides _result's own @state cadence (~3×/s). This keeps the full
      // template off the 60fps hot path while keeping the HUD correct.
      const hudLabel = (this._elapsedMs / 1000).toFixed(1)
      if (hudLabel !== this._lastHudLabel) {
        this._lastHudLabel = hudLabel
        this.requestUpdate()
      }

      this._tick()
    })
  }

  /**
   * Push the current sim state to the scope + quad and draw them THIS frame.
   * Called every tick so the visualisations stay at the full frame rate even
   * though the parent template is only re-rendered ~10×/s. The declarative
   * bindings in render() remain the correctness path while stopped / on element
   * (re)creation, so no viz state is lost across tab switches or Reset.
   */
  private _drawViz() {
    this._quadEl?.renderFrame(this._getQuadProps())

    // The scope element exists only for the response/terms tabs, not metrics.
    if (this._activeTab === 2) return
    const scope = this.renderRoot.querySelector('fpv-scope')
    if (!scope) return
    const series = this._activeTab === 0
      ? this._buildResponseSeries()
      : this._buildTermsSeries()
    scope.renderFrame(series, this._windowMs)
  }

  // ── HUD button handlers ───────────────────────────────────────────────────

  private _onStart() {
    this._startLoop()
  }

  private _onStop() {
    this._stopLoop()
  }

  private _onReset() {
    this._stopLoop()
    this._resetSim()
  }

  private _onRestart() {
    this._stopLoop()
    this._resetSim()
    this._startLoop()
  }

  // ── Config change ─────────────────────────────────────────────────────────

  private _onConfigChange(e: CustomEvent<Partial<SimConfig>>) {
    e.stopPropagation()
    this._config = e.detail as SimConfig
    // Live in-place adjust: while running, apply the new config to the sim
    // without restarting, so the scope transitions smoothly instead of clearing
    // on every slider move. While stopped, the current results are left intact
    // (the change takes effect on Restart).
    if (this._running && this._runner) {
      this._runner.updateConfig(this._config)
    }
  }

  // ── Scope series builders ─────────────────────────────────────────────────

  private _buildResponseSeries(): ScopeSeries[] {
    const samples = this._rollingBuf
    if (samples.length === 0) return []
    const n = samples.length
    const setpoint = new Float32Array(n)
    const gyro     = new Float32Array(n)
    const error    = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      setpoint[i] = samples[i].setpointDegS
      gyro[i]     = samples[i].gyroDegS
      error[i]    = samples[i].errorDegS
    }
    return [
      { name: this._i18n.t('pid.series_setpoint'), color: COLOR_SETPOINT, data: setpoint, visible: true },
      { name: this._i18n.t('pid.series_gyro'),     color: COLOR_GYRO,     data: gyro,     visible: true },
      { name: this._i18n.t('pid.series_error'),    color: COLOR_ERROR,    data: error,    visible: true },
    ]
  }

  private _buildTermsSeries(): ScopeSeries[] {
    const samples = this._rollingBuf
    if (samples.length === 0) return []
    const n = samples.length
    const p     = new Float32Array(n)
    const iArr  = new Float32Array(n)
    const d     = new Float32Array(n)
    const motor = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      p[i]     = samples[i].pTerm
      iArr[i]  = samples[i].iTerm
      d[i]     = samples[i].dTerm
      motor[i] = samples[i].motorOutput
    }
    return [
      { name: this._i18n.t('pid.series_pterm'), color: COLOR_P,     data: p,     visible: true },
      { name: this._i18n.t('pid.series_iterm'), color: COLOR_I,     data: iArr,  visible: true },
      { name: this._i18n.t('pid.series_dterm'), color: COLOR_D,     data: d,     visible: true },
      { name: this._i18n.t('pid.series_motor'), color: COLOR_MOTOR, data: motor, visible: false },
    ]
  }

  // ── Quad preview helpers ──────────────────────────────────────────────────

  private _getQuadProps() {
    // Pure reader of the smoothed (EMA) display state advanced in _tick. Feeding
    // temporally-smoothed values keeps the quad, its rotation arcs and its
    // thrust columns calm and legible instead of vibrating on the raw high-
    // frequency loop output. The scope + metrics keep the true, unsmoothed data.
    const maxT = this._config.plant.maxTorqueNm || 1
    // Normalise smoothed motor command to [-1, 1] for display. Kept SIGNED so an
    // opposite-sign motor pair still reads as the roll/pitch couple that drives
    // it; smoothing removes the sign-thrashing that made the columns flip.
    const m = Math.max(-1, Math.min(1, this._qMotor / maxT))
    // Roll convention: left motors (M1, M3) +, right motors (M2, M4) -
    const motorOutputs = [m / 2, -m / 2, m / 2, -m / 2]
    return {
      motorOutputs,
      setpointDegS: this._qSetpoint,
      gyroDegS: this._qGyro,
      errorDegS: this._qError,
      // Hysteresis on the smoothed saturation fraction so the motor colour
      // doesn't flicker red on brief, isolated saturation samples.
      saturated: this._qSat > 0.5,
    }
  }

  // ── Metrics rendering ─────────────────────────────────────────────────────

  /**
   * Compact, always-visible live metrics strip (shown regardless of active
   * tab). Stays live because _tick recomputes _result on the METRICS_EVERY
   * throttle independent of the active tab. Reuses the pid.metric_* / common.na
   * i18n keys and token-based styling.
   */
  private _renderMetricsStrip() {
    const m = this._result?.metrics
    const na = html`<span class="strip-value metric-null">${this._i18n.t('common.na')}</span>`
    const val = (v: number | null | undefined, unit: string, digits = 1) =>
      v === null || v === undefined
        ? na
        : html`<span class="strip-value">${v.toFixed(digits)} ${unit}</span>`
    return html`
      <div class="metrics-strip">
        <div class="strip-item">
          <span class="strip-label">${this._i18n.t('pid.metric_rise_time')}</span>
          ${val(m?.riseTimeMs, 'ms')}
        </div>
        <div class="strip-item">
          <span class="strip-label">${this._i18n.t('pid.metric_overshoot')}</span>
          ${val(m?.overshootPct, '%')}
        </div>
        <div class="strip-item">
          <span class="strip-label">${this._i18n.t('pid.metric_settling_time')}</span>
          ${val(m?.settlingTimeMs, 'ms')}
        </div>
        <div class="strip-item">
          <span class="strip-label">${this._i18n.t('pid.metric_oscillation')}</span>
          ${val(m?.oscillationHz, 'Hz')}
        </div>
      </div>
    `
  }

  private _renderMetrics() {

    const m = this._result?.metrics
    if (!m) return html`<div class="metric-null">${this._i18n.t('pid.loading')}</div>`

    const fmt = (v: number | null, unit: string, digits = 1) =>
      v === null
        ? html`<span class="metric-null">${this._i18n.t('common.na')}</span>`
        : html`<span>${v.toFixed(digits)} ${unit}</span>`

    const badgeVariant = (v: number | null, good: number, warn: number): string => {
      if (v === null) return 'success'
      if (v <= good) return 'success'
      if (v <= warn) return 'warning'
      return 'error'
    }

    return html`
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">${this._i18n.t('pid.metric_rise_time')}</div>
          <div class="metric-value">${fmt(m.riseTimeMs, 'ms')}</div>
          ${m.riseTimeMs !== null ? html`<fpv-badge .variant=${badgeVariant(m.riseTimeMs, 30, 80)}>
            ${m.riseTimeMs <= 30 ? this._i18n.t('common.status_fast') : m.riseTimeMs <= 80 ? this._i18n.t('common.status_ok') : this._i18n.t('common.status_slow')}
          </fpv-badge>` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">${this._i18n.t('pid.metric_overshoot')}</div>
          <div class="metric-value">${fmt(m.overshootPct, '%')}</div>
          ${m.overshootPct !== null ? html`<fpv-badge .variant=${badgeVariant(m.overshootPct, 5, 20)}>
            ${m.overshootPct <= 5 ? this._i18n.t('common.status_good') : m.overshootPct <= 20 ? this._i18n.t('common.status_moderate') : this._i18n.t('common.status_high')}
          </fpv-badge>` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">${this._i18n.t('pid.metric_settling_time')}</div>
          <div class="metric-value">${fmt(m.settlingTimeMs, 'ms')}</div>
          ${m.settlingTimeMs !== null ? html`<fpv-badge .variant=${badgeVariant(m.settlingTimeMs, 100, 300)}>
            ${m.settlingTimeMs <= 100 ? this._i18n.t('common.status_fast') : m.settlingTimeMs <= 300 ? this._i18n.t('common.status_ok') : this._i18n.t('common.status_slow')}
          </fpv-badge>` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">${this._i18n.t('pid.metric_ss_error')}</div>
          <div class="metric-value">${fmt(m.steadyStateErrorDegS, '°/s', 2)}</div>
          ${m.steadyStateErrorDegS !== null ? html`<fpv-badge .variant=${badgeVariant(Math.abs(m.steadyStateErrorDegS), 2, 10)}>
            ${Math.abs(m.steadyStateErrorDegS) <= 2 ? this._i18n.t('common.status_good') : Math.abs(m.steadyStateErrorDegS) <= 10 ? this._i18n.t('common.status_fair') : this._i18n.t('common.status_poor')}
          </fpv-badge>` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">${this._i18n.t('pid.metric_oscillation')}</div>
          <div class="metric-value">${fmt(m.oscillationHz, 'Hz')}</div>
          ${m.oscillationHz !== null ? html`<fpv-badge .variant=${badgeVariant(m.oscillationHz, 5, 20)}>
            ${m.oscillationHz <= 5 ? this._i18n.t('common.status_stable') : m.oscillationHz <= 20 ? this._i18n.t('common.status_moderate') : this._i18n.t('common.status_oscillating')}
          </fpv-badge>` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">${this._i18n.t('pid.metric_motor_rms')}</div>
          <div class="metric-value">${m.motorActivityRms.toFixed(3)} Nm</div>
          <fpv-badge .variant=${badgeVariant(m.motorActivityRms, 0.1, 0.3)}>
            ${m.motorActivityRms <= 0.1 ? this._i18n.t('common.status_smooth') : m.motorActivityRms <= 0.3 ? this._i18n.t('common.status_normal') : this._i18n.t('common.status_active')}
          </fpv-badge>
        </div>
      </div>
    `
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    const quad = this._getQuadProps()

    return html`
      <div class="hud-toolbar">
        ${this._running
          ? html`<button class="hud-btn" @click=${this._onStop}>${this._i18n.t('common.stop')}</button>`
          : html`<button class="hud-btn" @click=${this._onStart}>${this._i18n.t('common.start')}</button>`
        }
        <button class="hud-btn" @click=${this._onReset}>${this._i18n.t('common.reset')}</button>
        <button class="hud-btn" @click=${this._onRestart}>${this._i18n.t('common.restart')}</button>
        <span class="hud-time">${this._i18n.t('pid.hud_time_label', { seconds: (this._elapsedMs / 1000).toFixed(1) })}</span>
      </div>

      <div class="layout">
        <div class="controls-col">
          <pid-controls
            .config=${this._config}
            @config-change=${this._onConfigChange}
          ></pid-controls>
        </div>

        <div class="viz-col">
          ${this._renderMetricsStrip()}

          <fpv-card>
            <fpv-tabs
              .tabs=${[
                this._i18n.t('pid.tab_response'),
                this._i18n.t('pid.tab_terms'),
                this._i18n.t('pid.tab_metrics'),
              ]}
              .active=${this._activeTab}
              @tab-change=${(e: CustomEvent<number>) => {
                this._activeTab = e.detail
                if (e.detail === 2 && this._running) this._result = this._computeMetrics()
              }}
            ></fpv-tabs>
            <div class="tab-panel">
              ${this._activeTab === 0 ? html`
                <fpv-scope
                  .series=${this._buildResponseSeries()}
                  .timeMs=${this._windowMs}
                ></fpv-scope>
              ` : ''}
              ${this._activeTab === 1 ? html`
                <fpv-scope
                  .series=${this._buildTermsSeries()}
                  .timeMs=${this._windowMs}
                ></fpv-scope>
              ` : ''}
              ${this._activeTab === 2 ? html`
                ${this._renderMetrics()}
              ` : ''}
            </div>
          </fpv-card>

          <fpv-quad-preview-3d
            .motorOutputs=${quad.motorOutputs}
            .setpointDegS=${quad.setpointDegS}
            .gyroDegS=${quad.gyroDegS}
            .errorDegS=${quad.errorDegS}
            .saturated=${quad.saturated}
            .axis=${'roll'}
          ></fpv-quad-preview-3d>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pid-simulator': PidSimulator
  }
}
