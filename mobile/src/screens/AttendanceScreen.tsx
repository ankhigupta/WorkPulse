import { ScreenContainer, EmptyState } from "../components";

export function AttendanceScreen() {
  return (
    <ScreenContainer>
      <EmptyState
        icon="time-outline"
        title="Attendance"
        message="QR and manual attendance are coming in a future milestone."
      />
    </ScreenContainer>
  );
}
