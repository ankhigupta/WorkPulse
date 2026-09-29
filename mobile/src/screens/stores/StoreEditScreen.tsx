import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState, LoadingState, ScreenContainer, StoreForm } from "../../components";
import { useStoreList, useUpdateStore } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import type { MoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParamList, "StoreEdit">;

// Reuses the already-loaded store list (small dataset, already cached by
// every screen with a store picker) rather than adding a second
// getById-style hook for one more field — the list already has everything
// this form needs.
export function StoreEditScreen({ route, navigation }: Props) {
  const { storeId } = route.params;
  const storeQuery = useStoreList();
  const updateMutation = useUpdateStore(storeId);

  if (storeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading store…" />
      </ScreenContainer>
    );
  }

  if (storeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load store"
          message={storeQuery.error instanceof ApiError ? storeQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => storeQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const store = storeQuery.data.find((s) => s.id === storeId);
  if (!store) {
    return (
      <ScreenContainer>
        <EmptyState icon="business-outline" title="Store not found" message="This store may have been removed." />
      </ScreenContainer>
    );
  }

  const submitError = updateMutation.error
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <ScreenContainer scroll>
      <StoreForm
        mode="edit"
        initialValues={{ name: store.name, address: store.address ?? "", isActive: store.isActive }}
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
