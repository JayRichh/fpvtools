import type { Spectrum } from '@core/blackbox/fft'
import type { SpectralNoise } from './types.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Median of a finite subset of a Float32Array (returned in dB). */
function medianDb(psd: Float32Array): number {
  const finite = Array.from(psd).filter(v => isFinite(v))
  if (finite.length === 0) return -120
  finite.sort((a, b) => a - b)
  return finite[Math.floor(finite.length / 2)]
}

/**
 * Estimate the Q factor of a peak at `peakBin` using the 3-dB bandwidth.
 * Falls back to Q = 1 when the bandwidth cannot be determined.
 */
function estimateQ(psd: Float32Array, freqHz: Float32Array, peakBin: number): number {
  const halfPowerDb = psd[peakBin] - 3

  let lowerBin = 0
  for (let i = peakBin - 1; i >= 0; i--) {
    if (psd[i] <= halfPowerDb) { lowerBin = i; break }
  }

  let upperBin = psd.length - 1
  for (let i = peakBin + 1; i < psd.length; i++) {
    if (psd[i] <= halfPowerDb) { upperBin = i; break }
  }

  const bw = freqHz[upperBin] - freqHz[lowerBin]
  return bw > 0 ? freqHz[peakBin] / bw : 1
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fit a simple noise model from a PSD (output of `welchPsd`).
 *
 * Steps:
 * 1. Highest peak → motor fundamental.
 * 2. Check bins at 2× and 3× the fundamental → harmonics.
 * 3. Non-harmonic peak > 6 dB above median → frame resonance.
 * 4. Median PSD away from peaks → broadband floor (converted to deg/s std).
 */
export function fitNoiseFromSpectrum(spectrum: Spectrum): SpectralNoise {
  const { freqHz, psd } = spectrum
  const N = psd.length

  if (N === 0) {
    return { fundamentalHz: 0, harmonicAmps: [], broadbandStdDegS: 0 }
  }

  // ── 1. Motor fundamental ──────────────────────────────────────────────────
  let maxPsd = -Infinity
  let fundamentalBin = 1
  for (let i = 1; i < N; i++) {
    if (psd[i] > maxPsd) { maxPsd = psd[i]; fundamentalBin = i }
  }
  const fundamentalHz = freqHz[fundamentalBin]

  // ── 2. Harmonics ──────────────────────────────────────────────────────────
  const median = medianDb(psd)
  const harmonicAmps: number[] = []

  for (let h = 2; h <= 3; h++) {
    const targetBin = Math.round(fundamentalBin * h)
    if (targetBin >= N) { harmonicAmps.push(0); continue }

    let localMax = -Infinity
    const lo = Math.max(1, targetBin - 5)
    const hi = Math.min(N, targetBin + 6)
    for (let k = lo; k < hi; k++) {
      if (psd[k] > localMax) localMax = psd[k]
    }
    harmonicAmps.push(localMax > median + 6 ? Math.pow(10, localMax / 20) : 0)
  }

  // ── 3. Frame resonance ────────────────────────────────────────────────────
  // Exclude bins within ±5 of fundamental and each harmonic
  const excluded = new Set<number>()
  for (let h = 1; h <= 4; h++) {
    const hBin = Math.round(fundamentalBin * h)
    for (let k = Math.max(0, hBin - 5); k < Math.min(N, hBin + 6); k++) {
      excluded.add(k)
    }
  }

  let resPsd = -Infinity
  let resBin = -1
  for (let i = 1; i < N; i++) {
    if (!excluded.has(i) && psd[i] > resPsd) { resPsd = psd[i]; resBin = i }
  }

  let resonance: SpectralNoise['resonance'] = undefined
  if (resBin > 0 && resPsd > median + 6) {
    resonance = {
      freqHz: freqHz[resBin],
      q:      estimateQ(psd, freqHz, resBin),
      gain:   Math.pow(10, resPsd / 20),
    }
  }

  // ── 4. Broadband floor ────────────────────────────────────────────────────
  // Convert median dB (10·log10 of power) to approximate amplitude std
  // psd_dB = 10·log10(amplitude²) → amplitude = 10^(psd_dB / 20)
  const broadbandStdDegS = Math.pow(10, median / 20)

  return { fundamentalHz, harmonicAmps, resonance, broadbandStdDegS }
}
