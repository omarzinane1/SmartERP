"""Explicit operator diagnostic; never downloads a model or sends ERP data."""
from time import monotonic
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from apps.intelligence.llm import OllamaProvider, AIError
from apps.intelligence.embeddings import EmbeddingProvider
from apps.intelligence.guardrails import GroundedAnswer


class Command(BaseCommand):
    help = "Verify local Ollama models/chat/embeddings and optional PostgreSQL vector distance."

    def add_arguments(self, parser):
        parser.add_argument("--database", action="store_true")

    def handle(self, *args, **options):
        try:
            provider = OllamaProvider()
            self.stdout.write(str(provider.health_check()))
            embedding = EmbeddingProvider()
            vectors = embedding.embed_texts(["Le paiement du contrat est dû à trente jours.", "La livraison concerne des bureaux."])
            self.stdout.write(f"Embedding model={embedding.model} dimension={len(vectors[0])} count={len(vectors)}")
            start = monotonic()
            response = provider.generate("Réponds en français à Bonjour. supported=true, citation_ids=[]; answer doit être une salutation.", schema=GroundedAnswer, deadline=start+90)
            self.stdout.write(f"Structured chat valid={bool(response.answer)} duration={monotonic()-start:.2f}s")
            if options["database"]:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT extversion FROM pg_extension WHERE extname='vector'")
                    row = cursor.fetchone()
                    if not row:
                        raise CommandError("Extension vector must be enabled by the database administrator.")
                    cursor.execute("SELECT %s::vector <=> %s::vector", [str(vectors[0]), str(vectors[0])])
                    self.stdout.write(f"pgvector={row[0]} self_cosine_distance={cursor.fetchone()[0]}")
        except AIError as error:
            raise CommandError(error.code) from None
