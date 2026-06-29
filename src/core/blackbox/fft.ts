// ─── In-place radix-2 Cooley-Tukey FFT ──────────────────────────────────────

/**
 * In-place radix-2 DIT FFT.
 * Length of real and imag must be a power of 2.
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const N = real.length
  if (N <= 1) return

  // Bit-reversal permutation
  let j = 0
  for (let i = 1; i < N; i++) {
    let bit = N >> 1
    while (j & bit) {
      j ^= bit
      bit >>= 1
    }
    j ^= bit
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti
    }
  }

  // Butterfly stages
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1
    const phaseStep = -Math.PI / half   // -2*PI / len
    const wBaseRe = Math.cos(phaseStep)
    const wBaseIm = Math.sin(phaseStep)

    for (let i = 0; i < N; i += len) {
      let wRe = 1.0
      let wIm = 0.0

      for (let k = 0; k < half; k++) {
        const evenRe = real[i + k]
        const evenIm = imag[i + k]
        const oddRe  = real[i + k + half]
        const oddIm  = imag[i + k + half]

        // Twiddle: t = w * odd
        const tRe = wRe * oddRe - wIm * oddIm
        const tIm = wRe * oddIm + wIm * oddRe

        real[i + k]        = evenRe + tRe
        imag[i + k]        = evenIm + tIm
        real[i + k + half] = evenRe - tRe
        imag[i + k + half] = evenIm - tIm

        // Advance twiddle factor
        const nextWRe = wRe * wBaseRe - wIm * wBaseIm
        wIm = wRe * wBaseIm + wIm * wBaseRe
        wRe = nextWRe
      }
    }
  }
}

// ─── Welch Power Spectral Density ─────────────────────────────────────────────

export interface Spectrum {
  freqHz: Float32Array
  psd: Float32Array   // power spectral density in dB
}

/** Round n up to the nearest power of 2. */
function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Welch PSD estimate.
 *
 * Splits `signal` into 50%-overlapping windows of `windowSize` (rounded up to
 * the nearest power of 2), applies a Hann window, FFTs each window, and
 * averages the magnitude-squared to produce a single-sided PSD returned in dB
 * (10·log10). Falls back to a single zero-padded window when the signal is
 * shorter than `windowSize`.
 *
 * @param signal     Input samples
 * @param fs         Sample rate in Hz
 * @param windowSize Nominal window length (default 1024; clamped to power of 2)
 */
export function welchPsd(signal: Float32Array, fs: number, windowSize = 1024): Spectrum {
  const W    = nextPow2(windowSize)
  const hop  = W >> 1              // 50% overlap
  const halfW = W >> 1

  // Periodic Hann window: w[i] = 0.5 * (1 - cos(2*pi*i / W))
  const hann = new Float32Array(W)
  for (let i = 0; i < W; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / W))
  }

  // Sum of squared Hann coefficients (for normalising the PSD)
  let hannPower = 0
  for (let i = 0; i < W; i++) hannPower += hann[i] * hann[i]

  const psdAccum = new Float64Array(halfW + 1)
  let numWindows = 0

  const real = new Float32Array(W)
  const imag = new Float32Array(W)

  // Process overlapping windows
  for (let start = 0; start + W <= signal.length; start += hop) {
    for (let i = 0; i < W; i++) {
      real[i] = signal[start + i] * hann[i]
      imag[i] = 0
    }
    fft(real, imag)
    for (let k = 0; k <= halfW; k++) {
      psdAccum[k] += real[k] * real[k] + imag[k] * imag[k]
    }
    numWindows++
  }

  // Fallback: single zero-padded window for short signals
  if (numWindows === 0) {
    const len = Math.min(signal.length, W)
    for (let i = 0; i < W; i++) {
      real[i] = i < len ? signal[i] * hann[i] : 0
      imag[i] = 0
    }
    fft(real, imag)
    for (let k = 0; k <= halfW; k++) {
      psdAccum[k] += real[k] * real[k] + imag[k] * imag[k]
    }
    numWindows = 1
  }

  const scale = 1.0 / (numWindows * hannPower)
  const freqHz = new Float32Array(halfW + 1)
  const psd    = new Float32Array(halfW + 1)

  for (let k = 0; k <= halfW; k++) {
    freqHz[k] = (k * fs) / W
    // Guard against near-zero to avoid -Infinity in dB
    psd[k] = 10 * Math.log10(psdAccum[k] * scale + 1e-12)
  }

  return { freqHz, psd }
}
