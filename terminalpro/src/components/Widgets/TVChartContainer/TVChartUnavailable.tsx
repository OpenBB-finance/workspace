import { forwardRef, memo } from "react";
import type {
  ChartingLibraryWidget,
  TVChartContainerProps,
} from "./TVChartContainerFunc";

const TVChartUnavailable = forwardRef<ChartingLibraryWidget, TVChartContainerProps>(
  ({ extraClassName }, _ref) => (
    <div role="alert" data-testid="tv-chart-unavailable" className={extraClassName}>
      Advanced charts are unavailable in this workspace. Choose another chart widget.
    </div>
  ),
);

TVChartUnavailable.displayName = "TVChartUnavailable";

export default memo(TVChartUnavailable);
