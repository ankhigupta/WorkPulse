export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// From the design system's "Spacing & radius" panel.
export const radii = {
  small: 8,
  medium: 12,
  large: 16,
  pill: 999,
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

// Minimum touch target per platform accessibility guidance (Android's 48dp minimum).
export const touchTarget = 48;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
