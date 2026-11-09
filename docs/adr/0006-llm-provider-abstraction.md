# 0006: A language-model provider abstraction

**Status:** accepted

## Context

Bin-card extraction and plain-language explanations can use a hosted language model, but providers differ in APIs and availability, keys must stay on the server, and tests must not depend on a network service.

## Decision

Extraction (`dawa_api.capture.providers`) and explanation (`dawa_api.explain.providers`) go through small provider interfaces with OpenAI and Gemini implementations, chosen by backend settings with a preferred provider and fallbacks. Responses must match a structured schema; incomplete or malformed output is rejected. Calls are capped, and when no provider is configured or every provider fails, the product degrades to manual entry (capture) or the deterministic template (explanation). CI uses mocked providers and recorded fixtures only.

## Consequences

- Provider keys never reach the browser, and switching providers is a settings change.
- No real provider has been exercised end to end in this repository; quality of extraction is untested and the README says so.
- A person confirms every extracted field before anything is saved.
