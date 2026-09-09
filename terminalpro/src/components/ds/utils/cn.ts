import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { typographyClassGroup } from "../plugins/typography";

type AdditionalClassGroupIds = "typography";

export const twMerge = extendTailwindMerge<AdditionalClassGroupIds>({
  extend: {
    classGroups: {
      typography: typographyClassGroup,
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
