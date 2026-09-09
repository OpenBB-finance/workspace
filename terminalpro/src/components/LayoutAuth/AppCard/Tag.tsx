import { cn } from "~/components/ds/utils";

export type TagColor =
  | "pink"
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "orange"
  | "coral"
  | "turquoise"
  | "grey"
  | "burgundy"
  | "purple"
  | "brand";

const colorClasses: Record<TagColor, string> = {
  pink: "bg-tag-pink-bg text-tag-pink-label",
  blue: "bg-tag-blue-bg text-tag-blue-label",
  green: "bg-tag-green-bg text-tag-green-label",
  red: "bg-tag-red-bg text-tag-red-label",
  yellow: "bg-tag-yellow-bg text-tag-yellow-label",
  orange: "bg-tag-orange-bg text-tag-orange-label",
  coral: "bg-tag-coral-bg text-tag-coral-label",
  turquoise: "bg-tag-turquoise-bg text-tag-turquoise-label",
  grey: "bg-tag-grey-bg text-tag-grey-label",
  burgundy: "bg-tag-burgundy-bg text-tag-burgundy-label",
  purple: "bg-tag-purple-bg text-tag-purple-label",
  brand: "bg-tag-brand-bg text-tag-brand-label",
};

export function Tag({ name, color = "grey" }: { name: string; color?: TagColor }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap flex gap-0.5 items-center rounded-2xl px-2 py-0.5 text-xs w-fit",
        colorClasses[color],
      )}
    >
      <span className="max-w-[140px] truncate">{name}</span>
    </span>
  );
}
