import { TooltipProvider } from "@openbb/ui";
import { QueryClient, QueryClientProvider } from "react-query";
import { RouterProvider } from "react-router-dom";

import "~/functions/functions";
import { router } from "~/utils/router.tsx";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
