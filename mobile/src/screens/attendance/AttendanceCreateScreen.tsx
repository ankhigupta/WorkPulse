import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AttendanceForm, EmptyState, LoadingState, ScreenContainer } from "../../components";
import { useCreateAttendance } from "../../hooks/useAttendance";
import { useEmployeeList } from "../../hooks/useEmployees";
import { ApiError } from "../../types/api";
import type { AttendanceStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParamList, "AttendanceCreate">;

export function AttendanceCreateScreen({ route, navigation }: Props) {
  const { date } = route.params;
  // Reuses the same employee list query the Employees module and the
  // Attendance list already use — GET /api/employees is already scoped to
  // the caller's store server-side for STORE_MANAGER, so this picker can
  // never offer an employee outside their store without any extra
  // client-side filtering.
  const employeeQuery = useEmployeeList();
  const createMutation = useCreateAttendance();

  if (employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading employees…" />
      </ScreenContainer>
    );
  }

  if (employeeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load employees"
          message={employeeQuery.error instanceof ApiError ? employeeQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => employeeQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (employeeQuery.data.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState icon="people-outline" title="No employees yet" message="Add an employee before recording attendance." />
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
      <AttendanceForm
        employees={employeeQuery.data}
        initialDate={date}
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
