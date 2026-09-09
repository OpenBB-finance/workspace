import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSemanticViewSuggestions } from "~/components/AI/hooks/useSemanticViewSuggestions";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";

describe("useSemanticViewSuggestions", () => {
  beforeEach(() => {
    useBackendConnectorStore.setState({ semanticViews: {} });
  });

  it("returns empty options when no views available", () => {
    const { result } = renderHook(() => useSemanticViewSuggestions());
    expect(result.current.svOptions).toEqual([]);
    expect(result.current.hasSemanticViews).toBe(false);
  });

  it("derives display fields from FQN", () => {
    useBackendConnectorStore.setState({
      semanticViews: {
        "MY_DB.MY_SCHEMA.REVENUE_VIEW": {
          fqn: "MY_DB.MY_SCHEMA.REVENUE_VIEW",
          database: "MY_DB",
          schema: "MY_SCHEMA",
          viewName: "REVENUE_VIEW",
        },
      },
    });

    const { result } = renderHook(() => useSemanticViewSuggestions());
    expect(result.current.svOptions).toEqual([
      {
        type: "semanticView",
        fqn: "MY_DB.MY_SCHEMA.REVENUE_VIEW",
        database: "MY_DB",
        schema: "MY_SCHEMA",
        viewName: "REVENUE_VIEW",
        slashText: "/sv:MY_DB.MY_SCHEMA.REVENUE_VIEW",
      },
    ]);
    expect(result.current.hasSemanticViews).toBe(true);
  });

  it("returns all options when search query is empty", () => {
    useBackendConnectorStore.setState({
      semanticViews: {
        "DB.SCH.VIEW_A": {
          fqn: "DB.SCH.VIEW_A",
          database: "DB",
          schema: "SCH",
          viewName: "VIEW_A",
        },
        "DB.SCH.VIEW_B": {
          fqn: "DB.SCH.VIEW_B",
          database: "DB",
          schema: "SCH",
          viewName: "VIEW_B",
        },
      },
    });

    const { result } = renderHook(() => useSemanticViewSuggestions());
    const results = result.current.searchSemanticViews("/sv:");
    expect(results).toHaveLength(2);
  });

  it("filters views by search term", () => {
    useBackendConnectorStore.setState({
      semanticViews: {
        "DB.SCH.REVENUE": {
          fqn: "DB.SCH.REVENUE",
          database: "DB",
          schema: "SCH",
          viewName: "REVENUE",
        },
        "DB.SCH.COSTS": {
          fqn: "DB.SCH.COSTS",
          database: "DB",
          schema: "SCH",
          viewName: "COSTS",
        },
        "DB.SCH.REVENUE_DETAIL": {
          fqn: "DB.SCH.REVENUE_DETAIL",
          database: "DB",
          schema: "SCH",
          viewName: "REVENUE_DETAIL",
        },
      },
    });

    const { result } = renderHook(() => useSemanticViewSuggestions());
    const results = result.current.searchSemanticViews("/sv:REVENUE");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.fqn.includes("REVENUE"))).toBe(true);
  });

  it("handles search without trigger prefix", () => {
    useBackendConnectorStore.setState({
      semanticViews: {
        "DB.SCH.SALES": {
          fqn: "DB.SCH.SALES",
          database: "DB",
          schema: "SCH",
          viewName: "SALES",
        },
      },
    });

    const { result } = renderHook(() => useSemanticViewSuggestions());
    const results = result.current.searchSemanticViews("SALES");
    expect(results).toHaveLength(1);
    expect(results[0].fqn).toBe("DB.SCH.SALES");
  });

  it("returns empty for non-matching search", () => {
    useBackendConnectorStore.setState({
      semanticViews: {
        "DB.SCH.SALES": {
          fqn: "DB.SCH.SALES",
          database: "DB",
          schema: "SCH",
          viewName: "SALES",
        },
      },
    });

    const { result } = renderHook(() => useSemanticViewSuggestions());
    const results = result.current.searchSemanticViews("ZZZZZZZ");
    expect(results).toHaveLength(0);
  });
});
