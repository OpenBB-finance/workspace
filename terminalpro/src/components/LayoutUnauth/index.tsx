import { Outlet, useLocation } from "react-router-dom";
import { cn } from "~/lib/utils";

export default function LayoutUnauth() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col items-center justify-center md:justify-start xl:justify-center min-h-screen overflow-y-auto bg-dark-850 dark:bg-dark-850">
      <main
        className={cn(
          "only-sm:w-[90%] md:min-w-[408px] lg:min-w-[1000px] lg:py-20 2xl:py-0 py-0",
          {
            "lg:py-0": pathname === "/register",
            "w-full h-screen overflow-x-hidden overflow-y-auto lg:py-10": [
              "/onboarding",
            ].includes(pathname),
            "flex flex-col justify-center items-center": pathname === "/onboarding",
          },
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
