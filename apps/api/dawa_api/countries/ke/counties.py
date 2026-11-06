"""Official Kenya administrative labels; operational records remain synthetic."""

from dataclasses import dataclass

COUNTY_SOURCE = "https://www.devolution.go.ke/county-information/"
KISUMU_SOURCE = "https://www.kisumu.go.ke/wp-content/uploads/KISUMU-CIDP-III-2023-2027.pdf"


@dataclass(frozen=True)
class County:
    code: str
    name: str


_NAMES = (
    "Mombasa",
    "Kwale",
    "Kilifi",
    "Tana River",
    "Lamu",
    "Taita Taveta",
    "Garissa",
    "Wajir",
    "Mandera",
    "Marsabit",
    "Isiolo",
    "Meru",
    "Tharaka-Nithi",
    "Embu",
    "Kitui",
    "Machakos",
    "Makueni",
    "Nyandarua",
    "Nyeri",
    "Kirinyaga",
    "Murang'a",
    "Kiambu",
    "Turkana",
    "West Pokot",
    "Samburu",
    "Trans Nzoia",
    "Uasin Gishu",
    "Elgeyo-Marakwet",
    "Nandi",
    "Baringo",
    "Laikipia",
    "Nakuru",
    "Narok",
    "Kajiado",
    "Kericho",
    "Bomet",
    "Kakamega",
    "Vihiga",
    "Bungoma",
    "Busia",
    "Siaya",
    "Kisumu",
    "Homa Bay",
    "Migori",
    "Kisii",
    "Nyamira",
    "Nairobi",
)
KENYA_COUNTIES = tuple(County(f"{index:03d}", name) for index, name in enumerate(_NAMES, 1))
KISUMU_SUBCOUNTIES = (
    "Kisumu Central",
    "Kisumu East",
    "Kisumu West",
    "Muhoroni",
    "Nyando",
    "Nyakach",
    "Seme",
)


def county_by_code(code: str) -> County:
    """Look up an exact three-digit official county code."""
    for county in KENYA_COUNTIES:
        if county.code == code:
            return county
    raise ValueError("Unknown Kenya county code")
