/**
 * Backend filter selection model.
 *
 * Tri-state to distinguish "show all" from "none picked yet":
 *   - `null`     — "all backends selected" sentinel; no filter applied.
 *   - `[]`       — explicit none; filter shows no apps (user is mid-pick).
 *   - `[a, b]`   — show only these backends.
 *
 * Collapses a now-complete selection back to `null` so the checkbox group and
 * the active filter never disagree.
 */
export type SelectedBackends = string[] | null;

export function isAllBackendsSelected(
  selected: SelectedBackends,
  allIds: string[],
): boolean {
  if (allIds.length === 0) return true;
  if (selected === null) return true;
  return selected.length === allIds.length;
}

export function isNoneBackendsSelected(
  selected: SelectedBackends,
  allIds: string[],
): boolean {
  return allIds.length > 0 && selected !== null && selected.length === 0;
}

/**
 * Next selection after toggling a single backend checkbox.
 *
 * Materializes the "all" sentinel into explicit ids before removing one, and
 * collapses a now-complete selection back to the sentinel. Unchecking the last
 * remaining backend yields the empty array ("none"), so the user can then pick
 * exactly the one they want without manually unchecking every other.
 */
export function toggleBackendSelection(
  selected: SelectedBackends,
  allIds: string[],
  backendId: string,
  checked: boolean,
): SelectedBackends {
  const base = selected === null ? allIds : selected;

  const next = checked
    ? base.includes(backendId)
      ? base
      : [...base, backendId]
    : base.filter((id) => id !== backendId);

  if (next.length === allIds.length) return null;
  return next;
}
