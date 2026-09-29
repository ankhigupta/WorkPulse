import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, EmptyState, IconButton, LoadingState, ScreenContainer, StoreCard } from "../../components";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, radii, spacing } from "../../theme";
import type { MoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParamList, "StoreList">;

type StatusFilter = "all" | "active" | "inactive";

function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <AppText variant="bodySmall" style={active ? styles.chipTextActive : styles.chipText}>
        {label}
      </AppText>
      <AppText variant="caption" style={active ? styles.chipTextActive : styles.chipText}>
        {" "}
        {count}
      </AppText>
    </Pressable>
  );
}

// Only ever reached by ORGANIZATION_ADMIN — the entry point on
// MoreHomeScreen is itself admin-gated, and /api/stores is
// ORGANIZATION_ADMIN-only entirely.
export function StoreListScreen({ navigation }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const storeQuery = useStoreList();

  const counts = useMemo(() => {
    const stores = storeQuery.data ?? [];
    return {
      all: stores.length,
      active: stores.filter((s) => s.isActive).length,
      inactive: stores.filter((s) => !s.isActive).length,
    };
  }, [storeQuery.data]);

  const filteredStores = useMemo(() => {
    const stores = storeQuery.data ?? [];
    return stores.filter((store) => {
      if (statusFilter === "active" && !store.isActive) return false;
      if (statusFilter === "inactive" && store.isActive) return false;
      return true;
    });
  }, [storeQuery.data, statusFilter]);

  if (storeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading stores…" />
      </ScreenContainer>
    );
  }

  if (storeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load stores"
          message={storeQuery.error instanceof ApiError ? storeQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => storeQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="screenTitle">Stores</AppText>
          <AppText variant="bodySmall">
            {counts.all} {counts.all === 1 ? "store" : "stores"}
          </AppText>
        </View>
        <IconButton icon="add" variant="primary" accessibilityLabel="Create store" onPress={() => navigation.navigate("StoreCreate")} />
      </View>

      <View style={styles.chipRow}>
        <FilterChip label="All" count={counts.all} active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
        <FilterChip label="Active" count={counts.active} active={statusFilter === "active"} onPress={() => setStatusFilter("active")} />
        <FilterChip
          label="Inactive"
          count={counts.inactive}
          active={statusFilter === "inactive"}
          onPress={() => setStatusFilter("inactive")}
        />
      </View>

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={storeQuery.isRefetching} onRefresh={() => storeQuery.refetch()} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <StoreCard store={item} onPress={() => navigation.navigate("StoreEdit", { storeId: item.id })} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="business-outline"
            title={statusFilter !== "all" ? "No matching stores" : "No stores yet"}
            message={statusFilter !== "all" ? "Try a different filter." : "Create your first store to get started."}
            actionLabel={statusFilter === "all" ? "Create store" : undefined}
            onAction={statusFilter === "all" ? () => navigation.navigate("StoreCreate") : undefined}
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primaryLight,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
});
