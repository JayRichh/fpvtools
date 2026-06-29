export interface RouteMeta {
  title: string
  description: string
  ogTitle?: string
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: 'FPV Tools — Browser-Native Calculators for FPV Pilots',
    description: 'Free, open-source FPV tools: PID simulator, pack calculator, motor sizing, link budget, VTX checker, and more. No install, no ads.',
  },
  '/pid': {
    title: 'PID Simulator — FPV Tools',
    description: 'Interactive Betaflight-style PID rate-loop simulator. Tune P/I/D/FF gains with live scope, quad preview, and performance metrics.',
  },
  '/power': {
    title: 'Pack Calculator — FPV Tools',
    description: 'Li-ion and LiPo pack sizing calculator. Flight time, voltage sag, C-rate analysis for Molicel P42A, P45B, Samsung 40T, and more.',
  },
  '/motors': {
    title: 'Motor Sizing — FPV Tools',
    description: 'Motor and prop sizing calculator. Thrust-to-weight ratio, efficiency, and current draw estimation for FPV builds.',
  },
  '/rf': {
    title: 'RF Tools — FPV Tools',
    description: 'ELRS link budget calculator and VTX power compliance checker. Check legal limits for USA, EU, UK, Australia, NZ, Canada, Japan.',
  },
  '/convert': {
    title: 'Unit Converters — FPV Tools',
    description: 'FPV-specific unit conversions: dBm/mW, mAh/Wh, KV/RPM, AWG ampacity, and more.',
  },
  '/tilt': {
    title: 'Camera Tilt Calculator — FPV Tools',
    description: 'Camera tilt angle vs flight speed calculator. Visualize horizon position and ground coverage.',
  },
  '/diff': {
    title: 'Tune Diff — FPV Tools',
    description: 'Compare two Betaflight CLI dumps side by side. See changed PID, filter, and rate settings at a glance.',
  },
  '/blackbox': {
    title: 'Blackbox Analyzer — FPV Tools',
    description: 'Analyze Betaflight blackbox logs. Gyro FFT, step response, and system identification.',
  },
}
