"""Marketing/CRM contact provider abstraction layer.

Mirrors the pattern from api.email — provider is selected via settings.
"""

from api.marketing.abstract import MarketingAbstract
from api.schemas import UserMarketing


class Marketing(MarketingAbstract):
    _instance: MarketingAbstract

    def __new__(cls) -> MarketingAbstract:
        if not hasattr(cls, "_instance"):
            from utilities.config import settings  # noqa: PLC0415

            if settings.EMAIL_PROVIDER == "mailchimp":
                from api.marketing.mailchimp import MailchimpMarketing_  # noqa: PLC0415

                cls._instance = MailchimpMarketing_()
            else:
                # Hubspot provider can be added here if needed
                from api.marketing.hubspot import HubspotMarketing  # noqa: PLC0415

                cls._instance = HubspotMarketing()

        return cls._instance


marketing_provider = Marketing()


class MarketingService:
    @staticmethod
    def find_contact(email: str) -> None | str:
        return marketing_provider.find_contact(email)

    @staticmethod
    def get_contact(email: str) -> None | UserMarketing:
        return marketing_provider.get_contact(email)

    @staticmethod
    def create_contact(email: str, properties: UserMarketing) -> None | str:
        return marketing_provider.create_contact(email, properties)

    @staticmethod
    def update_contact(email: str, properties: UserMarketing) -> None | str:
        return marketing_provider.update_contact(email, properties)

    @staticmethod
    def delete_contact(email: str) -> bool:
        return marketing_provider.delete_contact(email)
