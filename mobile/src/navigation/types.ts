export type AuthStackParamList = {
  Login: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Attendance: undefined;
  Employees: undefined;
  Payroll: undefined;
  More: undefined;
};

export type EmployeesStackParamList = {
  EmployeeList: undefined;
  EmployeeDetail: { employeeId: string };
  EmployeeCreate: undefined;
  EmployeeEdit: { employeeId: string };
  ManagerList: undefined;
  ManagerDetail: { managerId: string };
  ManagerCreate: undefined;
  ManagerEdit: { managerId: string };
};

export type AttendanceStackParamList = {
  AttendanceList: undefined;
  AttendanceCreate: { date: string };
  CorrectionsList: undefined;
  CorrectionCreate: {
    attendanceId: string;
    employeeName: string;
    date: string;
    currentStatus: "PRESENT" | "ABSENT";
  };
};

export type PayrollStackParamList = {
  PayrollList: undefined;
  PayrollCreate: undefined;
  PaymentsList: undefined;
  PaymentCreate: { employeeId?: string; employeeName?: string } | undefined;
  EmployeeBalance: { employeeId: string; employeeName?: string };
};

export type MoreStackParamList = {
  MoreHome: undefined;
  AttendanceReport: undefined;
  PayrollReport: undefined;
  PaymentsReport: undefined;
  WorkforceReport: undefined;
  Account: undefined;
  Organization: undefined;
  StoreList: undefined;
  StoreCreate: undefined;
  StoreEdit: { storeId: string };
};
