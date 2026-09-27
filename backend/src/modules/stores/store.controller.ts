import type { Request, Response } from "express";
import * as storeService from "./store.service";

export async function create(req: Request, res: Response): Promise<void> {
  const store = await storeService.createStore(req.auth!.organizationId!, req.body);
  res.status(201).json(store);
}

export async function list(req: Request, res: Response): Promise<void> {
  const stores = await storeService.listStoresForOrganization(req.auth!.organizationId!);
  res.status(200).json(stores);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const store = await storeService.getStoreForOrganization(
    req.auth!.organizationId!,
    req.params.storeId as string,
  );
  res.status(200).json(store);
}

export async function update(req: Request, res: Response): Promise<void> {
  const store = await storeService.updateStoreForOrganization(
    req.auth!.organizationId!,
    req.params.storeId as string,
    req.body,
  );
  res.status(200).json(store);
}
