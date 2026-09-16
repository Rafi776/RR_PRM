import { QueryClient } from "@tanstack/react-query";

// Single module-level instance, shared by the <Providers> component (for
// the React tree) and by plain action functions in lib/actions/*.ts
// (which aren't hooks, so can't use useQueryClient()). Actions call
// `queryClient.invalidateQueries()` after a successful write instead of
// the old `revalidatePath()` — replaced wholesale rather than
// invalidating narrow keys per-action, since this is a small internal
// tool and simplicity here outweighs the extra refetching.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});
