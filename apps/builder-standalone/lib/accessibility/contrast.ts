/**
 * WCAG 2.1 contrast ratio calculator
 * Uses relative luminance formula per WCAG 2.x specification
 */

/** Parse a hex color (#RGB, #RRGGBB, or RRGGBB) into [r, g, b] 0-255 */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Named CSS colors → hex (common subset) */
const NAMED_COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
  blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080",
  gray: "#808080", grey: "#808080", silver: "#c0c0c0", navy: "#000080",
  teal: "#008080", maroon: "#800000", aqua: "#00ffff", lime: "#00ff00",
  olive: "#808000", fuchsia: "#ff00ff", cyan: "#00ffff", magenta: "#ff00ff",
  coral: "#ff7f50", tomato: "#ff6347", gold: "#ffd700", wheat: "#f5deb3",
  lightgray: "#d3d3d3", lightgrey: "#d3d3d3", darkgray: "#a9a9a9", darkgrey: "#a9a9a9",
  dimgray: "#696969", dimgrey: "#696969", lightblue: "#add8e6", darkblue: "#00008b",
  lightgreen: "#90ee90", darkgreen: "#006400", darkred: "#8b0000",
  pink: "#ffc0cb", hotpink: "#ff69b4", brown: "#a52a2a", tan: "#d2b48c",
  beige: "#f5f5dc", ivory: "#fffff0", linen: "#faf0e6", snow: "#fffafa",
  indianred: "#cd5c5c", crimson: "#dc143c", firebrick: "#b22222",
  salmon: "#fa8072", lightsalmon: "#ffa07a", orangered: "#ff4500",
  chocolate: "#d2691e", sienna: "#a0522d", peru: "#cd853f",
  darkkhaki: "#bdb76b", khaki: "#f0e68c", plum: "#dda0dd",
  violet: "#ee82ee", orchid: "#da70d6", mediumpurple: "#9370db",
  slateblue: "#6a5acd", darkslateblue: "#483d8b", midnightblue: "#191970",
  cornflowerblue: "#6495ed", royalblue: "#4169e1", steelblue: "#4682b4",
  dodgerblue: "#1e90ff", deepskyblue: "#00bfff", skyblue: "#87ceeb",
  cadetblue: "#5f9ea0", mediumaquamarine: "#66cdaa", mediumseagreen: "#3cb371",
  seagreen: "#2e8b57", forestgreen: "#228b22", limegreen: "#32cd32",
  springgreen: "#00ff7f", turquoise: "#40e0d0", paleturquoise: "#afeeee",
  powderblue: "#b0e0e6", aliceblue: "#f0f8ff", ghostwhite: "#f8f8ff",
  whitesmoke: "#f5f5f5", mintcream: "#f5fffa", honeydew: "#f0fff0",
  lavender: "#e6e6fa", mistyrose: "#ffe4e1", antiquewhite: "#faebd7",
  papayawhip: "#ffefd5", blanchedalmond: "#ffebcd", bisque: "#ffe4c4",
  moccasin: "#ffe4b5", navajowhite: "#ffdead", peachpuff: "#ffdab9",
  rosybrown: "#bc8f8f", sandybrown: "#f4a460", goldenrod: "#daa520",
  darkgoldenrod: "#b8860b", saddlebrown: "#8b4513",
};

/** Parse an rgb() or rgba() string into [r, g, b] */
function parseRgb(str: string): [number, number, number] | null {
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

/** Resolve any CSS color value to [r, g, b] or null */
export function resolveColor(color: string): [number, number, number] | null {
  const c = color.trim().toLowerCase();
  if (c === "transparent" || c === "inherit" || c === "currentcolor" || c === "initial" || c === "unset") return null;

  // Hex
  if (c.startsWith("#")) return parseHex(c);

  // rgb/rgba
  if (c.startsWith("rgb")) return parseRgb(c);

  // Named
  const named = NAMED_COLORS[c];
  if (named) return parseHex(named);

  return null;
}

/**
 * Calculate relative luminance per WCAG 2.x
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getLuminance(rgb: [number, number, number]): number {
  const [rs, gs, bs] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio in range [1, 21]
 */
export function getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a contrast ratio meets WCAG 2.1 AA requirements
 * Normal text: 4.5:1 minimum
 * Large text (18pt+ or 14pt bold): 3:1 minimum
 */
export function meetsWCAG_AA(ratio: number, isLargeText: boolean): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}
