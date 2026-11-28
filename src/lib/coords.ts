import type { Point } from '../types'

/**
 * BF2 minimap textures are authored with the opposite vertical axis from the
 * gameplay coordinates. Mirror Z around the map centre; do not rotate.
 */
export function mirrorNorm(p: Point): Point {
  return { x: p.x, y: 1 - p.y }
}

export function unmirrorNorm(p: Point): Point {
  return { x: p.x, y: 1 - p.y }
}

export function worldNorm(x: number, z: number, world: number): Point {
  return { x: (x + world / 2) / world, y: (z + world / 2) / world }
}

export function worldToDisplayNorm(x: number, z: number, world: number): Point {
  return mirrorNorm(worldNorm(x, z, world))
}

export function displayNormToWorld(p: Point, world: number): { x: number; z: number } {
  const point = unmirrorNorm(p)
  return { x: point.x * world - world / 2, z: point.y * world - world / 2 }
}

/**
 * Vehicle icons are authored nose-up, matching the game yaw convention.
 * BF2 yaw is already in map-screen orientation; only normalize it.
 */
export function vehicleSpriteRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360
}
