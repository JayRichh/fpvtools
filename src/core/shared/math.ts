export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
export function remap(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin)
}
export function rms(arr: Float32Array): number {
  let sum = 0
  for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i]
  return Math.sqrt(sum / arr.length)
}
