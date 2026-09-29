import { ScreenContainer, EmptyState } from "../components";

export function EmployeesScreen() {
  return (
    <ScreenContainer>
      <EmptyState
        icon="people-outline"
        title="Employees"
        message="Employee management is coming in a future milestone."
      />
    </ScreenContainer>
  );
}
