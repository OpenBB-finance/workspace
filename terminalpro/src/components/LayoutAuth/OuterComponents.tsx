import { useMobile } from "~/lib/providers/MobileProvider";
import { useShallowThemeStore } from "~/lib/state/theme";
import AddSkillDialog from "../AI/AddSkillDialog";
import { CreateWidgetMetadataDialog } from "../AI/CreateWidgetMetadataDialog";
import McpAuthPopup from "../AI/hooks/mcp/McpAuthPopup";
import { McpConnectionManager } from "../AI/McpConnectionManager";
import { WorkspaceBridgeConnectionManager } from "../AI/WorkspaceBridgeConnectionManager";
import ManageAppDialog from "../Apps/ManageAppDialog";
import ManageAppsDialog from "../Apps/ManageAppsDialog";
import AddConnectionModal from "../DataConnectors/AddConnectionModal";
import CreateFolderPopup from "../General/CreateFolderPopup";
import ExportFolderDialog from "../General/ExportFolderDialog";
import ExportModal from "../General/ExportModal";
import ExportTemplatePopup from "../General/ExportTemplatePopup";
import ExportWidgetModal from "../General/ExportWidgetModal";
import RenamePopup from "../General/RenamePopup";
import { SaveAppDialog } from "../General/SaveAppDialog";
import { ShareUserAppDialog } from "../General/SharedAppsDialog";
import { ShareDashboardDialog } from "../General/SharedDashboardDialog";
import TourGuide from "../InAppOnboarding/TourGuide";
import WalkthroughGuide from "../InAppOnboarding/WalkthroughGuide";
import ExcelExportDialog from "../LayoutAuth/DropdownSubs/ExcelExportDialog";
import MarketingPopup from "./MarketingPopup";
import OpenDataPlatformModal from "./OpenDataPlatformModal";
import AddPromptDialog from "./PromptLibrary/AddPromptDialog";
import SearchDialog from "./Search/SearchDialog";
import ShortcutDialog from "./ShortcutDialog";
import TOSDialog from "./TOSDialog";

export default function OuterComponents() {
  const {
    exportWidgetData,
    exportPopup,
    renamePopup,
    shortcutSidebarOpen,
    search,
    shareDashboardPopupId,
    shareUserAppsPopupId,
    excelExportPopup,
    exportFolderPopup,
    openDataPlatformModalOpen,
    setOpenDataPlatformModalOpen,
  } = useShallowThemeStore((state) => ({
    exportWidgetData: state.exportWidgetData,
    exportPopup: state.exportPopup,
    renamePopup: state.renamePopup,
    shortcutSidebarOpen: state.shortcutSidebarOpen,
    search: state.search,
    shareDashboardPopupId: state.shareDashboardPopupId,
    shareUserAppsPopupId: state.shareUserAppsPopupId,
    excelExportPopup: state.excelExportPopup,
    exportFolderPopup: state.exportFolderPopup,
    openDataPlatformModalOpen: state.openDataPlatformModalOpen,
    setOpenDataPlatformModalOpen: state.setOpenDataPlatformModalOpen,
  }));

  const isMobile = useMobile((s) => s.isMobile);

  return (
    <>
      <TourGuide />
      <WalkthroughGuide />
      <AddConnectionModal />
      <MarketingPopup />
      <AddPromptDialog />
      <AddSkillDialog />
      <ManageAppsDialog />
      <ManageAppDialog />
      <SaveAppDialog />
      <McpAuthPopup />
      {search && !isMobile && <SearchDialog />}
      {shortcutSidebarOpen && <ShortcutDialog />}
      {openDataPlatformModalOpen && (
        <OpenDataPlatformModal
          open={openDataPlatformModalOpen}
          onClose={() => setOpenDataPlatformModalOpen(false)}
        />
      )}
      <TOSDialog />
      {exportPopup && <ExportModal />}
      {exportWidgetData && <ExportWidgetModal />}
      {renamePopup && <RenamePopup />}
      <ExportTemplatePopup />
      <CreateFolderPopup />
      {shareDashboardPopupId && <ShareDashboardDialog />}
      {shareUserAppsPopupId && <ShareUserAppDialog />}
      {excelExportPopup && <ExcelExportDialog />}
      {exportFolderPopup && <ExportFolderDialog />}
      <McpConnectionManager />
      <WorkspaceBridgeConnectionManager />
      <CreateWidgetMetadataDialog />
    </>
  );
}
