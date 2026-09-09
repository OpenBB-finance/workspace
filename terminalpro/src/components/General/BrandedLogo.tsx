import Icon from "~/components/Icon";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";

interface BrandedLogoProps {
  className?: string;
  animate?: boolean;
}

export default function BrandedLogo({ className, animate = true }: BrandedLogoProps) {
  const theme = useShallowThemeStore((state) => state.theme);
  const { leftSidebarLogo, leftSidebarLogoDark, name } = getConfig().whiteLabel;

  if (leftSidebarLogo) {
    return (
      <img
        className={cn(
          "max-w-[200px] w-full max-h-full object-contain opacity-50",
          animate && "animate-pulse",
          className,
        )}
        src={
          theme === "dark" && leftSidebarLogoDark
            ? leftSidebarLogoDark
            : leftSidebarLogo
        }
        alt={name || "OpenBB"}
      />
    );
  }

  return (
    <Icon
      id="openbb-butterfly-logo"
      className={cn(
        "h-[50px] w-[100px] text-ds-text-caption",
        animate && "animate-pulse",
        className,
      )}
    />
  );
}
