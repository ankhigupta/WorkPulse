import { ScreenContainer, EmptyState } from "../components";

export function MoreScreen() {
  return (
    <ScreenContainer>
      <EmptyState
        icon="ellipsis-horizontal-circle-outline"
        title="More"
        message="Reports and settings are coming in a future milestone."
      />
    </ScreenContainer>
  );
}
