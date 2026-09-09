from datetime import datetime
from typing import Literal
from uuid import UUID

from api.email.abstract import EmailAbstract


class Email(EmailAbstract):
    _instance: EmailAbstract

    def __new__(cls) -> EmailAbstract:
        from api.email import hubspot, mailchimp  # noqa: PLC0415

        if not hasattr(cls, "_instance"):
            from utilities.config import settings  # noqa: PLC0415

            if settings.EMAIL_PROVIDER == "mailchimp":
                cls._instance = mailchimp.MailChimpEmail()
            else:
                cls._instance = hubspot.HubSpotEmail()

        return cls._instance


email_provider = Email()


class EmailService:
    @staticmethod
    def send_welcome_email(to: str) -> None:
        return email_provider.send_welcome_email(to)

    @staticmethod
    def send_invite_emails(from_email: str, to_emails: list[str]) -> None:
        return email_provider.send_invite_emails(from_email, to_emails)

    @staticmethod
    def send_confirmation(token: str, to: str) -> None:
        return email_provider.send_confirmation(token, to)

    @staticmethod
    def send_create_account(
        token: UUID,
        to: str,
        password: str,
        inviter: str,
        message: None | str = None,
        is_free_tier: bool = False,
    ) -> None:
        return email_provider.send_create_account(
            token, to, password, inviter, message, is_free_tier
        )

    @staticmethod
    def send_password_reset(token: str, to: str) -> None:
        return email_provider.send_password_reset(token, to)

    @staticmethod
    def send_password_reset_confirmation(to: str) -> None:
        return email_provider.send_password_reset_confirmation(to)

    @staticmethod
    def send_support_received(to: str) -> None:
        return email_provider.send_support_received(to)

    @staticmethod
    def four_days_no_use(to: str, first_name: str) -> None:
        return email_provider.four_days_no_use(to, first_name)

    @staticmethod
    def send_pat_warning(to: str, exp: datetime) -> None:
        return email_provider.send_pat_warning(to, exp)

    @staticmethod
    def send_share_notice(to: str, sharer: str, dashboard_uuid: UUID) -> None:
        return email_provider.send_share_notice(to, sharer, dashboard_uuid)

    @staticmethod
    def send_account_takeover(
        token: str, to: str, inviter: str, message: None | str = None
    ) -> None:
        return email_provider.send_account_takeover(token, to, inviter, message)

    @staticmethod
    def extend_pro_trial(to: str, user_uuid: UUID) -> None:
        return email_provider.extend_pro_trial(to, user_uuid)

    @staticmethod
    def send_dynamic_template(
        to: str,
        template: Literal["welcome", "welcome-error", "sfa01", "ica01", "spa02"],
    ) -> None:
        return email_provider.send_dynamic_template(to, template)

    @staticmethod
    def send_new_entity(to: str, entity_name: str) -> None:
        return email_provider.send_new_entity(to, entity_name)

    @staticmethod
    def send_install_email(
        to: str,
        first_name: str,
        access_key_id: str,
        secret_access_key: str,
        expiration: str,
        version: str,
    ) -> None:
        return email_provider.send_install_email(
            to, first_name, access_key_id, secret_access_key, expiration, version
        )
