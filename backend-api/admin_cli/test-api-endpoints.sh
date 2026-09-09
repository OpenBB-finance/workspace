#!/bin/bash
# OpenBB Admin API - Direct HTTP Endpoint Test Script
# Tests the raw API endpoints with curl (mirrors test-workflow.sh)
#
# This shows what the HubAPIClient does under the hood.
#
# Usage:
#     ./test-api-endpoints.sh
#
#     # Or with environment variables:
#     OPENBB_BASE_URL=http://localhost:8000 ./test-api-endpoints.sh

set -e

BASE_URL="${OPENBB_BASE_URL:-https://payments.openbb.dev}"
TIMESTAMP=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() { echo -e "${YELLOW}==>${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Helper: make authenticated API request
api_request() {
    local METHOD=$1
    local ENDPOINT=$2
    local DATA=$3

    if [ -n "$DATA" ]; then
        curl -s -X "$METHOD" "$BASE_URL$ENDPOINT" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -d "$DATA"
    else
        curl -s -X "$METHOD" "$BASE_URL$ENDPOINT" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $ACCESS_TOKEN"
    fi
}

# Helper: extract JSON value (simple grep-based, works for flat keys)
json_val() {
    echo "$1" | grep -o "\"$2\": *\"[^\"]*\"" | head -1 | awk -F'"' '{print $4}'
}

# =============================================================================
# 1. AUTHENTICATION
# =============================================================================
log_step "Step 1: Authenticating..."
echo "Endpoint: POST /pro/login"

EMAIL="${ADMIN_EMAIL:-}"
PASSWORD="${ADMIN_PASSWORD:-}"

if [ -z "$EMAIL" ]; then
    read -p "Email: " EMAIL
fi
if [ -z "$PASSWORD" ]; then
    read -sp "Password: " PASSWORD
    echo ""
fi

AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/pro/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$EMAIL\",
        \"password\": \"$PASSWORD\",
        \"remember\": false,
        \"ip_address\": \"\",
        \"source\": \"pro\",
        \"totp_token\": null
    }")

ACCESS_TOKEN=$(json_val "$AUTH_RESPONSE" "access_token")

if [ -z "$ACCESS_TOKEN" ]; then
    log_error "Authentication failed"
    echo "$AUTH_RESPONSE"
    exit 1
fi
log_success "Authenticated (token: ${ACCESS_TOKEN:0:10}...)"

# =============================================================================
# 2. LIST ENTITY TYPES
# =============================================================================
log_step "Step 2: Fetching entity types..."
echo "Endpoint: GET /entity/entity-type?page=1&size=100"

ENTITY_TYPES=$(api_request GET "/entity/entity-type?page=1&size=100")
ENTITY_TYPE_UUID=$(json_val "$ENTITY_TYPES" "uuid")

if [ -z "$ENTITY_TYPE_UUID" ]; then
    log_error "No entity types found"
    exit 1
fi
log_success "Using entity type: $ENTITY_TYPE_UUID"

# =============================================================================
# 3. CREATE ENTITY
# =============================================================================
log_step "Step 3: Creating entity..."
echo "Endpoint: POST /entity/entity"

ENTITY_RESPONSE=$(api_request POST "/entity/entity" "{
    \"name\": \"Test Entity $TIMESTAMP\",
    \"entity_code\": \"$ENTITY_TYPE_UUID\",
    \"email\": \"billing-$TIMESTAMP@example.com\",
    \"admin_email\": \"admin-$TIMESTAMP@example.com\",
    \"company_type\": \"Investment Firm\",
    \"organization_size\": \"10-50\",
    \"aum\": 10000000,
    \"country\": \"USA\",
    \"seats\": 50,
    \"expiration_date\": \"2025-12-31T00:00:00Z\"
}")

ENTITY_UUID=$(json_val "$ENTITY_RESPONSE" "entity_uuid")

if [ -z "$ENTITY_UUID" ]; then
    log_error "Failed to create entity"
    echo "$ENTITY_RESPONSE"
    exit 1
fi
log_success "Entity created: $ENTITY_UUID"

# =============================================================================
# 4. UPDATE ENTITY ENTITLEMENTS (what entity_create_with_entitlements does)
# =============================================================================
log_step "Step 4: Updating entity entitlements..."
echo "Endpoint: PATCH /entity/entitlement/{entity_uuid}?update_all=true"

ENTITLEMENT_RESPONSE=$(api_request PATCH "/entity/entitlement/$ENTITY_UUID?update_all=true" "{
    \"tier\": \"pro\",
    \"number_copilot_calls_day\": 10000,
    \"total_file_upload_size_gb\": 10,
    \"excel_add_in\": 1,
    \"bundle_name\": \"On-Premise\"
}")

log_success "Entitlements configured (On-Premise bundle)"

# =============================================================================
# 5. GET PERMISSION MAPS (what get_permission_map_by_role does)
# =============================================================================
log_step "Step 5: Fetching permission maps for entity..."
echo "Endpoint: GET /entity/entity-map?size=100&page=1"

PERMISSION_MAPS=$(api_request GET "/entity/entity-map?size=100&page=1")

# Parse permission maps using Python (more reliable than grep for nested JSON)
ADMIN_PERM_UUID=$(echo "$PERMISSION_MAPS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data.get('items', []):
    if item.get('entity_uuid') == '$ENTITY_UUID' and item.get('name') == 'Admin':
        print(item['uuid'])
        break
" 2>/dev/null || echo "")

USER_PERM_UUID=$(echo "$PERMISSION_MAPS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data.get('items', []):
    if item.get('entity_uuid') == '$ENTITY_UUID' and item.get('name') == 'User':
        print(item['uuid'])
        break
" 2>/dev/null || echo "")

if [ -z "$ADMIN_PERM_UUID" ] || [ -z "$USER_PERM_UUID" ]; then
    log_error "Failed to find permission maps"
    exit 1
fi
log_success "Admin permission map: $ADMIN_PERM_UUID"
log_success "User permission map: $USER_PERM_UUID"

# =============================================================================
# 6. CREATE ADMIN USER
# =============================================================================
log_step "Step 6: Creating admin user..."
echo "Endpoint: POST /admin/create-user"
echo "Note: HubAPIClient.user_create() does step 5 + 6 automatically"

ADMIN_EMAIL="admin-$TIMESTAMP@example.com"

ADMIN_USER_RESPONSE=$(api_request POST "/admin/create-user" "{
    \"email\": \"$ADMIN_EMAIL\",
    \"permissions_uuid\": \"$ADMIN_PERM_UUID\",
    \"first_name\": \"Admin\",
    \"last_name\": \"User\"
}")

ADMIN_TEMP_PASSWORD=$(json_val "$ADMIN_USER_RESPONSE" "temporary_password")

if [ -z "$ADMIN_TEMP_PASSWORD" ]; then
    log_error "Failed to create admin user"
    echo "$ADMIN_USER_RESPONSE"
else
    log_success "Admin created: $ADMIN_EMAIL (password: $ADMIN_TEMP_PASSWORD)"
fi

# =============================================================================
# 7. CREATE REGULAR USER
# =============================================================================
log_step "Step 7: Creating regular user..."
echo "Endpoint: POST /admin/create-user"

USER_EMAIL="analyst-$TIMESTAMP@example.com"

USER_RESPONSE=$(api_request POST "/admin/create-user" "{
    \"email\": \"$USER_EMAIL\",
    \"permissions_uuid\": \"$USER_PERM_UUID\",
    \"first_name\": \"Analyst\",
    \"last_name\": \"One\"
}")

USER_TEMP_PASSWORD=$(json_val "$USER_RESPONSE" "temporary_password")

if [ -z "$USER_TEMP_PASSWORD" ]; then
    log_error "Failed to create regular user"
    echo "$USER_RESPONSE"
else
    log_success "User created: $USER_EMAIL (password: $USER_TEMP_PASSWORD)"
fi

# =============================================================================
# 8. LIST ENTITIES (to get entity details)
# =============================================================================
log_step "Step 8: Getting entity details..."
echo "Endpoint: GET /entity/entity?page=1&size=100"
echo "Note: HubAPIClient.entity_get() iterates pages to find by UUID"

ENTITIES=$(api_request GET "/entity/entity?page=1&size=100")

# Extract our entity details
ENTITY_DETAILS=$(echo "$ENTITIES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data.get('items', []):
    if item.get('uuid') == '$ENTITY_UUID':
        print(json.dumps(item, indent=2))
        break
" 2>/dev/null || echo "{}")

echo "$ENTITY_DETAILS" | head -10
log_success "Retrieved entity details"

# =============================================================================
# 9. UPDATE ENTITY (smart partial update)
# =============================================================================
log_step "Step 9: Updating entity (seats: 50 -> 100)..."
echo "Endpoint: PUT /entity/entity/{uuid}"
echo "Note: HubAPIClient.entity_update() fetches current state, merges changes, then PUTs"

# For PUT, we need to send the full payload (the client does fetch-merge-put)
UPDATE_RESPONSE=$(api_request PUT "/entity/entity/$ENTITY_UUID" "{
    \"name\": \"Test Entity $TIMESTAMP\",
    \"entity_code\": \"$ENTITY_TYPE_UUID\",
    \"email\": \"billing-$TIMESTAMP@example.com\",
    \"company_type\": \"Investment Firm\",
    \"organization_size\": \"10-50\",
    \"aum\": 10000000,
    \"country\": \"USA\",
    \"seats\": 100,
    \"expiration_date\": \"2025-12-31T00:00:00Z\"
}")

log_success "Entity updated (seats: 50 -> 100)"

# =============================================================================
# 10. FIND USER BY EMAIL
# =============================================================================
log_step "Step 10: Finding user by email..."
echo "Endpoint: GET /entity/user?email={email}&page=1&size=100"
echo "Note: HubAPIClient.user_get_by_email() does this"

USER_LOOKUP=$(api_request GET "/entity/user?email=$USER_EMAIL&page=1&size=100")
USER_UUID=$(echo "$USER_LOOKUP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data.get('items', [])
if items:
    print(items[0]['uuid'])
" 2>/dev/null || echo "")

if [ -z "$USER_UUID" ]; then
    log_error "User not found"
else
    log_success "Found user UUID: $USER_UUID"
fi

# =============================================================================
# 11. RESET USER PASSWORD
# =============================================================================
log_step "Step 11: Resetting user password..."
echo "Endpoint: POST /admin/reset-password/{user_uuid}"

if [ -n "$USER_UUID" ]; then
    RESET_RESPONSE=$(api_request POST "/admin/reset-password/$USER_UUID")
    NEW_PASSWORD=$(json_val "$RESET_RESPONSE" "temporary_password")
    log_success "Password reset: $USER_EMAIL (new: $NEW_PASSWORD)"
fi

# =============================================================================
# 12. DELETE USER
# =============================================================================
log_step "Step 12: Deleting user..."
echo "Endpoint: DELETE /admin/users/{user_uuid}/remove"

if [ -n "$USER_UUID" ]; then
    DELETE_RESPONSE=$(api_request DELETE "/admin/users/$USER_UUID/remove")
    log_success "User deleted: $USER_EMAIL"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "======================================="
echo "API ENDPOINT REFERENCE"
echo "======================================="
echo ""
echo "What HubAPIClient abstracts:"
echo ""
echo "| Client Method                      | Raw Endpoints                              |"
echo "|------------------------------------|-------------------------------------------|"
echo "| auth_login(email, pw)              | POST /pro/login                           |"
echo "| entity_type_list()                 | GET /entity/entity-type                   |"
echo "| entity_create_with_entitlements()  | POST /entity/entity                       |"
echo "|                                    | + PATCH /entity/entitlement/{uuid}        |"
echo "| entity_get(uuid)                   | GET /entity/entity (iterates pages)       |"
echo "| entity_update(uuid, **kwargs)      | GET + merge + PUT /entity/entity/{uuid}   |"
echo "| get_permission_map_by_role()       | GET /entity/entity-map + filter           |"
echo "| user_create(entity, email, role)   | GET permission map + POST /admin/create-user |"
echo "| user_get_by_email(email)           | GET /entity/user?email=X                  |"
echo "| user_reset_password(uuid)          | POST /admin/reset-password/{uuid}         |"
echo "| user_delete(uuid)                  | DELETE /admin/users/{uuid}/remove         |"
echo "| provision_full(config)             | All of the above in sequence              |"
echo ""
echo "======================================="
echo ""
echo "Test Results:"
echo "  Entity UUID: $ENTITY_UUID"
echo "  Admin: $ADMIN_EMAIL"
echo "======================================="
