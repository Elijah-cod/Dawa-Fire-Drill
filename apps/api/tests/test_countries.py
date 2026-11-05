import pytest

from dawa_api.countries.service import CountryNotConfigured, get_country


def test_kenya_adapter_is_configured() -> None:
    country = get_country("ke")
    assert country.code == "KE"
    assert country.currency == "KES"


def test_second_country_is_explicit_stub() -> None:
    with pytest.raises(CountryNotConfigured, match="ZZ"):
        get_country("ZZ")


def test_unknown_country_is_rejected() -> None:
    with pytest.raises(CountryNotConfigured):
        get_country("XX")
