import asyncio
import json

import httpx

from dawa_api.capture.providers import GeminiProvider, OpenAIProvider

VALID = '{"commodity_name":null,"opening_balance":1,"closing_balance":2,"record_date":null}'


def test_openai_provider_uses_structured_image_request_without_network() -> None:
    async def run() -> None:
        def handle(request: httpx.Request) -> httpx.Response:
            assert request.url.host == "api.openai.com"
            payload = json.loads(request.content)
            assert payload["text"]["format"]["type"] == "json_schema"
            assert payload["input"][0]["content"][1]["type"] == "input_image"
            return httpx.Response(
                200,
                json={
                    "status": "completed",
                    "output": [
                        {"type": "message", "content": [{"type": "output_text", "text": VALID}]}
                    ],
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            assert (
                await OpenAIProvider(client, "synthetic-token", "test-model").extract(b"image")
                == VALID
            )

    asyncio.run(run())


def test_gemini_provider_uses_header_and_structured_request_without_network() -> None:
    async def run() -> None:
        def handle(request: httpx.Request) -> httpx.Response:
            assert request.url.host == "generativelanguage.googleapis.com"
            assert "key" not in request.url.params
            payload = json.loads(request.content)
            assert payload["generationConfig"]["responseMimeType"] == "application/json"
            assert payload["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/png"
            return httpx.Response(
                200,
                json={
                    "candidates": [
                        {"finishReason": "STOP", "content": {"parts": [{"text": VALID}]}}
                    ]
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            assert (
                await GeminiProvider(client, "synthetic-token", "test-model").extract(b"image")
                == VALID
            )

    asyncio.run(run())
