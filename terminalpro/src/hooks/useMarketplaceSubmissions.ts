import { useMutation, useQuery } from "@tanstack/react-query";
import {
  deleteSubmission,
  listSubmissions,
  MARKETPLACE_SUBMISSIONS_QUERY_KEY,
  runTests,
  submitForReview,
} from "~/api/marketplaceSubmission.api";
import queryClient from "~/queryClient";

/**
 * React Query layer over the submission service. Reads come from
 * {@link listSubmissions} (backend apps + local drafts); every mutation
 * invalidates the list so owner cards (My Apps menu, marketplace tab) reflect
 * the new status. Review outcomes (approve/reject) happen out of band, so the
 * list refetches on focus/mount to pick them up.
 */
export function useMarketplaceSubmissions() {
  return useQuery({
    queryKey: MARKETPLACE_SUBMISSIONS_QUERY_KEY,
    queryFn: listSubmissions,
    staleTime: 30_000,
  });
}

function invalidate() {
  queryClient.invalidateQueries({ queryKey: MARKETPLACE_SUBMISSIONS_QUERY_KEY });
}

export function useRunSubmissionTests() {
  return useMutation({
    mutationFn: (vars: Parameters<typeof runTests>) => runTests(...vars),
  });
}

export function useSubmitForReview() {
  return useMutation({
    mutationFn: (vars: Parameters<typeof submitForReview>) => submitForReview(...vars),
    onSuccess: invalidate,
  });
}

export function useDeleteSubmission() {
  return useMutation({ mutationFn: deleteSubmission, onSuccess: invalidate });
}
