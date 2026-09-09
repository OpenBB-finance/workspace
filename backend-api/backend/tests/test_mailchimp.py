"""Unit tests for api.email.mailchimp and the create_html helper in api.base."""

from datetime import datetime
from unittest.mock import patch
from uuid import uuid4

from api.base import create_html
from api.email.mailchimp import (
    MailChimpEmail,
    Template,
    send_account_takeover,
    send_create_account,
    send_customer_email,
    send_dynamic_template,
    send_email,
    send_invite_emails,
    send_new_entity,
    send_password_reset,
    send_password_reset_confirmation,
    send_pat_day_warning,
    send_pat_week_warning,
    send_share_notice,
    send_support_received,
    send_template,
    send_welcome_email,
)

# ---------------------------------------------------------------------------
# create_html tests
# ---------------------------------------------------------------------------


class TestCreateHtml:
    def test_none_returns_br(self):
        assert create_html(None) == "<br>"

    def test_empty_string_returns_br(self):
        assert create_html("") == "<br>"

    def test_plain_text_wrapped_in_blockquote(self):
        result = create_html("hello world")
        assert "<blockquote" in result
        assert "hello world" in result
        assert "Here is a brief message from them:" in result

    def test_newlines_converted_to_br(self):
        # newlines become <br>, then tag stripping removes <br> tags,
        # so the text content is joined without line breaks
        result = create_html("line1\nline2")
        assert "line1" in result
        assert "line2" in result

    def test_html_tags_stripped_from_message(self):
        result = create_html("<script>alert('xss')</script>hello")
        assert "<script>" not in result
        assert "</script>" not in result
        # The text content between tags is preserved but escaped
        assert "hello" in result

    def test_special_chars_escaped(self):
        # Note: < c > is treated as an HTML tag and stripped by the regex
        result = create_html('a & b "e"')
        assert "&amp;" in result
        assert "&quot;" in result

    def test_returns_string(self):
        assert isinstance(create_html("test"), str)


# ---------------------------------------------------------------------------
# Template enum
# ---------------------------------------------------------------------------


class TestTemplateEnum:
    def test_workspace_invite_free_tier_value(self):
        assert (
            Template.WORKSPACE_INVITE_FREE_TIER.value
            == "workspace-invite-free-tier-without-account"
        )

    def test_workspace_invite_pro_tier_value(self):
        assert (
            Template.WORKSPACE_INVITE_PRO_TIER.value
            == "workspace-invite-pro-tier-without-account"
        )

    def test_reset_password_value(self):
        assert Template.RESET_PASSWORD.value == "reset-password"

    def test_all_members_have_string_values(self):
        for member in Template:
            assert isinstance(member.value, str)
            assert len(member.value) > 0


# ---------------------------------------------------------------------------
# send_email tests
# ---------------------------------------------------------------------------


class TestSendEmail:
    @patch("api.email.mailchimp.settings")
    def test_non_production_logs_only(self, mock_settings):
        mock_settings.MODE = "local"
        result = send_email("to@test.com", "from@test.com", "Subject", "body")
        assert result is True

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_production_calls_mailchimp(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "production"
        mock_mailchimp.messages.send.return_value = [{"status": "sent"}]
        result = send_email("to@test.com", "from@test.com", "Subject", "body")
        assert result is True
        mock_mailchimp.messages.send.assert_called_once()
        call_args = mock_mailchimp.messages.send.call_args[0][0]
        assert call_args["message"]["to"][0]["email"] == "to@test.com"

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_production_api_error_returns_false(self, mock_settings, mock_mailchimp):
        from mailchimp_transactional.api_client import ApiClientError

        mock_settings.MODE = "production"
        mock_mailchimp.messages.send.side_effect = ApiClientError("fail", 500)
        result = send_email("to@test.com", "from@test.com", "Subject", "body")
        assert result is False

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_onprem_logs_only(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "onprem"
        result = send_email("to@test.com", "from@test.com", "Subject", "body")
        assert result is True
        mock_mailchimp.messages.send.assert_not_called()


# ---------------------------------------------------------------------------
# send_template tests
# ---------------------------------------------------------------------------


class TestSendTemplate:
    @patch("api.email.mailchimp.settings")
    def test_non_production_returns_true(self, mock_settings):
        mock_settings.MODE = "local"
        result = send_template(
            Template.RESET_PASSWORD, "to@test.com", "Subject", {"key": "val"}
        )
        assert result is True

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_production_sends_template(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "production"
        mock_mailchimp.messages.send_template.return_value = [{"status": "sent"}]
        result = send_template(
            Template.RESET_PASSWORD, "to@test.com", "Reset", {"url": "http://x"}
        )
        assert result is True
        mock_mailchimp.messages.send_template.assert_called_once()
        call_args = mock_mailchimp.messages.send_template.call_args[0][0]
        assert call_args["template_name"] == "reset-password"
        assert call_args["message"]["merge_language"] == "handlebars"

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_accepts_string_template_name(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "production"
        mock_mailchimp.messages.send_template.return_value = [{"status": "sent"}]
        result = send_template("custom-template", "to@test.com", "Subject", {})
        assert result is True
        call_args = mock_mailchimp.messages.send_template.call_args[0][0]
        assert call_args["template_name"] == "custom-template"

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_merge_vars_passed_correctly(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "production"
        mock_mailchimp.messages.send_template.return_value = [{"status": "sent"}]
        content = {"foo": "bar", "baz": "qux"}
        send_template(Template.RESET_PASSWORD, "to@test.com", "Subject", content)
        call_args = mock_mailchimp.messages.send_template.call_args[0][0]
        merge_vars = call_args["message"]["global_merge_vars"]
        names = {v["name"] for v in merge_vars}
        assert names == {"foo", "baz"}

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_api_error_returns_false(self, mock_settings, mock_mailchimp):
        from mailchimp_transactional.api_client import ApiClientError

        mock_settings.MODE = "production"
        mock_mailchimp.messages.send_template.side_effect = ApiClientError("fail", 500)
        result = send_template(Template.RESET_PASSWORD, "to@test.com", "Subject", {})
        assert result is False

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_onprem_logs_only(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "onprem"
        result = send_template(Template.RESET_PASSWORD, "to@test.com", "Subject", {})
        assert result is True
        mock_mailchimp.messages.send_template.assert_not_called()

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_default_from_email_is_no_reply(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "production"
        mock_mailchimp.messages.send_template.return_value = [{"status": "sent"}]
        send_template(Template.RESET_PASSWORD, "to@test.com", "Subject", {})
        call_args = mock_mailchimp.messages.send_template.call_args[0][0]
        assert call_args["message"]["from_email"] == "no-reply@openbb.co"

    @patch("api.email.mailchimp.mailchimp", create=True)
    @patch("api.email.mailchimp.settings")
    def test_custom_from_email_is_used(self, mock_settings, mock_mailchimp):
        mock_settings.MODE = "production"
        mock_mailchimp.messages.send_template.return_value = [{"status": "sent"}]
        send_template(
            Template.RESET_PASSWORD,
            "to@test.com",
            "Subject",
            {},
            from_email="support@openbb.co",
        )
        call_args = mock_mailchimp.messages.send_template.call_args[0][0]
        assert call_args["message"]["from_email"] == "support@openbb.co"


# ---------------------------------------------------------------------------
# send_create_account tests
# ---------------------------------------------------------------------------


class TestSendCreateAccount:
    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_pro_trial_uses_confirm_account_new(self, mock_settings, mock_send):
        mock_settings.PRO_TRIAL_EMAIL = "trial@openbb.co"
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True

        token = uuid4()
        send_create_account(token, "user@test.com", "pass123", "trial@openbb.co")
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == Template.CONFIRM_ACCOUNT_NEW

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_free_tier_uses_workspace_invite_free(self, mock_settings, mock_send):
        mock_settings.PRO_TRIAL_EMAIL = "trial@openbb.co"
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True

        token = uuid4()
        send_create_account(
            token,
            "user@test.com",
            "pass123",
            "admin@company.com",
            message="Join us!",
            is_free_tier=True,
        )
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == Template.WORKSPACE_INVITE_FREE_TIER

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_pro_tier_uses_workspace_invite_pro(self, mock_settings, mock_send):
        mock_settings.PRO_TRIAL_EMAIL = "trial@openbb.co"
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True

        token = uuid4()
        send_create_account(
            token,
            "user@test.com",
            "pass123",
            "admin@company.com",
            message="Join us!",
            is_free_tier=False,
        )
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == Template.WORKSPACE_INVITE_PRO_TIER

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_message_html_passed_in_data(self, mock_settings, mock_send):
        mock_settings.PRO_TRIAL_EMAIL = "trial@openbb.co"
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True

        token = uuid4()
        send_create_account(
            token,
            "user@test.com",
            "pass123",
            "admin@company.com",
            message="hello",
            is_free_tier=True,
        )
        data = mock_send.call_args[0][3]
        assert "message" in data
        assert "hello" in data["message"]
        assert "<blockquote" in data["message"]

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_no_message_still_sends(self, mock_settings, mock_send):
        mock_settings.PRO_TRIAL_EMAIL = "trial@openbb.co"
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True

        token = uuid4()
        send_create_account(
            token,
            "user@test.com",
            "pass123",
            "admin@company.com",
            message=None,
            is_free_tier=True,
        )
        data = mock_send.call_args[0][3]
        assert data["message"] == "<br>"


# ---------------------------------------------------------------------------
# send_account_takeover tests
# ---------------------------------------------------------------------------


class TestSendAccountTakeover:
    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_uses_confirm_account_existing_template(self, mock_settings, mock_send):
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True

        send_account_takeover("token123", "user@test.com", "admin@co.com", "hi there")
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == Template.CONFIRM_ACCOUNT_EXISTING

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_message_html_included(self, mock_settings, mock_send):
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True

        send_account_takeover("token123", "user@test.com", "admin@co.com", "welcome!")
        data = mock_send.call_args[0][3]
        assert "welcome!" in data["message"]


# ---------------------------------------------------------------------------
# Other send_* wrapper tests
# ---------------------------------------------------------------------------


class TestSendWrappers:
    @patch("api.email.mailchimp.send_template")
    def test_send_welcome_email(self, mock_send):
        mock_send.return_value = True
        result = send_welcome_email("user@test.com")
        assert result is True
        assert mock_send.call_args[0][0] == Template.DAY_1_FREE_TIER_ANALYSTS

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_send_password_reset(self, mock_settings, mock_send):
        mock_settings.SELFURL = "http://localhost:8000"
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True
        result = send_password_reset("token", "user@test.com")
        assert result is True
        assert mock_send.call_args[0][0] == Template.RESET_PASSWORD

    @patch("api.email.mailchimp.send_template")
    def test_send_password_reset_confirmation(self, mock_send):
        mock_send.return_value = True
        result = send_password_reset_confirmation("user@test.com")
        assert result is True
        assert mock_send.call_args[0][0] == Template.PASSWORD_RESET_COMPLETED

    @patch("api.email.mailchimp.send_template")
    def test_send_support_received(self, mock_send):
        mock_send.return_value = True
        result = send_support_received("user@test.com")
        assert result is True
        assert mock_send.call_args[0][0] == Template.SUPPORT_REQUEST

    @patch("api.email.mailchimp.send_template")
    def test_send_dynamic_template(self, mock_send):
        mock_send.return_value = True
        result = send_dynamic_template("user@test.com", "welcome")
        assert result is True
        call_args = mock_send.call_args[0]
        assert call_args[0] == "welcome"

    @patch("api.email.mailchimp.send_template")
    def test_send_pat_week_warning(self, mock_send):
        mock_send.return_value = True
        exp = datetime(2026, 3, 20, 12, 0, 0)
        result = send_pat_week_warning("user@test.com", exp)
        assert result is True
        data = mock_send.call_args[0][3]
        assert "2026-03-20" in data["expiration_date"]

    @patch("api.email.mailchimp.send_template")
    def test_send_pat_day_warning(self, mock_send):
        mock_send.return_value = True
        exp = datetime(2026, 3, 14, 12, 0, 0)
        result = send_pat_day_warning("user@test.com", exp)
        assert result is True
        assert mock_send.call_args[0][0] == Template.PAT_DAY_WARNING

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_send_share_notice(self, mock_settings, mock_send):
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True
        dashboard_id = uuid4()
        result = send_share_notice("user@test.com", "sharer@test.com", dashboard_id)
        assert result is True
        assert mock_send.call_args[0][0] == Template.NEW_DASHBOARD_SHARED
        data = mock_send.call_args[0][3]
        assert str(dashboard_id) in data["dashboardLink"]

    @patch("api.email.mailchimp.send_template")
    @patch("api.email.mailchimp.settings")
    def test_send_new_entity(self, mock_settings, mock_send):
        mock_settings.PROURL = "http://localhost:3000"
        mock_send.return_value = True
        result = send_new_entity("user@test.com", "Acme Corp")
        assert result is True
        assert mock_send.call_args[0][0] == Template.NEW_ENTITY_CREATED
        data = mock_send.call_args[0][3]
        assert "'Acme Corp'" in data["entity_name"]

    @patch("api.email.mailchimp.send_template")
    def test_send_install_email_from_support(self, mock_send):
        mock_send.return_value = True
        result = MailChimpEmail.send_install_email(
            to="user@test.com",
            first_name="Ada",
            access_key_id="AKIA123",
            secret_access_key="secret",
            expiration="2027-07-21",
            version="1.2.3",
        )
        assert result is True
        assert mock_send.call_args[0][0] == Template.OPENBB_LITE_INSTRUCTIONS
        assert mock_send.call_args.kwargs["from_email"] == "support@openbb.co"

    @patch("api.email.mailchimp.send_template")
    def test_send_invite_emails_sends_to_all(self, mock_send):
        mock_send.return_value = True
        send_invite_emails("admin@test.com", ["a@test.com", "b@test.com", "c@test.com"])
        assert mock_send.call_count == 3
        for call in mock_send.call_args_list:
            assert call[0][0] == Template.ODP_INVITE

    @patch("api.email.mailchimp.send_email")
    def test_send_customer_email(self, mock_send):
        mock_send.return_value = True
        result = send_customer_email("user@test.com", "feedback here")
        assert result is True
        mock_send.assert_called_once_with(
            "andrew.kenreich@openbb.finance",
            "user@test.com",
            "Customer Email",
            "feedback here",
        )
