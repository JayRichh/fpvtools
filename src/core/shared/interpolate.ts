/**
 * Catmull-Rom spline interpolation.
 * Interpolates between p1 and p2 using p0 and p3 as tangent guides.
 * t is in [0, 1].
 */
export function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

/**
 * Largest-Triangle-Three-Buckets (LTTB) decimation.
 * Reduces a Float32Array of y-values (with implicit x = index) to at most
 * `threshold` points while preserving visual shape.
 *
 * Reference: Sveinn Steinarsson, "Downsampling Time Series for Visual
 * Representation" (2013).
 */
export function lttbDecimate(data: Float32Array, threshold: number): Float32Array {
  const len = data.length
  if (threshold >= len || threshold <= 0) return data.slice()

  const sampled: number[] = []

  // Always keep the first point.
  sampled.push(data[0])

  const bucketSize = (len - 2) / (threshold - 2)
  let prevSelected = 0 // index of last selected point

  for (let i = 0; i < threshold - 2; i++) {
    // Range of the current bucket.
    const rangeStart = Math.floor((i + 0) * bucketSize) + 1
    const rangeEnd   = Math.min(Math.floor((i + 1) * bucketSize) + 1, len - 1)

    // Average of the NEXT bucket (used as the far point for the triangle).
    const avgStart = Math.floor((i + 1) * bucketSize) + 1
    const avgEnd   = Math.min(Math.floor((i + 2) * bucketSize) + 1, len - 1)
    let avgX = 0, avgY = 0
    const avgLen = avgEnd - avgStart
    for (let j = avgStart; j < avgEnd; j++) {
      avgX += j
      avgY += data[j]
    }
    if (avgLen > 0) { avgX /= avgLen; avgY /= avgLen }

    // Pick the point in the current bucket that maximises the triangle area.
    let maxArea = -1
    let selected = rangeStart
    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (prevSelected - avgX) * (data[j]     - data[prevSelected]) -
        (prevSelected - j)    * (avgY         - data[prevSelected])
      ) * 0.5
      if (area > maxArea) {
        maxArea  = area
        selected = j
      }
    }

    sampled.push(data[selected])
    prevSelected = selected
  }

  // Always keep the last point.
  sampled.push(data[len - 1])

  return new Float32Array(sampled)
}
