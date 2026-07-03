import type { CellSpec } from './types'
export const CELL_LIBRARY: Record<string, CellSpec> = {
  // Li-ion (3.6 V nominal)
  'Molicel P42A': { name: 'Molicel P42A', capacityMah: 4200, maxContinuousA: 45, weightG: 70, internalResistanceMohm: 12, nominalV: 3.6 },
  'Molicel P45B': { name: 'Molicel P45B', capacityMah: 4500, maxContinuousA: 45, weightG: 70, internalResistanceMohm: 11, nominalV: 3.6 },
  'Molicel P50B': { name: 'Molicel P50B', capacityMah: 5000, maxContinuousA: 35, weightG: 70, internalResistanceMohm: 14, nominalV: 3.6 },
  'Samsung 40T': { name: 'Samsung 40T', capacityMah: 4000, maxContinuousA: 35, weightG: 67, internalResistanceMohm: 13, nominalV: 3.6 },
  'Samsung 50E': { name: 'Samsung 50E', capacityMah: 5000, maxContinuousA: 10, weightG: 69, internalResistanceMohm: 20, nominalV: 3.6 },
  'Sony VTC6': { name: 'Sony VTC6', capacityMah: 3000, maxContinuousA: 30, weightG: 47, internalResistanceMohm: 18, nominalV: 3.6 },
  'LG HG2': { name: 'LG HG2', capacityMah: 3000, maxContinuousA: 20, weightG: 47, internalResistanceMohm: 20, nominalV: 3.6 },
  // LiPo (3.7 V nominal, per-cell values; C-ratings derated to realistic continuous)
  'LiPo 300mAh whoop': { name: 'LiPo 300mAh whoop', capacityMah: 300, maxContinuousA: 18, weightG: 8, internalResistanceMohm: 40, nominalV: 3.7 },
  'LiPo 450mAh micro': { name: 'LiPo 450mAh micro', capacityMah: 450, maxContinuousA: 27, weightG: 12, internalResistanceMohm: 30, nominalV: 3.7 },
  'LiPo 650mAh toothpick': { name: 'LiPo 650mAh toothpick', capacityMah: 650, maxContinuousA: 39, weightG: 17, internalResistanceMohm: 18, nominalV: 3.7 },
  'LiPo 1100mAh 3S class': { name: 'LiPo 1100mAh 3S class', capacityMah: 1100, maxContinuousA: 66, weightG: 30, internalResistanceMohm: 8, nominalV: 3.7 },
  'LiPo 1300mAh race': { name: 'LiPo 1300mAh race', capacityMah: 1300, maxContinuousA: 91, weightG: 38, internalResistanceMohm: 4, nominalV: 3.7 },
  'LiPo 1500mAh freestyle': { name: 'LiPo 1500mAh freestyle', capacityMah: 1500, maxContinuousA: 105, weightG: 43, internalResistanceMohm: 4, nominalV: 3.7 },
  'LiPo 2200mAh cine': { name: 'LiPo 2200mAh cine', capacityMah: 2200, maxContinuousA: 110, weightG: 60, internalResistanceMohm: 5, nominalV: 3.7 },
}
