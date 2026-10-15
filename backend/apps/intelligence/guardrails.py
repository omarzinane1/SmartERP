import re
from time import monotonic
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from . import policy
from .llm import AIError


class ClosedSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ToolCall(ClosedSchema):
    name: str = Field(max_length=60)
    arguments: dict = Field(default_factory=dict)


class RoutePlan(ClosedSchema):
    route: Literal["DIRECT", "TOOL", "RAG", "HYBRID"]
    calls: list[ToolCall] = Field(default_factory=list, max_length=policy.MAX_TOOL_CALLS)
    document_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def coherent(self):
        if bool(self.calls) != (self.route in {"TOOL", "HYBRID"}):
            raise ValueError("Inconsistent plan")
        if self.document_id and self.route not in {"RAG", "HYBRID"}:
            raise ValueError("Inconsistent document scope")
        return self


class GroundedAnswer(ClosedSchema):
    answer: str = Field(min_length=1, max_length=6000)
    citation_ids: list[int] = Field(default_factory=list, max_length=policy.MAX_RAG_CHUNKS)
    supported: bool


def deadline_check(deadline):
    if monotonic() >= deadline:
        raise AIError("request_timeout")


def inspect_input(text):
    if not isinstance(text, str) or not text.strip() or len(text) > policy.MAX_MESSAGE:
        raise AIError("invalid_message")
    lowered = text.casefold()
    if re.search(r"\b(company|société|entreprise)\s+(b|autre|étrangère)\b|\b(other|another|foreign)\s+compan", lowered):
        return "blocked"
    if ".env" in lowered or re.search(r"\b(sql|python|powershell|bash|shell|system prompt|mot de passe|password|secrets?|tokens?|api[_ -]?key)\b", lowered) or re.search(r"(ignore|bypass|contourne).{0,50}(instruction|règle|permission|rbac|policy)", lowered):
        return "blocked"
    if re.search(r"\b(pay|refund|delete|approve|send|payer|paie|paye|rembourser|supprime|supprimer|approuve|approuver|envoie|envoyer|transfère|transférer)\b", lowered):
        return "confirmation_required"
    return "allowed"


def redact_credentials(text):
    """Conservative pattern redaction before indexing; not a general DLP classifier."""
    text = re.sub(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----", "[clé privée retirée]", text)
    text = re.sub(r"(?im)\b(password|mot de passe|api[_ -]?key|access[_ -]?token|smtp[_ -]?password|db[_ -]?password|secret)\s*[:=]\s*[^\n]+", r"\1: [retiré]", text)
    return re.sub(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [retiré]", text)
