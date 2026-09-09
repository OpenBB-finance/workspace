import {
  type ExportFormat,
  exportRecordsToFile,
} from "~/components/AdminUsers/exportTable";
import { type App, formatDate } from "./adminApps";

const HEADERS = ["Name", "URL", "User Email", "Created Date", "Last Updated"] as const;

export function buildAppExportRows(apps: App[]): Record<string, string>[] {
  return apps.map((app) => ({
    Name: app.name ?? "",
    URL: app.url ?? "",
    "User Email": app.user_email ?? "",
    "Created Date": formatDate(app.created_date),
    "Last Updated": formatDate(app.updated_date),
  }));
}

export function exportAppsToFile(
  rows: Record<string, string>[],
  fileName: string,
  format: ExportFormat,
): Promise<void> {
  return exportRecordsToFile(rows, HEADERS, "Apps", fileName, format);
}
