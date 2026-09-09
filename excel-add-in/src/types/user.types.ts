interface BaseUser {
  uuid: string;
  email: string;
  access_token: string;
  username: string | null;
  expiration_date: string;
  // We don't save this field (feature_entitlements) in the store,
  // but it's part of the response and used upon login
  // to check if the user has Pro access.
  // TODO: this was a patch, this validation should be done in the backend  
  feature_entitlements?: Record<string, any>;
}

export interface BackendUser extends BaseUser {
  user: UserProfile | null;
}
export interface User extends BaseUser {
  profile: UserProfile | undefined; // Existing users may not have a profile in the store
}

export interface HeaderItem {
  key: string;
  value: string;
  location: "headers" | "query";
}

export interface Backend {
  id: string;
  name: string;
  url: string;
  endpointHeaders: HeaderItem[];
  uuid: string;
  createDate: string;
  updateDate: string;
}

export interface UserProfile {
  accepted_pro_tos: boolean;
  api_sources: Backend[];
  data_connector_url: string;
  email: string;
  // entitlements: null | ProEntitlements;
  expiration_date: string;
  // features_pro_info: null | ProInfo;
  feedback_improve: null | string;
  feedback_like: null | string;
  feedback_to_pay: null | string;
  first_name: null | string;
  last_name: null | string;
  // pro_display_settings: DisplaySettings;
  single_widgets: any[];
  username: string;
  uuid: string;
}

export interface ValidationResponse {
  success: boolean;
}