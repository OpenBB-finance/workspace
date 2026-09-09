import type { Entitlements } from "./user.type";

export interface Entity {
  uuid: string;
  name: string;
  company_type: string;
  country: string;
  email: string;
  entity_type: any; // TODO
  aum: number;
  organization_size: string;
}

export interface EntityMapItem {
  uuid: string;
  /** Name of the user role */
  name: string;
  entity_uuid: string;
  entity: Entity;
  entitlements: Entitlements;
}

export interface EntitySettings {
  require_authenticator: boolean;
}
