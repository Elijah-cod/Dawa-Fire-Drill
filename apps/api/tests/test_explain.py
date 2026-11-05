from dawa_api.explain.service import explain_selection
from dawa_api.optimization.service import Candidate, select_actions


def test_explanation_restates_solver_result_without_changing_ranking():
    candidates = [Candidate("alpha", 3, 5), Candidate("beta", 5, 4)]
    result = select_actions(candidates, budget=3)
    explanation = explain_selection(result, budget=3)
    assert explanation.selected_ids == result.selected_ids == ("alpha",)
    assert "alpha" in explanation.text and "beta" in explanation.text
    assert "illustrative" in explanation.text.lower()
    assert "accuracy" not in explanation.text.lower()


def test_llm_explanation_cannot_change_solver_selection_and_falls_back():
    import asyncio

    from dawa_api.explain.service import explain_with_providers

    class Store:
        async def reserve(self):
            return True

    class Provider:
        async def explain(self, payload):
            assert payload["selected_ids"] == ["alpha"]
            return '{"text":"The chosen option fits the budget."}'

    class UnsafeProvider:
        async def explain(self, payload):
            return '{"text":"The model has 99 percent accuracy."}'

    result = select_actions([Candidate("alpha", 3, 5), Candidate("beta", 5, 4)], budget=3)
    explained = asyncio.run(
        explain_with_providers(result, budget=3, providers=[Provider()], store=Store())
    )
    assert explained.selected_ids == result.selected_ids
    assert "chosen option" in explained.text
    fallback = asyncio.run(
        explain_with_providers(result, budget=3, providers=[UnsafeProvider()], store=Store())
    )
    assert fallback == explain_selection(result, budget=3)
    alternate = asyncio.run(
        explain_with_providers(
            result, budget=3, providers=[UnsafeProvider(), Provider()], store=Store()
        )
    )
    assert "chosen option" in alternate.text

    class Exhausted:
        async def reserve(self):
            return False

    assert asyncio.run(
        explain_with_providers(result, budget=3, providers=[Provider()], store=Exhausted())
    ) == explain_selection(result, budget=3)


def test_explanation_http_adapters_use_structured_outputs_without_images():
    import asyncio

    import httpx

    from dawa_api.explain.providers import GeminiExplanationProvider, OpenAIExplanationProvider

    async def check():
        def handle(request):
            data = __import__("json").loads(request.content)
            assert "selected_ids" in str(data)
            assert "image" not in str(data).lower()
            if request.url.host == "api.openai.com":
                return httpx.Response(
                    200,
                    json={
                        "status": "completed",
                        "output": [
                            {
                                "type": "message",
                                "content": [
                                    {
                                        "type": "output_text",
                                        "text": '{"text":"The chosen option fits the budget."}',
                                    }
                                ],
                            }
                        ],
                    },
                )
            return httpx.Response(
                200,
                json={
                    "candidates": [
                        {
                            "finishReason": "STOP",
                            "content": {
                                "parts": [{"text": '{"text":"The chosen option fits the budget."}'}]
                            },
                        }
                    ]
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            for provider in (
                OpenAIExplanationProvider(client, "test-key", "test-model"),
                GeminiExplanationProvider(client, "test-key", "test-model"),
            ):
                assert "chosen option" in await provider.explain({"selected_ids": ["alpha"]})

    asyncio.run(check())
