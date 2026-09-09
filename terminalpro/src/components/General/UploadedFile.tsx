import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "~/lib/state/app";
import { cn } from "~/lib/utils";
import OldIcon from "../Icon";
import Icon from "../Icon";
import Tooltip from "../Tooltip";

export function FooterLink({ link }: { link: string }) {
  const { addWidget } = useAppStore();
  const { id } = useParams();

  const url = link.replace(/[?.]$/, "");
  const formattedUrl = url.startsWith("http") ? url : `https://${url}`;

  return (
    <div className="px-[6px] py-1 text-xs rounded dark:bg-[#303038] flex items-center justify-center gap-1 min-w-0 max-w-[10rem]">
      <Icon id="link-03" className="h-3 w-3 text-brand-lighter shrink-0" />
      <a
        href={formattedUrl}
        target="_blank"
        rel="noreferrer"
        className="ml-1 mr-3 text-brand-lighter whitespace-nowrap hover:underline truncate min-w-0"
      >
        {link}
      </a>
      <Tooltip message="Create iframe widget">
        <button
          onClick={() => {
            addWidget(id, {
              id: uuidv4(),
              widgetId: "iframe",
              name: link,
              description: `${link} iframe`,
              storage: { html: formattedUrl },
              gridData: {
                w: 20,
                h: 25,
              },
            } as any);
          }}
          type="button"
          className="shrink-0"
        >
          <OldIcon id="solar-widget-add-outline" className="h-3 w-3" />
        </button>
      </Tooltip>
    </div>
  );
}

type UploadedFileProps = {
  name: string;
  status?: "pending" | "uploaded" | "failed";
  onClick?: () => void;
  className?: string;
  readOnly?: boolean;
};

export function UploadedFile(props: UploadedFileProps) {
  const { name, status, onClick, className = "", readOnly = false } = props;

  const statusIcon = useMemo(() => {
    if (!status) return null;

    return status === "pending" ? (
      <Icon
        id="mdi-loading"
        className="size-3.5 min-w-3.5 animate-spin text-ds-text-caption"
      />
    ) : (
      <Icon
        id={status === "uploaded" ? "check" : "x"}
        className={cn(
          "size-3.5 min-w-3.5",
          status === "uploaded" ? "text-alert-success" : "text-alert-error",
        )}
      />
    );
  }, [status]);

  return (
    <div
      className={cn(
        "h-7 px-2 py-1 rounded border border-general-border-primary bg-general-bg-primary flex items-center gap-1.5 min-w-0",
        className,
      )}
    >
      <Icon
        id="attachment-icon"
        className="size-3.5 min-w-3.5 shrink-0 text-ds-text-caption"
      />
      <Tooltip message={name} className="max-w-radix-tooltip-content-available-width!">
        <span className="body-xs-regular truncate min-w-0 flex-1 text-ds-text-subtitle">
          {name}
        </span>
      </Tooltip>
      {!readOnly && (
        <div className="flex gap-1 items-center shrink-0">
          {statusIcon && (
            <Tooltip
              message={
                <div className="capitalize">
                  {status === "pending" ? "Uploading..." : status}
                </div>
              }
            >
              {statusIcon}
            </Tooltip>
          )}
          {onClick && (
            <Tooltip message="Delete file">
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={onClick}
                className="flex items-center"
              >
                <Icon
                  id="x-outline-circle"
                  className="size-3.5 cursor-pointer text-ds-text-caption hover:text-ds-text-subtitle"
                />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
