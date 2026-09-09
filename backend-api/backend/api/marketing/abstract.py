"""Abstract base class for marketing/CRM contact providers."""

from api.schemas import UserMarketing


class MarketingAbstract:
    @staticmethod
    def find_contact(email: str) -> None | str:
        """Look up a contact by email. Returns provider-specific ID or None."""
        raise NotImplementedError

    @staticmethod
    def get_contact(email: str) -> None | UserMarketing:
        """Retrieve a contact's marketing preferences."""
        raise NotImplementedError

    @staticmethod
    def create_contact(email: str, properties: UserMarketing) -> None | str:
        """Create a new contact. Returns provider-specific ID or None."""
        raise NotImplementedError

    @staticmethod
    def update_contact(email: str, properties: UserMarketing) -> None | str:
        """Update an existing contact, or create if not found. Returns ID or None."""
        raise NotImplementedError

    @staticmethod
    def delete_contact(email: str) -> bool:
        """Remove a contact. Returns True on success."""
        raise NotImplementedError
