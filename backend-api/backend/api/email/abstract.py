from datetime import datetime
from typing import Literal
from uuid import UUID


class EmailAbstract:
    @staticmethod
    def send_welcome_email(to: str) -> None:
        raise NotImplementedError

    @staticmethod
    def send_invite_emails(from_email: str, to_emails: list[str]) -> None:
        raise NotImplementedError

    @staticmethod
    def send_confirmation(token: str, to: str) -> None:
        raise NotImplementedError

    @staticmethod
    def send_create_account(
        token: UUID,
        to: str,
        password: str,
        inviter: str,
        message: None | str = None,
        is_free_tier: bool = False,
    ) -> None:
        raise NotImplementedError

    @staticmethod
    def send_password_reset(token: str, to: str) -> None:
        raise NotImplementedError

    @staticmethod
    def send_password_reset_confirmation(to: str) -> None:
        raise NotImplementedError

    @staticmethod
    def send_support_received(to: str) -> None:
        raise NotImplementedError

    @staticmethod
    def four_days_no_use(to: str, first_name: str) -> None:
        raise NotImplementedError

    @staticmethod
    def send_pat_warning(to: str, exp: datetime) -> None:
        raise NotImplementedError

    @staticmethod
    def send_share_notice(to: str, sharer: str, dashboard_uuid: UUID) -> None:
        raise NotImplementedError

    @staticmethod
    def send_account_takeover(
        token: str, to: str, inviter: str, message: None | str = None
    ) -> None:
        raise NotImplementedError

    @staticmethod
    def extend_pro_trial(to: str, user_uuid: UUID) -> None:
        raise NotImplementedError

    @staticmethod
    def send_dynamic_template(
        to: str,
        template: Literal["welcome", "welcome-error", "sfa01", "ica01", "spa02"],
    ) -> None:
        raise NotImplementedError

    @staticmethod
    def send_new_entity(to: str, entity_name: str) -> None:
        raise NotImplementedError

    @staticmethod
    def send_install_email(
        to: str,
        first_name: str,
        access_key_id: str,
        secret_access_key: str,
        expiration: str,
        version: str,
    ) -> None:
        """Deliver the Lite install instructions email.

        Renders the `openbb-lite-instructions` template with merge vars for
        the AWS credentials, name, expiration date, and Docker tag.
        """
        raise NotImplementedError
