import type { Request, Response } from "express";
import * as managerService from "./manager.service";

export async function create(req: Request, res: Response): Promise<void> {
  const manager = await managerService.createManager(req.auth!.organizationId!, req.body);
  res.status(201).json(manager);
}

export async function list(req: Request, res: Response): Promise<void> {
  const managers = await managerService.listManagersForOrganization(req.auth!.organizationId!);
  res.status(200).json(managers);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const manager = await managerService.getManagerForOrganization(
    req.auth!.organizationId!,
    req.params.managerId as string,
  );
  res.status(200).json(manager);
}

export async function update(req: Request, res: Response): Promise<void> {
  const manager = await managerService.updateManagerForOrganization(
    req.auth!.organizationId!,
    req.params.managerId as string,
    req.body,
  );
  res.status(200).json(manager);
}
