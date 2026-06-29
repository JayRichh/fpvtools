import { describe, it, expect } from 'vitest'
import { fft, welchPsd } from '../../../src/core/blackbox/fft'
import { mulberry32 } from '../../../src/core/shared/prng'

// ─── FFT ──────────────────────────────────────────────────────────────────────

describe('fft', () => {
  it('peak at the correct bin for a pure on-bin sine wave', () => {
    // N = 1024 samples, fs = 1024 Hz → 1 Hz per bin.
    // A sine at 64 Hz falls exactly on bin 64 — no spectral leakage.
    const N    = 1024
    const fs   = 1024
    const freq = 64   // Hz → bin index 64

    const real = new Float32Array(N)
    const imag = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      real[i] = Math.sin(2 * Math.PI * freq * i / fs)
    }

    fft(real, imag)

    // Find peak in the positive-frequency half (bins 1 … N/2-1)
    let maxMag  = -Infinity
    let peakBin = -1
    for (let k = 1; k < N / 2; k++) {
      const mag = real[k] * real[k] + imag[k] * imag[k]
      if (mag > maxMag) { maxMag = mag; peakBin = k }
    }

    expect(peakBin).toBe(64)
  })

  it('output is purely real for a real symmetric input', () => {
    // For even-length all-real input the imaginary output should be zero (up to
    // floating-point rounding) at DC and Nyquist.
    const N    = 8
    const real = new Float32Array([1, 2, 3, 4, 4, 3, 2, 1])
    const imag = new Float32Array(N)

    fft(real, imag)

    // DC and Nyquist must have zero imaginary part for a real-valued symmetric signal
    expect(Math.abs(imag[0])).toBeLessThan(1e-5)
    expect(Math.abs(imag[N / 2])).toBeLessThan(1e-5)
  })
})

// ─── Welch PSD ────────────────────────────────────────────────────────────────

describe('welchPsd', () => {
  it('PSD of seeded white noise is roughly flat across the band', () => {
    // Use a deterministic PRNG so the test is reproducible.
    const rng    = mulberry32(42)
    const N      = 4096   // 4× window → 7 overlapping windows (50% overlap)
    const fs     = 1000   // Hz
    const signal = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      signal[i] = rng() * 2 - 1   // centred uniform white noise
    }

    const { psd } = welchPsd(signal, fs, 1024)

    // Split the positive-frequency bins (skip DC at k=0) into two halves and
    // compare their means.  White noise should keep them within 6 dB of each
    // other after Welch averaging.
    const nBins = psd.length
    const mid   = Math.floor(nBins / 2)

    const mean = (arr: number[]): number =>
      arr.reduce((s, v) => s + v, 0) / arr.length

    const loBins = Array.from(psd.subarray(1, mid)).filter(isFinite)
    const hiBins = Array.from(psd.subarray(mid)).filter(isFinite)

    expect(loBins.length).toBeGreaterThan(0)
    expect(hiBins.length).toBeGreaterThan(0)

    const diff = Math.abs(mean(loBins) - mean(hiBins))
    expect(diff).toBeLessThan(6)  // within 6 dB
  })

  it('handles signal shorter than windowSize without throwing', () => {
    const signal = new Float32Array([1, 0, -1, 0])  // 4 samples < default 1024
    expect(() => welchPsd(signal, 1000)).not.toThrow()
    const { psd } = welchPsd(signal, 1000)
    expect(psd.length).toBeGreaterThan(0)
    expect(psd.every(isFinite)).toBe(true)
  })
})
