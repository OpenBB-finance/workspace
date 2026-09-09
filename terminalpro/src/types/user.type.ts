import type { DataProviderSlug } from "~/lib/data-providers";

export type UserSources = "user" | "invite" | "takeover";

export interface User {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  billing_active: boolean;
  pro_entitlements: Entitlements;
  status: string;
  last_login: null | string;
  last_active: null | string;
  permissions_uuid: string;
  source: UserSources;
  renewed: boolean;
}

export interface CreateUserDTO {
  first_name?: string;
  last_name?: string;
  email?: string;
  permissions_uuid?: string;
  role?: string;
}

export const UserProEntitlements = ["None", "Read", "Write"] as const;
export type UserProEntitlement = (typeof UserProEntitlements)[number];

export type Entitlements = {
  [key in DataProviderSlug]: UserProEntitlement;
};
