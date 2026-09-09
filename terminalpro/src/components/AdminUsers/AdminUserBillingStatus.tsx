import type { User } from "~/types/user.type";
import { Tag } from "../ds/atoms/Tag";

const statusColors = {
  inactive: "grey",
  active: "success",
} as const;

interface Props {
  value: User["billing_active"];
}

export default function AdminUserBillingStatus(props: Props) {
  const { value } = props;
  const displayValue = value ? "Active" : "Inactive";
  const color = statusColors[displayValue.toLowerCase()] || "grey";
  return (
    <Tag color={color} className="capitalize">
      {displayValue}
    </Tag>
  );
}
