"""Mailchimp Marketing audience management for contact/newsletter preferences."""

import contextlib
import hashlib

import mailchimp_marketing as MailchimpMarketing
from loguru import logger
from mailchimp_marketing.api_client import ApiClientError

from api.marketing.abstract import MarketingAbstract
from api.schemas import UserMarketing
from utilities.config import settings

TAGS = ["Academia", "Bot", "Newsletter", "PROWaitlist"]

TAG_TO_FIELD = {
    "Newsletter": "email_newsletter",
    "Academia": "email_academia",
    "Bot": "email_bot",
    "PROWaitlist": "email_prowaitlist",
}

FIELD_TO_TAG = {v: k for k, v in TAG_TO_FIELD.items()}

# Mapping from UserMarketing field names to Mailchimp merge field tags.
# Mailchimp has built-in FNAME/LNAME; the rest are custom merge fields
# that must be created in the Mailchimp audience settings (max 10-char tag).
MERGE_FIELD_MAP = {
    "first_name": "FNAME",
    "last_name": "LNAME",
    "primary_usage": "PRIUSE",
    "organization_name": "ORGNAME",
    "organization_segment": "ORGSEG",
    "role": "ROLE",
    "wants_contacted": "WNTSCNTCT",
    "is_verified": "VERIFIED",
    "is_paid_user": "ISPAID",
    "is_admin": "ISADMIN",
    "pro_start_date": "PROSTART",
    "pro_trial_granted": "PROTRIAL",
    "pro_trial_granted_date": "PROTRIALDT",
    "trial_extended": "TRIALEXT",
    "programming_experience": "PROGEXP",
    "data_types": "DATATYPES",
    "other_data_types": "OTHRDTYPE",
}


def _get_client() -> MailchimpMarketing.Client:
    return settings.get_marketing_client()


def _subscriber_hash(email: str) -> str:
    return hashlib.md5(email.lower().encode()).hexdigest()  # noqa: S324


def _marketing_to_tags(properties: UserMarketing) -> list[dict]:
    """Convert UserMarketing booleans into Mailchimp tag status list."""
    data = properties.model_dump()
    tags = []
    for field, tag in FIELD_TO_TAG.items():
        value = data.get(field)
        if value is not None:
            tags.append({"name": tag, "status": "active" if value else "inactive"})
    return tags


def _marketing_to_merge_fields(properties: UserMarketing) -> dict:
    """Convert UserMarketing fields into Mailchimp merge_fields dict.

    Only includes fields that are explicitly set (not None).
    Booleans are converted to "Yes"/"No" strings for Mailchimp.
    Floats are converted to strings.
    """
    data = properties.model_dump()
    merge_fields = {}
    for field, tag in MERGE_FIELD_MAP.items():
        value = data.get(field)
        if value is None:
            continue
        if isinstance(value, bool):
            merge_fields[tag] = "Yes" if value else "No"
        elif isinstance(value, float):
            merge_fields[tag] = str(value)
        else:
            merge_fields[tag] = str(value)
    return merge_fields


def _merge_fields_to_marketing(
    merge_fields: dict, tag_list: list[dict]
) -> UserMarketing:
    """Convert Mailchimp merge_fields + tags into UserMarketing."""
    active_names = {t["name"] for t in tag_list if t.get("status") == "active"}

    # Reverse map: merge tag -> field name
    reverse_map = {v: k for k, v in MERGE_FIELD_MAP.items()}

    kwargs: dict = {
        "email_newsletter": "Newsletter" in active_names,
        "email_academia": "Academia" in active_names,
        "email_bot": "Bot" in active_names,
        "email_prowaitlist": "PROWaitlist" in active_names,
    }

    bool_fields = {
        "wants_contacted",
        "is_verified",
        "is_paid_user",
        "is_admin",
        "pro_trial_granted",
        "trial_extended",
    }

    for tag, value in merge_fields.items():
        field = reverse_map.get(tag)
        if not field or not value:
            continue
        if field in bool_fields:
            kwargs[field] = str(value).lower() in {"yes", "true", "1"}
        elif field == "pro_start_date":
            with contextlib.suppress(ValueError, TypeError):
                kwargs[field] = float(value)
        else:
            kwargs[field] = str(value)

    return UserMarketing(**kwargs)


def _tags_to_marketing(tag_list: list[dict]) -> UserMarketing:
    """Convert Mailchimp tag list into UserMarketing (tags only, no merge fields)."""
    active_names = {t["name"] for t in tag_list if t.get("status") == "active"}
    return UserMarketing(
        email_newsletter="Newsletter" in active_names,
        email_academia="Academia" in active_names,
        email_bot="Bot" in active_names,
        email_prowaitlist="PROWaitlist" in active_names,
    )


class MailchimpMarketing_(MarketingAbstract):
    @staticmethod
    def find_contact(email: str) -> None | str:
        if not settings.is_prod():
            return None
        try:
            client = _get_client()
            result = client.lists.get_list_member(
                settings.MAILCHIMP_AUDIENCE_ID, _subscriber_hash(email)
            )
            return result.get("id")
        except ApiClientError as e:
            if e.status_code == 404:  # noqa: PLR2004
                return None
            logger.error(f"Mailchimp find_contact error: {e.text}")
            return None

    @staticmethod
    def get_contact(email: str) -> None | UserMarketing:
        if not settings.is_prod():
            return None
        try:
            client = _get_client()
            result = client.lists.get_list_member(
                settings.MAILCHIMP_AUDIENCE_ID, _subscriber_hash(email)
            )
            return _merge_fields_to_marketing(
                result.get("merge_fields", {}), result.get("tags", [])
            )
        except ApiClientError as e:
            if e.status_code == 404:  # noqa: PLR2004
                return None
            logger.error(f"Mailchimp get_contact error: {e.text}")
            return None

    @staticmethod
    def create_contact(email: str, properties: UserMarketing) -> None | str:
        if not settings.is_prod():
            return None
        try:
            active_tags = [
                tag["name"]
                for tag in _marketing_to_tags(properties)
                if tag["status"] == "active"
            ]
            merge_fields = _marketing_to_merge_fields(properties)
            data: dict = {
                "email_address": email,
                "status": "subscribed",
                "tags": active_tags,
            }
            if merge_fields:
                data["merge_fields"] = merge_fields
            client = _get_client()
            result = client.lists.add_list_member(settings.MAILCHIMP_AUDIENCE_ID, data)
            return result.get("id")
        except ApiClientError as e:
            logger.error(f"Mailchimp create_contact error: {e.text}")
            return None

    @staticmethod
    def update_contact(email: str, properties: UserMarketing) -> None | str:
        if not settings.is_prod():
            return None
        try:
            client = _get_client()
            sub_hash = _subscriber_hash(email)

            # Upsert contact via set_list_member (creates if not exists)
            merge_fields = _marketing_to_merge_fields(properties)
            upsert_data: dict = {
                "email_address": email,
                "status_if_new": "subscribed",
            }
            if merge_fields:
                upsert_data["merge_fields"] = merge_fields
            client.lists.set_list_member(
                settings.MAILCHIMP_AUDIENCE_ID,
                sub_hash,
                upsert_data,
            )

            # Update tags separately (tags API is a separate endpoint)
            tags = _marketing_to_tags(properties)
            if tags:
                client.lists.update_list_member_tags(
                    settings.MAILCHIMP_AUDIENCE_ID,
                    sub_hash,
                    {"tags": tags},
                )

            return sub_hash
        except ApiClientError as e:
            if e.status_code == 404:  # noqa: PLR2004
                return MailchimpMarketing_.create_contact(email, properties)
            logger.error(f"Mailchimp update_contact error: {e.text}")
            return None

    @staticmethod
    def delete_contact(email: str) -> bool:
        if not settings.is_prod():
            return True
        try:
            client = _get_client()
            # Archive instead of permanent delete so the contact can re-subscribe
            client.lists.update_list_member(
                settings.MAILCHIMP_AUDIENCE_ID,
                _subscriber_hash(email),
                {"status": "unsubscribed"},
            )
            return True
        except ApiClientError as e:
            logger.error(f"Mailchimp delete_contact error: {e.text}")
            return False
