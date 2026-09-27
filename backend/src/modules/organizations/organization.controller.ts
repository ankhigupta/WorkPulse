import type { Request, Response } from "express";
import * as organizationService from "./organization.service";

export async function create(req: Request, res: Response): Promise<void> {
  const organization = await organizationService.createOrganization(req.body.name);
  res.status(201).json(organization);
}

export async function list(_req: Request, res: Response): Promise<void> {
  const organizations = await organizationService.listOrganizations();
  res.status(200).json(organizations);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const organization = await organizationService.getOrganizationForAuth(
    req.auth!,
    req.params.organizationId as string,
  );
  res.status(200).json(organization);
}

export async function update(req: Request, res: Response): Promise<void> {
  const organization = await organizationService.updateOrganizationForAuth(
    req.auth!,
    req.params.organizationId as string,
    req.body,
  );
  res.status(200).json(organization);
}
