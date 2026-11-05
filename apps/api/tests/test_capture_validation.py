from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin

from dawa_api.app import create_app
from dawa_api.capture.images import ImageValidationError, validate_image
from dawa_api.settings import Settings


def synthetic_png() -> bytes:
    buffer = BytesIO()
    info = PngImagePlugin.PngInfo()
    info.add_text("synthetic-metadata", "remove me")
    Image.new("RGB", (4, 4), "white").save(buffer, format="PNG", pnginfo=info)
    return buffer.getvalue()


def test_image_is_validated_and_metadata_removed() -> None:
    normalized = validate_image(synthetic_png(), "image/png", max_bytes=10000)
    with Image.open(BytesIO(normalized)) as image:
        assert image.format == "PNG"
        assert "synthetic-metadata" not in image.info


@pytest.mark.parametrize(
    ("content", "content_type", "limit"),
    [
        (b"not an image", "image/png", 100),
        (synthetic_png(), "image/jpeg", 10000),
        (synthetic_png(), "image/png", 4),
        (synthetic_png(), "text/plain", 10000),
    ],
)
def test_invalid_image_type_size_or_content_is_rejected(
    content: bytes, content_type: str, limit: int
) -> None:
    with pytest.raises(ImageValidationError):
        validate_image(content, content_type, max_bytes=limit)


def test_streamed_multipart_body_is_limited_without_content_length() -> None:
    settings = Settings(DATABASE_URL="postgresql+asyncpg://localhost/dawa", max_upload_mb=1)
    boundary = b"synthetic-boundary"
    prefix = (
        b"--" + boundary + b'\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\n'
    )
    prefix += b"Content-Type: image/png\r\n\r\n"
    chunks = iter([prefix] + [b"x" * 65536] * 20 + [b"\r\n--" + boundary + b"--\r\n"])
    with TestClient(create_app(settings=settings)) as client:
        response = client.post(
            "/v1/captures",
            content=chunks,
            headers={"Content-Type": "multipart/form-data; boundary=synthetic-boundary"},
        )
    assert response.status_code == 413
