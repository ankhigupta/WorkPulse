import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenContainer, StoreForm } from "../../components";
import { useCreateStore } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import type { MoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParamList, "StoreCreate">;

export function StoreCreateScreen({ navigation }: Props) {
  const createMutation = useCreateStore();

  const submitError = createMutation.error
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <ScreenContainer scroll>
      <StoreForm
        mode="create"
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
