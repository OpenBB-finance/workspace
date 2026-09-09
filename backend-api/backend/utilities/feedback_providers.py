"""
Provides a unified abstraction for Service Desk providers (HubSpot, Jira)
used to submit user feedback.
"""

import abc
from http import HTTPStatus

import requests
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from api import hubspot
from api.schemas import Feedback
from utilities.config import settings


class FeedbackProvider(abc.ABC):
    """
    Minimal abstraction for submitting feedback to a service desk.
    """

    @abc.abstractmethod
    async def submit_feedback(
        self,
        feedback: Feedback,
        user_email: str,
        db: AsyncSession,
        current_user_hubspot_id: int | None,
    ) -> tuple[bool, str]:
        """
        Submits feedback and returns a tuple of (success_bool, message).
        """
        pass


class HubspotFeedbackProvider(FeedbackProvider):
    """
    Existing HubSpot implementation for feedback tickets.
    """

    async def submit_feedback(  # noqa: PLR6301
        self,
        feedback: Feedback,
        user_email: str,
        db: AsyncSession,  # noqa: ARG002
        current_user_hubspot_id: int | None,
    ) -> tuple[bool, str]:

        def send_to_hubspot(the_id: int) -> str | None:
            clean_result = feedback.full_json_dump(the_id)
            response = hubspot.send_ticket(clean_result)
            if response.status_code == HTTPStatus.CREATED:
                return None
            logger.error(f"Hubspot Error:\n{response.text}")
            logger.error(f"Request Data:\n{clean_result}")
            return response.json().get("message", "")

        if not settings.HUBSPOT:
            return False, hubspot.ERROR_MESSAGE

        hubspot_id = current_user_hubspot_id or hubspot.find_contact(user_email)
        if not hubspot_id:
            return False, "User does not have a valid hubspot account"

        message = send_to_hubspot(hubspot_id)
        if message is None:
            return True, ""
        return False, message


class JiraFeedbackProvider(FeedbackProvider):
    """
    Jira Service Management implementation using API Gateway and Service Account Bearer Token.
    """

    def __init__(self):
        self._cloud_id = None

    def _get_cloud_id(self) -> str:
        """Discovers the Jira Cloud ID required for Service Account API requests."""
        if self._cloud_id:
            return self._cloud_id

        base_url = settings.JIRA_BASE_URL
        if not base_url:
            raise ValueError("JIRA_BASE_URL is not configured.")
        base_url = base_url.rstrip("/")
        response = requests.get(f"{base_url}/_edge/tenant_info", timeout=10)
        response.raise_for_status()
        self._cloud_id = response.json().get("cloudId")
        return self._cloud_id

    async def submit_feedback(
        self,
        feedback: Feedback,
        user_email: str,
        db: AsyncSession,
        current_user_hubspot_id: int | None,
    ) -> tuple[bool, str]:

        try:
            cloud_id = self._get_cloud_id()
        except Exception as e:
            logger.error(f"Failed to fetch Jira Cloud ID: {e}")
            return False, "Jira integration error: could not resolve tenant."

        api_url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/servicedeskapi"

        headers = {
            "Authorization": f"Bearer {settings.JIRA_API_TOKEN}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # Map frontend feedback type to Jira Request Type ID
        ticket_type = str(feedback.ticket_type).lower()
        request_type_id = settings.JIRA_REQUEST_TYPE_MAPPING.get(
            ticket_type, str(settings.JIRA_DEFAULT_REQUEST_TYPE_ID)
        )

        # Explicit mapping of properties into the Jira request fields
        description = (
            f"{feedback.content}\n\n"
            f"--- Metadata ---\n"
            f"Type: {feedback.ticket_type}\n"
            f"Version: {feedback.version}\n"
            f"Page: {feedback.location_page}"
        )

        payload = {
            "serviceDeskId": str(settings.JIRA_SERVICE_DESK_ID),
            "requestTypeId": request_type_id,
            "raiseOnBehalfOf": user_email,
            "requestFieldValues": {
                "summary": feedback.subject,
                "description": description,
            },
        }

        try:
            res = requests.post(
                f"{api_url}/request", json=payload, headers=headers, timeout=10
            )

            if res.status_code == HTTPStatus.CREATED:
                return True, ""

            # If the service account doesn't have "Agent" permissions for the project,
            # it cannot raise requests on behalf of other users.
            # We automatically fallback to creating the ticket as the service account
            # and appending the real user's email to the description.
            if (
                res.status_code == HTTPStatus.FORBIDDEN
                or "permission.onbehalfof" in res.text
            ):
                logger.warning(
                    "Jira SA lacks raiseOnBehalfOf permission. Retrying with email in description."
                )
                payload.pop("raiseOnBehalfOf")
                payload["requestFieldValues"]["description"] = (
                    f"User: {user_email}\n\n" + description
                )

                res_fallback = requests.post(
                    f"{api_url}/request", json=payload, headers=headers, timeout=10
                )
                if res_fallback.status_code == HTTPStatus.CREATED:
                    return True, ""
                else:
                    logger.error(
                        f"Jira fallback ticket creation failed: {res_fallback.text}"
                    )
                    return False, "Failed to create fallback Jira ticket."

            logger.error(f"Jira Error: {res.text}")
            return False, "Failed to create Jira ticket."

        except requests.exceptions.RequestException as e:
            logger.error(f"Error submitting to Jira: {e}")
            return False, "Network error reaching Jira API."


def get_feedback_provider() -> FeedbackProvider:
    """Factory to return the configured feedback provider."""
    if getattr(settings, "FEEDBACK_PROVIDER", "hubspot") == "jira":
        return JiraFeedbackProvider()
    return HubspotFeedbackProvider()
