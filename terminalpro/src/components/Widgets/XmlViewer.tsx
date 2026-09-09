import { useMemo } from "react";
import { useJsonData } from "~/lib/api";
import DraggableCard from "../DraggableCard";
import { AgGridProvider } from "../General/Table/hooks";
import { useWidgetContext } from "../Widget.context";

const XMLViewer = () => {
  const widget = useWidgetContext()?.widget;

  const { data, isLoading, error, dataUpdatedAt } = useJsonData<string>(
    {
      url: widget?.data?.html,
      asText: true,
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 5,
    },
  );

  const { xmlContent, structuredContent } = useMemo(() => {
    if (!data) {
      return { xmlContent: "", structuredContent: [] };
    }
    const newDoc = { xmlContent: data, structuredContent: [] };
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, "text/xml");
    const items = Array.from(xmlDoc.getElementsByTagName("item"));
    const feedItems = items.map((item) => {
      const title = item.getElementsByTagName("title")[0].textContent;
      const content = item.getElementsByTagName("description")[0].textContent;
      return { title, content };
    });
    newDoc.structuredContent = feedItems;
    return newDoc;
  }, [data]);

  return (
    <DraggableCard
      lastUpdated={dataUpdatedAt}
      error={error}
      loading={isLoading}
      extraClassName="flex flex-col gap-2 divide-y divide-gray-200"
    >
      {structuredContent.length > 0 ? (
        <AgGridProvider
          rowData={structuredContent}
          columnDefs={[
            { field: "title", headerName: "Title", flex: 1 },
            { field: "content", headerName: "Content", flex: 1 },
          ]}
        />
      ) : xmlContent && xmlContent.length > 0 ? (
        <pre
          style={{
            fontFamily: "Inter",
            whiteSpace: "pre-wrap",
            padding: "10px",
          }}
          dangerouslySetInnerHTML={{ __html: xmlContent }}
        />
      ) : null}
    </DraggableCard>
  );
};

export default XMLViewer;
