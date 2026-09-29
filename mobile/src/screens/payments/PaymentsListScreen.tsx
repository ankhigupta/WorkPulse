import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppInput, AppText, EmptyState, IconButton, LoadingState, PaymentCard, ScreenContainer } from "../../components";
import { usePaymentsList } from "../../hooks/usePayments";
import { useEmployeeList } from "../../hooks/useEmployees";
import { ApiError } from "../../types/api";
import { colors, radii, spacing } from "../../theme";
import type { PayrollStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<PayrollStackParamList, "PaymentsList">;

// Full organization-wide feed, no date/employee filter applied by default
// — PaymentLedger has no storeId to scope by anyway, and this screen only
// ever renders for ORGANIZATION_ADMIN (see ADR-011's reasoning, which
// applies identically here).
export function PaymentsListScreen({ navigation }: Props) {
  const [balancePickerOpen, setBalancePickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const paymentsQuery = usePaymentsList({});
  const employeeQuery = useEmployeeList();

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employeeQuery.data ?? []) map.set(employee.id, employee.name);
    return map;
  }, [employeeQuery.data]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    const employees = employeeQuery.data ?? [];
    if (!query) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(query));
  }, [employeeQuery.data, search]);

  if (paymentsQuery.isPending || employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading payments…" />
      </ScreenContainer>
    );
  }

  if (paymentsQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load payments"
          message={paymentsQuery.error instanceof ApiError ? paymentsQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => paymentsQuery.refetch()}
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

  const payments = paymentsQuery.data;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="screenTitle">Payments</AppText>
        <View style={styles.headerActions}>
          <IconButton icon="wallet-outline" accessibilityLabel="Check employee balance" onPress={() => setBalancePickerOpen(true)} />
          <IconButton
            icon="add"
            variant="primary"
            accessibilityLabel="Record payment"
            onPress={() => navigation.navigate("PaymentCreate", undefined)}
          />
        </View>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={paymentsQuery.isRefetching} onRefresh={() => paymentsQuery.refetch()} tintColor={colors.primary} />
        }
        renderItem={({ item }) => {
          const employeeName = employeeNameById.get(item.employeeId);
          return (
            <PaymentCard
              payment={item}
              employeeName={employeeName}
              onPress={() => navigation.navigate("EmployeeBalance", { employeeId: item.employeeId, employeeName })}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="wallet-outline"
            title="No payments recorded"
            message="No payments have been recorded yet. This does not mean nothing is owed — check an employee's balance to see what's outstanding."
            actionLabel="Record payment"
            onAction={() => navigation.navigate("PaymentCreate", undefined)}
          />
        }
      />

      <Modal visible={balancePickerOpen} animationType="slide" transparent onRequestClose={() => setBalancePickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBalancePickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <AppText variant="sectionTitle" style={styles.modalTitle}>
              Check employee balance
            </AppText>
            <AppInput label="Search" placeholder="Search by name" value={search} onChangeText={setSearch} autoCorrect={false} />
            <ScrollView>
              {filteredEmployees.map((employee) => (
                <Pressable
                  key={employee.id}
                  onPress={() => {
                    setBalancePickerOpen(false);
                    setSearch("");
                    navigation.navigate("EmployeeBalance", { employeeId: employee.id, employeeName: employee.name });
                  }}
                  style={styles.modalRow}
                  accessibilityRole="button"
                >
                  <AppText variant="body">{employee.name}</AppText>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))}
              {filteredEmployees.length === 0 ? (
                <AppText variant="bodySmall" style={styles.noResults}>
                  No employees match that search.
                </AppText>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.large,
    borderTopRightRadius: radii.large,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalTitle: {
    marginBottom: spacing.md,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  noResults: {
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
});
