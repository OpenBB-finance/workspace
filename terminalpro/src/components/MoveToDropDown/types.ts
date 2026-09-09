import type { Item } from "~/lib/state/app";
import type { DraggableState } from "../DraggableCard";
import type { ExtraActionT } from "../DraggableCard/NavBar";
import type { Widget } from "../types";

export type InnerTabsMenuProps = {
  uniqueKey: string;
  tab: Item;
  gridLayout: Item["data"]["gridLayout"];
};

export type MoveToOnSelectProps = {
  widget: Widget;
  tab: Item;
  activeDashboardId: string;
  navigate: (path: string) => void;
};

export type EllipsisDropdownMenuProps = {
  dispatch?: (value: Partial<DraggableState>) => void;
  settings?: {
    showSettings?: boolean;
    showFunctions?: boolean;
    showParameters?: boolean;
    showShare?: boolean;
    showDuplicate?: boolean;
    showExport?: boolean;
    showMaximize?: boolean;
    showMove?: boolean;
    showMetadata?: boolean;
    showCopyToClipboard?: boolean;
    showMinimize?: boolean;
  };
  exportFns?: {
    csvFunction?: (title: string) => void;
    excelFunction?: (title: string) => void;
    pngFunction?: (title: string) => void;
    pdfFunction?: (title: string) => void;
  };
  extraSettings?: ExtraActionT[];
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
};
