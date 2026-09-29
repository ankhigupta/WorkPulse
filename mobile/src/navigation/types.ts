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
};
