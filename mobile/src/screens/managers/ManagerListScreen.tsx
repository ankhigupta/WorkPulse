import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, AppInput, EmptyState, IconButton, LoadingState, ManagerCard, ScreenContainer } from "../../components";
import { useManagerList } from "../../hooks/useManagers";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, radii, spacing } from "../../theme";
import type { EmployeesStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<EmployeesStackParamList, "ManagerList">;

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

// This screen only ever mounts for ORGANIZATION_ADMIN — the entry point on
// EmployeeListScreen is itself admin-gated, and /api/managers is
// ORGANIZATION_ADMIN-only entirely, same as Payroll/Payments.
export function ManagerListScreen({ navigation }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const managerQuery = useManagerList();
  const storeQuery = useStoreList();

  const storeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const store of storeQuery.data ?? []) map.set(store.id, store.name);
    return map;
  }, [storeQuery.data]);

  const counts = useMemo(() => {
    const managers = managerQuery.data ?? [];
    return {
      all: managers.length,
      active: managers.filter((m) => m.isActive).length,
      inactive: managers.filter((m) => !m.isActive).length,
    };
  }, [managerQuery.data]);

  const filteredManagers = useMemo(() => {
    const managers = managerQuery.data ?? [];
    const query = search.trim().toLowerCase();
    return managers.filter((manager) => {
      if (statusFilter === "active" && !manager.isActive) return false;
      if (statusFilter === "inactive" && manager.isActive) return false;
      if (query && !manager.user.email.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [managerQuery.data, search, statusFilter]);

  if (managerQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading managers…" />
      </ScreenContainer>
    );
  }

  if (managerQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load managers"
          message={managerQuery.error instanceof ApiError ? managerQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => managerQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const totalCount = counts.all;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="screenTitle">Managers</AppText>
          <AppText variant="bodySmall">
            {totalCount} {totalCount === 1 ? "manager" : "managers"}
          </AppText>
        </View>
        <IconButton
          icon="add"
          variant="primary"
          accessibilityLabel="Create manager"
          onPress={() => navigation.navigate("ManagerCreate")}
        />
      </View>

      <AppInput
        label="Search"
        placeholder="Search by email"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.chipRow}>
        <FilterChip label="All" count={counts.all} active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
        <FilterChip
          label="Active"
          count={counts.active}
          active={statusFilter === "active"}
          onPress={() => setStatusFilter("active")}
        />
        <FilterChip
          label="Inactive"
          count={counts.inactive}
          active={statusFilter === "inactive"}
          onPress={() => setStatusFilter("inactive")}
        />
      </View>

      <FlatList
        data={filteredManagers}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={managerQuery.isRefetching} onRefresh={() => managerQuery.refetch()} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <ManagerCard
            manager={item}
            storeName={storeNameById.get(item.storeId)}
            onPress={() => navigation.navigate("ManagerDetail", { managerId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shield-checkmark-outline"
            title={search || statusFilter !== "all" ? "No matching managers" : "No managers yet"}
            message={
              search || statusFilter !== "all" ? "Try a different search or filter." : "Create your first store manager to get started."
            }
            actionLabel={!search && statusFilter === "all" ? "Create manager" : undefined}
            onAction={!search && statusFilter === "all" ? () => navigation.navigate("ManagerCreate") : undefined}
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
