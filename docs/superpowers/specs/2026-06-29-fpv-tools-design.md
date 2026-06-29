# FPV Tools — Design Specification

A browser-native suite of FPV calculators, simulators, and analysis tools. Client-side only, no backend. Vue 3 + Lit web components + pure TypeScript physics core.

---

## 1. Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build | Vite 6 | Fast, native ESM, excellent Vue + Lit support |
| Shell | Vue 3.5 Composition API + vue-router | Routing, layout, state coordination |
| Components | Lit 3 (custom elements, `fpv-` prefix) | Portable, fine-grained rendering for canvas-heavy UI |
| Core | Pure TypeScript | Zero-dependency physics/math, testable, reusable |
| Plots | Canvas 2D API | 60fps multi-channel scope with Catmull-Rom interpolation |
| Test | Vitest | Fast, native ESM, same config as build |
| Deploy | Vercel (static SPA) | Zero-config, edge CDN |
| SSG | vite-ssg | Pre-render landing + tool pages for SEO |

No CSS framework. Design tokens as CSS custom properties. Dark-first theme.

---

## 2. Routes & Pages

```
/                  Landing — tool grid with descriptions, SEO content
/pid               PID Simulator — scope + quad preview + controls
/power             Pack & Flight Calculator
/motors            Motor/Prop Sizing Calculator
/rf                Link Budget + VTX Legal Checker
/convert           Unit Converters (FPV-specific)
/blackbox          Blackbox Analyzer (FFT + step response)
/tilt              Camera Tilt Calculator
/diff              Tune Diff (paste two CLI dumps)
```

Each route lazy-loads its tool component. URL search params encode tool state for sharing.

---

## 3. Module Architecture

```
src/
  core/                         Pure TS, no DOM, no framework
    pid/
      types.ts                  SimConfig, SimSample, SimMetrics, SimResult
      plant.ts                  Airframe dynamics: torque→rate, motor lag, drag, prop nonlinearity
      controller.ts             Betaflight-style PID+FF: P/I/D-on-measurement, anti-windup, iterm-relax, TPA
      filters.ts                PT1/PT2 lowpass + biquad notch (gyro, D-term)
      setpoint.ts               Stick profiles: step, ramp, sine, recorded trace
      simulate.ts               Orchestrates plant+controller+filters → SimResult (pure)
      metrics.ts                Rise time, overshoot, settling, steady-state error, motor RMS
      presets.ts                 Per-craft-class gain + plant presets (5" race, 7" LR, etc.)
    power/
      types.ts                  CellSpec, PackConfig, FlightModel, PackResult
      cells.ts                  Cell library (P42A, P45B, 40T, HG2, VTC6) + custom entry
      pack.ts                   computePack(): voltage, capacity, weight, flight time, sag, C-rate
    motors/
      types.ts                  MotorSpec, PropSpec, SizingResult
      sizing.ts                 Thrust-to-weight, static thrust, efficiency, current draw
    rf/
      types.ts                  LinkBudgetInput/Result, VtxRuleQuery/Result
      linkBudget.ts             Free-space path loss, link margin, range vs packet rate
      rules.ts                  Per-country VTX frequency/power tables
      convert.ts                dBm⇄mW, mAh⇄Wh, KV→RPM, AWG⇄ampacity
    blackbox/
      types.ts                  BlackboxLog, parsed channels
      parse.ts                  CSV export parser (native .bbl binary behind same interface)
      fft.ts                    FFT/PSD utilities (Welch method)
      stepExtract.ts            Find stick-step events → step-response samples
    sysid/
      types.ts                  SysIdInput, SysIdResult
      cost.ts                   Residual cost function J(θ)
      optimizer.ts              Nelder-Mead simplex (derivative-free)
      fit.ts                    identifyPlant(): optimizer → fitted plant + confidence
    noise/
      types.ts                  SpectralNoise, Spectrum
      spectrum.ts               Welch PSD + peak-picking
      synth.ts                  Generate gyro noise: harmonics + resonance + broadband
    shared/
      units.ts                  Branded unit types + conversions (deg⇄rad, mAh⇄Wh)
      math.ts                   Clamp, lerp, remap, RMS
      prng.ts                   Seeded PRNG (mulberry32) for reproducible noise
      biquad.ts                 Generic biquad filter implementation
      interpolate.ts            Catmull-Rom spline, LTTB decimation

  components/                   Lit web components
    primitives/
      tokens.css.ts             Design tokens as CSS custom properties
      fpv-card.ts               Surface container
      fpv-slider.ts             Labeled slider with unit + live value display
      fpv-number.ts             Numeric input with unit, validation, step
      fpv-badge.ts              Status pill (verdict/confidence/warning)
      fpv-toggle.ts             On/off toggle with label
      fpv-select.ts             Dropdown select
      fpv-tabs.ts               Tab bar for tool sub-sections
    scope/
      fpv-scope.ts              Multi-channel oscilloscope (Canvas 2D)
                                - Named series with colors
                                - Catmull-Rom smooth interpolation
                                - Auto/manual Y-axis scaling
                                - Time cursor + value readout
                                - Metric badges overlay
                                - Grid with configurable divisions
                                - ResizeObserver for responsive canvas
    quad-preview/
      fpv-quad-preview.ts       Top-down quad silhouette (Canvas 2D)
                                - 4 motor positions with RPM spin indicators
                                - Thrust force arrows scaled to motor output
                                - Rotation arrows (roll/pitch/yaw torque)
                                - Center-of-gravity marker
                                - Color-coded setpoint vs actual
    pid/
      pid-controls.ts           All simulator inputs, emits config-change (stateless)
      pid-simulator.ts          Orchestrator: holds SimConfig, runs simulate(), feeds scope+preview
    power/
      pack-calculator.ts        Pack inputs + computePack results + warnings
    motors/
      motor-calculator.ts       Motor/prop inputs + sizing results
    rf/
      link-budget.ts            Link budget inputs/outputs
      vtx-checker.ts            Country + VTX selection → compliance verdict
    convert/
      unit-converter.ts         FPV-specific converters
    blackbox/
      bbl-dropzone.ts           File intake → parseBlackbox → emits log-loaded
      bbl-overlay.ts            Measured vs fitted/simulated trace overlay
    tilt/
      tilt-calculator.ts        Camera angle vs speed vs horizon visualization
    diff/
      tune-diff.ts              Two CLI dumps → highlighted diff

  app/                          Vue 3 shell
    App.vue                     Layout: nav sidebar/header, main content, theme toggle
    router.ts                   Flat route list, lazy imports
    views/
      HomeView.vue              Landing page: tool grid + SEO content
      PidView.vue               Hosts pid-simulator + pid-controls + fpv-scope + fpv-quad-preview
      PowerView.vue             Hosts pack-calculator
      MotorsView.vue            Hosts motor-calculator
      RfView.vue                Hosts link-budget + vtx-checker
      ConvertView.vue           Hosts unit-converter
      BlackboxView.vue          Hosts bbl-dropzone + bbl-overlay
      TiltView.vue              Hosts tilt-calculator
      DiffView.vue              Hosts tune-diff
    composables/
      useLocalStorage.ts        Reactive localStorage wrapper
      useUrlState.ts            Sync tool config ↔ URL search params
      useTheme.ts               Dark/light/auto theme toggle

  styles/
    tokens.css                  CSS custom properties (colors, spacing, type, radii)
    reset.css                   Minimal CSS reset
    global.css                  Base body/html styles, font loading
```

---

## 4. Design System

### Tokens (CSS Custom Properties)

```
--fpv-bg:          #0a0a0f          (dark default)
--fpv-surface:     #14141f
--fpv-surface-2:   #1e1e2e
--fpv-border:      #2a2a3a
--fpv-text:        #e0e0e8
--fpv-text-muted:  #8888a0
--fpv-primary:     #00d4aa          (teal — control/active)
--fpv-accent:      #ff6b35          (orange — warnings/highlights)
--fpv-error:       #ff4466
--fpv-success:     #44cc88
--fpv-info:        #4488ff

--fpv-space-xs:    4px
--fpv-space-sm:    8px
--fpv-space-md:    16px
--fpv-space-lg:    24px
--fpv-space-xl:    32px

--fpv-radius-sm:   4px
--fpv-radius-md:   8px
--fpv-radius-lg:   12px

--fpv-font-body:   14px
--fpv-font-label:  12px
--fpv-font-mono:   'JetBrains Mono', monospace
--fpv-font-sans:   'Inter', system-ui, sans-serif
```

Light theme swaps via `[data-theme="light"]` on `<html>`. Auto follows `prefers-color-scheme`.

### Scope Plot Colors (per series)
```
Setpoint:    #00d4aa (primary teal)
Gyro:        #4488ff (blue)
Error:       #ff4466 (red)
P-term:      #ffaa33 (amber)
I-term:      #aa44ff (purple)
D-term:      #44ccaa (cyan)
FF-term:     #ff6b35 (orange)
Motor:       #888888 (gray)
```

### Typography
- Body: Inter 14px, line-height 1.5
- Labels: Inter 12px, uppercase tracking
- Values/code: JetBrains Mono 13px
- Headings: Inter 600 weight, sized by context

### Component Patterns
- Cards: `fpv-surface` background, `fpv-border` 1px, `fpv-radius-md`
- Inputs: compact, inline labels, unit suffix badges
- Layout: CSS Grid for tool layouts, no flexbox soup

---

## 5. PID Simulator — Full Specification

### Physical Model
Closed loop: setpoint → error → PID+FF → motor mixer → motor lag → airframe rotation → gyro (noise + filtering) → error.

Fixed-step semi-implicit Euler at configurable loop rate (8k/4k/2k Hz).

**Airframe (per axis, SI/rad internally):**
```
I·dω/dt = τ_app − b·ω + τ_dist
dτ_app/dt = (τ_cmd − τ_app) / τ_m
```

Configurable realism levels:
- Linear actuator (default): `τ_cmd = maxTorqueNm · u`
- Prop nonlinearity: command → RPM (lagged) → `τ_cmd = thrustCoeff · RPM²`
- Battery coupling: `τ_cmd` scales by `V_pack(I_draw)/V_nom`
- Frame resonance: peaking biquad between motor and gyro
- 3-axis coupling: rigid-body gyroscopic `ω × (I·ω)` terms

**Controller (Betaflight-style, per tick):**
```
e   = setpoint − gyroFiltered
P   = Kp·e
I  += Ki·e·dt, clamped, iterm-relax during fast moves
D   = Kd · dtermLowpass(−dGyro/dt)     (D on measurement)
FF  = Kff · dSetpoint/dt
u   = clamp(P + I + D + FF, −1, +1)
```

Supports TPA (throttle PID attenuation) and dMin/dMax dynamic D.

**Filters:** PT1 lowpass (gyro + D-term) + optional biquad notch.

### Inputs
- PID gains (P, I, D, FF, dMin/dMax)
- Filter cutoffs (gyro lowpass Hz, D-term lowpass Hz, optional notch center + Q)
- Loop rate (8k/4k/2k)
- Anti-windup limit + iterm-relax toggle
- TPA breakpoint + rate
- Plant preset or custom parameters
- Setpoint profile (step/ramp/sine/trace)
- Disturbance injector (impulse/step torque at configurable time)
- Noise model (Gaussian amplitude or spectral with seed)
- Simulation duration

### Outputs
- Multi-channel scope: setpoint, gyro, error, P/I/D/FF terms, motor output
- Gyro FFT with filter response overlay
- Quad preview: force/rotation arrows tracking PID output
- Live metrics: rise time (10→90%), overshoot %, settling time (±2%), steady-state error, oscillation Hz, motor RMS

### Presets
- **Gains:** Betaflight defaults per craft class (version-pinned snapshot)
- **Plant:** Illustrative ranges per airframe (2.5"/3.5"/5" freestyle/5" race/7" LR/10" cine)
- **Scenarios:** Over-tuned (ringing), size comparison, noise filtering, propwash recovery

### Two-Tune Comparison
Side-by-side A/B overlay with metric diff table.

---

## 6. Power / Pack Calculator

Inputs: cell selection (library + custom), S/P config, wiring overhead %, AUW, hover efficiency, cruise factor, cruise speed, usable capacity %.

Outputs: nominal voltage, capacity (mAh/Wh), pack weight, max continuous amps, pack IR, hover/cruise current, hover/cruise flight time, voltage sag, C-rate verdict + margin, estimated range.

Cell library ships with: Molicel P42A, P45B, P50B; Samsung 40T, 50E; Sony VTC6; LG HG2 + custom entry.

---

## 7. Motor/Prop Sizing Calculator

Inputs: motor KV, prop diameter/pitch, cell count (S), AUW, number of motors.

Outputs: max RPM, estimated static thrust per motor, thrust-to-weight ratio, estimated cruise/hover current per motor, efficiency (g/W), recommended prop range.

Includes a small library of common motors (2806.5 1300KV, 2207 1750KV, etc.) with known thrust data.

---

## 8. RF Link Budget + VTX Legal Checker

**Link Budget:** TX power (mW), antenna gains (dBi), frequency (915/2.4/5.8 GHz), packet rate → free-space path loss, link margin (dB), theoretical range (km), sensitivity threshold.

**VTX Legal:** Country selection → frequency band + power limit lookup. Shows compliance verdict for chosen VTX settings. Ships with rules for: USA (FCC), EU, UK, Australia, New Zealand, Canada, Japan.

---

## 9. Unit Converters

FPV-specific conversions surfaced standalone:
- dBm ⇄ mW ⇄ W
- mAh ⇄ Wh (at pack voltage)
- KV → RPM (at voltage)
- RPM ⇄ Hz ⇄ rad/s (motor frequency to filter notch)
- AWG → ampacity + voltage drop over length
- deg ⇄ rad

---

## 10. Camera Tilt Calculator

Inputs: camera tilt angle (deg), flight speed (m/s or mph).

Outputs: horizon line position in frame, ground distance visible, angle-of-attack visualization. Simple Canvas 2D showing camera FOV cone at the tilt angle with speed vector.

---

## 11. Tune Diff Tool

Paste two Betaflight CLI `diff all` outputs. Parser extracts structured settings. Side-by-side diff with:
- Changed values highlighted
- Grouped by category (PID, filters, rates, features)
- Shareable URL encoding both configs

---

## 12. Blackbox Analyzer (Phase 4 — deferred but designed)

Drop a Blackbox CSV export file. Outputs:
- Gyro FFT (Welch PSD) with detected resonance peaks
- Step response extraction + overlay
- One-click handoff: fitted plant + spectral noise → PID simulator

System identification (Nelder-Mead) fits plant parameters to the log. Reports per-parameter confidence. Frequency-domain alternative for chirp/lively flights.

---

## 13. Quad Preview Component

Canvas 2D rendering, top-down view:

```
    M1[↻]          M2[↺]
       \            /
        \    CoG   /
         ●--------●
        /          \
       /            \
    M3[↺]          M4[↻]
```

- Motor circles: radius proportional to current RPM, spin direction indicated
- Thrust arrows: downward-pointing vectors at each motor, length = thrust magnitude
- Torque arrows: curved arrows at CoG showing roll/pitch/yaw moment
- Setpoint indicator: ghost arrow showing commanded rotation
- Color coding: green = tracking well, orange = error > threshold, red = saturated
- Updates at display framerate, interpolated from simulation ticks

---

## 14. Scope Component

Multi-channel time-series oscilloscope built on Canvas 2D:

- Series data as `Float32Array` for performance
- Catmull-Rom spline interpolation between sample points
- LTTB decimation for traces > 2x canvas pixel width
- Auto-scaling Y-axis with ±10% padding, or manual min/max
- Configurable grid (major/minor divisions, labels)
- Time cursor: vertical line follows mouse, shows interpolated values per series
- Metric badges: positioned at relevant points (overshoot peak, settling boundary)
- Legend: series name + color + toggle visibility
- Zoom: scroll to zoom X-axis, drag to pan
- Export: copy trace data as CSV

---

## 15. SEO & Lighthouse

- vite-ssg pre-renders all routes at build time
- Each route has `<title>`, `<meta description>`, Open Graph tags
- Semantic HTML: `<main>`, `<nav>`, `<article>`, heading hierarchy
- `<noscript>` explains the tool and suggests enabling JS
- Font preloading: Inter (variable) + JetBrains Mono (400)
- Image-free design (canvas renders, no raster assets)
- Target: 95+ Performance, 100 Accessibility, 100 Best Practices, 90+ SEO

---

## 16. Persistence & Sharing

- `localStorage` key per tool: `fpv-tools:{route}:config`
- URL search params: `?config=<base64url(JSON)>` for full state sharing
- No backend. No auth. No cookies beyond theme preference.

---

## 17. PWA (Phase 5)

- `vite-plugin-pwa` for service worker + manifest
- Offline-capable: all tools work without network after first load
- Install prompt on mobile
- App icon: simple geometric quad silhouette

---

## 18. Live Stick Input (Phase 5)

Gamepad API reads USB-connected radio (e.g. ELRS handset in joystick mode):
- Maps axes to roll/pitch/yaw/throttle setpoint
- Drives the PID simulator in real time
- Visual indicator when gamepad connected
- Axis mapping configuration

---

## 19. Testing Strategy

**Core (Vitest unit):**
- Null response: zero gains → no motion
- Pure-P: steady-state error matches analytic
- P+I: zeroes steady-state error
- Higher Kp ⇒ more overshoot
- D damps overshoot
- Lower D-cutoff under noise ⇒ less motor RMS + more lag
- Anti-windup clamp holds
- Determinism: same seed → same output
- Pack calculator: known cell + config → expected values

**Validation (fixture-based):**
- Ship a fixture blackbox log + known gains
- Assert identifyPlant recovers parameters within RMS threshold
- Assert fitNoiseFromSpectrum reconstructs peak locations

---

## 20. Honest Limits (surfaced in UI)

The simulator omits: unmodeled aerodynamics (turbulence, ground effect, gusts), ESC microdynamics/motor cogging, thermal drift, airframe flex. Identification quality depends on flight excitation level. Per-parameter confidence is reported. This is a sandbox for intuition — not a guarantee of a flyable tune. Always maiden carefully.

---

## 21. Implementation Phases

| Phase | Scope | Dependencies |
|-------|-------|-------------|
| 1 | Vite + Vue shell, design tokens, router, layout, landing page | None |
| 2 | Lit primitives (card, slider, number, badge, toggle, select, tabs) | Phase 1 |
| 3 | Core PID engine (types, plant, controller, filters, setpoint, simulate, metrics) | None |
| 4 | Scope component (fpv-scope) + quad preview (fpv-quad-preview) | Phase 2 |
| 5 | PID simulator UI (pid-controls, pid-simulator, presets, wiring) | Phases 3, 4 |
| 6 | Power calculator (core + UI) | Phases 1, 2 |
| 7 | Motor/prop sizing (core + UI) | Phases 1, 2 |
| 8 | RF link budget + VTX checker (core + UI) | Phases 1, 2 |
| 9 | Converters + camera tilt + tune diff (core + UI) | Phases 1, 2 |
| 10 | SEO: vite-ssg, meta tags, semantic HTML, Lighthouse audit | Phases 1-9 |
| 11 | Blackbox analyzer + system ID + noise model | Phases 3, 4 |
| 12 | Polish: PWA, live stick input, sharing URLs, mobile responsive | All |
