import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { AppCard } from "./AppCard";
import { Avatar } from "./Avatar";
import { colors, spacing } from "../theme";
import { formatCurrency, formatDateTime } from "../utils/format";
import type { Payment } from "../types/payment";

interface PaymentCardProps {
  payment: Payment;
  employeeName?: string;
  onPress?: () => void;
}

// Append-only by design — no edit/delete/reverse action anywhere on this
// card, matching the backend, which has no PATCH/PUT/DELETE route for
// payments at all.
export function PaymentCard({ payment, employeeName, onPress }: PaymentCardProps) {
  const content = (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        <Avatar name={employeeName ?? "?"} />
        <View style={styles.info}>
          <AppText variant="bodyStrong">{employeeName ?? "Unknown employee"}</AppText>
          <AppText variant="bodySmall">{formatDateTime(payment.paidAt)}</AppText>
        </View>
        <AppText variant="bodyStrong" style={styles.amount}>
          {formatCurrency(payment.amount)}
        </AppText>
      </View>
      {payment.note ? (
        <AppText variant="bodySmall" style={styles.note}>
          {payment.note}
        </AppText>
      ) : null}
    </AppCard>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View balance for ${employeeName ?? "employee"}`}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  amount: {
    color: colors.success,
  },
  note: {
    color: colors.textSecondary,
  },
});
