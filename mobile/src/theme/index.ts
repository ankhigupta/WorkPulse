import { colors } from "./colors";
import { typography } from "./typography";
import { spacing, radii, iconSizes, touchTarget } from "./spacing";

// Single static theme object. WorkPulse V1 has one brand (Charcoal + Burnished
// Copper) and no runtime light/dark toggle, so a React context provider would
// be an abstraction with no second value to switch between yet. Every token
// still funnels through here, so swapping the brand later is a one-file change.
export const theme = {
  colors,
  typography,
  spacing,
  radii,
  iconSizes,
  touchTarget,
} as const;

export type Theme = typeof theme;

export { colors, typography, spacing, radii, iconSizes, touchTarget };
export { fontFamilies } from "./typography";
export type { TypographyToken } from "./typography";
export type { ColorToken } from "./colors";
export type { SpacingToken, RadiusToken } from "./spacing";
