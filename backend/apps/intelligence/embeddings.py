from time import monotonic
from django.conf import settings
from langchain_core.embeddings import Embeddings
from . import policy
from .llm import OllamaProvider, AIError


class EmbeddingProvider(Embeddings):
    """LangChain embedding contract; only this adapter knows the Ollama transport."""
    def __init__(self, *, deadline=None):
        self.provider = OllamaProvider()
        self.model = settings.OLLAMA_EMBEDDING_MODEL
        self.deadline = deadline or monotonic()+policy.INDEX_SECONDS

    def identity(self):
        return self.model, self.provider.model_digest(self.model, deadline=self.deadline)

    def model_info(self):
        return self.provider.model_info(self.model)

    def health_check(self):
        info = self.model_info()
        if "embedding" not in info["capabilities"]:
            raise AIError("embedding_model_unavailable")
        return dict(**info, digest=self.identity()[1])

    def embed_documents(self, texts):
        if not texts or len(texts) > policy.MAX_CHUNKS or any(not isinstance(t, str) or not t.strip() or len(t.encode()) > policy.MAX_MESSAGE for t in texts):
            raise AIError("invalid_embedding_input")
        identity = self.identity()
        result = []
        for start in range(0, len(texts), policy.EMBEDDING_BATCH):
            result.extend(self.provider.embeddings(self.model, texts[start:start+policy.EMBEDDING_BATCH], deadline=self.deadline))
        if identity != self.identity():
            raise AIError("embedding_model_changed")
        return result

    def embed_query(self, text):
        return self.embed_documents([text])[0]

    embed_text = embed_query
    embed_texts = embed_documents
