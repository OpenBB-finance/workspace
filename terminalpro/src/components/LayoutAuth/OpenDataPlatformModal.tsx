import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogTitle } from "../ds/dialogs/Dialog";
import Icon from "../Icon";

export default function OpenDataPlatformModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      className="!w-[95vw] !max-w-[95vw] !h-[90vh] !max-h-[90vh] md:!w-[820px] md:!max-w-[820px] md:!h-[686px] md:!max-h-[686px] overflow-y-auto md:overflow-hidden bg-light-50 dark:bg-dark-900 text-light-900 dark:text-white p-0 gap-0 flex flex-col"
    >
      <div className="p-5 pb-3 flex justify-between items-center shrink-0">
        <DialogTitle className="body-md-bold text-light-900 dark:text-white">
          Install Open Data Platform
        </DialogTitle>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5 md:h-full md:flex-1 md:min-h-0">
        <div className="flex flex-col md:flex-row bg-light-100 dark:bg-dark-800 overflow-hidden border border-light-300 dark:border-dark-700 shrink-0 md:shrink md:flex-1 md:min-h-0">
          <div className="w-full h-48 md:w-[40%] md:h-full relative shrink-0">
            <img
              src="/assets/images/onboarding/odp/01_meet.png"
              alt="Meet ODP"
              className="w-full h-full object-cover rounded-none"
            />
          </div>
          <div className="p-4 flex flex-col justify-center w-full md:w-[60%] gap-2 md:overflow-y-auto">
            <div>
              <h3 className="body-sm-medium text-light-900 dark:text-white mb-1">
                Meet ODP: Your Open Data Platform
              </h3>
              <p className="body-xs-regular text-light-600 dark:text-gray-300 leading-relaxed">
                ODP is an open-source toolset that helps you build standardized data
                integrations and consume them through multiple interfaces, locally and
                securely.
              </p>
            </div>
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open("https://docs.openbb.co/desktop", "_blank")}
              >
                <Icon id="book-open-01" className="mr-2 h-3.5 w-3.5" />
                Check Documentation
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row bg-light-100 dark:bg-dark-800 overflow-hidden border border-light-300 dark:border-dark-700 shrink-0 md:shrink md:flex-1 md:min-h-0">
          <div className="w-full h-48 md:w-[40%] md:h-full relative shrink-0">
            <img
              src="/assets/images/onboarding/odp/02_download.png"
              alt="Download ODP"
              className="w-full h-full object-cover rounded-none"
            />
          </div>
          <div className="p-4 flex flex-col justify-center w-full md:w-[60%] gap-2 md:overflow-y-auto">
            <div>
              <h3 className="body-sm-medium text-light-900 dark:text-white mb-1">
                How to Download & Setup ODP
              </h3>
              <p className="body-xs-regular text-light-600 dark:text-gray-300 leading-relaxed">
                Download the desktop app from GitHub and set your API keys to access
                data from FRED, BLS, IMF, FOMC, Congress, and much more, in one place at
                once.
              </p>
            </div>
            <div>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  window.open(
                    "https://openbb.link/odp-installer-from-workspace",
                    "_blank",
                  )
                }
              >
                <Icon id="download" className="mr-2 h-3.5 w-3.5" />
                Download Installer
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row bg-light-100 dark:bg-dark-800 overflow-hidden border border-light-300 dark:border-dark-700 shrink-0 md:shrink md:flex-1 md:min-h-0">
          <div className="w-full h-48 md:w-[40%] md:h-full relative shrink-0">
            <img
              src="/assets/images/onboarding/odp/03_connect.png"
              alt="Connect ODP"
              className="w-full h-full object-cover rounded-none"
            />
          </div>
          <div className="p-4 flex flex-col justify-center w-full md:w-[60%] gap-2 md:overflow-y-auto">
            <div>
              <h3 className="body-sm-medium text-light-900 dark:text-white mb-1">
                Connect ODP inside the Workspace
              </h3>
              <div className="body-xs-regular text-light-600 dark:text-gray-300 leading-relaxed space-y-0.5">
                <p>
                  1. Sign in to your OpenBB Workspace account and open the ‘Apps’ tab.
                </p>
                <p>2. Click ‘Connect backend’.</p>
                <p>
                  3. In the form, enter:{" "}
                  <span className="font-semibold text-light-900 dark:text-white">
                    Name:
                  </span>{" "}
                  OpenBB Platform /{" "}
                  <span className="font-semibold text-light-900 dark:text-white">
                    URL:
                  </span>{" "}
                  <a
                    href="http://127.0.0.1:6900"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-light-900 dark:hover:text-white transition-colors"
                  >
                    http://127.0.0.1:6900
                  </a>
                </p>
                <p>4. Click ‘Test’, then ‘Add’ to complete the connection.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}
