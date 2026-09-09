import uuid
from datetime import datetime
from unittest.mock import patch

import pytest

from api.email.hubspot import HubSpotEmail


@pytest.fixture
def email_service():
    return HubSpotEmail()


@patch("api.email.hubspot.hubspot")
def test_send_welcome_email(mock_hubspot, email_service):
    email = "test@example.com"
    email_service.send_welcome_email(email)
    mock_hubspot.send_welcome_email.assert_called_once_with(email)


@patch("api.email.hubspot.hubspot")
def test_send_invite_emails(mock_hubspot, email_service):
    from_email = "admin@example.com"
    to_emails = ["user1@example.com", "user2@example.com"]
    email_service.send_invite_emails(from_email, to_emails)
    mock_hubspot.send_invite_emails.assert_called_once_with(from_email, to_emails)


@patch("api.email.hubspot.hubspot")
def test_send_confirmation(mock_hubspot, email_service):
    token = "some_token"
    email = "test@example.com"
    email_service.send_confirmation(token, email)
    mock_hubspot.send_confirmation.assert_called_once_with(token, email)


@patch("api.email.hubspot.hubspot")
def test_send_create_account(mock_hubspot, email_service):
    token = uuid.uuid4()
    to = "test@example.com"
    password = "password123"
    inviter = "inviter@example.com"
    message = "Welcome!"
    is_free_tier = True

    email_service.send_create_account(
        token, to, password, inviter, message, is_free_tier
    )
    mock_hubspot.send_create_account.assert_called_once_with(
        token, to, password, inviter, message, is_free_tier
    )


@patch("api.email.hubspot.hubspot")
def test_send_password_reset(mock_hubspot, email_service):
    token = "reset_token"
    email = "test@example.com"
    email_service.send_password_reset(token, email)
    mock_hubspot.send_password_reset.assert_called_once_with(token, email)


@patch("api.email.hubspot.hubspot")
def test_send_password_reset_confirmation(mock_hubspot, email_service):
    email = "test@example.com"
    email_service.send_password_reset_confirmation(email)
    mock_hubspot.send_password_reset_confirmation.assert_called_once_with(email)


@patch("api.email.hubspot.hubspot")
def test_send_support_received(mock_hubspot, email_service):
    email = "test@example.com"
    email_service.send_support_received(email)
    mock_hubspot.send_support_received.assert_called_once_with(email)


@patch("api.email.hubspot.hubspot")
def test_four_days_no_use(mock_hubspot, email_service):
    email = "test@example.com"
    first_name = "John"
    email_service.four_days_no_use(email, first_name)
    mock_hubspot.four_days_no_use.assert_called_once_with(email, first_name)


@patch("api.email.hubspot.hubspot")
def test_send_pat_warning(mock_hubspot, email_service):
    email = "test@example.com"
    exp = datetime.now()
    email_service.send_pat_warning(email, exp)
    mock_hubspot.send_pat_warning.assert_called_once_with(email, exp)


@patch("api.email.hubspot.hubspot")
def test_send_share_notice(mock_hubspot, email_service):
    to = "to@example.com"
    sharer = "sharer@example.com"
    dashboard_uuid = uuid.uuid4()
    email_service.send_share_notice(to, sharer, dashboard_uuid)
    mock_hubspot.send_share_notice.assert_called_once_with(to, sharer, dashboard_uuid)


@patch("api.email.hubspot.hubspot")
def test_send_account_takeover(mock_hubspot, email_service):
    token = "token"
    to = "to@example.com"
    inviter = "inviter@example.com"
    message = "Takeover"
    email_service.send_account_takeover(token, to, inviter, message)
    mock_hubspot.send_account_takeover.assert_called_once_with(
        token, to, inviter, message
    )


@patch("api.email.hubspot.hubspot")
def test_extend_pro_trial(mock_hubspot, email_service):
    to = "to@example.com"
    user_uuid = uuid.uuid4()
    email_service.extend_pro_trial(to, user_uuid)
    mock_hubspot.extend_pro_trial.assert_called_once_with(to, user_uuid)


@patch("api.email.hubspot.hubspot")
def test_send_dynamic_template(mock_hubspot, email_service):
    to = "to@example.com"
    template = "welcome"
    email_service.send_dynamic_template(to, template)
    mock_hubspot.send_dynamic_template.assert_called_once_with(to, template)


@patch("api.email.hubspot.hubspot")
def test_send_new_entity(mock_hubspot, email_service):
    to = "to@example.com"
    entity_name = "New Entity"
    email_service.send_new_entity(to, entity_name)
    mock_hubspot.send_new_entity.assert_called_once_with(to, entity_name)
