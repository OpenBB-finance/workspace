import DOMPurify from "dompurify";
import { v4 as uuidv4 } from "uuid";
import type { WidgetT } from "~/components/types";
import type { ArtifactT, Citation } from "~/lib/state/copilot";
import { HTML_SANITIZE_CONFIG, sanitizeHtml } from "~/lib/utils/sanitize";
import {
  applyChartViewToWidget,
  buildChartColumnDefs,
  sanitizeTableContent,
} from "./createWidgetUtils";

export const GENERATIVE_WIDGET_DEFAULT_GRID = { x: 0, y: 0, w: 40, h: 12 };

interface BaseWidgetMetadata {
  uuid?: string;
  name: string;
  description?: string;
  citations?: Citation[];
  artifacts?: ArtifactT[];
}

interface ChartWidgetMetadata extends BaseWidgetMetadata {
  xKey: string;
  yKey: string[];
  chartType: string;
  angleKey?: string;
  calloutLabelKey?: string;
}

/**
 * Sanitizes content by removing dots from keys (AG Grid doesn't handle dots well)
 */
export function sanitizeContent(
  content: Record<string, unknown>[],
): Record<string, unknown>[] {
  return sanitizeTableContent(content);
}

/**
 * Builds a chart widget with proper columnDefs and chartView settings
 * Uses copilot_table with chartView.enabled for consistency with artifact flow
 */
export function buildChartWidget(
  content: Record<string, unknown>[],
  metadata: ChartWidgetMetadata,
): WidgetT {
  const { uuid, name, description, xKey, yKey, chartType, angleKey, calloutLabelKey } =
    metadata;
  const widgetUuid = uuid || uuidv4();
  const sanitizedContent = sanitizeContent(content);
  const columnDefs = buildChartColumnDefs({
    xKey,
    yKey,
    chartType,
    angleKey,
    calloutLabelKey,
  });

  return applyChartViewToWidget(
    {
      id: widgetUuid,
      name,
      description,
      type: "custom",
      widgetId: `copilot_table-${widgetUuid}`,
      gridData: { ...GENERATIVE_WIDGET_DEFAULT_GRID, i: widgetUuid },
      data: {
        table: {
          showAll: true,
          enableCharts: true,
        },
      },
      storage: {
        rowsData: sanitizedContent,
        columnDefs,
      },
    } as WidgetT,
    { enabled: true, chartType },
  );
}

/**
 * Builds a table widget with auto-generated columnDefs
 */
export function buildTableWidget(
  content: Record<string, unknown>[],
  metadata: BaseWidgetMetadata,
): WidgetT {
  const { uuid, name, description } = metadata;
  const widgetUuid = uuid || uuidv4();
  const sanitizedContent = sanitizeContent(content);

  const columns = sanitizedContent[0] ? Object.keys(sanitizedContent[0]) : [];

  return {
    id: widgetUuid,
    name,
    description,
    type: "custom",
    widgetId: `copilot_table-${widgetUuid}`,
    gridData: { ...GENERATIVE_WIDGET_DEFAULT_GRID, i: widgetUuid },
    data: {
      table: {
        showAll: true,
        enableCharts: true,
        chartView: { chartType: "line" },
      },
    },
    storage: {
      rowsData: sanitizedContent,
      columns,
    },
  } as WidgetT;
}

/**
 * Builds an HTML widget from raw HTML content (no markdown conversion)
 */
export function buildHtmlWidget(
  content: string,
  metadata: BaseWidgetMetadata,
): WidgetT {
  const { uuid, name, description } = metadata;
  const widgetUuid = uuid || uuidv4();

  const html = DOMPurify.sanitize(content, {
    ...HTML_SANITIZE_CONFIG,
    WHOLE_DOCUMENT: true,
  });

  return {
    id: widgetUuid,
    name,
    description,
    type: "custom",
    widgetId: `html-${widgetUuid}`,
    gridData: { ...GENERATIVE_WIDGET_DEFAULT_GRID, i: widgetUuid },
    storage: { html },
  } as WidgetT;
}

/**
 * Builds a note widget with markdown-to-HTML conversion
 */
export function buildNoteWidget(
  content: string,
  metadata: BaseWidgetMetadata,
): WidgetT {
  const { uuid, name, description, citations, artifacts } = metadata;
  const widgetUuid = uuid || uuidv4();

  if (citations?.length || artifacts?.length) {
    return {
      id: widgetUuid,
      name,
      description,
      type: "custom",
      widgetId: "markdown",
      gridData: { ...GENERATIVE_WIDGET_DEFAULT_GRID, i: widgetUuid },
      storage: {
        text: content,
        citations: citations ?? [],
        artifacts: artifacts ?? [],
      },
    } as WidgetT;
  }

  // Remove citation tags if present
  const contentWithoutCitations = content.replace(
    /(?:\.\s*)?<citation>.*?<\/citation>(\s*\.)?/g,
    "$1",
  );

  const html = sanitizeHtml(contentWithoutCitations);

  return {
    id: widgetUuid,
    name: name ?? "Note",
    description,
    type: "custom",
    widgetId: `rich_note-${widgetUuid}`,
    gridData: { ...GENERATIVE_WIDGET_DEFAULT_GRID, i: widgetUuid },
    storage: { html },
  } as WidgetT;
}
