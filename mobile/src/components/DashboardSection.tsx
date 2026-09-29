import { StyleSheet, View } from "react-native";
import { SectionHeader } from "./SectionHeader";
import { spacing } from "../theme";

interface DashboardSectionProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: React.ReactNode;
}

export function DashboardSection({ title, actionLabel, onActionPress, children }: DashboardSectionProps) {
  return (
    <View style={styles.container}>
      <SectionHeader title={title} action={actionLabel} onActionPress={onActionPress} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
});
