# Auth Tests

Rate Limiting / Brute Force Protection

Login rate limiting (multiple failed attempts)
Registration rate limiting
Password reset rate limiting
Password Validation

Weak password rejection (too short, no special chars, etc.)
Password with spaces/unicode characters
Password matching username/email rejection
Session Management

Multiple concurrent sessions for same user
Session invalidation on password change
Session expiry behavior
Logout invalidates specific session vs all sessions
Token Security

Expired JWT rejection
Malformed JWT handling
Token refresh flow
Access token vs refresh token separation
Account States

Locked account login attempt
Suspended/banned user login
Soft-deleted user login attempt
Email Validation Edge Cases

Case sensitivity (Test@Email.com vs test@email.com)
Email with plus addressing (user+tag@domain.com)
IDN/punycode email domains
2FA/TOTP Edge Cases

Login with TOTP enabled but no code provided
Login with expired TOTP code
TOTP backup codes
TOTP deactivation flow
Password Reset Flow

Reset token expiry
Reset token single-use enforcement
Reset for nonexistent email (timing attack prevention)
OAuth Edge Cases

OAuth account linking to existing email
OAuth with revoked token
OAuth provider down/timeout handling