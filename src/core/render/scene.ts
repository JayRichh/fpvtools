// src/core/render/scene.ts — Pure TS, zero DOM, zero framework
//
// A SceneNode is not just a draw closure: it carries metadata (hover payload)
// and an analytic hit-region, which is what distinguishes hoverable entities
// from a plain list of draw calls.

export type NodeKind = 'entity' | 'vector' | 'chart' | 'grid' | 'label'

/** Screen-space analytic hit regions (computed at scene-build time). */
export type HitRegion =
  | { type: 'circle'; x: number; y: number; r: number }
  | { type: 'segment'; x1: number; y1: number; x2: number; y2: number; width: number }
  | { type: 'ellipse'; x: number; y: number; rx: number; ry: number; rotation?: number }
  | { type: 'polyline'; points: ReadonlyArray<readonly [number, number]>; width: number }

export interface DrawState {
  hovered: boolean
}

export interface SceneNode {
  id: string
  kind: NodeKind
  /** Back-to-front sort key: smaller = further from camera, drawn first */
  depth: number
  /** Hover payload (label, value, units) shown by the metadata overlay */
  meta?: Record<string, unknown>
  /** Analytic hit region for picking; omit for non-interactive nodes */
  hit?: HitRegion
  draw(ctx: CanvasRenderingContext2D, state: DrawState): void
}

/** Stable back-to-front ordering (does not mutate the input). */
export function sortBackToFront(nodes: readonly SceneNode[]): SceneNode[] {
  return nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.depth - b.n.depth || a.i - b.i)
    .map(({ n }) => n)
}
