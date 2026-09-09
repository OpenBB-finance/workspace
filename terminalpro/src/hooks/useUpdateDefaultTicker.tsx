import { useEffect } from "react";
import { isValidMainTicker, migrateDefaultTicker } from "~/api/auth.api";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useSaveSettings } from "~/routes/settings";

export function useUpdateDefaultTicker() {
  const { defaultTicker, setDefaultTicker } = useShallowThemeStore((state) => ({
    defaultTicker: state.defaultTicker,
    setDefaultTicker: state.setDefaultTicker,
  }));

  useEffect(() => {
    if (!isValidMainTicker(defaultTicker)) {
      console.log(defaultTicker, "is missing or invalid, updating...");

      migrateDefaultTicker(defaultTicker)
        .then((newTicker) => {
          setDefaultTicker(newTicker);
        })
        .catch((error) => {
          console.error("Failed to migrate default ticker:", error);
        });
    }
  }, []);

  useSaveSettings(false);
}
