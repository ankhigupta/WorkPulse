// Source of truth: docs/design/Final — Charcoal + Burnished Copper — Design System@1x.png
// Do not hand-tune these — if the palette changes, update the reference image and this file together.
export const colors = {
  background: "#0D0D0C",
  surface: "#161514",
  surfaceElevated: "#1F1D1C",
  border: "#2B2826",
  inputBorder: "#37332F",

  text: "#F3F1EE",
  textSecondary: "#A7A19B",
  textMuted: "#6F6A65",

  primary: "#D2774A",
  primaryPressed: "#DE8B60",
  primaryDeep: "#3A2419",
  primaryLight: "#EDA27F",
  onPrimary: "#1C0E07",

  secondaryAccent: "#F4EEE4",

  success: "#5FC98A",
  warning: "#E9BF4F",
  error: "#EE6F8A",
  info: "#8FB0DA",

  chartNeutral: "#8C857F",
  chartTrack: "#2A2725",
} as const;

export type ColorToken = keyof typeof colors;
