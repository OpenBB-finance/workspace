import { NavLink, type NavLinkProps } from "react-router-dom";
import { cn } from "~/lib/utils";
import Icon from "../Icon";
import type { IconId } from "../Icon.types";

interface Props extends NavLinkProps {
  icon?: IconId;
}

export default function SidebarNavButton(props: Props) {
  const { className, title, icon, ...rest } = props;

  return (
    <NavLink
      {...rest}
      title={title}
      className={cn(
        "obb-navigation-item @max-[100px]:h-8 @max-[100px]:w-8!",
        className,
      )}
    >
      <Icon id={icon} className="h-4 min-w-[16px]" />
      <span className="flex-1 truncate @max-[100px]:hidden">{title}</span>
    </NavLink>
  );
}
