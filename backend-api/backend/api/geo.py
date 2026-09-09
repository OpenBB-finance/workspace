"""Functions for dealing with geo information"""

import ipaddress

import requests  # type: ignore
from pydantic import BaseModel

from utilities.config import settings


class GeoTimezone(BaseModel):
    name: str
    offset: float


class GeoResponse(BaseModel):
    city: None | str = None
    state_prov: None | str = None
    state_code: None | str = None
    zipcode: None | str = None
    country_name: str
    country_code3: str
    continent_name: str
    continent_code: str
    time_zone: GeoTimezone


def get_ip_info(ip: str) -> GeoResponse:
    clean_ip = ipaddress.ip_address(ip)
    fin_ip = str(clean_ip)
    base = "https://api.ipgeolocation.io/ipgeo"
    url = f"{base}?apiKey={settings.OPENBB_GEO_KEY}&ip={fin_ip}"

    response = requests.get(url, timeout=10)
    return GeoResponse(**response.json())
