import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState, LoadingState, ManagerForm, ScreenContainer } from "../../components";
import { useManager, useUpdateManager } from "../../hooks/useManagers";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { toDateOnlyString } from "../../utils/format";
import type { EmployeesStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<EmployeesStackParamList, "ManagerEdit">;

export function ManagerEditScreen({ route, navigation }: Props) {
  const { managerId } = route.params;
  const managerQuery = useManager(managerId);
  const storeQuery = useStoreList();
  const updateMutation = useUpdateManager(managerId);

  if (managerQuery.isPending || storeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading…" />
      </ScreenContainer>
    );
  }

  if (managerQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this manager"
          message={managerQuery.error instanceof ApiError ? managerQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => managerQuery.refetch()}
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

  const manager = managerQuery.data;
  const submitError = updateMutation.error
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <ScreenContainer scroll>
      <ManagerForm
        mode="edit"
        stores={storeQuery.data}
        initialValues={{
          storeId: manager.storeId,
          joinedAt: toDateOnlyString(manager.joinedAt),
          isActive: manager.isActive,
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
