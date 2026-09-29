import { ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
}

export function ScreenContainer({ scroll = false, style, children, ...props }: ScreenContainerProps) {
  const Wrapper = scroll ? ScrollView : View;
  const wrapperProps = scroll
    ? { contentContainerStyle: [styles.scrollContent, style] }
    : { style: [styles.content, style] };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Wrapper {...wrapperProps} {...props}>
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
});
