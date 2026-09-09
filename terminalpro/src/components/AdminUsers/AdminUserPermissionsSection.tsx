import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getUserPermissions } from "~/api/entity_roles.api";
import type { DataTableColumn } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import { Tag } from "../ds/atoms/Tag";
import { HoverPopover } from "../HoverPopover";

interface AdminUserPermissionsSectionProps {
  userUuid: string;
}

interface RolePermissionRow {
  roleId: string;
  roleName: string;
  apps: string[];
  widgets: string[];
  agents: string[];
  prompts: string[];
  hasAnyAccess: boolean;
}

type AccessList = Record<string, string>[] | undefined;

// Returns the access value ("access" / "denied" / ...) a role has for a resource.
function accessFor(access: AccessList, roleId: string): string | null {
  if (!access) return null;
  const entry = access.find((item) => Object.keys(item).includes(roleId));
  return entry ? entry[roleId] : null;
}

const isGranted = (access: AccessList, roleId: string) =>
  accessFor(access, roleId) === "access";

function PermissionCountCell({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return <span className="text-ds-text-caption">-</span>;
  }

  return (
    <HoverPopover
      side="bottom"
      trigger={
        <span className="text-link-color cursor-pointer font-medium hover:underline">
          {items.length}
        </span>
      }
      content={
        <div className="flex max-h-[240px] min-w-[200px] flex-col gap-1 overflow-y-auto p-1">
          <span className="body-xs-medium text-ds-text-heading px-1 pb-1">{label}</span>
          {items.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between gap-3 px-1 py-0.5"
            >
              <span className="body-xs-regular text-ds-text-body truncate">{name}</span>
              <Tag color="success" className="shrink-0 capitalize">
                Access
              </Tag>
            </div>
          ))}
        </div>
      }
    />
  );
}

const COUNT_COLUMN = {
  width: 110,
  align: "center",
  truncate: false,
} as const;

// Surrounding border per row. `<tr>` borders are ignored in border-separate, so
// the border lives on the cells: top/bottom on all, left/right on the end cells.
const BORDERED_ROW =
  "[&>td]:border-y [&>td]:border-general-border-secondary " +
  "[&>td:first-child]:border-l [&>td:last-child]:border-r";

export default function AdminUserPermissionsSection({
  userUuid,
}: AdminUserPermissionsSectionProps) {
  const userPermissionsQuery = useQuery({
    queryKey: ["admin", "userPermissions", userUuid],
    queryFn: () => getUserPermissions(userUuid),
    enabled: true,
  });

  const rows = useMemo<RolePermissionRow[]>(() => {
    const data = Array.isArray(userPermissionsQuery.data)
      ? userPermissionsQuery.data[0]
      : userPermissionsQuery.data;
    if (!data) return [];

    const roleIds = new Set<string>();
    const collect = (access: AccessList) => {
      for (const item of access ?? [])
        for (const key of Object.keys(item)) roleIds.add(key);
    };
    for (const connector of data.data_connectors ?? []) {
      collect(connector.access);
      for (const widget of connector.widgets ?? []) collect(widget.access);
    }
    for (const template of data.templates ?? []) collect(template.access);
    for (const prompt of data.prompts ?? []) collect(prompt.access);

    return Array.from(roleIds).map((roleId) => {
      const apps: string[] = [];
      const widgets: string[] = [];
      const prompts: string[] = [];

      for (const template of data.templates ?? []) {
        if (isGranted(template.access, roleId)) {
          apps.push(template.templateId ?? template.name ?? "Unknown");
        }
      }
      for (const connector of data.data_connectors ?? []) {
        for (const widget of connector.widgets ?? []) {
          if (isGranted(widget.access, roleId)) {
            widgets.push(widget.widgetId ?? "Unknown");
          }
        }
      }
      for (const prompt of data.prompts ?? []) {
        if (isGranted(prompt.access, roleId)) {
          prompts.push(prompt.uuid ?? "Unknown");
        }
      }

      // "AI Agents" has no field in the current permissions payload yet.
      const agents: string[] = [];

      return {
        roleId,
        roleName: roleId,
        apps,
        widgets,
        agents,
        prompts,
        hasAnyAccess: apps.length + widgets.length + prompts.length > 0,
      };
    });
  }, [userPermissionsQuery.data]);

  const columns = useMemo<DataTableColumn<RolePermissionRow>[]>(
    () => [
      {
        id: "role",
        // Fill so the role column absorbs the dialog's slack while the count
        // columns stay fixed; keeps the table filling the (wide) dialog.
        width: "fill",
        minWidth: 150,
        header: "Role",
        cell: (row) => (
          <span className="font-medium text-ds-text-heading">{row.roleName}</span>
        ),
      },
      {
        id: "apps",
        header: "Apps",
        ...COUNT_COLUMN,
        cell: (row) => <PermissionCountCell label="Apps" items={row.apps} />,
      },
      {
        id: "widgets",
        header: "Widgets",
        ...COUNT_COLUMN,
        cell: (row) => <PermissionCountCell label="Widgets" items={row.widgets} />,
      },
      {
        id: "agents",
        header: "AI Agents",
        ...COUNT_COLUMN,
        cell: (row) => <PermissionCountCell label="AI Agents" items={row.agents} />,
      },
      {
        id: "prompts",
        header: "Prompts",
        ...COUNT_COLUMN,
        cell: (row) => <PermissionCountCell label="Prompts" items={row.prompts} />,
      },
      {
        id: "final",
        header: "Final Permission",
        width: 140,
        align: "center",
        truncate: false,
        cell: (row) => (
          <Tag color={row.hasAnyAccess ? "success" : "grey"} className="capitalize">
            {row.hasAnyAccess ? "Access" : "-"}
          </Tag>
        ),
      },
    ],
    [],
  );

  if (userPermissionsQuery.isLoading) {
    return <div className="body-xs-regular">Loading permissions...</div>;
  }

  if (userPermissionsQuery.isError) {
    return (
      <div className="body-xs-regular text-alert-error">Error loading permissions</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-row items-center justify-between gap-4 rounded bg-general-bg-secondary p-2.5">
        <div className="space-y-0.5 text-left">
          <h3 className="text-ds-text-heading font-medium">
            No roles assigned to this user account
          </h3>
          <p className="text-ds-text-caption body-xs-regular">
            This user account has no assigned roles. Assign an existing role or create a
            new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[300px] overflow-y-auto">
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.roleId}
        rowClassName={() => BORDERED_ROW}
      />
    </div>
  );
}
