import { ScreenContainer, EmptyState } from "../components";

export function PayrollScreen() {
  return (
    <ScreenContainer>
      <EmptyState
        icon="card-outline"
        title="Payroll"
        message="Payroll and payments are coming in a future milestone."
      />
    </ScreenContainer>
  );
}
