import { useEffect, useState } from "react";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { useJsonData } from "~/lib/api";
import type { DataUrl } from "~/lib/state/copilot";
import { useWidgetContext } from "../Widget.context";

export default function ImageViewer() {
  const widget = useWidgetContext()?.widget;
  const [aiData, setAiData] = useState<DataUrl>(null);

  useEffect(() => {
    // This aiData is not used, but we update it for consistency
    const extension = widget.endpoint.url.split(".").pop();
    setAiData({
      url: widget.endpoint?.url,
      data_format: { data_type: extension, filename: widget.name },
    } as DataUrl);
  }, [widget.endpoint.url, widget.name]);

  const { data, isLoading, isError } = useJsonData(
    {
      url: widget.endpoint.url,
      addBearerToken: true,
      responseCb: async (response, resolve, reject) => {
        try {
          const objUrl = URL.createObjectURL(await response.blob());
          return resolve(objUrl);
        } catch (err) {
          reject("Failed to load image");
        }
      },
    },
    {
      staleTime: 1000 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      retryDelay: 1000,
    },
  );

  return (
    <DraggableCard
      loading={isLoading}
      error={isError}
      extraClassName="p-0!"
      aiEnabled={true}
      aiData={aiData}
      exportFns={{
        pngFunction: (title = widget.name) => {
          const extension = widget.endpoint.url.split(".").pop();

          const link = document.createElement("a");
          link.download = `${title}.${extension}`;
          link.href = data!;
          link.click();
          link.remove();
        },
      }}
    >
      <SetLoadingOnResize>
        <img src={data} alt={widget.name} className="w-full h-full object-contain" />
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
