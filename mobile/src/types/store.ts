export interface Store {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

// Mirrors backend/src/modules/stores/store.schemas.ts's createStoreSchema.
// organizationId is never client-supplied — derived server-side.
export interface CreateStoreInput {
  name: string;
  address?: string;
}

// Mirrors updateStoreSchema exactly.
export interface UpdateStoreInput {
  name?: string;
  address?: string;
  isActive?: boolean;
}
