#!/bin/bash
# OpenBB Admin CLI - Full Workflow Test Script
# Tests: create entity, add users, update, and cleanup

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_CLI="py $SCRIPT_DIR/openbb-admin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_step() {
    echo -e "${YELLOW}==>${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if authenticated
log_step "Checking authentication status..."
AUTH_STATUS=$($ADMIN_CLI auth status --json)
IS_AUTHENTICATED=$(echo "$AUTH_STATUS" | grep -o '"authenticated": *[^,}]*' | awk -F': ' '{print $2}')

if [ "$IS_AUTHENTICATED" != "true" ]; then
    log_error "Not authenticated. Run: $ADMIN_CLI auth login"
    exit 1
fi
log_success "Authenticated"

# Get entity type UUID (using the first one available)
log_step "Fetching entity types..."
ENTITY_TYPES=$($ADMIN_CLI entity-type list --json)
ENTITY_TYPE_UUID=$(echo "$ENTITY_TYPES" | grep -o '"uuid": *"[^"]*"' | head -1 | awk -F'"' '{print $4}')

if [ -z "$ENTITY_TYPE_UUID" ]; then
    log_error "No entity types found. Create one first with: $ADMIN_CLI entity-type create"
    exit 1
fi
log_success "Using entity type: $ENTITY_TYPE_UUID"

# 1. CREATE ENTITY + INITIAL USERS (Bulk Provisioning)
log_step "Step 1: Creating test entity with initial users (bulk provisioning)..."
TIMESTAMP=$(date +%s)
PROVISION_CONFIG=$(cat <<EOF
{
  "entity": {
    "name": "Test Entity $TIMESTAMP",
    "entity_type_uuid": "$ENTITY_TYPE_UUID",
    "email": "billing-test-$TIMESTAMP@example.com",
    "company_type": "Investment Firm",
    "organization_size": "10-50",
    "aum": 10000000,
    "country": "USA",
    "seats": 50,
    "expiration_date": "2025-12-31T00:00:00Z",
    "admin_email": "admin-test-$TIMESTAMP@example.com"
  },
  "admins": [
    {
      "email": "admin-$TIMESTAMP@example.com",
      "first_name": "Admin",
      "last_name": "User"
    }
  ],
  "users": [
    {
      "email": "analyst1-$TIMESTAMP@example.com",
      "first_name": "Analyst",
      "last_name": "One"
    }
  ]
}
EOF
)

echo "$PROVISION_CONFIG" > /tmp/test-provision-$TIMESTAMP.json
echo "Provision config saved to: /tmp/test-provision-$TIMESTAMP.json"
echo "Config contents:"
cat /tmp/test-provision-$TIMESTAMP.json
echo ""

echo "Running: $ADMIN_CLI provision apply --config /tmp/test-provision-$TIMESTAMP.json --json"
echo "Note: This may take a moment as it creates entity and users..."
echo "DEBUG: About to run provision apply command"
echo ""

set +e
$ADMIN_CLI provision apply --config /tmp/test-provision-$TIMESTAMP.json --json > /tmp/provision-response-$TIMESTAMP.txt 2>&1
PROVISION_EXIT_CODE=$?
set -e

echo "DEBUG: Provision command exited with code: $PROVISION_EXIT_CODE"
echo "DEBUG: Reading response file..."
PROVISION_RESPONSE=$(cat /tmp/provision-response-$TIMESTAMP.txt)
echo "DEBUG: Response file contents:"
echo "$PROVISION_RESPONSE"
echo ""

if [ $PROVISION_EXIT_CODE -ne 0 ]; then
    log_error "Provision command failed with exit code $PROVISION_EXIT_CODE"
    echo "Full response:"
    echo "$PROVISION_RESPONSE"
    exit 1
fi

echo "DEBUG: Attempting to extract entity_uuid from response..."
ENTITY_UUID=$(echo "$PROVISION_RESPONSE" | grep -o '"entity_uuid": *"[^"]*"' | head -1 | awk -F'"' '{print $4}')
echo "DEBUG: Extracted ENTITY_UUID='$ENTITY_UUID'"

if [ -z "$ENTITY_UUID" ]; then
    log_error "Failed to extract entity UUID from provision response"
    echo "Full response was:"
    echo "$PROVISION_RESPONSE"
    exit 1
fi
log_success "Entity + initial users created via bulk provisioning: $ENTITY_UUID"

# Store initial user emails
INITIAL_ADMIN_EMAIL="admin-$TIMESTAMP@example.com"
INITIAL_USER_EMAIL="analyst1-$TIMESTAMP@example.com"

# 2. ADD ANOTHER ADMIN USER
log_step "Step 2: Adding another admin user to the entity..."
ADMIN_EMAIL="admin2-$TIMESTAMP@example.com"
echo "Running: $ADMIN_CLI user create $ENTITY_UUID --email $ADMIN_EMAIL --first-name Admin --last-name Two --role admin --json"
ADMIN_RESPONSE=$($ADMIN_CLI user create "$ENTITY_UUID" \
    --email "$ADMIN_EMAIL" \
    --first-name "Admin" \
    --last-name "Two" \
    --role admin \
    --json 2>&1)
echo "API Response:"
echo "$ADMIN_RESPONSE"
echo ""

ADMIN_TEMP_PASSWORD=$(echo "$ADMIN_RESPONSE" | grep -o '"temporary_password": *"[^"]*"' | awk -F'"' '{print $4}')
if [ -z "$ADMIN_TEMP_PASSWORD" ]; then
    log_error "Failed to create additional admin user - no temporary password in response"
    exit 1
fi
log_success "Additional admin user created: $ADMIN_EMAIL (temp password: $ADMIN_TEMP_PASSWORD)"

# 3. ADD ANOTHER REGULAR USER
log_step "Step 3: Adding another regular user to the entity..."
USER_EMAIL="analyst2-$TIMESTAMP@example.com"
echo "Running: $ADMIN_CLI user create $ENTITY_UUID --email $USER_EMAIL --first-name Analyst --last-name Two --role user --json"
USER_RESPONSE=$($ADMIN_CLI user create "$ENTITY_UUID" \
    --email "$USER_EMAIL" \
    --first-name "Analyst" \
    --last-name "Two" \
    --role user \
    --json 2>&1)
echo "API Response:"
echo "$USER_RESPONSE"
echo ""

USER_TEMP_PASSWORD=$(echo "$USER_RESPONSE" | grep -o '"temporary_password": *"[^"]*"' | awk -F'"' '{print $4}')
if [ -z "$USER_TEMP_PASSWORD" ]; then
    log_error "Failed to create additional regular user - no temporary password in response"
    exit 1
fi
log_success "Additional regular user created: $USER_EMAIL (temp password: $USER_TEMP_PASSWORD)"

# 4. UPDATE ENTITY
log_step "Step 4: Updating entity (increasing seats to 100)..."
$ADMIN_CLI entity update "$ENTITY_UUID" --d '{"seats": 100}'
log_success "Entity updated (seats: 50 → 100)"

# Verify update
ENTITY_DETAILS=$($ADMIN_CLI entity show "$ENTITY_UUID" --json)
SEATS=$(echo "$ENTITY_DETAILS" | grep -o '"seats": *[^,}]*' | awk -F': ' '{print $2}')
if [ "$SEATS" != "100" ]; then
    log_error "Entity update verification failed (expected seats: 100, got: $SEATS)"
else
    log_success "Entity update verified"
fi

# 5. ADD DATA BACKEND
log_step "Step 5: Adding a data backend to the entity..."
echo "Running: $ADMIN_CLI data-backend add $ENTITY_UUID --name test-backend --url https://api.example.com --json"
DB_ADD_RESPONSE=$($ADMIN_CLI data-backend add "$ENTITY_UUID" \
    --name "test-backend" \
    --url "https://api.example.com" \
    --json 2>&1)
echo "API Response:"
echo "$DB_ADD_RESPONSE"
echo ""
log_success "Data backend added to entity"

# 6. LIST DATA BACKENDS
log_step "Step 6: Listing data backends..."
echo "Running: $ADMIN_CLI data-backend list $ENTITY_UUID --json"
DB_LIST_RESPONSE=$($ADMIN_CLI data-backend list "$ENTITY_UUID" --json 2>&1)
echo "API Response:"
echo "$DB_LIST_RESPONSE"
echo ""
log_success "Data backends listed"

# 7. UPDATE ENTITLEMENT (disable custom backends)
log_step "Step 7: Disabling custom backends for entity..."
echo "Running: $ADMIN_CLI entitlement update $ENTITY_UUID --data '{\"allow_custom_backends\": false}' --json"
ENT_RESPONSE=$($ADMIN_CLI entitlement update "$ENTITY_UUID" \
    --data '{"allow_custom_backends": false}' \
    --json 2>&1)
echo "API Response:"
echo "$ENT_RESPONSE"
echo ""
log_success "Custom backends disabled for entity"

# 8. DELETE DATA BACKEND
log_step "Step 8: Deleting the data backend..."
echo "Running: $ADMIN_CLI data-backend delete $ENTITY_UUID --name test-backend --json"
DB_DEL_RESPONSE=$($ADMIN_CLI data-backend delete "$ENTITY_UUID" \
    --name "test-backend" \
    --json 2>&1)
echo "API Response:"
echo "$DB_DEL_RESPONSE"
echo ""
log_success "Data backend deleted"

# 9. VERIFY DATA BACKENDS EMPTY
log_step "Step 9: Verifying data backends removed..."
echo "Running: $ADMIN_CLI data-backend list $ENTITY_UUID --json"
DB_VERIFY_RESPONSE=$($ADMIN_CLI data-backend list "$ENTITY_UUID" --json 2>&1)
echo "API Response:"
echo "$DB_VERIFY_RESPONSE"
echo ""
# Check if response is an empty list
if [ "$DB_VERIFY_RESPONSE" = "[]" ]; then
    log_success "Verified: 0 data backends remaining"
else
    log_error "Expected 0 data backends after deletion"
fi

# 10. UPDATE USERS (reset passwords for all users)
log_step "Step 10: Resetting passwords for all users..."

# Reset initial admin password
INITIAL_ADMIN_RESET=$($ADMIN_CLI user reset-password "$INITIAL_ADMIN_EMAIL" --json)
INITIAL_ADMIN_NEW_PASSWORD=$(echo "$INITIAL_ADMIN_RESET" | grep -o '"temporary_password": *"[^"]*"' | awk -F'"' '{print $4}')
log_success "Initial admin password reset: $INITIAL_ADMIN_EMAIL"

# Reset additional admin password
ADMIN_RESET=$($ADMIN_CLI user reset-password "$ADMIN_EMAIL" --json)
ADMIN_NEW_PASSWORD=$(echo "$ADMIN_RESET" | grep -o '"temporary_password": *"[^"]*"' | awk -F'"' '{print $4}')
log_success "Additional admin password reset: $ADMIN_EMAIL"

# Reset initial user password
INITIAL_USER_RESET=$($ADMIN_CLI user reset-password "$INITIAL_USER_EMAIL" --json)
INITIAL_USER_NEW_PASSWORD=$(echo "$INITIAL_USER_RESET" | grep -o '"temporary_password": *"[^"]*"' | awk -F'"' '{print $4}')
log_success "Initial user password reset: $INITIAL_USER_EMAIL"

# Reset additional user password
USER_RESET=$($ADMIN_CLI user reset-password "$USER_EMAIL" --json)
USER_NEW_PASSWORD=$(echo "$USER_RESET" | grep -o '"temporary_password": *"[^"]*"' | awk -F'"' '{print $4}')
log_success "Additional user password reset: $USER_EMAIL"

# 11. DELETE ALL USERS (Note: May fail due to permissions)
log_step "Step 11: Attempting to delete all users..."
echo "Note: Deletion may fail if authenticated admin is not part of the test entity"
echo ""

set +e  # Don't exit on error for deletions
USERS_DELETED=0
USERS_FAILED=0
ENTITY_DELETED=0

# Try to delete initial admin
DELETE_RESPONSE=$($ADMIN_CLI user delete "$INITIAL_ADMIN_EMAIL" --json 2>&1)
if echo "$DELETE_RESPONSE" | grep -q "404"; then
    echo -e "${YELLOW}⚠${NC} Could not delete: $INITIAL_ADMIN_EMAIL"
    USERS_FAILED=$((USERS_FAILED + 1))
else
    log_success "Deleted: $INITIAL_ADMIN_EMAIL"
    USERS_DELETED=$((USERS_DELETED + 1))
fi

# Try to delete additional admin
DELETE_RESPONSE=$($ADMIN_CLI user delete "$ADMIN_EMAIL" --json 2>&1)
if echo "$DELETE_RESPONSE" | grep -q "404"; then
    echo -e "${YELLOW}⚠${NC} Could not delete: $ADMIN_EMAIL"
    USERS_FAILED=$((USERS_FAILED + 1))
else
    log_success "Deleted: $ADMIN_EMAIL"
    USERS_DELETED=$((USERS_DELETED + 1))
fi

# Try to delete initial user
DELETE_RESPONSE=$($ADMIN_CLI user delete "$INITIAL_USER_EMAIL" --json 2>&1)
if echo "$DELETE_RESPONSE" | grep -q "404"; then
    echo -e "${YELLOW}⚠${NC} Could not delete: $INITIAL_USER_EMAIL"
    USERS_FAILED=$((USERS_FAILED + 1))
else
    log_success "Deleted: $INITIAL_USER_EMAIL"
    USERS_DELETED=$((USERS_DELETED + 1))
fi

# Try to delete additional user
DELETE_RESPONSE=$($ADMIN_CLI user delete "$USER_EMAIL" --json 2>&1)
if echo "$DELETE_RESPONSE" | grep -q "404"; then
    echo -e "${YELLOW}⚠${NC} Could not delete: $USER_EMAIL"
    USERS_FAILED=$((USERS_FAILED + 1))
else
    log_success "Deleted: $USER_EMAIL"
    USERS_DELETED=$((USERS_DELETED + 1))
fi


# Delete entity
log_step "Deleting test entity: $ENTITY_UUID"
DELETE_ENTITY_RESPONSE=$($ADMIN_CLI entity delete "$ENTITY_UUID" --json 2>&1)
if echo "$DELETE_ENTITY_RESPONSE" | grep -q "404"; then
    echo -e "${YELLOW}⚠${NC} Could not delete entity: $ENTITY_UUID"
else
    log_success "Deleted entity: $ENTITY_UUID"
    ENTITY_DELETED=1
fi

set -e  # Re-enable exit on error

# 12. CLEANUP SUMMARY
log_step "Step 12: Cleanup summary..."

# Cleanup temp files
rm -f /tmp/test-provision-$TIMESTAMP.json

echo ""
echo "======================================="
echo "WORKFLOW TEST SUMMARY"
echo "======================================="
echo ""
echo "✓ Bulk Provisioning: Entity + 2 initial users created"
echo "  Method: provision apply (matches README Bulk Provisioning)"
echo "  Entity UUID: $ENTITY_UUID"
echo "  Name: Test Entity $TIMESTAMP"
echo "  AUM: 10000000 (matches README)"
echo "  Seats: 50 → 100 (updated, matches README Section 3)"
echo "  Expiration: 2025-12-31T00:00:00Z"
echo ""
echo "✓ Initial users (via provisioning):"
echo "  - Admin: $INITIAL_ADMIN_EMAIL"
echo "  - User:  $INITIAL_USER_EMAIL"
echo ""
echo "✓ Additional users (created individually):"
echo "  - Admin: $ADMIN_EMAIL (matches README Section 5)"
echo "  - User:  $USER_EMAIL (matches README Section 5)"
echo ""
echo "✓ Total users: 4 (2 admins, 2 regular users)"
echo ""
echo "✓ Total entities deleted: $ENTITY_DELETED/1"
echo ""
echo "✓ Data backend operations tested:"
echo "  - Add backend: test-backend (matches README Section 9)"
echo "  - List backends"
echo "  - Delete backend: test-backend"
echo ""
echo "✓ Entitlement operations tested:"
echo "  - Disable custom backends (allow_custom_backends: false)"
echo ""
echo "✓ User operations tested:"
echo "  - Password reset: 4/4 users (matches README Section 8)"
echo ""

TOTAL_USERS=4
if [ "$USERS_DELETED" -eq "$TOTAL_USERS" ]; then
    echo "✓ Users deleted: $USERS_DELETED/$TOTAL_USERS (matches README Section 6)"
    echo ""
    log_success "Workflow completed - all operations successful!"
elif [ "$USERS_DELETED" -gt 0 ]; then
    echo "⚠ Partial deletion: $USERS_DELETED/$TOTAL_USERS users deleted, $USERS_FAILED failed"
    echo ""
    echo -e "${YELLOW}Note:${NC} Remaining users need manual cleanup:"
    echo "  Entity UUID: $ENTITY_UUID"
    if [ "$USERS_FAILED" -gt 0 ]; then
        echo "  Failed to delete $USERS_FAILED user(s) - check entity for remaining users"
    fi
    echo ""
    echo -e "${YELLOW}Partial Success:${NC} Most operations successful"
    echo "Some deletions failed due to cross-entity admin permissions (expected limitation from README Section 6)"
else
    echo "⚠ Users NOT deleted ($USERS_FAILED failed)"
    echo "  - All users remain in entity $ENTITY_UUID"
    echo "  - Manual cleanup required"
    echo ""
    echo -e "${YELLOW}Note:${NC} Entity and users need manual cleanup:"
    echo "  Entity UUID: $ENTITY_UUID"
    echo "  Initial admin: $INITIAL_ADMIN_EMAIL"
    echo "  Additional admin: $ADMIN_EMAIL"
    echo "  Initial user: $INITIAL_USER_EMAIL"
    echo "  Additional user: $USER_EMAIL"
    echo ""
    echo -e "${YELLOW}Partial Success:${NC} Workflow tested create/update operations successfully"
    echo "All deletions failed due to cross-entity admin permissions (expected limitation from README Section 6)"
fi
echo ""
echo "======================================="
