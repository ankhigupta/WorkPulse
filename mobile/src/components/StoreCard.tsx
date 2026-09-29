import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { AppCard } from "./AppCard";
import { StatusBadge } from "./StatusBadge";
import { colors, spacing } from "../theme";
import type { Store } from "../types/store";

interface StoreCardProps {
  store: Store;
  onPress: () => void;
}

export function StoreCard({ store, onPress }: StoreCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Edit ${store.name}`}>
      <AppCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.textWrap}>
            <AppText variant="bodyStrong">{store.name}</AppText>
            {store.address ? (
              <AppText variant="bodySmall" style={styles.address}>
                {store.address}
              </AppText>
            ) : null}
          </View>
          <StatusBadge label={store.isActive ? "Active" : "Inactive"} tone={store.isActive ? "success" : "neutral"} />
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  address: {
    color: colors.textSecondary,
  },
});
