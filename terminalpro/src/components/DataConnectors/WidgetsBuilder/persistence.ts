import type { FormState, WidgetConfiguration } from "./types";

const WIDGET_BUILDER_STORAGE_KEY = "widget_builder_state";
const WIDGET_CONFIG_STORAGE_KEY = "widget_config_state";

export interface PersistedFormState {
  endpoint: string;
  authRequired: boolean;
  authHeaderKey: string;
  tokenBearer: string;
  dataOrigin: "new_endpoint" | "existing_widget";
  selectedBackend: string;
  selectedWidget: string;
  activeConfigTab: "ui" | "json";
  jsonValue: string;
}

export function saveFormStateToStorage(state: FormState): void {
  const persistableState: PersistedFormState = {
    endpoint: state.endpoint,
    authRequired: state.authRequired,
    authHeaderKey: state.authHeaderKey,
    tokenBearer: state.tokenBearer,
    dataOrigin: state.dataOrigin,
    selectedBackend: state.selectedBackend,
    selectedWidget: state.selectedWidget,
    activeConfigTab: state.activeConfigTab,
    jsonValue: state.jsonValue,
  };
  try {
    localStorage.setItem(WIDGET_BUILDER_STORAGE_KEY, JSON.stringify(persistableState));
  } catch (error) {
    console.warn("Failed to save form state to localStorage:", error);
  }
}

export function loadFormStateFromStorage(): Partial<PersistedFormState> | null {
  try {
    const saved = localStorage.getItem(WIDGET_BUILDER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn("Failed to load form state from localStorage:", error);
    return null;
  }
}

export function saveWidgetConfigToStorage(config: WidgetConfiguration): void {
  try {
    localStorage.setItem(WIDGET_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn("Failed to save widget config to localStorage:", error);
  }
}

export function loadWidgetConfigFromStorage(): WidgetConfiguration | null {
  try {
    const saved = localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn("Failed to load widget config from localStorage:", error);
    return null;
  }
}

export function clearWidgetBuilderStorage(): void {
  try {
    localStorage.removeItem(WIDGET_BUILDER_STORAGE_KEY);
    localStorage.removeItem(WIDGET_CONFIG_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear widget builder storage:", error);
  }
}
