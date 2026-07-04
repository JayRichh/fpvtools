import { describe, it, expect } from 'vitest'
import {
  createOrbitCamera, projectPoint, applyOrbit, rotX, rotY, rotZ,
} from '../../../src/core/render/camera'
import type { Vec3 } from '../../../src/core/render/camera'
import { sortBackToFront } from '../../../src/core/render/scene'
import type { SceneNode } from '../../../src/core/render/scene'
import { hitTest, pickNode } from '../../../src/core/render/picking'

const node = (id: string, depth: number, hit?: SceneNode['hit']): SceneNode => ({
  id, kind: 'entity', depth, hit, draw: () => {},
})

describe('camera', () => {
  it('rotX/rotY/rotZ preserve vector length', () => {
    const v: Vec3 = [1, 2, 3]
    const len = Math.hypot(...v)
    for (const r of [rotX(v, 0.7), rotY(v, -1.2), rotZ(v, 2.4)]) {
      expect(Math.hypot(...r)).toBeCloseTo(len, 10)
    }
  })

  it('projects the origin to the screen center at depth 1', () => {
    const cam = createOrbitCamera({ yaw: 0.5, pitch: -0.4, scale: 100, focalLen: 4, cx: 320, cy: 240 })
    const p = projectPoint(cam, [0, 0, 0])
    expect(p.x).toBeCloseTo(320, 6)
    expect(p.y).toBeCloseTo(240, 6)
    expect(p.depth).toBeCloseTo(1, 6)
  })

  it('points further from the camera project with smaller depth', () => {
    const cam = createOrbitCamera({ yaw: 0, pitch: 0, scale: 100, focalLen: 4, cx: 0, cy: 0 })
    const near = projectPoint(cam, [0, 0, -1])
    const far = projectPoint(cam, [0, 0, 1])
    expect(far.depth).toBeLessThan(near.depth)
  })

  it('positive world Y projects upward on screen (screen y decreases)', () => {
    const cam = createOrbitCamera({ yaw: 0, pitch: 0, scale: 100, focalLen: 4, cx: 0, cy: 0 })
    expect(projectPoint(cam, [0, 1, 0]).y).toBeLessThan(projectPoint(cam, [0, 0, 0]).y)
  })

  it('applyOrbit clamps pitch to the configured range', () => {
    const r = applyOrbit({ yaw: 0, pitch: -0.5 }, 0, -100000, { pitchMin: -1.45, pitchMax: -0.04 })
    expect(r.pitch).toBe(-1.45)
    const r2 = applyOrbit({ yaw: 0, pitch: -0.5 }, 0, 100000, { pitchMin: -1.45, pitchMax: -0.04 })
    expect(r2.pitch).toBe(-0.04)
  })

  it('applyOrbit is pure — does not mutate the input', () => {
    const cam = { yaw: 1, pitch: -0.5 }
    applyOrbit(cam, 50, 50)
    expect(cam).toEqual({ yaw: 1, pitch: -0.5 })
  })
})

describe('scene sorting', () => {
  it('sorts back-to-front (ascending depth), stable for ties', () => {
    const nodes = [node('c', 2), node('a', 1), node('b', 1), node('d', 0.5)]
    expect(sortBackToFront(nodes).map((n) => n.id)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('does not mutate the input array', () => {
    const nodes = [node('x', 2), node('y', 1)]
    sortBackToFront(nodes)
    expect(nodes.map((n) => n.id)).toEqual(['x', 'y'])
  })
})

describe('picking', () => {
  it('circle hit includes slop padding', () => {
    const c = { type: 'circle' as const, x: 100, y: 100, r: 10 }
    expect(hitTest(c, 100, 112, 3)).toBe(true)
    expect(hitTest(c, 100, 114, 3)).toBe(false)
  })

  it('segment hit tests distance to the line segment, not the infinite line', () => {
    const s = { type: 'segment' as const, x1: 0, y1: 0, x2: 100, y2: 0, width: 4 }
    expect(hitTest(s, 50, 3, 0)).toBe(false) // 3 > width/2
    expect(hitTest(s, 50, 2, 0)).toBe(true)
    expect(hitTest(s, 150, 0, 0)).toBe(false) // beyond the endpoint
  })

  it('ellipse hit respects rotation', () => {
    const e = { type: 'ellipse' as const, x: 0, y: 0, rx: 20, ry: 5, rotation: Math.PI / 2 }
    // rotated 90°: long axis now vertical
    expect(hitTest(e, 0, 15, 0)).toBe(true)
    expect(hitTest(e, 15, 0, 0)).toBe(false)
  })

  it('polyline hit tests each segment', () => {
    const p = { type: 'polyline' as const, points: [[0, 0], [50, 50], [100, 0]] as const, width: 4 }
    expect(hitTest(p, 25, 25, 1)).toBe(true)
    expect(hitTest(p, 50, 0, 1)).toBe(false)
  })

  it('topmost (largest depth) node wins when hits overlap — vectors over entities', () => {
    const body = node('body', 0.9, { type: 'circle', x: 100, y: 100, r: 30 })
    const vector = node('thrust', 1.1, { type: 'segment', x1: 100, y1: 100, x2: 100, y2: 40, width: 3 })
    expect(pickNode([body, vector], 100, 90)?.id).toBe('thrust')
    // outside the vector but inside the body
    expect(pickNode([body, vector], 120, 110)?.id).toBe('body')
  })

  it('nodes without hit regions are not pickable', () => {
    const grid = node('grid', 5)
    expect(pickNode([grid], 0, 0)).toBeNull()
  })
})
