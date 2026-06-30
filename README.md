# FPV Tools

Browser-native calculators and simulators for FPV pilots. No install, no account, no ads.

**[fpvtools.vercel.app](https://fpvtools.vercel.app)**

---

## Tools

| Tool | Description |
|------|-------------|
| **PID Simulator** | Betaflight-style rate-loop simulator with live scope and 3D quad preview |
| **Pack Calculator** | Li-ion / LiPo pack sizing — flight time, voltage sag, C-rate, 3D cell view |
| **Motor / Prop Sizing** | Thrust, T:W ratio, hover current, ESC load — 3D thrust column view |
| **Flight Time** | Discharge model with range ring — hover and cruise estimates |
| **RF Link Budget** | ELRS path-loss calculator and VTX compliance checker (USA, EU, UK, AU…) |
| **Camera Tilt** | FOV, horizon position, and ground coverage at tilt angle and speed |
| **Blackbox Analyzer** | Gyro FFT and step-response extraction from Betaflight CSV exports |
| **Tune Diff** | Side-by-side comparison of two Betaflight `diff all` outputs |
| **Unit Converters** | dBm/mW, mAh/Wh, KV/RPM, AWG ampacity, deg/rad |
| **Build Planner** | Local-first parts list, checklist, store guide, and firmware links |

---

## Stack

Vue 3 · Lit 3 · TypeScript · Vite · Canvas 2D (3D projection from scratch)

All computation is client-side. No backend, no tracking.
