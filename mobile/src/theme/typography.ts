import type { TextStyle } from "react-native";
import { colors } from "./colors";

// Weights map to the four Manrope cuts loaded in App.tsx via @expo-google-fonts/manrope.
const family = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  bold: "Manrope_700Bold",
  extraBold: "Manrope_800ExtraBold",
} as const;

// font sizes / line heights / weights per the design system's "Typography" panel
// (format there was "size/lineHeight/weight").
export const typography = {
  screenTitle: { fontFamily: family.extraBold, fontSize: 28, lineHeight: 36, color: colors.text } satisfies TextStyle,
  sectionTitle: { fontFamily: family.bold, fontSize: 20, lineHeight: 28, color: colors.text } satisfies TextStyle,
  bodyStrong: { fontFamily: family.bold, fontSize: 14, lineHeight: 20, color: colors.text } satisfies TextStyle,
  body: { fontFamily: family.medium, fontSize: 15, lineHeight: 24, color: colors.text } satisfies TextStyle,
  bodySmall: { fontFamily: family.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary } satisfies TextStyle,
  label: { fontFamily: family.bold, fontSize: 11, lineHeight: 16, color: colors.textSecondary, letterSpacing: 0.6 } satisfies TextStyle,
  caption: { fontFamily: family.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted } satisfies TextStyle,
  button: { fontFamily: family.bold, fontSize: 16, lineHeight: 22 } satisfies TextStyle,
} as const;

export const fontFamilies = family;
export type TypographyToken = keyof typeof typography;
