import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getEntityInfo } from "~/api/admin.api";
import {
  buildEntityNameMap,
  buildUserRolesMap,
  useEntityMap,
  useEntityRoles,
  useUsers,
} from "~/components/AdminRoles/adminUseQueries";
import { AdminInviteUsersDialog } from "~/components/AdminUsers/AdminInviteUsersDialog";
import AdminUserBillingStatus from "~/components/AdminUsers/AdminUserBillingStatus";
import AdminUserDetailsDialog from "~/components/AdminUsers/AdminUserDetailsDialog";
import AdminUserStatus from "~/components/AdminUsers/AdminUserStatus";
import ExportUsersDialog from "~/components/AdminUsers/ExportUsersDialog";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import type { DataTableColumn, SortState } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import { OverflowTags } from "~/components/ds/molecules/OverflowTags";
import SnowflakeHide from "~/components/General/SnowflakeHide";
import Icon from "~/components/Icon";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { isLiteEnvironment } from "~/lib/onPremFeatureFlags";
import { RenderNoData } from "~/routes/admin";
import type { User } from "~/types/user.type";

const isLite = isLiteEnvironment();

const getUserId = (user: User) => user.uuid;

function nameOf(user: User): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

function formatDate(value?: string | null): string {
  return value ? dayjs(value).locale("en").format("MMM D, YYYY h:mm A") : "-";
}

function userSortValue(
  user: User,
  id: string,
  entityNameMap: Map<string, string>,
): string | number | null {
  switch (id) {
    case "name":
      return nameOf(user).toLowerCase();
    case "email":
      return (user.email ?? "").toLowerCase();
    case "type":
      return (entityNameMap.get(user.permissions_uuid) ?? "").toLowerCase();
    case "status":
      return (user.status ?? "").toLowerCase();
    case "billing_active":
      return user.billing_active ? 1 : 0;
    case "last_active": {
      const value = user.last_active ?? user.last_login;
      return value ? Date.parse(value) : null;
    }
    case "last_login":
      return user.last_login ? Date.parse(user.last_login) : null;
    default:
      return "";
  }
}

function sortUsers(
  users: User[],
  sortState: SortState | null,
  entityNameMap: Map<string, string>,
): User[] {
  if (!sortState) return users;
  const sign = sortState.dir === "asc" ? 1 : -1;
  return [...users].sort((a, b) => {
    const av = userSortValue(a, sortState.id, entityNameMap);
    const bv = userSortValue(b, sortState.id, entityNameMap);
    // Empty dates always sort last, regardless of direction.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  });
}

export default function AdminUsers() {
  const [state, dispatch] = useStateReducer({
    search: "",
    sortState: { id: "last_active", dir: "desc" } as SortState,
    selectedIds: new Set<string>(),
    openInvite: false,
    openExport: false,
    openDetails: null as null | User,
  });

  const usersQuery = useUsers();
  const entityMapQuery = useEntityMap();
  const rolesQuery = useEntityRoles();

  const entityNameMap = useMemo(
    () => buildEntityNameMap(entityMapQuery.data ?? []),
    [entityMapQuery.data],
  );
  const userRolesMap = useMemo(
    () => buildUserRolesMap(rolesQuery.data ?? []),
    [rolesQuery.data],
  );

  const entityInfoQuery = useQuery({
    queryKey: ["admin", "entityInfo"],
    queryFn: getEntityInfo,
    enabled: true,
  });
  const users = usersQuery.data ?? undefined;
  const navigate = useNavigate();
  const entityInfo = entityInfoQuery.data ?? undefined;
  const remainingSeats = entityInfo?.seats - entityInfo?.used_seats;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(state.search), 250);
    return () => clearTimeout(timeout);
  }, [state.search]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const rows = users ?? [];
    if (!query) return rows;
    return rows.filter((user) => {
      const type = (entityNameMap.get(user.permissions_uuid) ?? "").toLowerCase();
      const roles = (userRolesMap.get(user.email) ?? []).join(" ").toLowerCase();
      return (
        nameOf(user).toLowerCase().includes(query) ||
        (user.email ?? "").toLowerCase().includes(query) ||
        type.includes(query) ||
        roles.includes(query) ||
        (user.status ?? "").toLowerCase().includes(query)
      );
    });
  }, [users, debouncedSearch, entityNameMap, userRolesMap]);

  const sorted = useMemo(
    () => sortUsers(filtered, state.sortState, entityNameMap),
    [filtered, state.sortState, entityNameMap],
  );

  const selectedUsers = useMemo(
    () => sorted.filter((user) => state.selectedIds.has(user.uuid)),
    [sorted, state.selectedIds],
  );

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: "13%",
        minWidth: 140,
        sortable: true,
        cell: (user) => nameOf(user) || "-",
      },
      {
        id: "email",
        header: "Email",
        width: "19%",
        minWidth: 200,
        sortable: true,
        cell: (user) => user.email || "-",
      },
      {
        id: "type",
        header: "Type",
        width: "8%",
        minWidth: 80,
        sortable: true,
        cell: (user) => entityNameMap.get(user.permissions_uuid) ?? "-",
      },
      {
        id: "roles",
        header: "Roles",
        width: "14%",
        minWidth: 140,
        truncate: false,
        cell: (user) => (
          <div className="w-full min-w-0">
            <OverflowTags items={userRolesMap.get(user.email) ?? []} />
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "10%",
        minWidth: 110,
        sortable: true,
        truncate: false,
        cell: (user) => <AdminUserStatus value={user.status} />,
      },
      {
        id: "billing_active",
        header: "Billing Status",
        width: "11%",
        minWidth: 130,
        sortable: true,
        truncate: false,
        cell: (user) => <AdminUserBillingStatus value={user.billing_active} />,
      },
      {
        id: "last_active",
        header: "Last Active",
        width: "12%",
        minWidth: 150,
        sortable: true,
        cell: (user) => formatDate(user.last_active ?? user.last_login),
      },
      {
        id: "last_login",
        header: "Last Log in",
        width: "13%",
        minWidth: 150,
        sortable: true,
        cell: (user) => formatDate(user.last_login),
      },
    ],
    [entityNameMap, userRolesMap],
  );

  const onToggleRow = useCallback(
    (id: string, checked: boolean) => {
      dispatch({
        selectedIds: (prev) => {
          const next = new Set(prev);
          if (checked) next.add(id);
          else next.delete(id);
          return next;
        },
      });
    },
    [dispatch],
  );

  const onToggleAll = useCallback(
    (rows: User[], checked: boolean) => {
      dispatch({
        selectedIds: (prev) => {
          const next = new Set(prev);
          for (const user of rows) {
            if (checked) next.add(user.uuid);
            else next.delete(user.uuid);
          }
          return next;
        },
      });
    },
    [dispatch],
  );

  const onSortChange = useCallback(
    (sortState: SortState) => dispatch({ sortState }),
    [dispatch],
  );

  const renderRowActions = useCallback(
    (user: User) => (
      <Tooltip message="Edit user">
        <button
          type="button"
          aria-label="Edit user"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center"
          onClick={() => dispatch({ openDetails: user })}
        >
          <Icon id="pencil-04" className="size-3.5" />
        </button>
      </Tooltip>
    ),
    [dispatch],
  );

  const expirationDate = useMemo(() => {
    if (entityInfo?.expiration_date) {
      const date = new Date(entityInfo.expiration_date);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return "N/A";
  }, [entityInfo?.expiration_date]);

  return (
    <SettingsLayout title="User Management" tabs={[]} defaultTab="users">
      <TabsPrimitive.Content
        value="users"
        className="p-6 text-sm only-sm:h-screen flex flex-col flex-1 h-[calc(100vh-72px)]"
      >
        <div className="border-l-2 border-brand-lighter pl-2.5 space-y-2">
          <p className="text-xs text-ds-text-heading">
            <span className="text-ds-text-subtitle font-medium">Users:</span>{" "}
            <span className="text-ds-text-caption">
              {entityInfoQuery.isLoading ? "" : (users?.length ?? 0)}
            </span>
          </p>
          {!isLite && (
            <p className="text-xs text-ds-text-heading">
              <span className="text-ds-text-subtitle font-medium">
                Seats Remaining:
              </span>{" "}
              <span className="text-ds-text-caption">
                {entityInfoQuery.isLoading ? "" : remainingSeats}
              </span>
            </p>
          )}
          {!isLite && (
            <p className="text-xs text-ds-text-heading">
              <span className="text-ds-text-subtitle font-medium">
                Expiration Date:
              </span>{" "}
              <span className="text-ds-text-caption">
                {entityInfoQuery.isLoading ? "" : expirationDate}
              </span>
            </p>
          )}
        </div>
        <div className="obb-divider my-6" />
        <div className="flex items-center gap-[10px]">
          <Input
            size="xs"
            className="min-w-[270px] h-8 [&_input]:h-8"
            placeholder="Search for users"
            prefix={<Icon id="search" />}
            onChange={(value: string) => dispatch({ search: value })}
          />
          <div className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => dispatch({ openExport: true })}
          >
            Export users
          </Button>
          <SnowflakeHide>
            <Button
              variant="primary"
              size="sm"
              onClick={() => dispatch({ openInvite: true })}
            >
              {isLite ? "Add users" : "Invite users"}
            </Button>
          </SnowflakeHide>
        </div>
        <div className="relative flex-1 mt-6 min-h-0">
          <DataTable
            columns={columns}
            data={sorted}
            getRowId={getUserId}
            virtualized
            estimateRowHeight={50}
            selectedIds={state.selectedIds}
            onToggleRow={onToggleRow}
            onToggleAll={onToggleAll}
            sortState={state.sortState}
            onSortChange={onSortChange}
            renderRowActions={renderRowActions}
            actionsWidth={64}
            className="h-full"
          />
          {!users?.length && (
            <div className="absolute bottom-0 left-0 right-0 top-0">
              <RenderNoData
                isError={usersQuery.isError}
                isLoading={usersQuery.isLoading}
              >
                <div>
                  <a href="#" className="text-brand-main hover:underline">
                    Invite more users
                  </a>{" "}
                  and grow your team
                </div>
              </RenderNoData>
            </div>
          )}
        </div>

        <AdminInviteUsersDialog
          open={state.openInvite}
          onClose={() => dispatch({ openInvite: false })}
        />
        <ExportUsersDialog
          open={state.openExport}
          onClose={() => dispatch({ openExport: false })}
          rows={sorted}
          selectedRows={selectedUsers}
          entityNameMap={entityNameMap}
          userRolesMap={userRolesMap}
        />
        {!!state.openDetails && (
          <AdminUserDetailsDialog
            onClose={() => dispatch({ openDetails: null })}
            user={state.openDetails}
            roles={userRolesMap.get(state.openDetails.email) ?? []}
          />
        )}
      </TabsPrimitive.Content>
    </SettingsLayout>
  );
}
