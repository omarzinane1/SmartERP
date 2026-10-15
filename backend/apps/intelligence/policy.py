"""One policy for provider, graph, retrieval and API bounds."""
from django.conf import settings

EMBEDDING_DIMENSION = 768  # Measured with embeddinggemma:300m /api/embed, 2026-10-13.
MAX_MESSAGE = 4000
MAX_HISTORY = 12
MAX_TOOL_CALLS = 4
MAX_GRAPH_STEPS = 10
MAX_RAG_CHUNKS = 8
DEFAULT_TOP_K = 5
MAX_ROWS = 20
MAX_CONTEXT_BYTES = 24000
MAX_OUTPUT_BYTES = 32000
CHUNK_SIZE = 1200  # UTF-8 bytes, conservative bound for the model's 2K token window.
CHUNK_OVERLAP = 150
MAX_CHUNKS = 512
MAX_EXTRACTED_CHARS = 600000
EMBEDDING_BATCH = 16
CHUNK_VERSION = "utf8-v1"
CHAT_SECONDS = 90
INDEX_SECONDS = 600
SQL_TIMEOUT_MS = 3000
RATE_PER_MINUTE = 10


def enabled():
    return bool(settings.OLLAMA_BASE_URL and settings.OLLAMA_CHAT_MODEL and settings.OLLAMA_EMBEDDING_MODEL)
