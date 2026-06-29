# FPV Tools

Browser-native FPV calculators and simulators. Vue 3 + Lit 3 + TypeScript.

## Architecture

- **src/core/** — Pure TypeScript physics/math modules. Zero DOM, zero framework. All functions are pure.
- **src/components/** — Lit 3 web components. Primitives use `fpv-` prefix. Tool components use their own prefix.
- **src/app/** — Vue 3 shell: router, layout, views, composables.
- **src/styles/** — Design tokens (CSS custom properties), reset, global styles.

## Key Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm test` — Run all tests (vitest)
- `npm run test:watch` — Watch mode

## Conventions

- All core modules are pure functions — no DOM, no side effects
- CSS via custom properties only (var(--fpv-*)), no CSS framework
- Dark theme default, light via [data-theme="light"]
- Internal units: SI (rad/s, kg*m^2, N*m). deg/s only at boundaries
- Lit components use tokenStyles from primitives/tokens.css.ts
- Custom events use bubbles: true, composed: true
- Vue↔Lit binding: :prop for objects, @event for custom events
- Seeded PRNG for all randomness (deterministic output)
