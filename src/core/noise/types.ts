export interface SpectralNoise {
  fundamentalHz: number
  harmonicAmps: number[]
  resonance?: { freqHz: number; q: number; gain: number }
  broadbandStdDegS: number
}
