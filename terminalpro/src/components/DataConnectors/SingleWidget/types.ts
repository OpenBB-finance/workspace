import { z } from "zod";
import type { StateDispatch } from "~/hooks/useStateReducer";
import { CATEGORY_OPTIONS } from "../common/helpers";

export type SingleWidgetDialogState = {
  dataKeyError?: string;
  selectOptions: { path: string; count: string | number }[];
  isTested: boolean;
  loading: boolean;
};

export const WidgetSchema = z.object({
  name: z.string().min(1, "This field is required"),
  description: z.string().optional(),
  category: z.enum(CATEGORY_OPTIONS).optional(),
  subCategory: z.string().optional(),
  source: z.string().optional(),
  endpoint: z.string().min(1, "This field is required"),
  dataKey: z.string().optional(),
  endpointHeaders: z
    .array(
      z.object({
        key: z.string().min(1, "This field is required"),
        value: z.string().min(1, "This field is required"),
      }),
    )
    .optional(),
});

export type SingleWidgetFormT = z.infer<typeof WidgetSchema>;

export type SingleWidgetInfoProps = {
  dispatch: StateDispatch<SingleWidgetDialogState>;
  state: SingleWidgetDialogState;
  onTestSource: (values: SingleWidgetFormT) => void;
};
