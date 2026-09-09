"""Role and permission events."""

import asyncio
import warnings
from contextlib import suppress
from datetime import UTC, datetime
from uuid import UUID

from loguru import logger
from sqlalchemy import Connection, event, insert, inspect, select
from sqlalchemy.orm.state import InstanceState

from api.context import session_token_ctx
from api.database import AsyncWriteSessionLocal
from api.events.types import RoleAuditAction, RoleResourceType
from api.helpers import add_log
from api.models.entity_models import (
    AuditEntityRolesPermissions,
    Role,
    RoleBackend,
    RoleFile,
    RolePrompt,
)
from api.models.tauri_models import ApiSource, FileWidget
from api.models.user_models import (
    Session as DDSession,
    User,
    UserRole,
)


async def _create_role_audit_entry_task(  # noqa: PLR0913, PLR0917
    role_uuid: UUID,
    action: RoleAuditAction,
    resource_type: RoleResourceType,
    resource_uuid: UUID | None,
    details: dict,
    session_token: UUID | None = None,
):
    """Create an audit entry for role-related changes"""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            async with AsyncWriteSessionLocal.session() as db:
                query_entity = await db.execute(
                    select(Role.entity_uuid).where(Role.uuid == role_uuid)
                )
                entity_uuid = query_entity.scalar_one_or_none()

                query = await db.execute(
                    select(DDSession.user_uuid).where(DDSession.uuid == session_token)
                )
                performing_user = query.scalar_one_or_none()

                await db.execute(
                    insert(AuditEntityRolesPermissions).values(
                        entity_uuid=entity_uuid,
                        role_uuid=role_uuid,
                        action=action.value,
                        resource_type=resource_type.value,
                        resource_uuid=resource_uuid,
                        performed_by_uuid=performing_user,
                        details=details,
                    )
                )
                await db.commit()
        except Exception as e:
            add_log("audit_role_permissions_error", str(e), 500, "audit")


def _create_role_audit_entry(  # noqa: PLR0913, PLR0917
    role_uuid: UUID,
    action: RoleAuditAction,
    resource_type: RoleResourceType,
    resource_uuid: UUID | None,
    details: dict,
):
    # Get the current session token from shared context
    session_token = session_token_ctx.get()
    with suppress(Exception):
        asyncio.ensure_future(
            _create_role_audit_entry_task(
                role_uuid,
                action,
                resource_type,
                resource_uuid,
                details,
                session_token,
            )
        )


# Role events
def track_role_insert(mapper, connection: Connection, target: Role):
    """Track role creation"""
    _create_role_audit_entry(
        target.uuid,
        RoleAuditAction.CREATE,
        RoleResourceType.ROLE,
        target.uuid,
        {"name": target.name, "description": target.description},
    )


def track_role_update(mapper, connection: Connection, target: Role):
    """Track role updates"""
    state: InstanceState = inspect(target)
    changed = {}

    # Track regular attribute changes
    for attr in ["name", "description"]:
        hist = state.get_history(attr, passive=True)
        if hist.has_changes():
            changed[attr] = {
                "old": hist.deleted[0] if hist.deleted else None,
                "new": hist.added[0] if hist.added else None,
            }

    # Track soft deletion
    deleted_hist = state.get_history("deleted_at", passive=True)
    if deleted_hist.has_changes():
        # If deleted_at was set from None to a timestamp, it's a deletion
        if deleted_hist.deleted == [None] and deleted_hist.added:
            _create_role_audit_entry(
                target.uuid,
                RoleAuditAction.DELETE,
                RoleResourceType.ROLE,
                target.uuid,
                {
                    "deleted_at": (
                        deleted_hist.added[0].isoformat()
                        if deleted_hist.added
                        else None
                    ),
                },
            )
            return  # Return early as this is a deletion event
        # If deleted_at was set from a timestamp to None, it's a restoration
        elif deleted_hist.added == [None] and deleted_hist.deleted:
            _create_role_audit_entry(
                target.uuid,
                RoleAuditAction.RESTORE,
                RoleResourceType.ROLE,
                target.uuid,
                {
                    "restored_at": datetime.now(UTC).isoformat(),
                },
            )
            return  # Return early as this is a restoration event

    # Log other changes if any occurred
    if changed:
        _create_role_audit_entry(
            target.uuid,
            RoleAuditAction.UPDATE,
            RoleResourceType.ROLE,
            target.uuid,
            changed,
        )


# UserRole events
def track_user_role_insert(mapper, connection: Connection, target: UserRole):
    """Track user role assignments"""
    # Get user email
    user_email = connection.execute(
        select(User.email).where(User.uuid == target.user_uuid)
    ).scalar_one_or_none()

    _create_role_audit_entry(
        target.role_uuid,
        RoleAuditAction.ADD,
        RoleResourceType.USER,
        target.user_uuid,
        {"user_email": user_email},
    )


def track_user_role_delete(mapper, connection: Connection, target: UserRole):
    """Track user role removals"""
    # Get user email
    user_email = connection.execute(
        select(User.email).where(User.uuid == target.user_uuid)
    ).scalar_one_or_none()

    _create_role_audit_entry(
        target.role_uuid,
        RoleAuditAction.REMOVE,
        RoleResourceType.USER,
        target.user_uuid,
        {"user_email": user_email},
    )


def get_widget_changes(new_widgets: list[dict], old_widgets: list[dict]) -> dict:
    """Get widget changes for a role backend"""

    if not (old_widgets and new_widgets):
        return {"old": old_widgets, "new": new_widgets}

    # Compare the widgets to find the differences
    old_widgets: dict[str, dict] = {
        widget.get("widgetId"): widget.get("access") for widget in old_widgets
    }
    new_widgets: dict[str, dict] = {
        widget.get("widgetId"): widget.get("access") for widget in new_widgets
    }

    changed_data = {"new": [], "old": []}
    # Find the widgets that have changed access
    for widget_id, access in new_widgets.items():
        if widget_id not in old_widgets:
            # New widget added
            changed_data["new"].append({"widgetId": widget_id, "access": access})
            continue

        if old_widgets[widget_id] != access:
            changed_data["new"].append({"widgetId": widget_id, "access": access})
            changed_data["old"].append(
                {"widgetId": widget_id, "access": old_widgets[widget_id]}
            )

    for widget_id, access in old_widgets.items():
        if widget_id not in new_widgets:
            changed_data["old"].append({"widgetId": widget_id, "access": access})

    return changed_data


def get_template_changes(new_templates: list[dict], old_templates: list[dict]) -> dict:
    """Get template changes for a role backend"""

    if not (old_templates and new_templates):
        return {"old": old_templates, "new": new_templates}

    old_templates: dict[str, dict] = {
        template.get("templateId"): template for template in old_templates
    }
    new_templates: dict[str, dict] = {
        template.get("templateId"): template for template in new_templates
    }

    result = {"new": [], "old": []}

    # Compare the templates to find the differences including prompts
    for template_id, new_template in new_templates.items():

        # New template added
        if template_id not in old_templates:
            result["new"].append({"templateId": template_id, **new_template})
            continue

        updated_data = {"new": {}, "old": {}}
        old_template = old_templates[template_id]

        # Check for access changes
        if old_template.get("access") != new_template.get("access"):
            updated_data["new"]["access"] = new_template.get("access")
            updated_data["old"]["access"] = old_template.get("access")

        # Check for prompt changes
        changed_prompts = {"new": [], "old": []}
        if (
            new_template.get("prompts")
            and old_template.get("prompts")
            and len(new_template["prompts"]) > 0
        ):
            new_prompts: dict[str, dict] = {
                prompt.get("promptId"): prompt
                for prompt in new_template["prompts"]
                if new_template["prompts"]
            }
            old_prompts: dict[str, dict] = {
                prompt.get("promptId"): prompt
                for prompt in old_template["prompts"]
                if old_template["prompts"]
            }
            # Find the prompts that have changed access
            for prompt_id, new_prompt in new_prompts.items():
                if prompt_id not in old_prompts:
                    # New prompt added
                    changed_prompts["new"].append({"promptId": prompt_id, **new_prompt})
                    continue

                old_prompt = old_prompts[prompt_id]
                if old_prompt.get("access") != new_prompt.get("access"):
                    # Access changed
                    changed_prompts["new"].append({"promptId": prompt_id, **new_prompt})
                    changed_prompts["old"].append({"promptId": prompt_id, **old_prompt})

            if changed_prompts["new"]:
                updated_data["new"]["prompts"] = changed_prompts["new"]
                updated_data["old"]["prompts"] = changed_prompts["old"] or None

        if updated_data["new"]:
            result["new"].append({"templateId": template_id, **updated_data["new"]})
            result["old"].append({"templateId": template_id, **updated_data["old"]})

    for template_id, old_template in old_templates.items():
        if template_id not in new_templates:
            result["old"].append({"templateId": template_id, **old_template})

    return result


# RoleBackend events
def track_role_backend_update(mapper, connection: Connection, target: RoleBackend):
    """Track backend permission changes"""
    state: InstanceState = inspect(target)
    changed = {}
    for attr in ["access", "widgets", "templates"]:

        hist = state.get_history(attr, passive=True)
        if hist.has_changes():
            old = hist.deleted[0] if hist.deleted else None
            new = hist.added[0] if hist.added else None
            try:
                if attr == "widgets":
                    changed_data = get_widget_changes(new, old)
                    if changed_data:
                        changed[attr] = changed_data
                        continue
                if attr == "templates":
                    changed_data = get_template_changes(new, old)
                    if changed_data:
                        changed[attr] = changed_data
                        continue
            except Exception as e:
                logger.error(e)

            changed[attr] = {"old": old, "new": new}

    if changed:
        backend_name = connection.execute(
            select(ApiSource.name).where(ApiSource.uuid == target.backend_uuid)
        ).scalar_one_or_none()

        changed = {"name": backend_name, **changed}

        _create_role_audit_entry(
            target.role_uuid,
            RoleAuditAction.UPDATE,
            RoleResourceType.BACKEND,
            target.backend_uuid,
            changed,
        )


def track_role_backend_insert(mapper, connection: Connection, target: RoleBackend):
    """Track backend permission assignments"""
    has_templates = target.templates is not None and len(target.templates) > 0
    widgets = target.widgets or []
    widgets_with_access = [
        widget for widget in (widgets) if widget.get("access") == "access"
    ]
    if all([target.access == "no-access", not has_templates, not widgets_with_access]):
        return

    backend_name = connection.execute(
        select(ApiSource.name).where(ApiSource.uuid == target.backend_uuid)
    ).scalar_one_or_none()

    _create_role_audit_entry(
        target.role_uuid,
        RoleAuditAction.ASSIGN,
        RoleResourceType.BACKEND,
        target.backend_uuid,
        {
            "name": backend_name,
            "access": {"old": None, "new": target.access},
            "widgets": {"old": None, "new": target.widgets},
            "templates": {"old": None, "new": target.templates},
        },
    )


# RoleFile events
def track_role_file_update(mapper, connection: Connection, target: RoleFile):
    """Track file permission changes"""

    state: InstanceState = inspect(target)
    hist = state.get_history("access", passive=True)
    if hist.has_changes():
        file_widget_name = connection.execute(
            select(FileWidget.name).where(FileWidget.uuid == target.file_uuid)
        ).scalar_one_or_none()

        _create_role_audit_entry(
            target.role_uuid,
            RoleAuditAction.UPDATE,
            RoleResourceType.FILE,
            target.file_uuid,
            {
                "name": file_widget_name,
                "access": {
                    "old": hist.deleted[0] if hist.deleted else None,
                    "new": hist.added[0] if hist.added else None,
                },
            },
        )


def track_role_file_insert(mapper, connection: Connection, target: RoleFile):
    """Track file permission assignments"""
    if target.access == "no-access":
        return

    file_widget_name = connection.execute(
        select(FileWidget.name).where(FileWidget.uuid == target.file_uuid)
    ).scalar_one_or_none()

    _create_role_audit_entry(
        target.role_uuid,
        RoleAuditAction.ASSIGN,
        RoleResourceType.FILE,
        target.file_uuid,
        {"name": file_widget_name, "access": {"old": None, "new": target.access}},
    )


# RolePrompt events
def track_role_prompt_update(mapper, connection: Connection, target: RolePrompt):
    """Track prompt permission changes"""
    state: InstanceState = inspect(target)
    hist = state.get_history("access", passive=True)
    if hist.has_changes():
        _create_role_audit_entry(
            target.role_uuid,
            RoleAuditAction.UPDATE,
            RoleResourceType.PROMPT,
            target.prompt_uuid,
            {
                "access": {
                    "old": hist.deleted[0] if hist.deleted else None,
                    "new": hist.added[0] if hist.added else None,
                }
            },
        )


def track_role_prompt_insert(mapper, connection: Connection, target: RolePrompt):
    """Track prompt permission assignments"""
    if target.access == "no-access":
        return

    _create_role_audit_entry(
        target.role_uuid,
        RoleAuditAction.ASSIGN,
        RoleResourceType.PROMPT,
        target.prompt_uuid,
        {"access": {"old": None, "new": target.access}},
    )


async def init_audit_listeners():
    """Enable role and permission audit listeners"""
    await asyncio.sleep(5)  # Wait for the database to be ready
    event.listen(Role, "after_insert", track_role_insert)
    event.listen(Role, "after_update", track_role_update)
    event.listen(UserRole, "after_insert", track_user_role_insert)
    event.listen(UserRole, "after_delete", track_user_role_delete)
    event.listen(RoleBackend, "after_update", track_role_backend_update)
    event.listen(RoleBackend, "after_insert", track_role_backend_insert)
    event.listen(RoleFile, "after_update", track_role_file_update)
    event.listen(RoleFile, "after_insert", track_role_file_insert)
    event.listen(RolePrompt, "after_update", track_role_prompt_update)
    event.listen(RolePrompt, "after_insert", track_role_prompt_insert)
