import type { User } from "~/types/user.type";
import { Tag } from "../ds/atoms/Tag";

const statusColors = {
  pending: "warning",
  verified: "success",
} as const;

interface Props {
  value: User["status"];
}

export default function AdminUserStatus(props: Props) {
  const { value } = props;
  const displayValue = value.replace("active", "verified") || "-";
  const color = statusColors[displayValue.toLowerCase()] || "grey";
  return (
    <Tag data-testid="user-status" color={color} className="capitalize w-fit">
      {displayValue}
    </Tag>
  );
}
