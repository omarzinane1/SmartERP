from pypdf import PdfReader
from apps.intelligence import policy
from apps.intelligence.llm import AIError
from apps.intelligence.guardrails import redact_credentials


def extract_pages(document):
    if document.mime_type not in {"text/plain", "application/pdf"}:
        raise AIError("unsupported_format")
    pages, total = [], 0
    with document.file.open("rb") as source:
        if document.mime_type == "text/plain":
            text = source.read().decode("utf-8-sig")
            raw = [(i//10000+1, text[i:i+10000]) for i in range(0, len(text), 10000)]
        else:
            reader = PdfReader(source, strict=True)
            if reader.is_encrypted or len(reader.pages) > 500:
                raise AIError("unsupported_pdf")
            raw = ((i+1, page.extract_text() or "") for i, page in enumerate(reader.pages))
        for page, text in raw:
            text = redact_credentials(text.replace("\x00", "")).strip()
            total += len(text)
            if total > policy.MAX_EXTRACTED_CHARS:
                raise AIError("document_too_large_for_rag")
            if text:
                pages.append((page, text))
    if not pages:
        raise AIError("no_extractable_text")
    return pages
