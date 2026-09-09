import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "../ds/atoms/Checkbox";
import { Select } from "../ds/atoms/Select";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import type { PermissionItem } from "./types";

const accessStyle = {
  "no-access":
    "obb-tag whitespace-nowrap body-xs-regular bg-tag-orange-bg text-tag-orange-label",
  access:
    "obb-tag whitespace-nowrap body-xs-regular bg-tag-green-bg text-tag-green-label",
};

const PERMISSION_OPTIONS = [
  { label: "Access", value: "access" },
  { label: "No Access", value: "no-access" },
];

export type PermissionItemRowProps = {
  item: PermissionItem;
  onAccessChange: (
    uuid: string,
    access: PermissionItem["access"],
    category: PermissionItem["category"],
  ) => void;
  onCheckChange: (uuid: string) => void;
  onToggleOpen: (uuid: string) => void;
  searchTerm: string;
};

export function PermissionItemRow({
  item,
  onAccessChange,
  onCheckChange,
  onToggleOpen,
  searchTerm,
}: PermissionItemRowProps) {
  const validTemplates = item.status === "error" ? [] : item.templates;
  const validWidgets = item.status === "error" ? [] : item.widgets;
  const hasNestedItems = validWidgets?.length > 0 || validTemplates?.length > 0;
  const isChildItem = item.parentUuid !== undefined;
  const itemAccess = item.access ?? "no-access";
  const parentNoAccess = isChildItem
    ? item.parentAccess === "no-access"
    : itemAccess === "no-access";
  const parentHasNoAccess = item.category === "file" ? false : parentNoAccess;

  const backendOffline = item.status === "error" && !hasNestedItems;

  const [localOpen, setIsOpen] = useState<boolean | null>(null);

  const filteredWidgets = useMemo(
    () =>
      item.widgets?.filter(
        (widget) =>
          !searchTerm ||
          widget?.name?.toLowerCase()?.includes(searchTerm.toLowerCase()),
      ),
    [item.widgets, searchTerm],
  );

  const noResults = filteredWidgets?.length === 0 && item.widgets?.length > 0;

  const isOpen = useMemo(() => {
    if (localOpen !== null) return localOpen;
    if (noResults && searchTerm !== "") return false;
    return searchTerm !== "" || item.isOpen;
  }, [localOpen, searchTerm, item.isOpen, noResults]);

  useEffect(() => {
    if (searchTerm === "") setIsOpen(null);
  }, [searchTerm]);

  const resourceTag = useMemo(() => {
    if (item.parentBackend && item.parentTemplate) return item.parentTemplate;
    if (item.appWidgetsIds !== undefined) return "App";
    return "";
  }, [item]);

  const showResourceTag = useMemo(
    () => !isChildItem || (item.category === "prompt" && item.parentTemplate),
    [isChildItem, item.category, item.parentTemplate],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn("flex items-center gap-2 pl-2 min-w-0 flex-1", {
            "cursor-pointer": hasNestedItems,
            "opacity-50": backendOffline,
          })}
          onClick={() => {
            if (hasNestedItems) {
              if (searchTerm !== "") {
                setIsOpen((prev) => (prev === null ? noResults : !prev));
                return;
              }
              onToggleOpen(item.uuid);
            }
          }}
        >
          {(hasNestedItems || (backendOffline && item.category === "backend")) && (
            <Icon
              id="chevron-right"
              className={cn("size-3 transition-transform", {
                "rotate-90": isOpen,
              })}
            />
          )}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Tooltip
              className="max-w-[300px]"
              message={
                item.parentBackend && item.parentTemplate
                  ? `${item.parentBackend} > ${item.parentTemplate} > ${item.name}`
                  : item.name
              }
            >
              <p className="body-xs-medium text-ds-text-heading truncate">
                {item.name}
              </p>
            </Tooltip>
            {showResourceTag && resourceTag && (
              <Tooltip className="max-w-[300px]" message={resourceTag}>
                <span className="obb-tag truncate max-w-[280px] text-xs flex-shrink-0">
                  {resourceTag}
                </span>
              </Tooltip>
            )}
            {item.description && isChildItem && (
              <Tooltip className="max-w-[300px]" message={item.description}>
                <p className="text-xs text-ds-text-caption truncate max-w-[300px]">
                  {item.description}
                </p>
              </Tooltip>
            )}
            {backendOffline && (
              <Tooltip
                position="top"
                message="Backend not connected. Please check your connections."
              >
                <span className="flex">
                  <Icon id="warning-icon" className="text-alert-warning size-5 mr-2" />
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 w-[156px]">
          {item.category === "file" ? (
            <div className="h-[18px] w-[110px] capitalize body-xs-regular text-ds-text-caption">
              {itemAccess === "access" ? "Access" : "No Access"}
            </div>
          ) : (
            <Select
              className="h-[18px] w-[130px] capitalize body-xs-regular"
              options={PERMISSION_OPTIONS}
              value={itemAccess}
              onChange={(value) =>
                onAccessChange(
                  item.uuid,
                  value as PermissionItem["access"],
                  item.category,
                )
              }
              disabled={(isChildItem && parentHasNoAccess) || backendOffline}
            />
          )}
          <Checkbox
            checked={item.isChecked}
            onCheckedChange={() => onCheckChange(item.uuid)}
            disabled={(isChildItem && parentHasNoAccess) || backendOffline}
          />
        </div>
      </div>

      <AnimatePresence>
        {hasNestedItems && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-4 space-y-2 border-general-border-primary pl-4">
              {(noResults && searchTerm !== "" ? item.widgets : filteredWidgets)?.map(
                (widget) => (
                  <PermissionRowItem
                    key={widget.uuid}
                    item={widget}
                    onAccessChange={onAccessChange}
                    onCheckChange={onCheckChange}
                    parentHasNoAccess={parentHasNoAccess}
                    isAppWidget={item.appWidgetsIds?.includes(widget.uuid)}
                  />
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PermissionRowItem({
  item,
  onAccessChange,
  onCheckChange,
  parentHasNoAccess,
  isAppWidget = false,
}: {
  item: PermissionItem;
  onAccessChange: (
    uuid: string,
    access: PermissionItem["access"],
    category: PermissionItem["category"],
  ) => void;
  onCheckChange: (uuid: string) => void;
  parentHasNoAccess?: boolean;
  isAppWidget?: boolean;
}) {
  const itemAccess = item.access ?? "no-access";
  return (
    <div
      key={item.uuid}
      className="flex items-center justify-between p-2 rounded bg-general-bg-secondary"
    >
      <div className="flex items-center gap-4 max-w-[70%]">
        <Tooltip className="max-w-[300px]" message={item.name}>
          <p className="body-xs-medium text-ds-text-heading truncate max-w-[200px]">
            {item.name}
          </p>
        </Tooltip>
        {item.description && (
          <Tooltip className="max-w-[300px]" message={item.description}>
            <p className="text-xs text-ds-text-caption truncate max-w-[300px]">
              {item.description}
            </p>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center justify-end gap-2.5 w-[156px]">
        {isAppWidget ? (
          <span className={cn(accessStyle[itemAccess])}>
            {itemAccess === "access" ? "Access" : "No Access"}
          </span>
        ) : (
          <>
            <Select
              className="h-[18px] w-[130px] capitalize body-xs-regular"
              options={PERMISSION_OPTIONS}
              value={itemAccess}
              onChange={(value) =>
                onAccessChange(
                  item.uuid,
                  value as PermissionItem["access"],
                  item.category,
                )
              }
              disabled={parentHasNoAccess}
            />
            <Checkbox
              checked={item.isChecked}
              onCheckedChange={() => onCheckChange(item.uuid)}
              disabled={parentHasNoAccess}
            />
          </>
        )}
      </div>
    </div>
  );
}
