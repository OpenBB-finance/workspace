import { getConfig } from "~/lib/runtimeConfig";
import { useShallowThemeStore } from "~/lib/state/theme";

export default function NoItems() {
  const theme = useShallowThemeStore((state) => state.theme);
  const { leftSidebarLogo, leftSidebarLogoDark, name } = getConfig().whiteLabel;

  return (
    <div className="w-screen h-screen overflow-hidden flex items-center justify-center">
      <div className="flex flex-col gap-1 items-center">
        {leftSidebarLogo ? (
          <img
            className="w-[200px] object-contain opacity-50"
            src={
              theme === "dark" && leftSidebarLogoDark
                ? leftSidebarLogoDark
                : leftSidebarLogo
            }
            alt={name || "OpenBB"}
          />
        ) : (
          <img
            className="w-[200px] object-cover opacity-50"
            src={`/assets/images/loading-bb-${theme === "dark" ? "white" : "dark"}.gif`}
            alt="OpenBB"
          />
        )}
        <p className="subtitle-sm-bold mt-2 text-light-300 dark:text-dark-700">
          Loading
          <span className="inline-flex gap-0.5 ml-0.5 items-end pb-0.5">
            <span className="size-[3px] bg-current rounded-full animate-pulse" />
            <span className="size-[3px] bg-current rounded-full animate-pulse [animation-delay:200ms]" />
            <span className="size-[3px] bg-current rounded-full animate-pulse [animation-delay:400ms]" />
          </span>
        </p>
      </div>
    </div>
  );
}
