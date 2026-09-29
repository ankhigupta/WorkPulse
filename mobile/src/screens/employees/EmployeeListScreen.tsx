import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, AppInput, EmployeeCard, EmptyState, IconButton, LoadingState, ScreenContainer } from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { useEmployeeList } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, radii, spacing } from "../../theme";
import type { EmployeesStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<EmployeesStackParamList, "EmployeeList">;

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

export function EmployeeListScreen({ navigation }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ORGANIZATION_ADMIN";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const employeeQuery = useEmployeeList();
  const storeQuery = useStoreList(isAdmin);

  const storeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const store of storeQuery.data ?? []) map.set(store.id, store.name);
    return map;
  }, [storeQuery.data]);

  const counts = useMemo(() => {
    const employees = employeeQuery.data ?? [];
    return {
      all: employees.length,
      active: employees.filter((e) => e.isActive).length,
      inactive: employees.filter((e) => !e.isActive).length,
    };
  }, [employeeQuery.data]);

  const filteredEmployees = useMemo(() => {
    const employees = employeeQuery.data ?? [];
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (statusFilter === "active" && !employee.isActive) return false;
      if (statusFilter === "inactive" && employee.isActive) return false;
      if (query && !employee.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [employeeQuery.data, search, statusFilter]);

  if (employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading employees…" />
      </ScreenContainer>
    );
  }

  if (employeeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load employees"
          message={employeeQuery.error instanceof ApiError ? employeeQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => employeeQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const totalCount = counts.all;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="screenTitle">Employees</AppText>
          <AppText variant="bodySmall">
            {totalCount} {totalCount === 1 ? "employee" : "employees"}
            {isAdmin && storeQuery.data ? ` across ${storeQuery.data.length} ${storeQuery.data.length === 1 ? "store" : "stores"}` : ""}
          </AppText>
        </View>
        {isAdmin ? (
          <IconButton
            icon="add"
            variant="primary"
            accessibilityLabel="Create employee"
            onPress={() => navigation.navigate("EmployeeCreate")}
          />
        ) : null}
      </View>

      <AppInput
        label="Search"
        placeholder="Search by name"
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
        data={filteredEmployees}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={employeeQuery.isRefetching}
            onRefresh={() => employeeQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <EmployeeCard
            employee={item}
            storeName={isAdmin ? storeNameById.get(item.storeId) : undefined}
            onPress={() => navigation.navigate("EmployeeDetail", { employeeId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={search || statusFilter !== "all" ? "No matching employees" : "No employees yet"}
            message={
              search || statusFilter !== "all"
                ? "Try a different name or filter."
                : isAdmin
                  ? "Create your first employee to get started."
                  : "No employees have been added to your store yet."
            }
            actionLabel={!search && statusFilter === "all" && isAdmin ? "Create employee" : undefined}
            onAction={!search && statusFilter === "all" && isAdmin ? () => navigation.navigate("EmployeeCreate") : undefined}
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
