import type { CellSpec } from './types'
export const CELL_LIBRARY: Record<string, CellSpec> = {
  'Molicel P42A': { name: 'Molicel P42A', capacityMah: 4200, maxContinuousA: 45, weightG: 70, internalResistanceMohm: 12, nominalV: 3.6 },
  'Molicel P45B': { name: 'Molicel P45B', capacityMah: 4500, maxContinuousA: 45, weightG: 70, internalResistanceMohm: 11, nominalV: 3.6 },
  'Molicel P50B': { name: 'Molicel P50B', capacityMah: 5000, maxContinuousA: 35, weightG: 70, internalResistanceMohm: 14, nominalV: 3.6 },
  'Samsung 40T': { name: 'Samsung 40T', capacityMah: 4000, maxContinuousA: 35, weightG: 67, internalResistanceMohm: 13, nominalV: 3.6 },
  'Samsung 50E': { name: 'Samsung 50E', capacityMah: 5000, maxContinuousA: 10, weightG: 69, internalResistanceMohm: 20, nominalV: 3.6 },
  'Sony VTC6': { name: 'Sony VTC6', capacityMah: 3000, maxContinuousA: 30, weightG: 47, internalResistanceMohm: 18, nominalV: 3.6 },
  'LG HG2': { name: 'LG HG2', capacityMah: 3000, maxContinuousA: 20, weightG: 47, internalResistanceMohm: 20, nominalV: 3.6 },
}
