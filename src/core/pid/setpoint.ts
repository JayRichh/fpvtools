import type { SetpointProfile } from './types'

export function generateSetpoint(profile: SetpointProfile, tMs: number): number {
  switch (profile.kind) {
    case 'step':
      return tMs >= profile.startMs ? profile.amplitudeDegS : 0

    case 'ramp': {
      if (tMs < profile.startMs) return 0
      const elapsed = tMs - profile.startMs
      if (elapsed >= profile.durationMs) return profile.amplitudeDegS
      return profile.amplitudeDegS * (elapsed / profile.durationMs)
    }

    case 'sine': {
      const tSec = tMs / 1000
      return profile.amplitudeDegS * Math.sin(2 * Math.PI * profile.frequencyHz * tSec)
    }

    case 'trace': {
      const tSec = tMs / 1000
      const samples = profile.samplesDegS
      const rate = profile.sampleRateHz
      const idx = tSec * rate
      const i0 = Math.floor(idx)
      if (i0 < 0) return samples[0] ?? 0
      if (i0 >= samples.length - 1) return samples[samples.length - 1] ?? 0
      const frac = idx - i0
      return samples[i0] + frac * (samples[i0 + 1] - samples[i0])
    }
  }
}
