import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { inSnowflakeNativeApp } from "./constants";
import { isOnPremDeployment } from "./onPremFeatureFlags";

/**
 * Gates the developer marketplace submission flow (List app -> fill listing ->
 * run tests -> submit for review). Runtime per-user capability sourced from the
 * `can_submit_marketplace` flag on the login / validate-and-sync payload (superuser
 * or whitelisted), so a mid-session whitelist toggle surfaces on the next sync
 * without a relogin. Snowflake and on-prem deployments never expose the flow.
 */
export function useCanSubmitApp(): boolean {
  const canSubmit = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.can_submit_marketplace ?? false,
  );
  return canSubmit && !inSnowflakeNativeApp && !isOnPremDeployment();
}
