import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    // take this back out for now until we think of a new way refetchOnWindowFocus: false
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      retryDelay: 1000,
      refetchInterval: 1000 * 60 * 15,
      refetchOnMount: false,
      refetchOnWindowFocus: (query) => {
        if (query.isStale() && !query.isActive()) {
          return true;
        }
        return false;
      },
    },
  },
});

export default queryClient;
