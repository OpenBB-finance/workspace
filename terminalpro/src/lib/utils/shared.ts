import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "../state/app";

export function duplicateDashboard(item: any) {
  const id = uuidv4();
  useAppStore.getState().addTab({
    index: id,
    data: {
      name: `${item.data?.name} (Duplicate)`,
      type: "custom",
      widgets: item.data?.widgets,
      groups: item.data?.groups,
      gridLayout: item.data?.gridLayout,
    },
  });
  toast.success("Duplicated dashboard", {
    description: "You were moved into the new dashboard",
  });
  return id;
}
