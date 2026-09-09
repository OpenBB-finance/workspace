import type { ReactNode } from "react";
import type { SelectedBackends } from "~/components/Apps/backendSelection";
import type { UnifiedTemplate } from "~/hooks/useAllTemplates";

export interface AppTemplate extends UnifiedTemplate {
  isDevelopment?: boolean;
}

export type SortOption = {
  label: string;
  value: "newest" | "oldest" | "a-z" | "z-a";
};

export type FilterOption = {
  label: string;
  value: "all" | "shared" | "user" | "listed" | "openbb";
};

export type AppsOptions = {
  filterBy: FilterOption["value"];
  sortBy: SortOption["value"];
  // null = "all selected" sentinel; [] = explicit none; [...ids] = filter set.
  selectedBackends: SelectedBackends;
};

export type DeleteConfirm = {
  template: UnifiedTemplate;
  type: "app" | "backend" | "listedApp";
};

export type AppsPageState = {
  search: string;
  filterOptions: FilterOption[];
  showToast: boolean;
  deleteConfirm: DeleteConfirm | null;
  rateApp: { id: string; appName: string } | null;
  backendDropdownOpen: boolean;
  backendSearch: string;
};

export interface AppCardProps {
  fromMarketplace?: boolean;
  template: AppTemplate;
  setDeleteConfirm?: (deleteConfirm: DeleteConfirm) => void;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  className?: string;
  hideActions?: boolean;
}

export interface AppCardDropdownItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  locked?: boolean;
  color?: string;
}
