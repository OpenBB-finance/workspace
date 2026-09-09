import type { User } from "~/types/user.type";
import { type ExportFormat, exportRecordsToFile } from "./exportTable";

export type { ExportFormat };

const HEADERS = [
  "Name",
  "Email",
  "Type",
  "Roles",
  "Status",
  "Billing Status",
  "Last Active",
  "Last Log in",
] as const;

/**
 * Builds plain-text export rows mirroring the visible Users table columns.
 * Values are the raw field/derived values (matching the previous AG Grid export).
 */
export function buildUserExportRows(
  users: User[],
  entityNameMap: Map<string, string>,
  userRolesMap: Map<string, string[]>,
): Record<string, string>[] {
  return users.map((user) => ({
    Name: [user.first_name, user.last_name].filter(Boolean).join(" "),
    Email: user.email ?? "",
    Type: entityNameMap.get(user.permissions_uuid) ?? "-",
    Roles: (userRolesMap.get(user.email) ?? []).join(", "),
    Status: user.status ?? "",
    "Billing Status": String(user.billing_active),
    "Last Active": user.last_active ?? "",
    "Last Log in": user.last_login ?? "",
  }));
}

export function exportUsersToFile(
  rows: Record<string, string>[],
  fileName: string,
  format: ExportFormat,
): Promise<void> {
  return exportRecordsToFile(rows, HEADERS, "Users", fileName, format);
}
