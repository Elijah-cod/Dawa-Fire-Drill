"""Shared validation for explicit JSON confirmations."""

from typing import Annotated, Any, Literal

from pydantic import BeforeValidator


def require_true(value: Any) -> Any:
    if value is not True:
        raise ValueError("An explicit true value is required")
    return value


ExplicitTrue = Annotated[Literal[True], BeforeValidator(require_true)]


def require_json_number(value: Any) -> Any:
    if type(value) not in (int, float):
        raise ValueError("Value must be a JSON number")
    return value


JsonInteger = Annotated[int, BeforeValidator(require_json_number)]
JsonNumber = Annotated[float, BeforeValidator(require_json_number)]
