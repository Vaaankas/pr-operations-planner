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

/** Screen angle is mirrored too: up becomes down, left/right swap. */
export function displayRotation(rotation: number): number {
  return (180 - rotation + 360) % 360
}

// Most PR minimaps use the same north-up heading convention. Hades Peak is
// authored 90 degrees differently; Ascheberg and Muttrah use the default.
const VEHICLE_SPRITE_OFFSET: Record<string, number> = {
  hades_peak: 0,
}

export function vehicleSpriteOffset(layerId: string): number {
  return VEHICLE_SPRITE_OFFSET[layerId.split('__')[0]] ?? 90
}

export function vehicleSpriteRotation(layerId: string, rotation: number): number {
  return (displayRotation(rotation) + vehicleSpriteOffset(layerId)) % 360
}
