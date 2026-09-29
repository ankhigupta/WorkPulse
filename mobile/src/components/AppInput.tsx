import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { AppText } from "./AppText";
import { colors, radii, spacing, touchTarget } from "../theme";

interface AppInputProps extends TextInputProps {
  label: string;
  errorMessage?: string;
}

export function AppInput({ label, errorMessage, style, onFocus, onBlur, ...props }: AppInputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage);

  return (
    <View style={styles.container}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        style={[
          styles.input,
          focused && !hasError && styles.focused,
          hasError && styles.errorBorder,
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {hasError ? (
        <AppText variant="caption" style={styles.errorText}>
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: touchTarget,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 15,
  },
  focused: {
    borderColor: colors.primary,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  errorText: {
    marginTop: spacing.xs,
    color: colors.error,
  },
});
