import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, CorrectionCard, EmptyState, LoadingState, ScreenContainer } from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { useCorrectionsList } from "../../hooks/useAttendanceCorrections";
import { useAttendanceList } from "../../hooks/useAttendance";
import { useEmployeeList } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, radii, spacing } from "../../theme";
import { shiftDateOnly, todayDateOnly } from "../../utils/date";
import type { CorrectionStatus } from "../../types/attendanceCorrection";
import type { Attendance } from "../../types/attendance";
import type { AttendanceStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParamList, "CorrectionsList">;

// Corrections have no date/employeeId of their own to page or filter by
// directly — resolving employee name, attendance date, and current status
// for each one means joining against the Attendance list. Both this query
// and the attendance one below share the same bounded window so that join
// is exactly two bulk requests total, never one per correction.
const WINDOW_DAYS = 90;

type TabFilter = "PENDING" | "ALL" | CorrectionStatus;

const tabs: { key: TabFilter; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "ALL", label: "All" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export function CorrectionsListScreen({ navigation }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ORGANIZATION_ADMIN";

  const [tab, setTab] = useState<TabFilter>("PENDING");

  const endDate = todayDateOnly();
  const startDate = shiftDateOnly(endDate, -(WINDOW_DAYS - 1));

  const correctionsQuery = useCorrectionsList({ startDate, endDate });
  const attendanceQuery = useAttendanceList({ startDate, endDate });
  const employeeQuery = useEmployeeList();
  const storeQuery = useStoreList(isAdmin);

  const attendanceById = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const record of attendanceQuery.data ?? []) map.set(record.id, record);
    return map;
  }, [attendanceQuery.data]);

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employeeQuery.data ?? []) map.set(employee.id, employee.name);
    return map;
  }, [employeeQuery.data]);

  const storeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const store of storeQuery.data ?? []) map.set(store.id, store.name);
    return map;
  }, [storeQuery.data]);

  if (correctionsQuery.isPending || attendanceQuery.isPending || employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading corrections…" />
      </ScreenContainer>
    );
  }

  if (correctionsQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load corrections"
          message={
            correctionsQuery.error instanceof ApiError ? correctionsQuery.error.message : "Something went wrong. Please try again."
          }
          actionLabel="Retry"
          onAction={() => correctionsQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (attendanceQuery.isError || employeeQuery.isError) {
    const failing = attendanceQuery.isError ? attendanceQuery : employeeQuery;
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load supporting data"
          message={failing.error instanceof ApiError ? failing.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => failing.refetch()}
        />
      </ScreenContainer>
    );
  }

  const allCorrections = correctionsQuery.data;
  const filtered = tab === "ALL" ? allCorrections : allCorrections.filter((c) => c.status === tab);

  return (
    <ScreenContainer>
      <AppText variant="screenTitle" style={styles.title}>
        Corrections
      </AppText>

      <View style={styles.tabRow}>
        {tabs.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <AppText variant="bodySmall" style={tab === key ? styles.tabTextActive : styles.tabText}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={correctionsQuery.isRefetching}
            onRefresh={() => correctionsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const attendance = attendanceById.get(item.attendanceId);
          return (
            <CorrectionCard
              correction={item}
              employeeName={attendance ? employeeNameById.get(attendance.employeeId) : undefined}
              attendanceDate={attendance?.date}
              currentStatus={attendance?.status}
              storeName={isAdmin && attendance ? storeNameById.get(attendance.storeId) : undefined}
              canReview={isAdmin}
            />
          );
        }}
        ListEmptyComponent={
          allCorrections.length === 0 ? (
            <EmptyState
              icon="git-pull-request-outline"
              title="No correction requests"
              message={`No corrections have been requested in the last ${WINDOW_DAYS} days. Open an attendance record to request one.`}
              actionLabel="Go to Attendance"
              onAction={() => navigation.navigate("AttendanceList")}
            />
          ) : (
            <EmptyState icon="git-pull-request-outline" title={`No ${tab.toLowerCase()} corrections`} />
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.lg,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
  },
  tabTextActive: {
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
