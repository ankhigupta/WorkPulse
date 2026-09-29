import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AppText,
  AttendanceCard,
  AttendanceDateSelector,
  EmptyState,
  IconButton,
  LoadingState,
  ScreenContainer,
} from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceList } from "../../hooks/useAttendance";
import { useEmployeeList } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, spacing } from "../../theme";
import { todayDateOnly } from "../../utils/date";
import type { AttendanceStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParamList, "AttendanceList">;

export function AttendanceListScreen({ navigation }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ORGANIZATION_ADMIN";

  const [date, setDate] = useState(todayDateOnly());

  const attendanceQuery = useAttendanceList({ date });
  const employeeQuery = useEmployeeList();
  const storeQuery = useStoreList(isAdmin);

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

  if (attendanceQuery.isPending || employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading attendance…" />
      </ScreenContainer>
    );
  }

  if (attendanceQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load attendance"
          message={
            attendanceQuery.error instanceof ApiError ? attendanceQuery.error.message : "Something went wrong. Please try again."
          }
          actionLabel="Retry"
          onAction={() => attendanceQuery.refetch()}
        />
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

  const records = attendanceQuery.data;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="screenTitle">Attendance</AppText>
        <View style={styles.headerActions}>
          <IconButton
            icon="git-pull-request-outline"
            accessibilityLabel="View attendance corrections"
            onPress={() => navigation.navigate("CorrectionsList")}
          />
          <IconButton
            icon="add"
            variant="primary"
            accessibilityLabel="Record attendance"
            onPress={() => navigation.navigate("AttendanceCreate", { date })}
          />
        </View>
      </View>

      <AttendanceDateSelector date={date} onChange={setDate} />

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={attendanceQuery.isRefetching}
            onRefresh={() => attendanceQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const employeeName = employeeNameById.get(item.employeeId) ?? "Unknown employee";
          return (
            <AttendanceCard
              attendance={item}
              employeeName={employeeName}
              storeName={isAdmin ? storeNameById.get(item.storeId) : undefined}
              onPress={() =>
                navigation.navigate("CorrectionCreate", {
                  attendanceId: item.id,
                  employeeName,
                  date: item.date,
                  currentStatus: item.status,
                })
              }
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="No attendance recorded"
            message="No one has been marked present or absent for this date yet — this isn't the same as everyone being absent."
            actionLabel="Record attendance"
            onAction={() => navigation.navigate("AttendanceCreate", { date })}
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
});
