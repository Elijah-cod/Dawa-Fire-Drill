import pytest

from dawa_api.countries.ke.counties import KENYA_COUNTIES, KISUMU_SUBCOUNTIES, county_by_code


def test_official_county_codes_are_complete_and_unique() -> None:
    assert len(KENYA_COUNTIES) == 47
    assert {county.code for county in KENYA_COUNTIES} == {
        f"{number:03d}" for number in range(1, 48)
    }
    assert len({county.name for county in KENYA_COUNTIES}) == 47
    assert county_by_code("042").name == "Kisumu"
    assert county_by_code("047").name == "Nairobi"
    with pytest.raises(ValueError):
        county_by_code("048")


def test_kisumu_subcounties_are_explicit_and_unique() -> None:
    assert set(KISUMU_SUBCOUNTIES) == {
        "Kisumu Central",
        "Kisumu East",
        "Kisumu West",
        "Muhoroni",
        "Nyando",
        "Nyakach",
        "Seme",
    }
