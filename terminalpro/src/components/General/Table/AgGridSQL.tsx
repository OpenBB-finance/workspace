import { useCallback } from "react";
import type { DBType } from "~/api/dataConnectors";
import { NamePopup, type TSaveAs } from "~/components/DataConnectors/NamePopup";
import DraggableCard from "~/components/DraggableCard";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import useIsMobile from "~/hooks/useIsMobile";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  getReset,
  measureTextWidth,
  useAgSQLSettings,
  useAgSQLState,
  useGridOptions,
  useSQLExtraActions,
  widgetIconId,
} from "./AgSQL";
import {
  AgGridProvider,
  useAgExportFuncs,
  useColumnVisibility,
  useQuickActionsSettings,
} from "./hooks";
import { useChartGeneration } from "./NavBar/useChartGeneration";

const dropdownSettings = {
  showSettings: true,
  showFunctions: true,
  showShare: true,
  showDuplicate: false,
  showExport: true,
  showMaximize: true,
  showMove: true,
};

export function AgGridSQLTable() {
  const isMobile = useIsMobile();
  const widget = useWidgetContext()?.widget;
  const dbType = widget.connectionType as DBType;

  const getWidgetsByAttribute = useShallowAppStore(
    (appState) => appState.getWidgetsByAttribute,
  );
  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);

  const [state, dispatch, handleSave] = useAgSQLState(decimalDigits);

  const sqlGridOptions = useGridOptions(dispatch);

  const handleSaveColumnVisibility = useColumnVisibility(state.decimalDigitsSettings);

  const { ChartGeneration, handleRangeSelection } = useChartGeneration({
    effectOnMount: () => {
      dispatch({
        ...getReset(widget.description ?? ""),
        loadingSave: false,
        loadingSaveAs: false,
      });
    },
  });

  const handleSaveClick = useCallback(async () => {
    dispatch({ loadingSave: true });

    const result = await handleSave();
    if (result === false) {
      dispatch({ loadingSave: false });
      return;
    }
    dispatch({
      openSettings: false,
      loadingSave: false,
      editSQL: false,
    });
  }, [handleSave, dispatch, state.dialogParams]);

  const handleSaveAsClick = useCallback(
    async (values: TSaveAs) => {
      dispatch({ loadingSaveAs: true });
      const selectedWidgets = getWidgetsByAttribute("name", values.name);
      const cleanWidgets = Object.values(selectedWidgets).flat();
      if (Object.keys(cleanWidgets).length === 0) {
        const value = await handleSave(values);
        if (value) {
          dispatch({
            openSettings: false,
            loadingSaveAs: false,
            editSQL: false,
            errorMessage: null,
          });
          return true;
        }

        dispatch({
          loadingSaveAs: false,
          errorMessage: (prev) => {
            if (prev?.includes("UNIQUE constraint failed"))
              return "Name already exists";
            return "Unexpected error occurred";
          },
        });
        return false;
      }

      dispatch({ errorMessage: "Name already exists", loadingSaveAs: false });
      return false;
    },
    [handleSave, dispatch, getWidgetsByAttribute],
  );

  // This needs to be added to enable AI, but for now its not ready
  /*
      aiData={rowData}
      aiEnabled={type === "snowflake"}
  */
  const ExtraActions = useSQLExtraActions(handleSaveClick, state, dispatch);

  const {
    settingsDialogClassname,
    settingsModalChildren,
    setOpenSettings,
    onSaveSettings,
  } = useAgSQLSettings({
    editSQL: state.editSQL,
    sqlValue: state.sqlValue,
    errorMessage: state.errorMessage,
    decimalDigitsSettings: state.decimalDigitsSettings,
    namePopup: state.namePopup,
    dialogParams: state.dialogParams,
    dispatch,
    handleSaveColumnVisibility,
  });

  const exportFns = useAgExportFuncs();
  const quickActions = useQuickActionsSettings();

  return (
    <DraggableCard
      aiEnabled={true}
      showActionsSettings={true}
      openSettings={state.openSettings}
      setOpenSettings={setOpenSettings}
      onSaveSettings={onSaveSettings}
      extraActions={ExtraActions}
      settings={dropdownSettings}
      settingsDialogClassName={settingsDialogClassname}
      settingsModalChildren={settingsModalChildren}
      exportFns={exportFns}
      elementBeforeTitle={<Icon id={widgetIconId(dbType)} className="h-4 w-4" />}
      elementNextToTitle={Object.entries(state.dialogParams ?? {}).map(([param]) => (
        <input
          key={`param-${param}`}
          type="text"
          value={state.dialogParams[param]}
          onChange={(e) => {
            const textWidth = measureTextWidth(e.target.value, "14px", "monospace");
            e.target.style.width = `${0.8 * textWidth + 20}px`;
            dispatch({
              dialogParams: (prev) => ({ ...prev, [param]: e.target.value }),
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSave();
            }
          }}
          className="obb-minimal-input text-center"
          style={{
            width: `${
              0.8 * measureTextWidth(state.dialogParams?.[param], "14px", "monospace") +
              20
            }px`,
          }}
        />
      ))}
      extraNavbarElements={
        <>
          {ChartGeneration}
          <Tooltip message="Edit the SQL" hide={isMobile}>
            <button
              onClick={() => dispatch({ editSQL: true, openSettings: true })}
              className="obb-small-navbar-btn"
            >
              <Icon id="tabler-file-type-sql" className="h-4 w-4" />
            </button>
          </Tooltip>
        </>
      }
      extraSettings={[quickActions]}
    >
      <div className={"grid h-[calc(100%-5px)] min-h-[100px]"}>
        <AgGridProvider
          columnDefs={state.columnDefs}
          rowData={state.rowData}
          rowGroupPanelShow="onlyWhenGrouping"
          onCellSelectionChanged={handleRangeSelection}
          groupDisplayType="multipleColumns"
          paginationPageSizeSelector={[500, 1000, 5000]}
          rowModelType="serverSide"
          cacheBlockSize={500}
          maxBlocksInCache={10}
          {...sqlGridOptions}
        />
        <NamePopup
          open={state.namePopup}
          setOpen={(namePopup) => dispatch({ namePopup })}
          onSaveAs={
            state.editSQL
              ? (values) => handleSaveAsClick(values)
              : () => Promise.resolve(false)
          }
          setOpenParent={(openSettings) => dispatch({ openSettings })}
        />
      </div>
    </DraggableCard>
  );
}

export default AgGridSQLTable;
