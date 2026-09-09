from typing import Any

from workspace_mcp.models import (
    BrowserSessionContext,
    WorkspaceCommandResult,
    workspace_command_adapter,
)
from workspace_mcp.state import BrowserUnavailableError as SidecarBrowserUnavailableError

from .bridge import BridgeSessionManager, BrowserUnavailableError
from .context import get_current_user_uuid


class WorkspaceMCPBridgeState:
    def __init__(self, bridge_manager: BridgeSessionManager):
        self._bridge_manager = bridge_manager

    async def execute_command(self, command: Any) -> WorkspaceCommandResult:
        user_uuid = get_current_user_uuid()
        command_model = workspace_command_adapter.validate_python(command)
        try:
            result = await self._bridge_manager.execute_command(
                user_uuid,
                command_model.model_dump(mode="json"),
            )
        except BrowserUnavailableError as error:
            raise SidecarBrowserUnavailableError(str(error)) from error
        return WorkspaceCommandResult.model_validate(result)

    def get_session_context(self) -> BrowserSessionContext | None:
        session = self._bridge_manager.get_session_context(get_current_user_uuid())
        if session is None:
            return None
        return BrowserSessionContext.model_validate(session)
