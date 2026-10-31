import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../../src/game/constants';
import { HORIZON_RATIO, buildDesertLayout, mixColor, skyColorAt } from '../../src/game/background/desertLayout';

const brightness = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);
const sizes: [number, number][] = [
  [GAME_WIDTH, GAME_HEIGHT],
  [390, 844],
  [1440, 900],
];

describe('buildDesertLayout', () => {
  it.each(sizes)('covers the whole height with sky then sand at %ix%i', (w, h) => {
    const l = buildDesertLayout(w, h);
    expect(l.sky.top).toBe(0);
    expect(l.sky.bottom).toBe(l.horizonY);
    expect(l.sand.y).toBe(l.horizonY);
    expect(l.sky.height + l.sand.height).toBe(h);
  });

  it.each(sizes)('puts the horizon near %s of the height', (w, h) => {
    const l = buildDesertLayout(w, h);
    expect(Math.abs(l.horizonY / h - HORIZON_RATIO)).toBeLessThan(0.01);
    expect(l.horizonY).toBeGreaterThan(h * 0.6);
    expect(l.horizonY).toBeLessThan(h * 0.9);
  });

  it('keeps the sun inside the sky, above the horizon', () => {
    const { sun, horizonY, width } = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT);
    expect(sun.x - sun.radius).toBeGreaterThanOrEqual(0);
    expect(sun.x + sun.radius).toBeLessThanOrEqual(width);
    expect(sun.y - sun.radius).toBeGreaterThanOrEqual(0);
    expect(sun.y + sun.glowRadius).toBeLessThan(horizonY);
  });

  it.each(sizes)('keeps every dune inside the width and just above the horizon at %ix%i', (w, h) => {
    const l = buildDesertLayout(w, h);
    expect(l.dunes.length).toBeGreaterThan(0);
    for (const dune of l.dunes) {
      for (const p of dune.points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(w);
        expect(p.y).toBeGreaterThanOrEqual(l.horizonY - dune.height - 1e-9);
        expect(p.y).toBeLessThanOrEqual(l.horizonY);
      }
    }
  });

  it('puts the sand ripples on the sand', () => {
    const { sand, height } = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT);
    for (const r of sand.ripples) {
      expect(r.y).toBeGreaterThan(sand.y);
      expect(r.y).toBeLessThan(height);
    }
  });

  it('uses valid 24-bit colours, with the sky lighter at the horizon than at the top', () => {
    const l = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT);
    const colors = [
      ...l.sky.stops.map((s) => s.color),
      l.sun.color,
      l.sun.glowColor,
      l.sand.color,
      ...l.dunes.map((d) => d.color),
      ...l.sand.ripples.map((r) => r.color),
    ];
    for (const c of colors) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
    expect(brightness(skyColorAt(l.sky.stops, 1))).toBeGreaterThan(brightness(skyColorAt(l.sky.stops, 0)));
  });
});

describe('colour helpers', () => {
  it('mixes colours channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xff0080, 0.5)).toBe(0x800040);
  });

  it('reads the sky gradient at its stops and clamps outside it', () => {
    const stops = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT).sky.stops;
    expect(skyColorAt(stops, 0)).toBe(stops[0].color);
    expect(skyColorAt(stops, 1)).toBe(stops[stops.length - 1].color);
    expect(skyColorAt(stops, -1)).toBe(stops[0].color);
    expect(skyColorAt(stops, 2)).toBe(stops[stops.length - 1].color);
  });
});
