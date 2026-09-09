/** biome-ignore-all lint/style/useReactFunctionComponents: Ag-Grid cell renderer */
import {
  type BeanCollection,
  Component,
  type FilterManager,
  type ICellRenderer,
} from "ag-grid-community";
import type { WidgetColumnDefT } from "~/components/types";
import { formatPrice } from "~/components/Widgets/Pyth/utils";
import { getColorStyle } from "./CellOnHover";

const ARROW_UP = "\u2191";
const ARROW_DOWN = "\u2193";

class AnimateShowChangeCellRenderer extends Component implements ICellRenderer {
  private static TEMPLATE = `<span class="whitespace-nowrap">
  <span class="ag-value-change-delta"></span>   <span class="ag-value-change-value"/></span>
  </span>`;

  // private params: any;
  private lastValue: number;
  private colorValueKey: number;
  private colorRules: WidgetColumnDefT["renderFnParams"]["colorRules"];

  private eValue: HTMLElement;
  private eDelta: HTMLElement;
  private eSpan: HTMLElement;

  private refreshCount = 0;

  private filterManager?: FilterManager;

  public wireBeans(beans: BeanCollection): void {
    this.filterManager = beans.filterManager;
  }

  constructor() {
    super();

    const template = document.createElement("div");
    template.innerHTML = AnimateShowChangeCellRenderer.TEMPLATE;

    this.setTemplateFromElement(template);
  }

  public init(params: any): void {
    // this.params = params;

    this.eValue = this.queryForHtmlElement(".ag-value-change-value");
    this.eDelta = this.queryForHtmlElement(".ag-value-change-delta");
    this.eSpan = this.getGui();
    this.colorValueKey = params.colorValueKey;
    this.colorRules = params.colorRules;

    this.refresh(params);
  }

  private showDelta(_params: any, delta: number): void {
    const absDelta = Math.abs(delta);
    const valueFormatted = formatPrice(absDelta);

    const valueToUse = valueFormatted ? valueFormatted : absDelta;

    const deltaUp = delta >= 0;

    if (deltaUp) {
      this.eDelta.innerHTML = ARROW_UP + valueToUse;
    } else {
      // because negative, use ABS to remove sign
      this.eDelta.innerHTML = ARROW_DOWN + valueToUse;
    }

    this.eDelta.classList.toggle("ag-value-change-delta-up", deltaUp);
    this.eDelta.classList.toggle("ag-value-change-delta-down", !deltaUp);
  }

  private setTimerToRemoveDelta(): void {
    // the refreshCount makes sure that if the value updates again while
    // the below timer is waiting, then the below timer will realise it
    // is not the most recent and will not try to remove the delta value.
    this.refreshCount++;
    const refreshCountCopy = this.refreshCount;
    window.setTimeout(() => {
      if (refreshCountCopy === this.refreshCount) {
        this.hideDeltaValue();
      }
    }, 2000);
  }

  private hideDeltaValue(): void {
    this.eValue.classList.remove("ag-value-change-value-highlight");
    this.eDelta.innerHTML = "";
  }

  public refresh(params: any): boolean {
    const value = params.value;
    this.eSpan.title = value;

    if (value === this.lastValue) {
      return false;
    }

    if (params.valueFormatted) {
      this.eValue.innerHTML = params.valueFormatted;
    } else if (params.value) {
      this.eValue.innerHTML = value;
    } else {
      this.eValue.innerHTML = "";
    }

    // we don't show the delta if we are in the middle of a filter. see comment on FilterManager
    // with regards processingFilterChange
    if (this.filterManager.isSuppressFlashingCellsBecauseFiltering()) {
      return false;
    }

    if (typeof value === "number" && typeof this.lastValue === "number") {
      const delta = value - this.lastValue;
      this.showDelta(params, delta);
    }

    // highlight the current value, but only if it's not new, otherwise it
    // would get highlighted first time the value is shown
    if (this.lastValue) {
      this.eValue.classList.add("ag-value-change-value-highlight");
    }

    const colorValue = params.data?.[params.colorValueKey] ?? value;
    const colorStyle = getColorStyle({
      color: true,
      value,
      colorValue,
      colorRules: this.colorRules,
    });

    const existingClasses = this.eSpan.className.split(" ");
    for (const className of existingClasses) {
      if (
        className.startsWith("text-") ||
        className.startsWith("pr-") ||
        className.startsWith("pl-")
      ) {
        this.removeCss(className);
      }
    }

    if (typeof colorValue === "number") {
      this.addCss("pr-1");
      this.eSpan.style.color = "";
      if (colorStyle.color) {
        this.eSpan.style.color = colorStyle.color;
      } else if (colorValue > 0) {
        this.addCss("text-green-500");
      } else {
        this.addCss("text-red-500");
      }
    } else {
      if (colorStyle.color) {
        this.eSpan.style.color = colorStyle.color;
      } else {
        this.eSpan.style.color = "";
      }
      this.addCss("pl-1");
    }

    this.setTimerToRemoveDelta();

    this.lastValue = params.value;
    this.colorValueKey = params.colorValueKey;

    return true;
  }
}

export default AnimateShowChangeCellRenderer;
