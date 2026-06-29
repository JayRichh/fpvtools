export type DegPerSec = number & { readonly __u: 'deg/s' }
export type RadPerSec = number & { readonly __u: 'rad/s' }
const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI
export function toRad(d: DegPerSec): RadPerSec { return (d * DEG2RAD) as RadPerSec }
export function toDeg(r: RadPerSec): DegPerSec { return (r * RAD2DEG) as DegPerSec }
export function degToRad(d: number): number { return d * DEG2RAD }
export function radToDeg(r: number): number { return r * RAD2DEG }
