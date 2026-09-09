import isEqual from "lodash.isequal";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import type { Selector } from "./app";

/* example of what is returned from backend on /login
feature_entitlements: {
    "tier": "pro",
    "number_copilot_calls_day": 100,
    "total_file_upload_size_gb": 50,
    "share_widgets": "private",
    "bring_your_own_data": true,
    "bring_your_own_copilot": true,
    "admin_access": true,
    "support": true,
    "excel_add_in": true,
    "data_add_ons_redistribution": true,
    "bundle_name": null,
    "data_bundle_info": null
},
is_trial_entity: true
*/

export type FeatureFlags = {
  admin_access: boolean; // show admin panel
  bring_your_own_copilot: boolean;
  bring_your_own_data: boolean;
  bundle_name: string | null;
  data_add_ons_redistribution: boolean;
  data_bundle_info: DataBundle | null;
  excel_add_in: boolean;
  number_copilot_calls_day: number;
  share_widgets: "private" | "public";
  support: boolean;
  tier: "pro" | "terminal";
  total_file_upload_size_gb: number;
  is_trial: boolean;
  can_submit_marketplace: boolean; // developer may submit marketplace apps
};

export type DashboardTypes = "charting" | "equity" | "onboarding";

export type OldDashboardTypes =
  | "charting"
  | "equityAnalyst"
  | "equity"
  | "comparison"
  | "etfTemplate"
  | "onboarding"
  | "earnings";

export type WidgetTypes =
  | "etf_holdings"
  | "earnings_trends"
  | "revenue_trends"
  | "etf_classification"
  | "etf_characteristics";

export function isExcludedWidgetId(widgetId: any): boolean {
  const featureFlags = useFeatureFlagsStore.getState().featureFlags;
  return featureFlags?.data_bundle_info?.except_widgets?.includes(widgetId);
}

export type DataBundle = {
  bundle_name: "Default" | "Equity Research" | "Pro Trial";
  except_widgets: WidgetTypes[] | null;
  except_dashboard_templates: DashboardTypes[] | null;
  except_team_collaboration: ("pdf_reports" | "sharing")[] | null;
  excel_add_in: boolean;
  data_export: boolean;
  providers: ("fmp" | "econdb" | "benzinga")[] | null;
  dashboards_at_launch: DashboardTypes[] | null;
  my_dashboards: DashboardTypes[] | null;
  invite_your_colleagues: boolean;
  number_copilot_calls_day: number;
  total_file_upload_size_gb: number;
};

export type Usage = {
  number_copilot_calls_day_count: number;
  total_file_upload_size_gb_count: number;
  copilot_calls_limit: number;
  file_upload_size_limit: number;
};

type FeatureFlagsState = {
  featureFlags: FeatureFlags | null;
  setFeatureFlags: (flags: Partial<FeatureFlags>) => void;
  usage: Usage | null;
  setUsage: (usage: Usage) => void;
  updateFeatureFlagsAndUsage: (
    flags: Partial<FeatureFlags>,
    usage: Partial<Usage>,
  ) => void;
  setFeatureFlagsAndUsage: (flags: FeatureFlags, usage: Usage) => void;
};

export const useFeatureFlagsStore = createWithEqualityFn<FeatureFlagsState>()(
  subscribeWithSelector((set) => ({
    featureFlags: null,
    usage: null,
    setUsage: (usage) => set((state) => ({ usage: { ...state.usage, ...usage } })),
    setFeatureFlags: (flags) =>
      set((state) => ({
        featureFlags: { ...state.featureFlags, ...flags },
      })),
    updateFeatureFlagsAndUsage: (flags, usage) =>
      set((state) => ({
        featureFlags: { ...state.featureFlags, ...flags },
        usage: { ...state.usage, ...usage },
      })),
    setFeatureFlagsAndUsage: (flags, usage) =>
      set(() => ({
        featureFlags: flags,
        usage: usage,
      })),
  })),
  shallow,
);

export function useShallowFeatureFlagsStore<S extends FeatureFlagsState, T>(
  selector: Selector<S, T>,
): T {
  return useFeatureFlagsStore(useShallow(selector), (prev, next) =>
    isEqual(prev, next),
  );
}
