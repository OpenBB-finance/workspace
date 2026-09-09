import { describe, expect, it, vi } from "vitest";
import {
  buildAppArtifactSource,
  buildWidgetMetadataResolver,
  buildWidgetSourceResolver,
  shouldAutoOpenAppArtifact,
} from "~/components/AI/appArtifactUtils";
import type { Item } from "~/lib/state/app";
import type { Source, WidgetMetadataItem } from "~/lib/state/backendConnector";
import type { AppArtifactT, AppArtifactWidgetRef, Copilot } from "~/lib/state/copilot";

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  createWidgetStudioWidget: (widget: WidgetMetadataItem) => ({
    widgetId: widget.widgetId,
    name: widget.name,
  }),
}));

function makeSource(name: string, widgetIds: string[]): Source {
  return {
    uuid: `uuid-${name}`,
    id: `id-${name}`,
    name,
    url: `https://${name}.example.com`,
    endpointHeaders: null,
    widgets: Object.fromEntries(
      widgetIds.map((id) => [id, { name: id, sdkFunc: "" }]),
    ) as Source["widgets"],
  };
}

describe("buildWidgetSourceResolver", () => {
  it("resolves a widget to the source whose name matches the ref origin", () => {
    const sources = [
      makeSource("Backend A", ["price"]),
      makeSource("Backend B", ["news"]),
    ];
    const refs: AppArtifactWidgetRef[] = [
      { i: "price", origin: "Backend A", widget_id: "price" },
      { i: "news", origin: "Backend B", widget_id: "news" },
    ];

    const resolve = buildWidgetSourceResolver(refs, sources);

    expect(resolve("price")?.name).toBe("Backend A");
    expect(resolve("news")?.name).toBe("Backend B");
  });

  it("disambiguates by origin when two sources expose the same widget id", () => {
    const sources = [
      makeSource("Backend A", ["price"]),
      makeSource("Backend B", ["price"]),
    ];
    const refs: AppArtifactWidgetRef[] = [
      { i: "price", origin: "Backend B", widget_id: "price" },
    ];

    const resolve = buildWidgetSourceResolver(refs, sources);

    expect(resolve("price")?.name).toBe("Backend B");
  });

  it("falls back to any source exposing the widget id when origin does not match", () => {
    const sources = [makeSource("Renamed Backend", ["price"])];
    const refs: AppArtifactWidgetRef[] = [
      { i: "price", origin: "Old Name", widget_id: "price" },
    ];

    const resolve = buildWidgetSourceResolver(refs, sources);

    expect(resolve("price")?.name).toBe("Renamed Backend");
  });

  it("returns undefined for built-in widgets no backend exposes", () => {
    const sources = [makeSource("Backend A", ["price"])];
    const refs: AppArtifactWidgetRef[] = [
      { i: "rich_note", origin: "OpenBB Workspace", widget_id: "rich_note" },
    ];

    const resolve = buildWidgetSourceResolver(refs, sources);

    expect(resolve("rich_note")).toBeUndefined();
  });

  it("dedupes repeated widget ids to a single resolved source", () => {
    const sources = [makeSource("Backend A", ["price"])];
    const refs: AppArtifactWidgetRef[] = [
      { i: "price", origin: "Backend A", widget_id: "price" },
      { i: "price", origin: "Backend A", widget_id: "price" },
    ];

    const resolve = buildWidgetSourceResolver(refs, sources);

    expect(resolve("price")?.name).toBe("Backend A");
  });
});

describe("buildAppArtifactSource", () => {
  it("derives a representative source keyed by the artifact uuid", () => {
    const artifact = {
      uuid: "artifact-123",
      type: "app",
      app: { name: "My App", tabs: {} },
      widget_refs: [],
    } as unknown as AppArtifactT;

    const source = buildAppArtifactSource(artifact);

    expect(source.uuid).toBe("artifact-123");
    expect(source.url).toBe("");
    expect(source.endpointHeaders).toBeNull();
    expect(typeof source.name).toBe("string");
  });
});

describe("buildWidgetMetadataResolver", () => {
  const widgetMetadata = [
    { widgetId: "abc", widgetType: "widget_studio", name: "Custom Studio" },
    { widgetId: "def", widgetType: "endpoint", name: "Not Studio" },
  ] as unknown as WidgetMetadataItem[];

  it("resolves a widget_studio widget by its prefixed id", () => {
    const resolve = buildWidgetMetadataResolver(widgetMetadata);
    expect(resolve("widget_studio-abc")).toMatchObject({ widgetId: "abc" });
  });

  it("returns undefined for non-studio, unknown, or unprefixed ids", () => {
    const resolve = buildWidgetMetadataResolver(widgetMetadata);
    expect(resolve("widget_studio-def")).toBeUndefined();
    expect(resolve("widget_studio-zzz")).toBeUndefined();
    expect(resolve("abc")).toBeUndefined();
  });
});

describe("shouldAutoOpenAppArtifact", () => {
  const features = { "generative-ui": true } as Copilot["features"];
  const emptyDashboard = { data: { widgets: [] } } as unknown as Item;

  it("returns true on an empty dashboard with generative UI enabled", () => {
    expect(
      shouldAutoOpenAppArtifact({
        generativeUiEnabled: true,
        features,
        currentDashboardItem: emptyDashboard,
      }),
    ).toBe(true);
  });

  it("returns false when generative UI is globally disabled", () => {
    expect(
      shouldAutoOpenAppArtifact({
        generativeUiEnabled: false,
        features,
        currentDashboardItem: emptyDashboard,
      }),
    ).toBe(false);
  });

  it("returns false when the agent lacks the generative-ui feature", () => {
    expect(
      shouldAutoOpenAppArtifact({
        generativeUiEnabled: true,
        features: { "generative-ui": false } as Copilot["features"],
        currentDashboardItem: emptyDashboard,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenAppArtifact({
        generativeUiEnabled: true,
        features: undefined,
        currentDashboardItem: emptyDashboard,
      }),
    ).toBe(false);
  });

  it("returns false when the dashboard already has widgets", () => {
    expect(
      shouldAutoOpenAppArtifact({
        generativeUiEnabled: true,
        features,
        currentDashboardItem: {
          data: { widgets: [{ id: "w" }] },
        } as unknown as Item,
      }),
    ).toBe(false);
  });

  it("returns false for a folder or a missing dashboard", () => {
    expect(
      shouldAutoOpenAppArtifact({
        generativeUiEnabled: true,
        features,
        currentDashboardItem: {
          isFolder: true,
          data: { widgets: [] },
        } as unknown as Item,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenAppArtifact({
        generativeUiEnabled: true,
        features,
        currentDashboardItem: null,
      }),
    ).toBe(false);
  });
});
