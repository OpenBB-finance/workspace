import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { AdminApp, MarketplaceAuthField } from "~/api/adminMarketplace.api";
import { AppPreviewSurfaces } from "~/components/Apps/AppPreviewSurfaces";
import { formatDate } from "~/components/Apps/adminApps";
import { PREVIEW_OPTIONS, type PreviewMode } from "~/components/Apps/appPreview";
import { DetailRow as SharedDetailRow } from "~/components/Apps/DetailRow";
import { Button } from "~/components/ds/atoms/Button";
import { Select } from "~/components/ds/atoms/Select";
import { Tag } from "~/components/ds/atoms/Tag";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogTitle } from "~/components/ds/dialogs/Dialog";
import { Notice } from "~/components/ds/molecules/Notice";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useAppSubscriptions } from "~/hooks/useAdminMarketplace";
import { safeExternalUrl } from "~/lib/utils/externalUrl";
import { statusTagColor } from "~/routes/admin/marketplaceStatus";
import type { ListedAppMcpServer } from "~/types/listedApps";
import { adminAppToAppTemplate, adminAppToListedApp } from "./adminAppToListedApp";
import {
  type MarketplaceAction,
  type ResolvedAction,
  resolveActions,
} from "./appActionModel";

type ReviewTab = "info" | "preview";

/** Left footer: utility / remove. Right: decision actions. */
const LEFT_ACTIONS: MarketplaceAction[] = ["verify", "disable", "remove"];
const RIGHT_ACTIONS: MarketplaceAction[] = ["reject", "publish"];

interface ReviewAppDialogProps {
  app: AdminApp | null;
  actionPending: boolean;
  onClose: () => void;
  onAction: (app: AdminApp, action: MarketplaceAction) => void;
}

/** Admin labels ("API key URL", "Last verified") need a wider column than the vendor view. */
const DetailRow = (props: { label: string; children: ReactNode }) => (
  <SharedDetailRow {...props} labelClassName="w-28" />
);

function displayCount(value: number | null | undefined): string {
  if (value == null || value === 0) return "-";
  return String(value);
}

function displayText(value: string | null | undefined): string {
  return value?.trim() ? value : "-";
}

/**
 * Vendor-authored URLs reach this dialog before anyone has reviewed them, so a
 * non-http(s) value is rendered as plain text rather than a link — clicking a
 * `javascript:` href would run it in the reviewer's session.
 */
function LinkValue({ url }: { url: string | null }) {
  if (!url) return <span>-</span>;
  const safe = safeExternalUrl(url);
  if (!safe) return <span className="break-all text-alert-error">{url}</span>;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link-color hover:underline break-all"
    >
      {safe}
    </a>
  );
}

/**
 * The credential *schema* a vendor declares — header names and prefixes, never
 * a user's saved value. Reviewers need it to judge what the app will ask for.
 */
function AuthFieldsValue({ fields }: { fields: MarketplaceAuthField[] | null }) {
  if (!fields?.length) return <span>-</span>;
  return (
    <div className="flex flex-col gap-1">
      {fields.map((field, index) => (
        <div
          key={`field-${field.id}-${index}`}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
        >
          <span className="text-ds-text-heading">{field.label}</span>
          <code className="obb-code">{field.key}</code>
          {field.prefix && (
            <>
              <span className="text-ds-text-caption">prefix</span>
              {/* whitespace-pre so a load-bearing trailing space ("Bearer ") stays visible. */}
              <code className="obb-code whitespace-pre">{field.prefix}</code>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function McpServersValue({ servers }: { servers: ListedAppMcpServer[] | null }) {
  if (!servers?.length) return <span>-</span>;
  return (
    <div className="flex flex-col gap-2">
      {servers.map((server, index) => (
        <div key={`server-${server.url}-${index}`} className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ds-text-heading">{server.name}</span>
            {/* Absent authType means the default OAuth flow — spell it out
                rather than leaving the reviewer to infer it. */}
            <Tag color="grey">{server.authType ?? "oauth"}</Tag>
          </div>
          <LinkValue url={server.url} />
          {server.description && (
            <span className="text-ds-text-caption">{server.description}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function FetchTag({ status }: { status: string | null }) {
  if (!status) return null;
  const ok = status !== "error";
  return <Tag color={ok ? "success" : "danger"}>{ok ? "Fetch ok" : "Fetch error"}</Tag>;
}

function ActionButton({
  action,
  pending,
  onClick,
}: {
  action: ResolvedAction;
  pending: boolean;
  onClick: () => void;
}) {
  const isLeft = LEFT_ACTIONS.includes(action.action);
  const variant = isLeft
    ? "outlined"
    : action.action === "publish"
      ? "primary"
      : "secondary";

  return (
    <Tooltip position="top" message={action.tooltip}>
      <Button
        variant={variant}
        size="sm"
        disabled={!action.enabled || pending}
        onClick={onClick}
      >
        {isLeft && <Icon id={action.icon} className="size-3.5" />}
        {action.label}
      </Button>
    </Tooltip>
  );
}

function AppInfoTab({ app }: { app: AdminApp }) {
  const { data, isLoading } = useAppSubscriptions(app.id);
  const verification = app.verification;

  return (
    <div className="flex flex-col gap-3">
      {app.rejection_reason && (
        <Notice variant="error" title="Rejection reason">
          {app.rejection_reason}
        </Notice>
      )}

      {verification &&
        (verification.errors.length > 0 || verification.warnings.length > 0) && (
          <Notice
            variant={verification.errors.length > 0 ? "error" : "warning"}
            title={`Verification: ${verification.status}`}
          >
            <ul className="mt-1 flex flex-col gap-1">
              {verification.errors.map((err, index) => (
                <li key={`error-${err}-${index}`} className="body-xs-regular">
                  {err}
                </li>
              ))}
              {verification.warnings.map((warn, index) => (
                <li key={`warn-${warn}-${index}`} className="body-xs-regular">
                  {warn}
                </li>
              ))}
            </ul>
          </Notice>
        )}

      <SettingsMenu title="Details">
        <div>
          <DetailRow label="Category">{displayText(app.category)}</DetailRow>
          <DetailRow label="Tagline">{displayText(app.tagline)}</DetailRow>
          <DetailRow label="Auth Type">
            {app.auth_type?.length ? app.auth_type.join(", ") : "-"}
          </DetailRow>
          <DetailRow label="Auth fields">
            <AuthFieldsValue fields={app.auth_fields} />
          </DetailRow>
          <DetailRow label="MCP server">
            <McpServersValue servers={app.mcp_servers} />
          </DetailRow>
          <DetailRow label="Widgets">{displayCount(app.widgets_count)}</DetailRow>
          <DetailRow label="Prompts">{displayCount(app.prompts_count)}</DetailRow>
          <DetailRow label="Description">
            {displayText(app.short_description)}
          </DetailRow>
        </div>
      </SettingsMenu>

      <SettingsMenu title="Backend & URLs">
        <div>
          <DetailRow label="Backend">
            <LinkValue url={app.backend_base_url} />
          </DetailRow>
          <DetailRow label="Apps.json">
            <LinkValue url={app.apps_json_url} />
          </DetailRow>
          <DetailRow label="Widgets.json">
            <LinkValue url={app.widgets_json_url} />
          </DetailRow>
        </div>
      </SettingsMenu>

      <SettingsMenu title="Admin meta">
        <div>
          <DetailRow label="Built-in">{app.is_built_in ? "Yes" : "No"}</DetailRow>
          <DetailRow label="API key URL">
            <LinkValue url={app.api_key_url} />
          </DetailRow>
          <DetailRow label="More info">
            <LinkValue url={app.more_information_url} />
          </DetailRow>
          <DetailRow label="Created">
            {formatDate(app.created_date ?? undefined)}
          </DetailRow>
          <DetailRow label="Updated">
            {formatDate(app.updated_date ?? undefined)}
          </DetailRow>
          <DetailRow label="Last verified">
            {formatDate(app.last_verified_at ?? undefined)}
          </DetailRow>
          <DetailRow label="Active subs">
            {isLoading ? "—" : String(data?.active_count ?? 0)}
          </DetailRow>
          <DetailRow label="Total subs">
            {isLoading ? "—" : String(data?.total_count ?? 0)}
          </DetailRow>
          {app.media.length > 0 && (
            <DetailRow label="Media">
              <div className="flex flex-col gap-1">
                {app.media.map((url, index) => (
                  <LinkValue key={`media-${url}-${index}`} url={url} />
                ))}
              </div>
            </DetailRow>
          )}
          {app.last_fetch_error && (
            <DetailRow label="Fetch error">
              <span className="text-alert-error">{app.last_fetch_error}</span>
            </DetailRow>
          )}
        </div>
      </SettingsMenu>
    </div>
  );
}

function FinalPreviewTab({ app }: { app: AdminApp }) {
  const [mode, setMode] = useState<PreviewMode>("marketplace");

  const listedApp = useMemo(() => adminAppToListedApp(app), [app]);
  const template = useMemo(() => adminAppToAppTemplate(app), [app]);

  return (
    <SettingsMenu title="Details">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="body-xs-regular text-ds-text-caption shrink-0">
            Preview as
          </span>
          <Select
            size="sm"
            className="w-[200px]"
            options={PREVIEW_OPTIONS}
            value={mode}
            onChange={(value) => setMode(value as PreviewMode)}
          />
        </div>

        <AppPreviewSurfaces mode={mode} listedApp={listedApp} template={template} />
      </div>
    </SettingsMenu>
  );
}

export function ReviewAppDialog({
  app,
  actionPending,
  onClose,
  onAction,
}: ReviewAppDialogProps) {
  const [tab, setTab] = useState<ReviewTab>("info");

  // Reset to App Info whenever a different app is opened for review.
  useEffect(() => {
    if (app) setTab("info");
  }, [app?.id]);

  // Split into the two footer groups, keeping each group's declared order.
  const { leftActions, rightActions } = useMemo(() => {
    if (!app) return { leftActions: [], rightActions: [] };
    const byAction = new Map(resolveActions(app).map((a) => [a.action, a]));
    const pick = (order: MarketplaceAction[]) =>
      order
        .map((a) => byAction.get(a))
        .filter((a): a is ResolvedAction => a !== undefined);
    return { leftActions: pick(LEFT_ACTIONS), rightActions: pick(RIGHT_ACTIONS) };
  }, [app]);

  if (!app) return null;

  return (
    <BaseDialog
      open
      onClose={onClose}
      className="gap-4 sm:!w-[680px] !max-w-[680px] max-h-[85vh] overflow-hidden flex flex-col"
    >
      <div className="flex flex-col gap-1 shrink-0">
        <DialogTitle>{app.name}</DialogTitle>
        <div className="flex flex-wrap items-center gap-2 text-ds-text-body body-sm-regular">
          <span>
            by: {app.vendor_name}
            <span className="mx-1.5 text-ds-text-caption">·</span>
            <span>v{app.version}</span>
          </span>
          <Tag color={statusTagColor(app.status)}>{app.status}</Tag>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ReviewTab)}
        variant="filled_secondary"
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="info" className="flex-1">
            App Info
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1">
            Final Preview
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <TabsContent value="info" className="mt-0 outline-none">
            <AppInfoTab app={app} />
          </TabsContent>
          <TabsContent value="preview" className="mt-0 outline-none">
            <FinalPreviewTab app={app} />
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-general-border-secondary pt-4 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {leftActions.map((a) => (
            <ActionButton
              key={a.action}
              action={a}
              pending={actionPending}
              onClick={() => onAction(app, a.action)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rightActions.map((a) => (
            <ActionButton
              key={a.action}
              action={a}
              pending={actionPending}
              onClick={() => onAction(app, a.action)}
            />
          ))}
        </div>
      </div>
    </BaseDialog>
  );
}
