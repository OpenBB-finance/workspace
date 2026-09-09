from enum import StrEnum


class RoleAuditAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"
    ASSIGN = "assign"
    REMOVE = "remove"
    ADD = "add"


class RoleResourceType(StrEnum):
    ROLE = "role"
    BACKEND = "backend"
    FILE = "file"
    PROMPT = "prompt"
    USER = "user"
