import { useMemo } from "react";
import type { DataTableColumn } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogHeader, DialogTitle } from "../ds/dialogs/Dialog";
import { type App, formatDate } from "./adminApps";

const getAppId = (app: App) => app.uuid;

// Surrounding border per row. `<tr>` borders are ignored in border-separate, so
// the border lives on the cells: top/bottom on all, left/right on the end cells.
const BORDERED_ROW =
  "[&>td]:border-y [&>td]:border-general-border-secondary " +
  "[&>td:first-child]:border-l [&>td:last-child]:border-r";

interface Props {
  open: boolean;
  onClose: () => void;
  appName: string;
  /** Every app record (one per user) for the selected (name, url). */
  apps: App[];
}

export default function AppUsersDialog({ open, onClose, appName, apps }: Props) {
  const columns = useMemo<DataTableColumn<App>[]>(
    () => [
      {
        id: "user",
        header: "User",
        width: "fill",
        minWidth: 200,
        cell: (app) => app.user_email || "-",
      },
      {
        id: "created",
        header: "Created",
        width: 200,
        cell: (app) => formatDate(app.created_date),
      },
      {
        id: "updated",
        header: "Last Updated",
        width: 200,
        cell: (app) => formatDate(app.updated_date),
      },
    ],
    [],
  );

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      className="max-w-md lg:max-w-3xl"
      modal={true}
    >
      <DialogHeader>
        <DialogTitle>{appName || "App"}</DialogTitle>
      </DialogHeader>
      {open && (
        <SettingsMenu
          title={`Users (${apps.length})`}
          bodyClassName="p-3 max-h-[70vh] overflow-y-auto"
        >
          <DataTable
            columns={columns}
            data={apps}
            getRowId={getAppId}
            rowClassName={() => BORDERED_ROW}
          />
        </SettingsMenu>
      )}
    </BaseDialog>
  );
}
