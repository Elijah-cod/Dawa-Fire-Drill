import pytest

from dawa_api.countries.service import CountryNotConfigured, get_adapter, get_country


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


def test_adapters_keep_synthetic_facility_rules_country_specific() -> None:
    kenya = get_adapter("KE")
    assert kenya.supports_synthetic_facility("SYN-KE-F001")
    assert not kenya.supports_synthetic_facility("SYN-ZZ-F001")
    stub = get_adapter("ZZ")
    assert not stub.configured
    assert not stub.supports_synthetic_facility("SYN-ZZ-F001")
