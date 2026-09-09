import json
from datetime import datetime
from typing import Literal
from uuid import UUID

import requests
from hubspot.crm.contacts import (
    ApiException as ContactApiException,
    SimplePublicObjectInput,
    SimplePublicObjectInputForCreate,
)
from hubspot.marketing.transactional import ApiException, PublicSingleSendRequestEgg
from loguru import logger
from pydantic import ConfigDict

from api.base import create_html, create_url
from api.schemas import HubspotProperties, UserMarketing
from utilities.config import BaseModel, settings
from utilities.decorators import require_hubspot_enabled

ERROR_MESSAGE = "Sending emails with Hubspot is disabled."


class ContactsSearchItem(BaseModel):
    id: int
    properties: dict


class ContactsSearchResponse(BaseModel):
    # type(lambda: None) is FunctionType in pure Python and the cyfunction
    # type when Cython-compiled — keeps methods from being seen as fields.
    model_config = ConfigDict(ignored_types=(type(lambda: None),))

    total: int
    results: list[ContactsSearchItem]

    def get_first_id(self) -> None | int:
        if len(self.results) < 1:
            return None
        return self.results[0].id


ALL_TEMPLATES = {
    "welcome": 107726373209,
    "welcome-error": 107726373209,
    "ica01": 139102842895,
    "sfa01": 139102807469,
    "spa02": 139097987455,
    "new_entity": 168678515536,
    "confirmation": 139098402565,
    "pro_invite": 145816413448,
    "send_invite_emails": 139075204884,
    "terminal_invite": 178582495410,
    "trial_create_account": 181609748534,
    "openbb.manager_account_takeover": 152501799073,
    "terminal_account_takeover": 181616517459,
    "account_takeover": 145939279542,
    "password_reset": 139100044146,
    "password_reset_confirmation": 139100051314,
    "support_received": 139102044039,
    "four_days_no_use": 152082226774,
    "pat_warning": 139100020273,
    "share_notice": 168386512021,
    "extend_pro_trial": 167332179064,
}


@require_hubspot_enabled
def send_ticket(data) -> requests.Response:
    url = f"{settings.HUBSPOT_BASE_URL}crm/v3/objects/tickets"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "Authorization": "Bearer " + settings.HUBSPOT_SERVICE_TOKEN,
    }
    return requests.post(url, data=data, headers=headers, timeout=10)


def _send_hubspot(method: str, data: None | dict = None, url: str = ""):
    if not settings.is_prod():
        return None
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"Bearer {settings.HUBSPOT_CONTACT_TOKEN}",
    }
    url = f"{settings.HUBSPOT_CONTACTS_URL}{url}"
    if data:
        return requests.request(
            method=method,
            url=url,
            headers=headers,
            timeout=10,
            data=json.dumps(data),
        )

    return requests.request(method=method, url=url, headers=headers, timeout=10)


@require_hubspot_enabled
def find_contact(email: str) -> None | int:
    "Takes an email and returns the hubspot id if it exists."
    if not settings.is_prod():
        return None
    filter_1 = {"propertyName": "email", "value": email, "operator": "EQ"}
    filter_groups = [{"filters": [filter_1]}]
    payload = {"filterGroups": filter_groups}

    response = _send_hubspot("POST", data=payload, url="/search")
    if response.status_code != 200:  # noqa: PLR2004
        return None
    cleaned = ContactsSearchResponse(**response.json())
    return cleaned.get_first_id()


@require_hubspot_enabled
def create_contact(email: str, properties: HubspotProperties) -> None | int:
    "Takes an email and a set of hubspot properties and creates a hubspot account with it."
    if not settings.is_prod():
        return None
    final_properties = properties.model_dump()
    final_properties["email"] = email
    create_contact = SimplePublicObjectInputForCreate(
        associations=[], properties=final_properties
    )
    try:
        contact_client = settings.get_hubspot_contact_client()
        api_response = contact_client.crm.contacts.basic_api.create(create_contact)
        return api_response.id
    except ContactApiException as e:
        data = json.loads(e.body)
        if "Contact already exists" in data.get("message", ""):
            logger.error(f"Contact already exists:\n{e}")
            the_id = data["message"].replace(
                "Contact already exists. Existing ID: ", ""
            )
            return int(the_id)
        logger.error(f"Exception:\n{e}")
    return None


@require_hubspot_enabled
def update_contact(
    hubspot_id: None | int, email: str, properties: HubspotProperties
) -> None | int:
    """Takes a hubspot_id and tries to update the contact with the given properties. If the
    hubspot_id is None, it will try to find the contact by email. This function returns the
    hubspot_id, this way if it found one, we can enter it into the database.
    """
    if not settings.is_prod():
        return None
    if hubspot_id is None:
        hubspot_id = find_contact(email)
        if hubspot_id is None:
            return create_contact(email, properties)
    data = properties.model_dump(exclude_none=True)
    update_contact = SimplePublicObjectInput(properties=data)

    def get_response(user_id: int):
        contact_client = settings.get_hubspot_contact_client()
        return contact_client.crm.contacts.basic_api.update(
            contact_id=user_id,
            simple_public_object_input=update_contact,
        )

    try:
        get_response(hubspot_id)
        return hubspot_id
    except ContactApiException as e:
        if e.status == 404:  # noqa: PLR2004
            check_contact = find_contact(email)
            if check_contact:
                return get_response(check_contact).id
            return create_contact(email, properties)
        logger.error(f"Exception:\n{e}")
    return None


@require_hubspot_enabled
def delete_contact(hubspot_id: None | int, email: str) -> None | int:
    """Takes a hubspot_id and tries to delete the contact. If the hubspot_id is None, it
    will try to find the contact by email. This function returns the hubspot_id, this way
    if it found one, we can enter it into the database.
    """
    if not settings.is_prod():
        return None
    if hubspot_id is None:
        hubspot_id = find_contact(email)
    if hubspot_id is None:
        return None
    try:
        contact_client = settings.get_hubspot_contact_client()
        api_response = contact_client.crm.contacts.basic_api.archive(hubspot_id)
        if api_response is None:
            return None
        return api_response.id
    except ContactApiException as e:
        logger.error(f"Exception:\n{e}")
    return None


@require_hubspot_enabled
def get_contact(hubspot_id: None | int, email: str) -> None | UserMarketing:
    if not settings.is_prod():
        return None
    if hubspot_id is None:
        hubspot_id = find_contact(email)
    try:
        properties = ["academia_email", "bot_email", "marketing_email", "pro_waitlist"]
        contact_client = settings.get_hubspot_contact_client()
        api_response = contact_client.crm.contacts.basic_api.get_by_id(
            contact_id=hubspot_id,
            archived=False,
            properties=properties,
        )
        data_dict = dict(api_response.properties)
        final = UserMarketing.from_hubspot(data_dict)
        return final
    except ContactApiException as e:
        logger.error(f"Exception:\n{e}")
    return None


@require_hubspot_enabled
def send_template(
    email_id: int,
    to: str,
    contact_properties: None | dict = None,
    custom_properties: None | dict = None,
):
    if not settings.is_prod():
        logger.info(f"To: {to}\n{contact_properties}\n{custom_properties}")
        return
    the_email = PublicSingleSendRequestEgg(
        email_id=email_id,
        message={"to": to, "from": "no-reply@openbb.co"},
        contact_properties=contact_properties,
        custom_properties=custom_properties,
    )
    try:
        email_client = settings.get_hubspot_email_client()
        return email_client.marketing.transactional.single_send_api.send_email(
            public_single_send_request_egg=the_email,
        )
    except ApiException as e:
        logger.error(f"Exception when calling single_send_api->send_email:\n{e}")


@require_hubspot_enabled
def send_welcome_email(to: str):
    send_template(107726373209, to)


@require_hubspot_enabled
def send_invite_emails(from_email: str, to_emails: list[str]):
    """Sends an invite email to a list of emails"""
    data = {"email_invite": from_email}
    for email in to_emails:
        send_template(139075204884, email, custom_properties=data)


@require_hubspot_enabled
def send_confirmation(token: str, to: str):
    url = create_url(
        "pro/confirm-account", base=settings.SELFURL, token=token, email=to
    )
    return send_template(139098402565, to, custom_properties={"confirmation_url": url})


@require_hubspot_enabled
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
    # Custom logic to handle the a register from the pro website
    if inviter == settings.PRO_TRIAL_EMAIL:
        data = {
            "create_url": url,
            "password": password,
            "site_url": settings.PROURL,
        }
        # Day 0 - Register from Pro (New Account) - 160414218258
        # Day 0 - Register from Pro (without Account) v2 - 164900441256
        # Day 0 - Register from Terminal - (without Account) v3 - 181609748534
        return send_template(181609748534, to, custom_properties=data)
    html = create_html(message)
    data = {
        "create_url": url,
        "password": password,
        "inviter": inviter,
        "site_url": settings.PROURL,
        "message": html,
    }
    if is_free_tier:
        # TERMINAL: Day 0 - Invite (without account) - 178582495410
        return send_template(178582495410, to, custom_properties=data)
    # PRO: Day 0 - Invite user (without account)
    return send_template(145816413448, to, custom_properties=data)


@require_hubspot_enabled
def send_password_reset(token: str, to: str):
    url = create_url(
        "forgot-password-confirmation", base=settings.PROURL, token=token, email=to
    )
    return send_template(139100044146, to, custom_properties={"confirmation_url": url})


@require_hubspot_enabled
def send_password_reset_confirmation(to: str):
    return send_template(139100051314, to)


@require_hubspot_enabled
def send_support_received(to: str):
    return send_template(139102044039, to)


@require_hubspot_enabled
def four_days_no_use(to: str, first_name: str):
    data = {"first_name": first_name}
    return send_template(152082226774, to, custom_properties=data)


@require_hubspot_enabled
def send_pat_warning(to: str, exp: datetime):
    data = {"expiration_date": exp.strftime("%Y-%m-%d %H:%M:%S")}
    return send_template(139100020273, to, custom_properties=data)


@require_hubspot_enabled
def send_share_notice(to: str, sharer: str, dashboard_uuid: UUID):
    link = f"{settings.PROURL}/app/{dashboard_uuid}"
    data = {"email": sharer, "dashboardLink": link}
    return send_template(168386512021, to, custom_properties=data)


@require_hubspot_enabled
def send_account_takeover(
    token: str, to: str, inviter: str, message: None | str = None  # noqa: ARG001
):
    url = create_url(f"pro/transfer-user/{token}", base=settings.SELFURL, email=to)
    # Deprecated: template 152501799073 removed from HubSpot
    if inviter == "openbb.manager@openbb.finance":
        logger.warning(
            f"Deprecated HubSpot takeover path hit: openbb.manager invite to {to}"
        )
        return
    # Day 0 - Register from Terminal (Existing Account) v3 - 181616517459
    if inviter == settings.PRO_TRIAL_EMAIL:
        return send_template(181616517459, to, custom_properties={"create_url": url})
    # Deprecated: template 145939279542 removed from HubSpot
    logger.warning(
        f"Deprecated HubSpot takeover path hit: generic invite from {inviter} to {to}"
    )
    return


@require_hubspot_enabled
def extend_pro_trial(to: str, user_uuid: UUID):
    url = create_url(f"pro/extend-trial-email/{user_uuid}", base=settings.SELFURL)
    data = {"extend_url": url}
    return send_template(167332179064, to, custom_properties=data)


@require_hubspot_enabled
def send_dynamic_template(
    to: str, template: Literal["welcome", "welcome-error", "sfa01", "ica01", "spa02"]
):
    """Sends a template email to a user

    Parameters
    ----------
    to: str
        The email address of the user
    template: Literal["welcome", "welcome-error", "sfa01", "ica01", "spa02"]
        The name of the template to send
    """
    templates = {
        "welcome": 107726373209,
        "welcome-error": 107726373209,
        "ica01": 139102842895,
        "sfa01": 139102807469,
        "spa02": 139097987455,
    }
    the_id = templates.get(template, 107726373209)
    return send_template(the_id, to)


@require_hubspot_enabled
def send_new_entity(to: str, entity_name: str):
    """Sends a template email to a user when a new entity is created."""

    pro_settings_url = f"{settings.PROURL}/admin"
    data = {"pro_settings_url": pro_settings_url, "entity_name": f"'{entity_name}'"}
    return send_template(168678515536, to, custom_properties=data)
