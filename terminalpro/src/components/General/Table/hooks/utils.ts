import type { ColumnState, GridState } from "ag-grid-enterprise";
import { useEffect, useRef } from "react";
import type { SavedState } from "./types";

export function isColumnState(obj: any): obj is ColumnState[] {
  return Array.isArray(obj);
}

export function isSavedState(obj: any): obj is SavedState {
  return obj?.hiddenColIds || obj?.orderedColIds || obj?.columnSizingModel;
}

export function getAverageWidth(columnSizingModel: SavedState["columnSizingModel"]) {
  if (!columnSizingModel) return 100;
  return (
    columnSizingModel
      ?.filter((size) => size.colId !== "Index")
      ?.reduce((acc, size) => acc + (size.width || 100), 0) /
      (columnSizingModel.length - 1) || 100
  );
}

export function getSavedState(state: GridState): SavedState | GridState {
  if (state?.columnOrder || state?.columnSizing || state?.columnVisibility) {
    return {
      ...(state?.columnOrder ?? {}),
      ...(state?.columnSizing ?? {}),
      ...(state?.columnVisibility ?? {}),
      ...(state?.columnPinning ?? {}),
      ...(state?.columnGroup ?? {}),
      ...(state?.rowGroup ?? {}),
      ...(state?.rowGroupExpansion ?? {}),
      ...(state?.aggregation ?? {}),
      ...(state?.scroll ? { scroll: state.scroll } : {}),
      ...(state?.sideBar ? { sideBar: state.sideBar } : {}),
    } as SavedState;
  }

  return state;
}

export function newColumnState(
  currentColumnState: ColumnState[],
  savedColumnState: SavedState,
): ColumnState[] {
  const { columnSizingModel, orderedColIds, hiddenColIds, groupColIds } =
    savedColumnState;

  const pinned = Object.entries(savedColumnState).reduce(
    (acc, curr) => {
      const [key, value] = curr as [string, any];
      if (key === "leftColIds" || key === "rightColIds") {
        for (const colId of value) {
          acc[colId.toString()] = key.replace("ColIds", "") as "left" | "right";
        }
      }
      return acc;
    },
    {} as Record<string, "left" | "right">,
  );

  const aggregation = (savedColumnState?.aggregationModel || [])?.reduce(
    (acc, model) => {
      acc[model.colId] = model;
      return acc;
    },
    {} as Record<string, SavedState["aggregationModel"][0]>,
  );

  const savedOrderIndexer = (orderedColIds || [])?.reduce(
    (acc, colId, index) => {
      acc[colId] = index;
      return acc;
    },
    {} as Record<string, number>,
  );

  const currentOrderIndexer = (currentColumnState || [])?.reduce(
    (acc, col, index) => {
      acc[col.colId] = index;
      return acc;
    },
    {} as Record<string, number>,
  );

  const avgSize = getAverageWidth(currentColumnState || columnSizingModel);

  return currentColumnState
    .map((col) => {
      const rowGroupIndex = groupColIds?.indexOf(col.colId);

      const size = columnSizingModel?.find((s) => s.colId === col.colId);
      col.hide = size ? hiddenColIds?.includes(col.colId) : col.hide;
      col.pinned = pinned?.[col.colId] ?? col.pinned;
      col.aggFunc = aggregation?.[col.colId]?.aggFunc ?? col.aggFunc;
      col.rowGroup = groupColIds?.includes(col.colId) ?? col.rowGroup;
      col.rowGroupIndex = rowGroupIndex === -1 ? col.rowGroupIndex : rowGroupIndex;

      if (size) {
        col.width = size.width;
        col.flex = size.flex;
      } else {
        col.width = Math.ceil(avgSize);
      }

      return col;
    }, [] as ColumnState[])
    .sort((a, b) => {
      const savedAB = [savedOrderIndexer[a.colId], savedOrderIndexer[b.colId]];
      const currentAB = [currentOrderIndexer[a.colId], currentOrderIndexer[b.colId]];

      const aIndex = savedAB[0] ?? currentAB[0];
      const bIndex = savedAB[1] ?? currentAB[1];

      if (aIndex === undefined || bIndex === undefined) return 0;

      return aIndex - bIndex;
    });
}

export function fromOldColumnState(
  currentColumnState: ColumnState[],
  savedColumnState: ColumnState[],
): ColumnState[] {
  // need this for quarterly data
  if (currentColumnState) {
    savedColumnState = [];

    for (const column of currentColumnState) {
      const found = savedColumnState.find((c) => c.colId === column.colId);
      savedColumnState.push(found || column);
    }

    // sort the columns based on the saved column state
    savedColumnState.sort((a, b) => {
      const aIndex = savedColumnState.findIndex((c) => c.colId === a.colId);
      const bIndex = savedColumnState.findIndex((c) => c.colId === b.colId);
      const aCurrentIndex = currentColumnState.findIndex((c) => c.colId === a.colId);
      const bCurrentIndex = currentColumnState.findIndex((c) => c.colId === b.colId);

      if (aIndex === -1 || bIndex === -1) return 0;
      return aIndex - bIndex || aCurrentIndex - bCurrentIndex;
    });

    return savedColumnState;
  }
  return currentColumnState;
}

export function getSavedColumnState(
  currentColumnState: ColumnState[],
  savedColumnState: any,
): ColumnState[] {
  return isSavedState(savedColumnState)
    ? newColumnState(currentColumnState, savedColumnState)
    : fromOldColumnState(currentColumnState, savedColumnState);
}

export function useIsFirstRender() {
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;

    return () => {
      isFirstRender.current = true;
    };
  }, []);
  return isFirstRender.current;
}
