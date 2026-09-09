import { useNavigate } from "react-router-dom";
import { ExtensionOptions } from "~/lib/constants";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import DragFileHere from "../AI/DragFileHere";
import { Button } from "../ds/atoms/Button";
import { useDragAndDropFiles } from "../GridLayout.hooks";
import Icon from "../Icon";

// temporary until first empty dashboard mockup cta is implemented
const isFirstLogin = false;

export default function EmptyDashboardCTA({ locked = false }: { locked?: boolean }) {
  const navigate = useNavigate();
  /*const { isFirstLogin } = useAuthStore((state) => ({
    isFirstLogin: state.isFirstLogin,
  }));*/
  const { changeSearch, setInitialSelectedSearchTab } = useShallowThemeStore(
    (state) => ({
      changeSearch: state.changeSearch,
      setInitialSelectedSearchTab: state.setInitialSelectedSearchTab,
    }),
  );

  function openWidgetSearch() {
    setInitialSelectedSearchTab("widgets");
    changeSearch(true);
  }

  function openTemplateSearch() {
    navigate("/app");
  }

  const { getRootProps, getInputProps, isDragActive } = useDragAndDropFiles(locked);

  return (
    <div
      {...getRootProps()}
      className={cn(
        "h-full w-full relative only-sm:px-4 only-sm:h-[calc(100vh-50px)]",
        {
          "flex flex-col gap-2.5 px-2 py-1": isFirstLogin,
          "@container/dashboard flex flex-col items-center justify-center px-2 @min-[700px]/dashboard:px-10 @min-[900px]/dashboard:px-20":
            !isFirstLogin,
        },
      )}
    >
      <input id="dashboard-file-upload" {...getInputProps()} />
      {isDragActive && (
        <div className="absolute mx-2 my-1 inset-0 z-50 flex items-center justify-center">
          <DragFileHere />
        </div>
      )}
      {isFirstLogin ? (
        <>
          <div className="bg-brand-darker text-white p-2.5 h-16 rounded">
            <p className="body-sm-bold">Build a new dashboard</p>
            <p className="mt-1 body-xs-regular">
              Your dashboard is empty. Choose from the options below to add content.
            </p>
          </div>
          <div className="dark:bg-[#1F1E23B8] p-2.5 h-[247px] rounded border dark:border-dark-800 bg-white border-light-300 flex flex-col">
            <p className="body-xs-bold dark:text-white text-light-900">
              Add a new widget or an app
            </p>
            <p className="mt-1 body-xs-regular dark:text-light-100 text-light-800">
              Choose from a wide range of widgets and apps to create a dashboard that
              meets your needs.
            </p>
            <div className="mt-2.5 grow rounded border dark:border-dark-600 border-light-300 p-2.5 flex flex-col gap-1 items-center justify-center">
              <Icon
                id="layout-top"
                className="w-5 h-5 text-brand-main dark:text-brand-lighter"
              />
              <p className="body-xs-regular text-2xs dark:text-dark-100 text-dark-100">
                Load a widget or an app from the library
              </p>
              <Button
                size="xs"
                variant="primary"
                className="w-fit mt-1.5"
                onClick={() => openWidgetSearch()}
              >
                Add widget(s)
              </Button>
              <p className="body-xs-regular dark:text-dark-100 text-dark-100">or</p>
              <Button
                size="xs"
                variant="outlined"
                className="w-fit"
                onClick={() => openTemplateSearch()}
              >
                Browse apps
              </Button>
            </div>
          </div>
          <div className="dark:bg-[#1F1E23B8] p-2.5 h-[247px] rounded border dark:border-dark-800 bg-white border-light-300 flex flex-col">
            <p className="body-xs-bold dark:text-white text-light-900">
              Add your files
            </p>
            <p className="mt-1 body-xs-regular dark:text-light-100 text-light-800">
              Supported formats:{" "}
              {ExtensionOptions.map((c) => `${c.toLocaleUpperCase()}`).join(", ")}.
            </p>
            <div className="mt-2.5 grow rounded border dark:border-dark-600 border-light-300 p-2.5 flex flex-col gap-1 items-center justify-center">
              <Icon
                id="download-icon"
                className="size-5 text-brand-main dark:text-brand-lighter"
              />
              <p className="body-xs-regular text-2xs dark:text-dark-100 text-dark-100">
                <span className="font-bold">Drag and Drop</span> file(s) here or
                anywhere inside the dashboard area
              </p>
              <p className="body-xs-regular dark:text-dark-100 text-dark-100">or</p>
              <Button
                size="xs"
                variant="outlined"
                className="w-fit"
                onClick={() => {
                  const input = document.getElementById("dashboard-file-upload");
                  input?.click();
                }}
              >
                Browse files
              </Button>
              <p className="body-xs-regular text-2xs dark:text-dark-100">
                File size limit: 25MB
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="dark:bg-[#1F1E23B8] p-2.5 h-[247px] rounded border dark:border-dark-800 bg-white border-light-300 flex flex-col">
              <p className="body-xs-bold dark:text-white text-light-900">
                Add iframe widget
              </p>
              <p className="mt-1 body-xs-regular dark:text-light-100 text-light-800">
                Add any embeddable iframe URL (e.g. Streamlit or Plotly dashboards) to
                your workspace.
              </p>
              <div className="mt-2.5 grow rounded border dark:border-dark-600 border-light-300 p-2.5 flex flex-col gap-2.5 items-center justify-center">
                <Icon
                  id="globe-01"
                  className="w-5 h-5 text-brand-main dark:text-brand-lighter"
                />
                <Button size="xs" variant="outlined" className="w-fit">
                  Add iframe
                </Button>
              </div>
            </div>
            <div className="dark:bg-[#1F1E23B8] p-2.5 h-[247px] rounded border dark:border-dark-800 bg-white border-light-300 flex flex-col">
              <p className="body-xs-bold dark:text-white text-light-900">
                Add API endpoint
              </p>
              <p className="mt-1 body-xs-regular dark:text-light-100 text-light-800">
                Instantly create a table widget from an endpoint. Requires JSON output
                and CORS-enabled APIs.
              </p>
              <div className="mt-2.5 grow rounded border dark:border-dark-600 border-light-300 p-2.5 flex flex-col gap-2.5 items-center justify-center">
                <Icon
                  id="dataflow-04"
                  className="w-5 h-5 text-brand-main dark:text-brand-lighter"
                />
                <Button size="xs" variant="outlined" className="w-fit">
                  Add API endpoint
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          className={cn(
            "items-center justify-center grid grid-cols-2 @max-[360px]/dashboard:grid-cols-1 gap-2.5 @max-[360px]/dashboard:gap-2 max-w-[500px] w-full @max-[360px]/dashboard:max-w-[220px]",
            {
              "opacity-0 pointer-events-none": isDragActive,
            },
          )}
        >
          {[
            {
              title: "Add Widgets",
              compactTitle: "Widgets",
              description: "Add widgets to your dashboard to start visualizing data.",
              icon: (
                <Icon
                  id="layout-top"
                  className="w-4 h-4 text-brand-main dark:text-brand-lighter"
                />
              ),
              action: "Add widgets",
              buttonVariant: "primary" as const,
              onClick: () => openWidgetSearch(),
            },
            {
              title: "Browse Apps",
              compactTitle: "Apps",
              description:
                "Explore pre-built templates combining widgets and prompts for specific analysis workflows.",
              icon: (
                <Icon
                  id="grid-01"
                  className="w-4 h-4 text-brand-main dark:text-brand-lighter"
                />
              ),
              action: "Browse apps",
              buttonVariant: "secondary" as const,
              onClick: () => openTemplateSearch(),
            },
          ].map((item, index) => (
            <div
              key={index}
              className="h-[159px] flex flex-col p-3.5 bg-general-bg-primary rounded @max-[360px]/dashboard:col-span-2 @max-[360px]/dashboard:h-auto @max-[360px]/dashboard:items-center @max-[360px]/dashboard:gap-1.5 @max-[360px]/dashboard:p-2.5"
            >
              <div className="flex min-w-0 gap-2 items-center mb-2.5 @max-[360px]/dashboard:mb-0">
                <div className="w-6 h-6 dark:bg-dark-500 bg-light-50 rounded flex items-center justify-center @max-[360px]/dashboard:hidden">
                  {item.icon}
                </div>
                <p className="body-xs-bold truncate">
                  <span className="@max-[360px]/dashboard:hidden">{item.title}</span>
                  <span className="hidden @max-[360px]/dashboard:inline">
                    {item.compactTitle}
                  </span>
                </p>
              </div>
              <p className="body-xs-regular text-2xs @max-[360px]/dashboard:hidden">
                {item.description}
              </p>
              <Button
                onClick={item.onClick}
                size="sm"
                variant={item.buttonVariant}
                className="mt-auto w-fit @max-[360px]/dashboard:mt-0"
              >
                {item.action}
              </Button>
            </div>
          ))}

          <div className="border dark:border-dark-800 border-light-300 p-2.5 rounded col-span-2 @max-[360px]/dashboard:flex @max-[360px]/dashboard:flex-col @max-[360px]/dashboard:items-center @max-[360px]/dashboard:gap-1.5">
            <p className="body-xs-bold mb-2.5 truncate @max-[360px]/dashboard:mb-0">
              <span className="@max-[360px]/dashboard:hidden">Add your files</span>
              <span className="hidden @max-[360px]/dashboard:inline">Files</span>
            </p>
            <p className="body-xs-regular text-2xs @max-[360px]/dashboard:hidden">
              Supported formats:{" "}
              {ExtensionOptions.map((c) => `${c.toLocaleUpperCase()}`).join(", ")}.
            </p>
            <div className="mt-2.5 border dark:border-dark-800 border-light-300 rounded p-2.5 border-dashed dark:text-dark-50 @max-[360px]/dashboard:mt-0 @max-[360px]/dashboard:border-0 @max-[360px]/dashboard:p-0">
              <div className="flex items-center justify-center flex-col gap-2.5">
                <Icon
                  id="download-icon"
                  className="size-5 @max-[360px]/dashboard:hidden"
                />
                <p className="body-xs-regular @max-[360px]/dashboard:hidden">
                  <span className="font-bold">Drag and Drop</span> file(s) here or
                  anywhere inside the dashboard area
                </p>
                <p className="body-xs-regular @max-[360px]/dashboard:hidden">or</p>
                <Button
                  size="xs"
                  variant="outlined"
                  onClick={() => {
                    const input = document.getElementById("dashboard-file-upload");
                    input?.click();
                  }}
                >
                  Browse files
                </Button>
                <p className="body-xs-regular text-2xs dark:text-dark-100 @max-[360px]/dashboard:hidden">
                  File size limit: 25MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
