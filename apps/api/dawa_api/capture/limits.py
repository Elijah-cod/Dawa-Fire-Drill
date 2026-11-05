"""Bound multipart request bodies before the parser buffers uploaded files."""

from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from dawa_api.settings import Settings


class BodyTooLarge(HTTPException):
    def __init__(self) -> None:
        super().__init__(status_code=413, detail="Upload is too large")


class CaptureBodyLimit:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or not scope["path"].endswith("/captures")
        ):
            await self.app(scope, receive, send)
            return
        settings: Settings = scope["app"].state.settings
        limit = settings.max_upload_mb * 1024 * 1024 + 65536
        content_length = next(
            (value for key, value in scope["headers"] if key == b"content-length"), None
        )
        if content_length is not None:
            try:
                size = int(content_length)
                too_large = size < 0 or size > limit
            except ValueError:
                too_large = True
            if too_large:
                await JSONResponse({"detail": "Upload is too large"}, status_code=413)(
                    scope, receive, send
                )
                return
        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLarge()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except BodyTooLarge:
            await JSONResponse({"detail": "Upload is too large"}, status_code=413)(
                scope, receive, send
            )
