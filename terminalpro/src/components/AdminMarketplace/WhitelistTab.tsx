import { useCallback, useMemo, useState } from "react";
import type { WhitelistEntry } from "~/api/adminMarketplace.api";
import { formatDate } from "~/components/Apps/adminApps";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import type { DataTableColumn } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import {
  useAddWhitelist,
  useDeleteWhitelist,
  useWhitelist,
} from "~/hooks/useAdminMarketplace";
import { RenderNoData } from "~/routes/admin";

const ACTION_BTN =
  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center";

const getRowId = (entry: WhitelistEntry) => entry.uuid;

export function WhitelistTab() {
  const { data: entries, isLoading, isError } = useWhitelist();
  const addWhitelist = useAddWhitelist();
  const deleteWhitelist = useDeleteWhitelist();

  const [email, setEmail] = useState("");
  const [removing, setRemoving] = useState<WhitelistEntry | null>(null);

  const handleAdd = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      await addWhitelist.mutateAsync(trimmed);
      setEmail("");
    } catch {
      // Error toast handled by the mutation.
    }
  }, [email, addWhitelist]);

  const handleRemove = useCallback(async () => {
    if (!removing) return;
    try {
      await deleteWhitelist.mutateAsync(removing.uuid);
      setRemoving(null);
    } catch {
      // Error toast handled by the mutation.
    }
  }, [removing, deleteWhitelist]);

  const columns = useMemo<DataTableColumn<WhitelistEntry>[]>(
    () => [
      {
        id: "email",
        header: "Email",
        width: "fill",
        minWidth: 220,
        cell: (entry) => <span className="text-general-label">{entry.email}</span>,
      },
      {
        id: "created_date",
        header: "Date added",
        width: 200,
        cell: (entry) => formatDate(entry.created_date),
      },
    ],
    [],
  );

  const renderRowActions = useCallback(
    (entry: WhitelistEntry) => (
      <Tooltip position="top" message="Remove">
        <button type="button" className={ACTION_BTN} onClick={() => setRemoving(entry)}>
          <Icon id="trash-icon" className="size-3.5" />
        </button>
      </Tooltip>
    ),
    [],
  );

  const rows = entries ?? [];

  return (
    <div className="p-6 flex flex-col flex-1 h-[calc(100vh-72px)]">
      <p className="text-ds-text-caption body-xs-regular">
        The developer must already have an OpenBB account. Once whitelisted, they can
        list apps to the marketplace from their Workspace.
      </p>
      <div className="flex items-end gap-2.5 mt-4">
        <Input
          size="xs"
          className="min-w-[280px] h-8 [&_input]:h-8"
          placeholder="developer@example.com"
          value={email}
          onChange={setEmail}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={addWhitelist.isPending}
          disabled={!email.trim()}
          onClick={handleAdd}
        >
          Add developer
        </Button>
      </div>

      <div className="relative flex-1 mt-6 min-h-0">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={getRowId}
          virtualized
          estimateRowHeight={50}
          renderRowActions={renderRowActions}
          actionsWidth={60}
          className="h-full"
        />
        {!rows.length && (
          <div className="absolute inset-0">
            <RenderNoData isError={isError} isLoading={isLoading}>
              <div>No whitelisted developers yet</div>
            </RenderNoData>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove developer"
        description={`Remove ${removing?.email ?? ""} from the whitelist? They keep any existing drafts but can't submit new apps.`}
        confirmButton={
          <Button
            variant="danger"
            size="sm"
            loading={deleteWhitelist.isPending}
            onClick={handleRemove}
          >
            Remove
          </Button>
        }
      />
    </div>
  );
}
