/**
 * Generic biquad filter — direct form 1.
 * Coefficients follow the Audio EQ Cookbook convention:
 *   H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
 * All a0 normalization is done in the factory methods before storing.
 */
export class BiquadFilter {
  private b0: number
  private b1: number
  private b2: number
  private a1: number
  private a2: number

  // Direct form 1 state: two delay lines
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(b0: number, b1: number, b2: number, a1: number, a2: number) {
    this.b0 = b0
    this.b1 = b1
    this.b2 = b2
    this.a1 = a1
    this.a2 = a2
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
              - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }

  reset(): void {
    this.x1 = 0
    this.x2 = 0
    this.y1 = 0
    this.y2 = 0
  }

  /** Lowpass filter (Audio EQ Cookbook LPF). */
  static lowpass(fc: number, fs: number, q: number): BiquadFilter {
    const w0 = 2 * Math.PI * fc / fs
    const cosW0 = Math.cos(w0)
    const alpha = Math.sin(w0) / (2 * q)
    const a0 = 1 + alpha
    return new BiquadFilter(
      (1 - cosW0) / 2 / a0,
      (1 - cosW0) / a0,
      (1 - cosW0) / 2 / a0,
      -2 * cosW0 / a0,
      (1 - alpha) / a0,
    )
  }

  /** Notch (band-reject) filter (Audio EQ Cookbook notch). */
  static notch(fc: number, fs: number, q: number): BiquadFilter {
    const w0 = 2 * Math.PI * fc / fs
    const cosW0 = Math.cos(w0)
    const alpha = Math.sin(w0) / (2 * q)
    const a0 = 1 + alpha
    return new BiquadFilter(
      1 / a0,
      -2 * cosW0 / a0,
      1 / a0,
      -2 * cosW0 / a0,
      (1 - alpha) / a0,
    )
  }

  /** Peaking EQ filter (Audio EQ Cookbook peakingEQ). */
  static peaking(fc: number, fs: number, q: number, gainDb: number): BiquadFilter {
    const w0 = 2 * Math.PI * fc / fs
    const A = Math.pow(10, gainDb / 40)
    const cosW0 = Math.cos(w0)
    const alpha = Math.sin(w0) / (2 * q)
    const a0 = 1 + alpha / A
    return new BiquadFilter(
      (1 + alpha * A) / a0,
      -2 * cosW0 / a0,
      (1 - alpha * A) / a0,
      -2 * cosW0 / a0,
      (1 - alpha / A) / a0,
    )
  }
}
