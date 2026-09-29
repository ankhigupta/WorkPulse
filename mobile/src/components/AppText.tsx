import { Text, type TextProps } from "react-native";
import { typography, type TypographyToken } from "../theme";

interface AppTextProps extends TextProps {
  variant?: TypographyToken;
}

export function AppText({ variant = "body", style, ...props }: AppTextProps) {
  return <Text style={[typography[variant], style]} {...props} />;
}
