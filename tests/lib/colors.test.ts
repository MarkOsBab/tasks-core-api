import { describe, expect, it } from 'vitest';
import { ENTITY_COLOR_PALETTE, nextUniqueColor } from '@/lib/colors';

describe('nextUniqueColor', () => {
  it('hands out the first free palette color', () => {
    expect(nextUniqueColor([])).toBe(ENTITY_COLOR_PALETTE[0]);
    expect(nextUniqueColor([ENTITY_COLOR_PALETTE[0], null])).toBe(ENTITY_COLOR_PALETTE[1]);
  });

  it('matches used colors case-insensitively', () => {
    expect(nextUniqueColor([ENTITY_COLOR_PALETTE[0].toUpperCase()])).toBe(
      ENTITY_COLOR_PALETTE[1],
    );
  });

  it('falls back to golden-angle hex colors once the palette is exhausted', () => {
    const generated = nextUniqueColor([...ENTITY_COLOR_PALETTE]);
    expect(generated).toMatch(/^#[0-9a-f]{6}$/);
    expect(ENTITY_COLOR_PALETTE).not.toContain(generated);
  });

  it('keeps generated colors distinct as usage grows', () => {
    const used: string[] = [...ENTITY_COLOR_PALETTE];
    const first = nextUniqueColor(used);
    const second = nextUniqueColor([...used, first]);
    expect(second).not.toBe(first);
  });
});
