"""Mock external services and reset shared state per test."""

from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import pytest


class MockChargebeeCustomerResult:
    """Mock result for Chargebee customer creation."""

    def __init__(self, customer_id: str = "ch_test_123"):
        self.customer = MagicMock()
        self.customer.id = customer_id
        self.customer.email = "test@openbb.co"


class MockChargebeeSubscriptionResult:
    """Mock result for Chargebee subscription."""

    def __init__(self, subscription_id: str = "sub_test_123"):
        self.subscription = MagicMock()
        self.subscription.id = subscription_id
        self.subscription.status = "active"
        self.subscription.customer_id = "ch_test_123"


class MockChargebeePortalResult:
    """Mock result for Chargebee portal session."""

    def __init__(self):
        self.portal_session = MagicMock()
        self.portal_session.id = "portal_test_123"
        self.portal_session.access_url = "https://test.chargebee.com/portal"


class MockChargebeeHostedPageResult:
    """Mock result for Chargebee hosted page."""

    def __init__(self):
        self.hosted_page = MagicMock()
        self.hosted_page.id = "hp_test_123"
        self.hosted_page.url = "https://test.chargebee.com/hosted"
        self.hosted_page.state = "created"


def create_mock_chargebee():
    """Create a comprehensive mock for the chargebee module."""
    mock_chargebee = MagicMock()

    mock_chargebee.Customer.create.return_value = MockChargebeeCustomerResult()
    mock_chargebee.Customer.retrieve.return_value = MockChargebeeCustomerResult()
    mock_chargebee.Customer.update.return_value = MockChargebeeCustomerResult()
    mock_chargebee.Customer.list.return_value = MagicMock(list=[])

    mock_chargebee.Subscription.create.return_value = MockChargebeeSubscriptionResult()
    mock_chargebee.Subscription.retrieve.return_value = MockChargebeeSubscriptionResult()
    mock_chargebee.Subscription.update.return_value = MockChargebeeSubscriptionResult()
    mock_chargebee.Subscription.cancel.return_value = MockChargebeeSubscriptionResult()
    mock_chargebee.Subscription.list.return_value = MagicMock(list=[])

    mock_chargebee.PortalSession.create.return_value = MockChargebeePortalResult()

    mock_chargebee.HostedPage.checkout_new.return_value = MockChargebeeHostedPageResult()
    mock_chargebee.HostedPage.checkout_existing.return_value = MockChargebeeHostedPageResult()
    mock_chargebee.HostedPage.manage_payment_sources.return_value = MockChargebeeHostedPageResult()

    mock_chargebee.configure = MagicMock()

    return mock_chargebee


def create_mock_hubspot():
    """Create a comprehensive mock for hubspot module functions."""
    return {
        "send_confirmation": MagicMock(return_value=None),
        "send_welcome_email": MagicMock(return_value=None),
        "send_password_reset": MagicMock(return_value=None),
        "send_password_reset_confirmation": MagicMock(return_value=None),
        "send_ticket": MagicMock(return_value=MagicMock(status_code=200, json=lambda: {})),
        "find_contact": MagicMock(return_value=12345),
        "create_contact": MagicMock(return_value=12345),
        "update_contact": MagicMock(return_value=12345),
        "delete_contact": MagicMock(return_value=None),
        "get_contact": MagicMock(return_value=None),
        "send_invite_emails": MagicMock(return_value=None),
        "send_create_account": MagicMock(return_value=None),
        "send_support_received": MagicMock(return_value=None),
    }


@pytest.fixture(autouse=True)
def mock_external_services():
    """Mock Chargebee/HubSpot integrations for each test."""
    mock_chargebee = create_mock_chargebee()
    mock_hubspot = create_mock_hubspot()

    with ExitStack() as stack:
        stack.enter_context(patch.dict("sys.modules", {"chargebee": mock_chargebee}))

        stack.enter_context(patch("api.hubspot.send_confirmation", mock_hubspot["send_confirmation"]))
        stack.enter_context(patch("api.hubspot.send_welcome_email", mock_hubspot["send_welcome_email"]))
        stack.enter_context(patch("api.hubspot.send_password_reset", mock_hubspot["send_password_reset"]))
        stack.enter_context(
            patch(
                "api.hubspot.send_password_reset_confirmation",
                mock_hubspot["send_password_reset_confirmation"],
            )
        )
        stack.enter_context(patch("api.hubspot.send_ticket", mock_hubspot["send_ticket"]))
        stack.enter_context(patch("api.hubspot.find_contact", mock_hubspot["find_contact"]))
        stack.enter_context(patch("api.hubspot.create_contact", mock_hubspot["create_contact"]))
        stack.enter_context(patch("api.hubspot.update_contact", mock_hubspot["update_contact"]))
        stack.enter_context(patch("api.hubspot.delete_contact", mock_hubspot["delete_contact"]))
        stack.enter_context(patch("api.hubspot.get_contact", mock_hubspot["get_contact"]))
        stack.enter_context(patch("api.hubspot.send_invite_emails", mock_hubspot["send_invite_emails"]))
        stack.enter_context(patch("api.hubspot.send_create_account", mock_hubspot["send_create_account"]))
        stack.enter_context(patch("api.hubspot.send_support_received", mock_hubspot["send_support_received"]))

        yield {
            "chargebee": mock_chargebee,
            "hubspot": mock_hubspot,
        }


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear rate limiter state between tests."""
    from api.rate_limit import limiter

    if hasattr(limiter, "_storage") and limiter._storage is not None:
        try:
            limiter._storage.reset()
        except (AttributeError, TypeError):
            pass

    if hasattr(limiter, "reset"):
        try:
            limiter.reset()
        except (AttributeError, TypeError):
            pass

    yield
