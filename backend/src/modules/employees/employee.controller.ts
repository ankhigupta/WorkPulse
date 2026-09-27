import type { Request, Response } from "express";
import * as employeeService from "./employee.service";

export async function create(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.createEmployee(req.auth!.organizationId!, req.body);
  res.status(201).json(employee);
}

export async function list(req: Request, res: Response): Promise<void> {
  const employees = await employeeService.listEmployeesForAuth(req.auth!);
  res.status(200).json(employees);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.getEmployeeForAuth(req.auth!, req.params.employeeId as string);
  res.status(200).json(employee);
}

export async function update(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.updateEmployeeForAuth(
    req.auth!.organizationId!,
    req.params.employeeId as string,
    req.body,
  );
  res.status(200).json(employee);
}
