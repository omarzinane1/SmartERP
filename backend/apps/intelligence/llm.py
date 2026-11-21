"""The sole HTTP transport for local inference. No downloads, redirects or cloud fallback."""
import json
import math
from time import monotonic
from typing import Protocol
from urllib.parse import urlsplit
import httpx
from django.conf import settings
from . import policy


class AIError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class LLMProvider(Protocol):
    def chat(self, messages, *, schema=None, deadline=None, max_output_tokens=500): ...
    def generate(self, prompt, *, schema=None, deadline=None): ...
    def health_check(self): ...
    def model_info(self, model=None): ...


class OllamaProvider:
    def __init__(self):
        self.url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.OLLAMA_CHAT_MODEL
        parsed = urlsplit(self.url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise AIError("provider_not_configured")

    def request(self, path, body=None, *, deadline=None):
        remaining = (deadline-monotonic()) if deadline else settings.OLLAMA_TIMEOUT
        if remaining <= 0:
            raise AIError("request_timeout")
        timeout = httpx.Timeout(min(settings.OLLAMA_TIMEOUT, remaining), connect=min(settings.OLLAMA_CONNECT_TIMEOUT, remaining))
        try:
            # trust_env=False prevents proxies and credentials being inherited from the host.
            with httpx.Client(timeout=timeout, follow_redirects=False, trust_env=False) as client:
                with client.stream("GET" if body is None else "POST", self.url+path, json=body) as response:
                    if response.status_code == 404:
                        raise AIError("model_unavailable")
                    if response.status_code != 200:
                        raise AIError("provider_unavailable")
                    content = bytearray()
                    for block in response.iter_bytes():
                        content.extend(block)
                        if len(content) > 2_000_000:
                            raise AIError("provider_response_too_large")
                        if deadline and monotonic() > deadline:
                            raise AIError("request_timeout")
                    result = json.loads(content)
                    if not isinstance(result, dict) or result.get("error"):
                        raise AIError("invalid_provider_response")
                    return result
        except httpx.TimeoutException:
            raise AIError("provider_timeout") from None
        except httpx.HTTPError:
            raise AIError("provider_unavailable") from None
        except (ValueError, UnicodeError):
            raise AIError("invalid_provider_response") from None

    def chat(self, messages, *, schema=None, deadline=None, max_output_tokens=500):
        if not self.model:
            raise AIError("model_unavailable")
        if len(json.dumps(messages, ensure_ascii=False).encode()) > policy.MAX_CONTEXT_BYTES:
            raise AIError("context_limit")
        body = dict(model=self.model, messages=messages, stream=False, think=False,
            options=dict(temperature=0, num_predict=min(1000, max(1, max_output_tokens)), num_ctx=8192))
        if schema is not None:
            body["format"] = schema.model_json_schema()
        result = self.request("/api/chat", body, deadline=deadline)
        message = result.get("message")
        text = message.get("content") if isinstance(message, dict) else None
        if not isinstance(text, str) or not text.strip() or len(text.encode()) > policy.MAX_OUTPUT_BYTES:
            raise AIError("invalid_provider_response")
        if schema is None:
            return text
        try:
            return schema.model_validate_json(text)

        except ValueError:
            # Un retry uniquement pour les erreurs de routing.
            if schema.__name__ != "RoutePlan":
                raise AIError("invalid_structured_output") from None

            correction = (
                "Your previous JSON failed validation. "
                "Correct your routing response using these mandatory rules: "
                "DIRECT: calls=[] and document_id=null. "
                "RAG: calls=[] without exception. "
                "TOOL: calls must contain an authorized tool and document_id=null. "
                "HYBRID: calls must contain an authorized tool. "
                "For a question about a contract or PDF content, choose RAG "
                "without any tool calls. "
                "Never invent tool names, entity IDs, or document IDs. "
                "Return ONLY corrected JSON with route, calls, document_id."
            )

            retry_messages = [
                *messages,
                {"role": "assistant", "content": text},
                {"role": "user", "content": correction},
            ]

            if (
                len(json.dumps(retry_messages, ensure_ascii=False).encode("utf-8"))
                > policy.MAX_CONTEXT_BYTES
            ):
                raise AIError("context_limit")

            retry_body = {
                **body,
                "messages": retry_messages,
            }

            retry_result = self.request(
                "/api/chat",
                retry_body,
                deadline=deadline,
            )

            retry_message = retry_result.get("message")
            retry_text = (
                retry_message.get("content")
                if isinstance(retry_message, dict)
                else None
            )

            if (
                not isinstance(retry_text, str)
                or not retry_text.strip()
                or len(retry_text.encode("utf-8")) > policy.MAX_OUTPUT_BYTES
            ):
                raise AIError("invalid_provider_response")

            try:
                return schema.model_validate_json(retry_text)

            except ValueError:
                raise AIError("invalid_structured_output") from None

    def generate(self, prompt, *, schema=None, deadline=None):
        return self.chat([dict(role="user", content=prompt)], schema=schema, deadline=deadline)

    def model_info(self, model=None):
        name = model or self.model
        result = self.request("/api/show", dict(model=name))
        return dict(model=name, capabilities=result.get("capabilities", []))

    def model_digest(self, model, *, deadline=None):
        result = self.request("/api/tags", deadline=deadline)
        rows = result.get("models")
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise AIError("invalid_provider_response")
        for row in rows:
            if row.get("name") == model or row.get("model") == model:
                digest = row.get("digest")
                if isinstance(digest, str) and len(digest) <= 100:
                    return digest
        raise AIError("model_unavailable")

    def health_check(self):
        return dict(chat=self.model_info(), embedding=self.model_info(settings.OLLAMA_EMBEDDING_MODEL))

    def embeddings(self, model, texts, *, deadline=None):
        result = self.request("/api/embed", dict(model=model, input=texts, truncate=False), deadline=deadline)
        vectors = result.get("embeddings")
        if not isinstance(vectors, list) or len(vectors) != len(texts):
            raise AIError("invalid_embeddings")
        for vector in vectors:
            if not isinstance(vector, list) or len(vector) != policy.EMBEDDING_DIMENSION or any(type(v) not in (float, int) or not math.isfinite(v) for v in vector) or not any(vector):
                raise AIError("invalid_embeddings")
        return vectors
