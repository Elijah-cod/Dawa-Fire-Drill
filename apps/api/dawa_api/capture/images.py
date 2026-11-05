"""Validate and normalize image content before it reaches an extraction provider."""

import warnings
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
MAX_PIXELS = 16_000_000


class ImageValidationError(ValueError):
    """The upload is too large, malformed, or not an allowed image."""


def validate_image(content: bytes, content_type: str, *, max_bytes: int) -> bytes:
    if content_type not in FORMATS or not content or max_bytes <= 0 or len(content) > max_bytes:
        raise ImageValidationError("Unsupported image or size")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as probe:
                if probe.format != FORMATS[content_type] or probe.width * probe.height > MAX_PIXELS:
                    raise ImageValidationError("Image format or dimensions are invalid")
                probe.verify()
            with Image.open(BytesIO(content)) as source:
                oriented = ImageOps.exif_transpose(source).convert("RGB")
                clean = Image.new("RGB", oriented.size)
                clean.paste(oriented)
                output = BytesIO()
                clean.save(output, format="PNG")
                return output.getvalue()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise ImageValidationError("Malformed image") from exc
