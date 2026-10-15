# Audit préalable — Assistant, Ollama et RAG — 2026-10-13

Avant les changements de cette mission ; HEAD initial 8b9be6e ; HEAD observé à la reprise 5f14cfd (commit externe à cette mission), arbre contenant déjà les milestones Intelligence et Opportunités. Le frontend réel est smarterp-ai, pas frontend. Aucun AGENTS.md applicable trouvé lors de l'audit initial.

| Élément | État réel | Décision |
|---|---|---|
| IntelligenceRun/AIAlert/ForecastRun/AIOpportunity | IMPLEMENTED dans l'arbre courant | Conserver moteurs déterministes et droits source |
| AI Tool Registry/context/executor | MISSING | tools.py, tools/* sont des squelettes ; créer registre fermé, contexte membre et exécuteur audité read-only |
| Ollama | PARTIAL | Runtime local installé ; qwen3:14b et mistral:latest, capacités completion/tools ; aucun embedding dédié |
| Provider LLM/embeddings | MISSING | Centraliser transport, limites, erreurs et sortie structurée ; aucun fallback cloud |
| pgvector | MISSING | Django5.2.17, psycopg3.3.6, PostgreSQL17 ; vector.control absent. Extension native à installer, aucun reset |
| Documents upload/storage | IMPLEMENTED | Fichiers ≤15Mo : PDF texte/TXT/images, validations pypdf/PIL ; storage partagé existant |
| Documents permissions | IMPLEMENTED | Company + privé propriétaire + chaque liaison métier autorisée, suppression logique exclue |
| Documents extraction/chunks/RAG | MISSING | Modules vides, aucun DocumentChunk ni statut d'index. TXT et PDF texte seulement pour RAG ; images/scans non pris en charge |
| Celery/Valkey/after_commit | IMPLEMENTED | Réutiliser dispatch ID-only et conventions de bail ; tests eager sans broker |
| Assistant/conversations/messages | MISSING backend / PARTIAL frontend | Types et UI de chat avec SSE existants ; mocks partagés. Connecter même contrat, sans redesign |
| LangGraph/LangChain | MISSING | Pas de dépendance existante ; graphe explicite borné DIRECT/TOOL/RAG/HYBRID |
| Paramètres AI société | PARTIAL / RISK | Valeurs false placeholders, sections indisponibles et non sauvegardables ; ne pas les présenter comme une politique administrable |
| Audit | IMPLEMENTED | Ajouter uniquement champs scalaires allowlistés nécessaires, jamais prompts ni documents |

Sources inspectées : apps intelligence/documents/accounts/companies/reporting/finance/inventory/sales/purchasing/crm/audit, common dispatch/RBAC/permissions/pagination, config settings/Celery, requirements/base.txt. Contrat frontend lu avant serializers : ai.types.ts, ai.api.ts, useAIWorkspace, AIAssistantPage, AIResponse, ChatEvent, SourceCitationList, Document payload/capabilities. L'Assistant conserve conversations/id/messages/blocks/sources/tools et SSE status/block/done ; les objets de sécurité ne sont jamais transmis par le navigateur.

Architecture retenue : contexte utilisateur/Company revalidé, outils ERP à schémas fermés, retriever pgvector utilisant document_queryset avant distance/limite ; graph LangGraph à sens unique avec nombre d'appels limité ; aucune boucle agent autonome ni handler write. Les chunks récupérés sont des données non fiables, jamais des instructions/outils. Citations construites et validées côté serveur. Historique personnel masqué si droits source changent. Publication chat vérifie encore les permissions et documents ; aucune transaction longue pendant Ollama.

Réindex : modèle/dimension/version de chunking suivis, changement explicite et remplacement atomique sous claim token ; anciens embeddings incompatibles jamais comparés. Dimension mesurée via /api/embed : 768, embeddinggemma:300m, le 2026-10-13. Téléchargement explicitement autorisé par l’utilisateur. Recherche exacte filtrée initialement ; pas d'index ANN arbitraire.

Téléchargement embedding dédié soumis à réponse explicite de l'utilisateur conformément à sa mission. Installation native pgvector/validation runtime à documenter séparément du code ; aucune déclaration DONE sans INSERT et requête de distance réels. Références techniques primaires : docs.ollama.com/api/chat, /api/embed ; github.com/pgvector/pgvector ; docs.langchain.com/oss/python/langgraph/graph-api.
