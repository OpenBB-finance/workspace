"""HubSpot marketing provider stub.

This wraps the existing hubspot.py contact functions into the MarketingAbstract
interface. Can be wired up if the provider is switched back to HubSpot.
"""

from api.marketing.abstract import MarketingAbstract
from api.schemas import UserMarketing


class HubspotMarketing(MarketingAbstract):
    @staticmethod
    def find_contact(email: str) -> None | str:
        from api import hubspot  # noqa: PLC0415

        result = hubspot.find_contact(email)
        return str(result) if result else None

    @staticmethod
    def get_contact(email: str) -> None | UserMarketing:
        from api import hubspot  # noqa: PLC0415

        return hubspot.get_contact(None, email)

    @staticmethod
    def create_contact(email: str, properties: UserMarketing) -> None | str:
        from api import hubspot  # noqa: PLC0415

        result = hubspot.create_contact(email, properties.hubspot_properties())
        return str(result) if result else None

    @staticmethod
    def update_contact(email: str, properties: UserMarketing) -> None | str:
        from api import hubspot  # noqa: PLC0415

        result = hubspot.update_contact(None, email, properties.hubspot_properties())
        return str(result) if result else None

    @staticmethod
    def delete_contact(email: str) -> bool:
        from api import hubspot  # noqa: PLC0415

        hubspot.delete_contact(None, email)
        return True
