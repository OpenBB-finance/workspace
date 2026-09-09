import DraggableCard from "~/components/DraggableCard";
import type { Widget } from "~/lib/state/app";

export default function PyScript({
  widget,
  activeDashboardId,
}: {
  widget: Widget;
  activeDashboardId: string;
}) {
  return (
    <DraggableCard
      // @ts-expect-error - ignored for now
      widget={widget}
      activeDashboardId={activeDashboardId}
      title="Python Emulator"
    >
      <div
        dangerouslySetInnerHTML={{
          __html: `
          <py-repl>
            ${widget.data.html ? widget.data.html : ""}
          </py-repl>
          `,
        }}
      />
    </DraggableCard>
  );
}
