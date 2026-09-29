import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmployeeForm, EmptyState, LoadingState, ScreenContainer } from "../../components";
import { useEmployee, useUpdateEmployee } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { toDateOnlyString } from "../../utils/format";
import type { EmployeesStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<EmployeesStackParamList, "EmployeeEdit">;

export function EmployeeEditScreen({ route, navigation }: Props) {
  const { employeeId } = route.params;
  const employeeQuery = useEmployee(employeeId);
  const storeQuery = useStoreList();
  const updateMutation = useUpdateEmployee(employeeId);

  if (employeeQuery.isPending || storeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading…" />
      </ScreenContainer>
    );
  }

  if (employeeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this employee"
          message={
            employeeQuery.error instanceof ApiError ? employeeQuery.error.message : "Something went wrong. Please try again."
          }
          actionLabel="Retry"
          onAction={() => employeeQuery.refetch()}
        />
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

  const employee = employeeQuery.data;
  const submitError = updateMutation.error
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <ScreenContainer scroll>
      <EmployeeForm
        mode="edit"
        stores={storeQuery.data}
        initialValues={{
          name: employee.name,
          storeId: employee.storeId,
          dailyWage: employee.dailyWage,
          joinedAt: toDateOnlyString(employee.joinedAt),
          isActive: employee.isActive,
        }}
        submitting={updateMutation.isPending}
        submitError={submitError}
        onSubmit={(payload) => {
          updateMutation.mutate(payload, {
            onSuccess: () => navigation.goBack(),
          });
        }}
      />
    </ScreenContainer>
  );
}
