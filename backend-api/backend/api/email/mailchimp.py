from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

import mailchimp_transactional
from loguru import logger
from mailchimp_transactional.api_client import ApiClientError

from api.base import create_html, create_url
from api.email.abstract import EmailAbstract
from utilities.config import settings

if settings.MODE in {"production"}:
    mailchimp = mailchimp_transactional.Client(settings.MAILCHIMP_TRANSACTIONAL)


class Template(Enum):
    WELCOME = "welcome"
    CONFIRMATION = "confirmation"
    RESET_PASSWORD = "reset-password"  # noqa: S105
    PASSWORD_RESET_COMPLETED = "password-reset-completed"  # noqa: S105
    SUPPORT_REQUEST = "support-request"
    PAT_DAY_WARNING = "pat-day-warning"
    CONFIRM_ACCOUNT_EXISTING = "confirm-account-existing"
    CONFIRM_ACCOUNT_NEW = "confirm-account-new"
    CONFIRM_ACCOUNT_NEW_HUB = "confirm-account-new-hub"
    WORKSPACE_INVITE_FREE_TIER = "workspace-invite-free-tier-without-account"
    WORKSPACE_INVITE_PRO_TIER = "workspace-invite-pro-tier-without-account"
    NEW_DASHBOARD_SHARED = "new-dashboard-shared-with-you"
    NEW_ENTITY_CREATED = "new-entity-created"
    ODP_INVITE = "odp-invite"
    DAY_1_FREE_TIER_ANALYSTS = "day-1-free-tier-analysts"
    DAY_1_FREE_TIER_DEVS = "day-1-free-tier-devs"
    DAY_1_FREE_TIER_STUDENTS = "day-1-free-tier-students"
    OPENBB_LITE_INSTRUCTIONS = "openbb-lite-instructions"


def confirm_mailchimp() -> None:
    try:
        response = mailchimp.users.ping()
        logger.info(f"API called successfully: {response}")
    except ApiClientError as error:
        logger.info(f"An exception occurred: {error.text}")
    except NameError:
        logger.info("Can only ping in production mode")


def send_email(to_email: str, from_email: str, subject: str, text: str) -> bool:
    message = {
        "from_email": from_email,
        "subject": subject,
        "text": text,
        "to": [{"email": to_email, "type": "to"}],
    }
    if settings.MODE in {"production"}:
        try:
            mailchimp.messages.send({"message": message})
            return True
        except ApiClientError:
            return False

    for key, value in message.items():
        logger.info(f"{key}: {value}")
    return True


def send_template(
    template: Template | str,
    to_email: str,
    subject: None | str,
    content: dict[str, str],
    from_email: str = "no-reply@openbb.co",
) -> bool:
    template_name = template.value if isinstance(template, Template) else template

    message = {
        "from_email": from_email,
        "text": "",
        "to": [{"email": to_email, "type": "to"}],
        "merge_language": "handlebars",
        "global_merge_vars": [{"name": k, "content": v} for k, v in content.items()],
    }
    if subject is not None:
        message["subject"] = subject
    if settings.MODE in {"production"}:
        try:
            response = mailchimp.messages.send_template(
                {
                    "template_name": template_name,
                    "template_content": [],
                    "message": message,
                }
            )
            logger.info(
                f"Mandrill send_template '{template_name}' to '{to_email}': {response}"
            )
            return True
        except ApiClientError as e:
            logger.error(
                f"Mandrill send_template '{template_name}' to '{to_email}' failed: {e.text}"
            )
            return False

    for key, value in message.items():
        logger.info(f"{key}: {value}")
    return True


def send_welcome_email(to: str) -> bool:
    return send_template(
        Template.DAY_1_FREE_TIER_ANALYSTS,
        to,
        None,
        {},
    )


def send_confirmation(token: str, to: str) -> bool:
    url = create_url(
        "pro/confirm-account", base=settings.SELFURL, token=token, email=to
    )
    return send_template(
        Template.CONFIRMATION,
        to,
        None,
        {"confirmation_url": url},
    )


def send_dynamic_template(to: str, template: str) -> bool:
    """Sends a template email to a user

    Parameters
    ----------
    to: str
        The email address of the user
    template: str
        The name of the template to send
    """
    return send_template(
        template,
        to,
        None,
        {},
    )


def send_password_reset(token: str, to: str) -> bool:
    url = create_url(
        "forgot-password-confirmation", base=settings.PROURL, token=token, email=to
    )
    return send_template(
        Template.RESET_PASSWORD,
        to,
        None,
        {"confirmation_url": url},
    )


def send_password_reset_confirmation(to: str) -> bool:
    return send_template(
        Template.PASSWORD_RESET_COMPLETED,
        to,
        None,
        {},
    )


def send_support_received(to: str) -> bool:
    return send_template(
        Template.SUPPORT_REQUEST,
        to,
        None,
        {},
    )


def send_customer_email(from_email: str, message: str) -> bool:
    """Allows customers to email us feedback"""
    return send_email(
        "andrew.kenreich@openbb.finance", from_email, "Customer Email", message
    )


def send_chargebee_check_email(message: str) -> bool:
    """Emails the results of the chargebee check function"""
    return send_email(
        "colin.delahunty@openbb.finance",
        "no-reply@openbb.co",
        "Reconciliation",
        message,
    )


def send_new_plan_email(chargebee_plan_id: str) -> bool:
    text = f"New plan created automatically with id: {chargebee_plan_id}"
    to = ["colin.delahunty@openbb.finance", "andrew.kenreich@openbb.finance"]
    for email in to:
        send_email(email, "no-reply@openbb.co", "New Plan", text)
    return True


def send_pat_week_warning(to_email: str, expiration_date: datetime):
    return send_template(
        Template.PAT_DAY_WARNING,
        to_email,
        None,
        {"expiration_date": expiration_date.strftime("%Y-%m-%d %H:%M:%S")},
    )


def send_pat_day_warning(to_email: str, expiration_date: datetime):
    return send_template(
        Template.PAT_DAY_WARNING,
        to_email,
        None,
        {"expiration_date": expiration_date.strftime("%Y-%m-%d %H:%M:%S")},
    )


def send_create_account(  # noqa: PLR0913, PLR0917
    token: UUID,
    to: str,
    password: str,
    inviter: str,
    message: None | str = None,
    is_free_tier: bool = False,
):
    "Sends a link for an invited user to create a new account"
    url = create_url(f"pro/create-account/{token}", base=settings.SELFURL, email=to)
    if inviter == settings.PRO_TRIAL_EMAIL:
        return send_template(
            Template.CONFIRM_ACCOUNT_NEW,
            to,
            None,
            {
                "create_url": url,
                "password": password,
                "site_url": settings.PROURL,
            },
        )
    html = create_html(message)
    data = {
        "create_url": url,
        "password": password,
        "inviter": inviter,
        "site_url": settings.PROURL,
        "message": html,
    }
    if is_free_tier:
        return send_template(
            Template.WORKSPACE_INVITE_FREE_TIER,
            to,
            None,
            data,
        )
    return send_template(
        Template.WORKSPACE_INVITE_PRO_TIER,
        to,
        None,
        data,
    )


def send_account_takeover(
    token: str, to: str, inviter: str, message: None | str = None
):
    url = create_url(f"pro/transfer-user/{token}", base=settings.SELFURL, email=to)
    html = create_html(message)
    return send_template(
        Template.CONFIRM_ACCOUNT_EXISTING,
        to,
        None,
        {
            "takeover_url": url,
            "inviter": inviter,
            "site_url": settings.PROURL,
            "message": html,
        },
    )


def send_invite_emails(from_email: str, to_emails: list[str]) -> None:
    for email in to_emails:
        send_template(
            Template.ODP_INVITE,
            email,
            None,
            {"email_invite": from_email},
        )


def send_share_notice(to: str, sharer: str, dashboard_uuid: UUID) -> bool:
    link = f"{settings.PROURL}/app/{dashboard_uuid}"
    return send_template(
        Template.NEW_DASHBOARD_SHARED,
        to,
        None,
        {"inviter": sharer, "dashboardLink": link},
    )


def send_new_entity(to: str, entity_name: str) -> bool:
    pro_settings_url = f"{settings.PROURL}/admin"
    return send_template(
        Template.NEW_ENTITY_CREATED,
        to,
        None,
        {"pro_settings_url": pro_settings_url, "entity_name": f"'{entity_name}'"},
    )


# --- New templates (not wired into abstraction layer yet) ---


def send_day_1_free_tier_analysts(to: str) -> bool:
    return send_template(
        Template.DAY_1_FREE_TIER_ANALYSTS,
        to,
        None,
        {},
    )


def send_day_1_free_tier_devs(to: str) -> bool:
    return send_template(
        Template.DAY_1_FREE_TIER_DEVS,
        to,
        None,
        {},
    )


def send_day_1_free_tier_students(to: str) -> bool:
    return send_template(
        Template.DAY_1_FREE_TIER_STUDENTS,
        to,
        None,
        {},
    )


def send_confirm_account_new_hub(to: str) -> bool:
    return send_template(
        Template.CONFIRM_ACCOUNT_NEW_HUB,
        to,
        None,
        {},
    )


class MailChimpEmail(EmailAbstract):
    @staticmethod
    def send_welcome_email(to: str) -> None:
        return send_welcome_email(to)

    @staticmethod
    def send_invite_emails(from_email: str, to_emails: list[str]) -> None:
        return send_invite_emails(from_email, to_emails)

    @staticmethod
    def send_confirmation(token: str, to: str) -> None:
        return send_confirmation(token, to)

    @staticmethod
    def send_create_account(
        token: UUID,
        to: str,
        password: str,
        inviter: str,
        message: None | str = None,
        is_free_tier: bool = False,
    ) -> None:
        return send_create_account(token, to, password, inviter, message, is_free_tier)

    @staticmethod
    def send_password_reset(token: str, to: str) -> None:
        return send_password_reset(token, to)

    @staticmethod
    def send_password_reset_confirmation(to: str) -> None:
        return send_password_reset_confirmation(to)

    @staticmethod
    def send_support_received(to: str) -> None:
        return send_support_received(to)

    @staticmethod
    def four_days_no_use(to: str, first_name: str) -> None:
        return

    @staticmethod
    def send_pat_warning(to: str, exp: datetime) -> None:
        return send_pat_week_warning(to, exp)

    @staticmethod
    def send_share_notice(to: str, sharer: str, dashboard_uuid: UUID) -> None:
        return send_share_notice(to, sharer, dashboard_uuid)

    @staticmethod
    def send_account_takeover(
        token: str, to: str, inviter: str, message: None | str = None
    ) -> None:
        return send_account_takeover(token, to, inviter, message)

    @staticmethod
    def extend_pro_trial(to: str, user_uuid: UUID) -> None:
        return

    @staticmethod
    def send_dynamic_template(
        to: str,
        template: Literal["welcome", "welcome-error", "sfa01", "ica01", "spa02"],
    ) -> None:
        return send_dynamic_template(to, template)

    @staticmethod
    def send_new_entity(to: str, entity_name: str) -> None:
        return send_new_entity(to, entity_name)

    @staticmethod
    def send_install_email(
        to: str,
        first_name: str,
        access_key_id: str,
        secret_access_key: str,
        expiration: str,
        version: str,
    ) -> bool:
        return send_template(
            Template.OPENBB_LITE_INSTRUCTIONS,
            to,
            None,
            {
                "first_name": first_name,
                "access_key_id": access_key_id,
                "secret_access_key": secret_access_key,
                "expiration": expiration,
                "version": version,
            },
            from_email="support@openbb.co",
        )
