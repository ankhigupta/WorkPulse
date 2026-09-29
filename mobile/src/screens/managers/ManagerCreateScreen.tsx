import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState, LoadingState, ManagerForm, ScreenContainer } from "../../components";
import { useCreateManager } from "../../hooks/useManagers";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import type { EmployeesStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<EmployeesStackParamList, "ManagerCreate">;

export function ManagerCreateScreen({ navigation }: Props) {
  const storeQuery = useStoreList();
  const createMutation = useCreateManager();

  if (storeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading stores…" />
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

  if (storeQuery.data.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState icon="business-outline" title="No stores yet" message="Create a store before adding managers." />
      </ScreenContainer>
    );
  }

  const submitError = createMutation.error
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <ScreenContainer scroll>
      <ManagerForm
        mode="create"
        stores={storeQuery.data}
        submitting={createMutation.isPending}
        submitError={submitError}
        onSubmit={(payload) => {
          createMutation.mutate(payload, {
            onSuccess: () => navigation.goBack(),
          });
        }}
      />
    </ScreenContainer>
  );
}
