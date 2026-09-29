import { useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AppButton,
  AppCard,
  AppText,
  EmptyState,
  LoadingState,
  PaymentCard,
  ScreenContainer,
  SectionHeader,
  SummaryRow,
} from "../../components";
import { useEmployeeBalance, usePaymentsList } from "../../hooks/usePayments";
import { useEmployeeList } from "../../hooks/useEmployees";
import { ApiError } from "../../types/api";
import { colors, spacing } from "../../theme";
import { formatCurrency } from "../../utils/format";
import type { PayrollStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<PayrollStackParamList, "EmployeeBalance">;

export function EmployeeBalanceScreen({ route, navigation }: Props) {
  const { employeeId, employeeName: paramName } = route.params;

  const balanceQuery = useEmployeeBalance(employeeId);
  const paymentsQuery = usePaymentsList({ employeeId });
  const employeeQuery = useEmployeeList();

  const employeeName = useMemo(
    () => paramName ?? employeeQuery.data?.find((e) => e.id === employeeId)?.name,
    [paramName, employeeQuery.data, employeeId],
  );

  if (balanceQuery.isPending || paymentsQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading balance…" />
      </ScreenContainer>
    );
  }

  if (balanceQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load balance"
          message={balanceQuery.error instanceof ApiError ? balanceQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => balanceQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (paymentsQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load payment history"
          message={paymentsQuery.error instanceof ApiError ? paymentsQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => paymentsQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const balance = balanceQuery.data;
  const hasOutstanding = Number(balance.outstanding) > 0;

  return (
    <ScreenContainer>
      <AppText variant="screenTitle" style={styles.title}>
        {employeeName ?? "Employee"}
      </AppText>

      <AppCard style={styles.balanceCard}>
        <SummaryRow label="Total owed (finalized payroll)" value={formatCurrency(balance.totalOwed)} />
        <SummaryRow label="Total paid" value={formatCurrency(balance.totalPaid)} tone="success" />
        <SummaryRow
          label="Outstanding (all time)"
          value={formatCurrency(balance.outstanding)}
          tone={hasOutstanding ? "warning" : "neutral"}
        />
      </AppCard>

      <View style={styles.recordButton}>
        <AppButton
          label="Record payment"
          onPress={() => navigation.navigate("PaymentCreate", { employeeId, employeeName })}
        />
      </View>

      <SectionHeader title="Payment history" />

      <FlatList
        data={paymentsQuery.data}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={balanceQuery.isRefetching || paymentsQuery.isRefetching}
            onRefresh={() => {
              balanceQuery.refetch();
              paymentsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => <PaymentCard payment={item} employeeName={employeeName} />}
        ListEmptyComponent={<EmptyState icon="wallet-outline" title="No payments yet" message="No payments recorded for this employee." />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.lg,
  },
  balanceCard: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  recordButton: {
    marginBottom: spacing.xl,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
});
