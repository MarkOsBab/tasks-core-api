// Visual identity colors for clients/projects. Assignment picks the first palette color not in
// use so entities stay distinguishable; past the palette it falls back to golden-angle hues,
// which keeps every generated color maximally separated from the previous ones.

export const ENTITY_COLOR_PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#a855f7', // purple
] as const;

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const value = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function nextUniqueColor(used: Array<string | null>): string {
  const taken = new Set(used.filter(Boolean).map((color) => color!.toLowerCase()));
  const free = ENTITY_COLOR_PALETTE.find((color) => !taken.has(color));
  if (free) return free;
  const hue = Math.round((taken.size * 137.508) % 360);
  return hslToHex(hue, 65, 55);
}
