import type { Point } from '../types'

/**
 * BF2 world coordinates put +X east and +Z south. PR minimap textures are
 * authored with a different up-axis, so the board rotates every overlay 90°
 * clockwise around the map centre before drawing. The map texture stays put.
 */
export function rotateNorm(p: Point): Point {
  return { x: 1 - p.y, y: p.x }
}

export function unrotateNorm(p: Point): Point {
  return { x: p.y, y: 1 - p.x }
}

export function worldNorm(x: number, z: number, world: number): Point {
  return { x: (x + world / 2) / world, y: (z + world / 2) / world }
}

export function worldToDisplayNorm(x: number, z: number, world: number): Point {
  return rotateNorm(worldNorm(x, z, world))
}

export function displayNormToWorld(p: Point, world: number): { x: number; z: number } {
  const worldNormPoint = unrotateNorm(p)
  return { x: worldNormPoint.x * world - world / 2, z: worldNormPoint.y * world - world / 2 }
}

export function displayRotation(rotation: number): number {
  return rotation + 90
}

export function rotatePoints(points: Point[]): Point[] {
  return points.map(rotateNorm)
}
