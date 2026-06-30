import type { BuildDefinition } from './types.js'

export const SEED_7LR_SLUG = '7-lr-fpv'

export function seed7LR(): BuildDefinition {
  const now = Date.now()
  return {
    meta: {
      slug: SEED_7LR_SLUG,
      name: '7" Long-Range FPV Build',
      description: 'iFlight AOS 7 V5 · 2806.5 1300KV · SpeedyBee F405 BLS 55A · Walksnail Avatar HD · ELRS Dual-Band · Molicel P42A 6S',
      createdAt: now,
      updatedAt: now,
    },
    catOrder: ['Airframe', 'Ground Station', 'Power', 'Consumables', 'QOL'],
    storeOrder: ['iFlight direct', 'Hobby Station', 'KiwiQuads', 'Killa Drones', 'AliExpress', 'Hardware store', 'Digital'],
    storesMeta: {
      'iFlight direct': { url: 'https://iflight-rc.com', ship: 'Ships from CN', hue: 210 },
      'Hobby Station':  { url: 'https://hobbystation.co.nz', ship: 'Ships from NZ', hue: 140 },
      'KiwiQuads':      { url: 'https://www.kiwiquads.co.nz', ship: 'Ships from NZ', hue: 100 },
      'Killa Drones':   { url: 'https://killadrones.co.nz', ship: 'Ships from NZ', hue: 0 },
      'AliExpress':     { url: 'https://www.aliexpress.com', ship: 'Ships from CN', hue: 30 },
      'Hardware store': { url: '', ship: 'Local', hue: 60 },
      'Digital':        { url: '', ship: 'Instant download', hue: 270 },
    },
    items: [
      {
        id: 'frame', name: 'iFlight AOS 7 V5 Frame Kit', cat: 'Airframe',
        price: 210, confirmed: false, store: 'iFlight direct', url: 'https://iflight-rc.com/products/iflight-aos-7-v5-frame-kit',
        stock: 'check', verified: false, note: '', backups: [],
      },
      {
        id: 'motors', name: 'iFlight XING 2806.5 1300KV ×4', cat: 'Airframe',
        price: 205.20, confirmed: false, store: 'Hobby Station', url: 'https://hobbystation.co.nz',
        stock: 'check', verified: false,
        note: 'Motor library lists maxCurrentA: 42A. Some sources quote 34A continuous at 6S with 7040 props — verify against your batch\'s dyno sheet. The SpeedyBee 55A ESC has headroom at either figure, but confirm before sustained WOT runs.',
        backups: [],
      },
      {
        id: 'fcesc', name: 'SpeedyBee F405 V4 BLS 55A Stack', cat: 'Airframe',
        price: 139.99, confirmed: true, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz/speedybee-f405-v4-bls-55a-stack/',
        stock: 'in', verified: false, note: '', backups: [],
      },
      {
        id: 'caps', name: 'Capacitors 50V 470uF ×2', cat: 'Airframe',
        price: 8.00, confirmed: false, store: 'AliExpress', url: 'https://www.aliexpress.com',
        stock: 'check', verified: false, note: 'Low-ESR electrolytic, 10mm diameter to fit between motor mounts.', backups: [],
      },
      {
        id: 'vtx', name: 'Walksnail Avatar HD Pro Kit V2', cat: 'Airframe',
        price: 315.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: '', backups: [],
      },
      {
        id: 'rx', name: 'RadioMaster DBR4 Dual-Band ELRS', cat: 'Airframe',
        price: 55.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: '900 MHz + 2.4 GHz ELRS. Dual antenna for diversity.', backups: [],
      },
      {
        id: 'gps', name: 'TBS M10Q GPS Glonass', cat: 'Airframe',
        price: 45.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: '', backups: [],
      },
      {
        id: 'buzzer', name: 'VIFLY Finder V2 Buzzer', cat: 'Airframe',
        price: 35.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: 'Standalone buzzer with LVC alarm. Wire to battery for post-crash location.', backups: [],
      },
      {
        id: 'props', name: 'Gemfan Flash 7040 ×5 sets', cat: 'Airframe',
        price: 34.95, confirmed: false, store: 'Killa Drones', url: 'https://killadrones.co.nz',
        stock: 'check', verified: false, note: 'Buy 5 sets minimum — crash tax is real.', backups: [],
      },
      {
        id: 'radio', name: 'RadioMaster GX12 Gemini-X', cat: 'Ground Station',
        price: 400.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: 'Dual-band ELRS internal module. Runs Boxer/TX16S firmware.', backups: [],
      },
      {
        id: 'goggles', name: 'Walksnail Avatar HD Goggles X', cat: 'Ground Station',
        price: 747.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: '', backups: [],
      },
      {
        id: 'gogbatt', name: 'GNB 2S 3000mAh Goggle Battery', cat: 'Ground Station',
        price: 30.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: '', backups: [],
      },
      {
        id: 'charger', name: 'HOTA D6 Pro 325W Dual Charger', cat: 'Ground Station',
        price: 200.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: 'Charge both 6S pack and goggle battery simultaneously.', backups: [],
      },
      {
        id: 'radiocells', name: '18650 cells ×2 (GX12 radio)', cat: 'Ground Station',
        price: 20.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: 'Confirm GX12 cell spec — 18650 or 21700.', backups: [],
      },
      {
        id: 'cells', name: 'Molicel P42A 21700 ×6 (6S pack)', cat: 'Power',
        price: 60.00, confirmed: false, store: 'AliExpress', url: 'https://www.aliexpress.com',
        stock: 'check', verified: false, note: '4200mAh, 45A continuous. Buy from reputable seller with datasheet.', backups: [],
      },
      {
        id: 'lipo', name: '6S LiPo 1300–1500mAh (tuning)', cat: 'Power',
        price: 60.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: 'Lightweight pack for initial hover/tuning before building the 6S li-ion pack.', backups: [],
      },
      {
        id: 'coating', name: 'Kotking Conformal Coating', cat: 'Consumables',
        price: 18.00, confirmed: false, store: 'KiwiQuads', url: 'https://www.kiwiquads.co.nz',
        stock: 'check', verified: false, note: 'Apply to FC/ESC after soldering to protect against moisture.', backups: [],
      },
      {
        id: 'smoke', name: 'TBS Smoke Stopper', cat: 'Consumables',
        price: 13.50, confirmed: false, store: 'Killa Drones', url: 'https://killadrones.co.nz',
        stock: 'check', verified: false, note: 'Always first-power through smoke stopper before connecting battery directly.', backups: [],
      },
      {
        id: 'loctite', name: 'Loctite Blue 243 Threadlocker', cat: 'Consumables',
        price: 12.00, confirmed: false, store: 'Hardware store', url: '',
        stock: 'check', verified: false, note: 'Use on motor screws, standoffs. Blue = removable (not red!).', backups: [],
      },
      {
        id: 'bits', name: 'XT60 connectors + battery straps', cat: 'Consumables',
        price: 25.00, confirmed: false, store: 'AliExpress', url: 'https://www.aliexpress.com',
        stock: 'check', verified: false, note: '', backups: [],
      },
      {
        id: 'sim', name: 'VelociDrone Simulator', cat: 'QOL',
        price: 30.00, confirmed: false, store: 'Digital', url: 'https://www.velocidrone.com',
        stock: 'check', verified: false, note: 'Practice long-range lines and cinematic moves before real packs.', backups: [],
      },
    ],
    checklist: [
      { text: 'Inspect frame for cracks or warping', phase: 'Bench' },
      { text: 'Dry-fit all components before soldering', phase: 'Bench' },
      { text: 'Solder motor leads — check rotation direction', phase: 'Bench' },
      { text: 'Solder ESC power leads with capacitors in parallel', phase: 'Bench' },
      { text: 'First power via Smoke Stopper', phase: 'Bench' },
      { text: 'Flash Betaflight firmware', phase: 'Setup' },
      { text: 'Configure AM32 ESC firmware via passthrough', phase: 'Setup' },
      { text: 'Flash ELRS TX/RX firmware — match version', phase: 'Setup' },
      { text: 'Bind radio → receiver', phase: 'Setup' },
      { text: 'Configure Walksnail VTX channel & power', phase: 'Setup' },
      { text: 'Configure GPS rescue in Betaflight', phase: 'Setup' },
      { text: 'Set failsafe to GPS rescue or land', phase: 'Setup' },
      { text: 'Calibrate compass', phase: 'Field' },
      { text: 'Pre-arm checks: props off, motors spin correct direction', phase: 'Field' },
      { text: 'First hover test — check oscillations', phase: 'Field' },
    ],
    firmware: [
      { name: 'Betaflight 4.5', url: 'https://github.com/betaflight/betaflight/releases' },
      { name: 'AM32 ESC Firmware', url: 'https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware/releases' },
      { name: 'ExpressLRS', url: 'https://github.com/ExpressLRS/ExpressLRS/releases' },
      { name: 'Walksnail Avatar Firmware', url: 'https://store.walksnail.com/pages/firmware' },
    ],
    refs: [
      { name: 'iFlight AOS 7 V5 Build Guide', url: 'https://iflight-rc.com' },
      { name: 'SpeedyBee F405 V4 Manual', url: 'https://www.speedybee.com/speedybee-f405-v4-bls-55a-30x30-fc-esc-stack/' },
      { name: 'ELRS Quick Start Guide', url: 'https://www.expresslrs.org/quick-start/getting-started/' },
      { name: 'Betaflight GPS Rescue Wiki', url: 'https://betaflight.com/docs/wiki/guides/current/GPS-Rescue-v4-4' },
    ],
  }
}
