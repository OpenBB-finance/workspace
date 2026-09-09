import clsx from "clsx";
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { usePrivateRoute } from "~/hooks/usePrivateRoute";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../ds/atoms/Popover";
import Icon from "../Icon";
import MinimalLogoIcon from "../Icons/MinimalLogo";

export default function LayoutOnboarding() {
  usePrivateRoute();
  const { pathname } = useLocation();
  const number = pathname.split("/")[2]
    ? Number.parseInt(pathname.split("/")[2], 10)
    : 1;
  const [open, setOpen] = useState(false);

  const handleMouseEnter = () => {
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };
  return (
    <div className="onboarding-container relative mx-auto h-screen max-w-[1400px] px-4">
      <MinimalLogoIcon className="absolute left-3 top-3 h-4 w-8" />
      <div className="flex h-full flex-col justify-center">
        <div
          className={clsx("max-w-[600px]", {
            "h-0 opacity-0": pathname !== "/onboarding",
          })}
        >
          <h1 className="subtitle-xl-bold mb-2">Welcome to the OpenBB Workspace</h1>
        </div>
        <div>
          <Outlet />
        </div>
      </div>
      {pathname !== "/onboarding" && (
        <PopoverRoot open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="why-button absolute bottom-[80px] right-[80px] flex h-[32px] items-center gap-2 rounded bg-brand-main px-3 py-2 text-xs font-bold text-white"
          >
            <Icon id="exclamation-circle-icon" className="h-[18px] w-[18px]" />
            Why should I answer this?
          </PopoverTrigger>
          <PopoverContent
            sideOffset={8}
            alignOffset={0}
            side="top"
            align="end"
            className={clsx(
              "radix-side-bottom:animate-slide-down radix-side-top:animate-slide-up",
              "h-fit w-[345px] text-xs",
              "obb-dropdown-container",
              "bg-[#CCEEFF] dark:bg-[#151518]",
              "text-brand-main dark:text-light-100",
            )}
          >
            <p className="mb-1 font-bold">Special Template For You</p>
            <p>
              We will create a special OpenBB template based on your answers which
              includes market specific content. You can customise it further any time
              you want.
            </p>
          </PopoverContent>
        </PopoverRoot>
      )}
      {pathname !== "/onboarding" && (
        <div className="fixed bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
          {new Array(5).fill(0).map((_, i) => {
            return (
              <div
                key={i}
                className={clsx(
                  "h-[4px] w-[42.5px] first:rounded-l-lg last:rounded-r-lg",
                  {
                    "bg-light-300": i + 1 > number,
                    "bg-[#33BBFF]": i + 1 <= number,
                  },
                )}
              />
            );
          })}
        </div>
      )}
      {/*
      <button
        onClick={() => {
          updateOnboarding(false);
          navigate("/app");
        }}
        className="absolute bottom-4 right-2 text-2xs hover:underline"
      >
        Press here to skip the onboarding
    </button>*/}
    </div>
  );
}
