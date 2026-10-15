# Audit de reprise — 2026-10-14

État observé avant les corrections de cette reprise : HEAD 5f14cfd ; modifications du milestone Assistant déjà présentes et non commitées. Le frontend réel est `smarterp-ai/`. Aucun AGENTS.md applicable. Audit précédent conservé dans ASSISTANT_RAG_AUDIT.md.

| Composant | État initial de la reprise | Preuve / restant |
|---|---|---|
| Ollama | DONE | Transport central et erreurs testés ; qwen3:14b a produit du JSON validé en 16,59 s ; un démarrage à froid a aussi dépassé 45 s |
| pgvector | PARTIAL | Extension 0.8.7 visible sur smarterp_ai:5433 à la reprise ; deux migrations encore non appliquées, puis appliquées avec succès pendant l'audit |
| Embeddings | DONE | EmbeddingGemma téléchargé avec accord explicite, dimension réelle 768, lot de deux requêtes réel ; tests unitaires de lots/dimension |
| Ingestion Documents | PARTIAL | Pipeline Celery branché, extraction et réindexation testées en eager ; validation worker réel et reprise de bail à compléter |
| Recherche sécurisée | DONE | WHERE société, visibilité et droits de chaque liaison avant CosineDistance/LIMIT ; tests avec vrais vecteurs PostgreSQL |
| RAG | PARTIAL | Sources réelles, aucun résultat, injections et citations inventées testés ; parcours complet Ollama réel à vérifier |
| Permissions outils | PARTIAL | Registre unique de sept outils, schémas fermés, droits sources ; dernière limite SQL globale et présentation non encore retestées |
| Garde-fous | PARTIAL | Limites et refus, droits revalidés, contexte documentaire non fiable ; compléter tests de délais/concurrence/rate limit/anonyme |
| LangChain | DONE | Embeddings et RecursiveCharacterTextSplitter réellement utilisés |
| LangGraph | DONE | Graphe acyclique DIRECT/TOOL/RAG/HYBRID testé avec sorties structurées simulées ; traces externes désactivées |
| Assistant | PARTIAL | API, conversations et SSE branchés ; 33 nouveaux tests backend passés avant dernières petites modifications, navigateur en échec de fixture module désactivé |

Lectures de contrôle : modèles/migrations/provider/embeddings, indexer/retriever/parsers/chunking, assistant et vues, registre/guardrails/graphe, sélecteurs ERP et droits membership, audit, configuration et scripts de test ; contrats React types/API/hooks/page/sources et rapports Playwright. Aucun moteur existant ne sera recréé. Les anciennes demandes manuelles d'activation pgvector sont closes ; ne pas se baser sur les anciens journaux d'échec.

Reste autorisé : corriger les écarts observés, valider runtime réel, suite complète puis ciblée, build/lint/navigateur, rapport final 23 sections et état Git sans commit/push.
