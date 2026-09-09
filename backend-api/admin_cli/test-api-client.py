"""
OpenBB Admin API Client - Full Workflow Test Script
Tests the HubAPIClient class directly as a Python library.

This mirrors test-workflow.sh but uses the client class programmatically
instead of invoking the CLI.

Usage:
    python test-api-client.py

    # Or with environment variables:
    OPENBB_BASE_URL=http://localhost:8000 ADMIN_EMAIL=admin@example.com python test-api-client.py
"""

import getpass
import os
import sys
import time
from pathlib import Path

# Import HubAPIClient and APIError from the CLI file
# We need to extract just the classes, not run main()
cli_path = Path(__file__).parent / "openbb-admin"
cli_source = cli_path.read_text()

# Extract everything up to the CLI command handlers (line ~540)
# This includes HubAPIClient, APIError, and helper functions
import_end = cli_source.find("def auth_login(args:")
if import_end == -1:
    import_end = cli_source.find("# COMMAND HANDLERS")
if import_end == -1:
    # Fallback: just don't run main by setting __name__
    exec(  # noqa: S102 -- loads classes from the extensionless openbb-admin CLI script
        compile(cli_source, cli_path, "exec"), {"__name__": "openbb_admin_module"}
    )
else:
    exec(  # noqa: S102 -- loads classes from the extensionless openbb-admin CLI script
        compile(cli_source[:import_end], cli_path, "exec")
    )

# Colors for output
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"


def log_step(msg: str) -> None:
    print(f"{YELLOW}==>{NC} {msg}")


def log_success(msg: str) -> None:
    print(f"{GREEN}✓{NC} {msg}")


def log_error(msg: str) -> None:
    print(f"{RED}✗{NC} {msg}")


def main():
    base_url = os.getenv("OPENBB_BASE_URL", "https://payments.openbb.dev")
    timestamp = int(time.time())

    # =========================================================================
    # 1. AUTHENTICATION
    # =========================================================================
    log_step("Step 1: Authenticating...")

    email = os.getenv("ADMIN_EMAIL") or input("Email: ")
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Password: ")

    client = HubAPIClient(base_url)  # noqa: F821  # type: ignore[unresolved-reference]

    try:
        token = client.auth_login(email, password)
        client.access_token = token
        log_success(f"Authenticated (token: {token[:10]}...)")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Authentication failed: {e}")
        sys.exit(1)

    # =========================================================================
    # 2. GET ENTITY TYPE
    # =========================================================================
    log_step("Step 2: Fetching entity types...")

    try:
        entity_types = client.entity_type_list()
        items = entity_types.get("items", [])
        if not items:
            log_error("No entity types found. Create one first.")
            sys.exit(1)

        entity_type_uuid = items[0]["uuid"]
        log_success(f"Using entity type: {entity_type_uuid}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to fetch entity types: {e}")
        sys.exit(1)

    # =========================================================================
    # 3. CREATE ENTITY WITH ENTITLEMENTS (High-level method)
    # =========================================================================
    log_step("Step 3: Creating entity with entitlements...")

    entity_config = {
        "name": f"Test Entity {timestamp}",
        "entity_type_uuid": entity_type_uuid,
        "email": f"billing-{timestamp}@example.com",
        "admin_email": f"admin-{timestamp}@example.com",
        "company_type": "Investment Firm",
        "organization_size": "10-50",
        "aum": 10000000,
        "country": "USA",
        "seats": 50,
        "expiration_date": "2025-12-31T00:00:00Z",
    }

    try:
        # This high-level method creates entity AND configures entitlements
        entity_resp = client.entity_create_with_entitlements(entity_config)
        entity_uuid = entity_resp["entity_uuid"]
        log_success(f"Entity created: {entity_uuid}")
        print(f"    Name: {entity_config['name']}")
        print(f"    Seats: {entity_config['seats']}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to create entity: {e}")
        sys.exit(1)

    # =========================================================================
    # 4. CREATE ADMIN USER (High-level method with role name)
    # =========================================================================
    log_step("Step 4: Creating admin user...")

    admin_email = f"admin-{timestamp}@example.com"

    try:
        # Note: We just pass role="admin", not a permission_uuid!
        admin_resp = client.user_create(
            entity_uuid=entity_uuid,
            email=admin_email,
            first_name="Admin",
            last_name="User",
            role="admin",
        )
        admin_password = admin_resp.get("temporary_password")
        log_success(f"Admin created: {admin_email}")
        print(f"    Temp password: {admin_password}")
        print(f"    Role: {admin_resp.get('role')}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to create admin: {e}")
        sys.exit(1)

    # =========================================================================
    # 5. CREATE REGULAR USER
    # =========================================================================
    log_step("Step 5: Creating regular user...")

    user_email = f"analyst-{timestamp}@example.com"

    try:
        user_resp = client.user_create(
            entity_uuid=entity_uuid,
            email=user_email,
            first_name="Analyst",
            last_name="One",
            role="user",
        )
        user_password = user_resp.get("temporary_password")
        log_success(f"User created: {user_email}")
        print(f"    Temp password: {user_password}")
        print(f"    Role: {user_resp.get('role')}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to create user: {e}")
        sys.exit(1)

    # =========================================================================
    # 6. UPDATE ENTITY (Partial update via high-level method)
    # =========================================================================
    log_step("Step 6: Updating entity (seats: 50 -> 100)...")

    try:
        # Smart partial update - only specify what you want to change
        _ = client.entity_update(entity_uuid, seats=100)
        log_success("Entity updated")

        # Verify
        entity_details = client.entity_get(entity_uuid)
        actual_seats = entity_details.get("seats")
        if actual_seats == 100:
            log_success(f"Verified: seats = {actual_seats}")
        else:
            log_error(f"Verification failed: expected 100, got {actual_seats}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to update entity: {e}")

    # =========================================================================
    # 7. ADD DATA BACKEND
    # =========================================================================
    log_step("Step 7: Adding a data backend to the entity...")

    try:
        db_resp = client.data_backend_add(
            entity_uuid=entity_uuid,
            name="test-backend",
            url="https://api.example.com",
        )
        log_success("Data backend added: test-backend")
        print(f"    Response: {db_resp}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to add data backend: {e}")

    # =========================================================================
    # 8. LIST DATA BACKENDS
    # =========================================================================
    log_step("Step 8: Listing data backends...")

    try:
        backends = client.data_backend_list(entity_uuid)
        log_success(f"Found {len(backends)} data backend(s)")
        for b in backends:
            print(f"    {b.get('name')} | {b.get('url')}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to list data backends: {e}")

    # =========================================================================
    # 9. UPDATE ENTITLEMENT (disable custom backends)
    # =========================================================================
    log_step("Step 9: Disabling custom backends via entitlement update...")

    try:
        ent_resp = client.entitlement_update(entity_uuid, {"allow_custom_backends": False})
        log_success("Custom backends disabled")
        print(f"    Response: {ent_resp}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to update entitlement: {e}")

    # =========================================================================
    # 10. DELETE DATA BACKEND
    # =========================================================================
    log_step("Step 10: Deleting data backend...")

    try:
        client.data_backend_delete(entity_uuid, "test-backend")
        log_success("Data backend deleted: test-backend")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to delete data backend: {e}")

    # =========================================================================
    # 11. VERIFY DATA BACKENDS EMPTY
    # =========================================================================
    log_step("Step 11: Verifying data backends removed...")

    try:
        backends = client.data_backend_list(entity_uuid)
        if len(backends) == 0:
            log_success("Verified: 0 data backends remaining")
        else:
            log_error(f"Expected 0 backends, found {len(backends)}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to list data backends: {e}")

    # =========================================================================
    # 12. GET USER BY EMAIL (High-level method)
    # =========================================================================
    log_step("Step 12: Looking up user by email...")

    try:
        user = client.user_get_by_email(user_email)
        user_uuid = user["uuid"]
        log_success(f"Found user: {user_uuid}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to find user: {e}")
        user_uuid = None

    # =========================================================================
    # 13. RESET USER PASSWORD
    # =========================================================================
    log_step("Step 13: Resetting user password...")

    if user_uuid:
        try:
            reset_resp = client.user_reset_password(user_uuid)
            new_password = reset_resp.get("temporary_password")
            log_success(f"Password reset for {user_email}")
            print(f"    New temp password: {new_password}")
        except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
            log_error(f"Failed to reset password: {e}")

    # =========================================================================
    # 14. GET PERMISSION MAP BY ROLE (High-level helper)
    # =========================================================================
    log_step("Step 14: Testing permission map lookup...")

    try:
        admin_map = client.get_permission_map_by_role(entity_uuid, "admin")
        user_map = client.get_permission_map_by_role(entity_uuid, "user")
        log_success(f"Admin permission map: {admin_map['uuid']}")
        log_success(f"User permission map: {user_map['uuid']}")
    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Failed to get permission maps: {e}")

    # =========================================================================
    # 15. DELETE USERS
    # =========================================================================
    log_step("Step 15: Deleting users...")

    users_deleted = 0
    for email_to_delete in [admin_email, user_email]:
        try:
            user = client.user_get_by_email(email_to_delete)
            client.user_delete(user["uuid"])
            log_success(f"Deleted: {email_to_delete}")
            users_deleted += 1
        except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
            print(f"{YELLOW}!{NC} Could not delete {email_to_delete}: {e}")

    # =========================================================================
    # 16. TEST BULK PROVISIONING (High-level workflow)
    # =========================================================================
    log_step("Step 16: Testing bulk provisioning (provision_full)...")

    provision_config = {
        "entity": {
            "name": f"Bulk Test Entity {timestamp}",
            "entity_type_uuid": entity_type_uuid,
            "email": f"bulk-billing-{timestamp}@example.com",
            "admin_email": f"bulk-admin-{timestamp}@example.com",
            "company_type": "Hedge Fund",
            "organization_size": "50-100",
            "aum": 50000000,
            "country": "UK",
            "seats": 25,
            "expiration_date": "2026-06-30T00:00:00Z",
        },
        "users": [
            {
                "email": f"bulk-admin-{timestamp}@example.com",
                "first_name": "Bulk",
                "last_name": "Admin",
                "role": "admin",
            },
            {
                "email": f"bulk-user1-{timestamp}@example.com",
                "first_name": "Bulk",
                "last_name": "User1",
                "role": "user",
            },
            {
                "email": f"bulk-user2-{timestamp}@example.com",
                "first_name": "Bulk",
                "last_name": "User2",
                "role": "user",
            },
        ],
    }

    try:
        # Single call creates entity + entitlements + all users
        results = client.provision_full(provision_config)

        bulk_entity_uuid = results["entity"]["entity_uuid"]
        log_success(f"Bulk entity created: {bulk_entity_uuid}")

        for user in results["users"]:
            log_success(f"  User created: {user['email']} ({user['role']})")

        for failed in results.get("failed_users", []):
            log_error(f"  User failed: {failed['email']} - {failed['error']}")

        # Cleanup bulk users
        log_step("Cleaning up bulk provisioned users...")
        for user in results["users"]:
            try:
                u = client.user_get_by_email(user["email"])
                client.user_delete(u["uuid"])
                log_success(f"  Deleted: {user['email']}")
            except APIError:  # noqa: F821  # type: ignore[unresolved-reference]
                pass

    except APIError as e:  # noqa: F821  # type: ignore[unresolved-reference]
        log_error(f"Bulk provisioning failed: {e}")

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print()
    print("=" * 50)
    print("API CLIENT TEST SUMMARY")
    print("=" * 50)
    print()
    print("High-level methods tested:")
    print("  - auth_login(email, password)")
    print("  - entity_type_list()")
    print("  - entity_create_with_entitlements(config)")
    print("  - entity_get(uuid)")
    print("  - entity_update(uuid, **kwargs)")
    print("  - user_create(entity_uuid, email, first_name, last_name, role)")
    print("  - user_get_by_email(email)")
    print("  - user_reset_password(user_uuid)")
    print("  - user_delete(user_uuid)")
    print("  - get_permission_map_by_role(entity_uuid, role)")
    print("  - data_backend_add(entity_uuid, name, url)")
    print("  - data_backend_list(entity_uuid)")
    print("  - data_backend_delete(entity_uuid, backend_name)")
    print("  - entitlement_update(entity_uuid, data)")
    print("  - provision_full(config)")
    print()
    print("Key benefits of HubAPIClient:")
    print("  - Pass role='admin' instead of looking up permission_uuid")
    print("  - entity_create_with_entitlements() auto-configures On-Premise bundle")
    print("  - entity_update() does smart partial updates (fetch-merge-put)")
    print("  - provision_full() creates entity + all users in one call")
    print("  - user_get_by_email() abstracts pagination")
    print()
    print("Test entities created:")
    print(f"  - {entity_uuid}")
    if "bulk_entity_uuid" in dir():
        print(f"  - {bulk_entity_uuid}")
    print()
    print("=" * 50)


if __name__ == "__main__":
    main()
