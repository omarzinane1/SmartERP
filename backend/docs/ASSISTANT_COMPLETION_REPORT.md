# SmartERP AI — rapport de reprise Assistant / RAG

Reprise du 14 octobre 2026. Frontend effectif : `smarterp-ai/`. Audit initial conservé dans [ASSISTANT_CONTINUATION_AUDIT.md](ASSISTANT_CONTINUATION_AUDIT.md). Les mentions « déjà présent » se rapportent à l’état de cette reprise, pas uniquement à HEAD. Aucun commit ni push effectué.

## 1 — FINAL STATUS

STATUS_MATRIX_FINAL

## 2 — WHAT WAS ALREADY DONE

Provider Ollama centralisé, abstraction Embeddings LangChain, chunking, migrations préparées, pipeline Documents, retriever SQL sécurisé, registre unique des sept outils, graphe LangGraph, conversations et API étaient déjà écrits dans l’arbre courant. Les tests de base passaient ; la connexion réelle de l’Assistant frontend était déjà engagée. Les modules ERP, le moteur de permissions membership, les sélecteurs financiers, le stockage Documents, les liaisons documentaires et l’infrastructure Celery existaient. Les migrations et le runtime complet n’étaient pas encore tous validés.

## 3 — IMPLEMENTED / FIXED NOW

- Vérification de vector 0.8.7 depuis Django puis application des deux migrations en attente, sans réinitialisation de données.
- Validation de l’indexation avec un vrai worker Celery, Valkey, embeddings Ollama et insertion/recherche PostgreSQL ; diagnostic reproductible avec nettoyage de ses seules fixtures.
- Droits `documents.ai_analyze` appliqués au retrieval, à la demande d’indexation et à sa publication ; tests de retrait avant appel provider.
- Limites SQL globales des outils, provenance transitive de l’historique bornée, exclusion des demandes bloquées des prompts suivants, traitement de motifs de credentials avant embedding, reprise de bail et clôture après suppression.
- Routage plus compact et réponses limitées à trois phrases / 240 tokens de sortie pour réduire le coût CPU ; sortie du routeur limitée à 200 tokens.
- API Documents par défaut, polling d’indexation et tests navigateur des vrais composants ; fixture d’activation des modules corrigée. Aucun changement de design.
- Contrôles supplémentaires d’accès anonyme, rate limit, concurrence de conversation, timeout, révocation, similarité ordonnée, déduplication et intégrité documentaire.
- Manifeste historique Opportunités manquant et résultats des validations précédentes documentés séparément.

## 4 — FILES

Liste exhaustive Created / Modified / Deleted : [ASSISTANT_COMPLETION_FILES.md](ASSISTANT_COMPLETION_FILES.md). Elle distingue les fichiers non suivis et suivis contre HEAD `5f14cfd` ; une partie de ce diff était déjà présente avant la reprise. Aucun fichier supprimé par cette reprise. Les migrations Documents 0002 et Intelligence 0004 sont désormais appliquées : ne plus les modifier.

## 5 — ARCHITECTURE

Utilisateur authentifié + société active → React Assistant → API JSON ou SSE → Assistant service → AIToolContext serveur → LangGraph → DIRECT / TOOL / RAG / HYBRID → registre fermé de sélecteurs ERP et/ou retriever documentaire autorisé → Ollama → validation du schéma et des citations → revalidation droits/sources → AIMessage → réponse/historique.

Le LLM produit uniquement un plan structuré et une interprétation. Les montants FACT proviennent des sélecteurs ERP officiels et sont rendus par le serveur. La société, l’utilisateur, le membership et le délai ne sont jamais des arguments choisis par le modèle. Les traces LangSmith externes sont désactivées.

## 6 — OLLAMA

Configuration de développement : `http://localhost:11434`, chat `qwen3:14b`, embeddings `embeddinggemma:300m`, remplaçables par environnement. Base settings hors développement sans modèle implicite. Connexion 3 s, lecture 45 s par défaut, deadline Assistant 90 s ; diagnostic complémentaire à 60 s de lecture. Aucun téléchargement automatique ni fallback cloud.

Transport httpx sans proxy hérité ni redirection, réponse HTTP ≤2 Mo, erreurs normalisées (`provider_timeout`, `provider_unavailable`, `model_unavailable`, `invalid_provider_response`, `invalid_structured_output`). Pas d’exception brute dans l’API ou l’audit. JSON Pydantic strict ; chain of thought non exposée. Health et capacités réelles validées ; chat simple Qwen validé (16,59 s puis 43,69 s dans deux contrôles), embeddings réels validés.

RUNTIME_FINAL

## 7 — PGVECTOR

Application connectée à `smarterp_ai`, `127.0.0.1:5433`, PostgreSQL 17, extension **0.8.7**. `VectorField(dimensions=768)` correspond aux vecteurs réellement mesurés. Distance cosinus, recherche exacte, B-tree société/document ; pas d’index ANN ni de filtrage global après top-K. Cette stratégie convient à la première version mais doit être mesurée sur de gros volumes.

Migration `documents.0002_document_embedding_digest_document_embedding_model_and_more` : VectorExtension, champs Document et DocumentChunk. Migration `intelligence.0004_aiconversation_aimessage_and_more` : conversations/messages. Toutes deux appliquées avec succès ; aucun changement de migration antérieure appliquée. Tests : insertion réelle, égalité cosinus 0, ordre de deux vecteurs différents, top-K filtré ; worker réel : distance **0,375445** vers le contrat synthétique.

## 8 — EMBEDDINGS

`EmbeddingProvider` implémente l’interface LangChain Embeddings et expose embed_text/embed_texts ainsi que embed_query/embed_documents. Ollama `/api/embed`, modèle configurable, dimension imposée 768, lots de 16, maximum 512 textes, texte non vide ≤4000 octets UTF-8. Vecteurs numériques finis, non nuls, nombre et dimension vérifiés. Modèle + digest + version de chunk stockés et comparés avant/après embedding et à la recherche.

Changement de modèle ou digest : anciens chunks exclus, réindexation explicite nécessaire. Pas de mélange silencieux d’espaces vectoriels. Un autre modèle de dimension différente nécessite une nouvelle migration et une réindexation, jamais une conversion inventée.

## 9 — DOCUMENT INGESTION

Formats RAG : TXT UTF-8 et PDF avec texte extractible. PDF chiffré, scans sans texte, images et autres formats refusés par l’indexeur avec erreur contrôlée. Fichier ≤15 Mo, PDF ≤500 pages, texte extrait ≤600000 caractères. NUL et motifs de credentials connus retirés. Splitter LangChain récursif : **1200 octets UTF-8**, overlap **150**, maximum **512 chunks** ; taille en octets, pas faux décompte de tokens. Page conservée ; section vide et token_count null quand non calculés.

Cycle : not_indexed → pending → processing → indexed / failed. Envoi Celery après commit. Claim UUID et bail ; extraction/HTTP hors transaction ; remplacement des chunks atomique après revérification des droits et du bail. Double livraison sans effet ; réindexation remplace les anciens chunks ; suppression invalide le claim et purge les chunks. Après échec ou bail expiré, réindexation manuelle ; pas de boucle automatique infinie. Un échec broker est visible. Les anciens chunks d’un document failed ne sont pas recherchables.

## 10 — VECTOR SECURITY

Le WHERE SQL impose société du chunk ET du document, visibilité privée/propriétaire ou entreprise, et autorisation de toutes les entités liées, avant calcul de distance/ORDER BY/LIMIT. Permissions `ai.use`, `documents.view`, `documents.ai_analyze`. Un document appartenant à une autre société ne peut entrer dans le contexte même avec un ID fourni dans la question. Le company_id serveur n’est pas modifiable par le LLM.

Top-K par défaut 5, maximum 8 ; seuil cosinus configurable 0,65 ; déduplication du contenu dans les résultats autorisés. Tests : société étrangère, privé, liaison sans permission, K=1 avec candidats interdits, modèle différent, retrait de droits. Sources, IDs, compteurs et métadonnées sont dérivés uniquement des résultats autorisés ; revalidation avant publication et lors de la lecture de l’historique.

## 11 — RAG

Question → embedding réel → recherche autorisée → contexte JSON borné → génération structurée → contrôle des IDs de citation → sources serveur (document, page, extrait). Aucun lien inventé. Tous les chunks ayant influencé la réponse sont conservés comme dépendances de permission, même non cités. Aucun résultat pertinent : réponse fixe sans second appel LLM ; résultat non supporté : no_answer. Citations inconnues : rejet.

Documents, noms, résultats d’outils et historique sont des données non fiables dans le prompt. Le graphe ne propose aucun appel outil après ingestion du texte RAG dans le nœud réponse. Ces protections maintiennent les droits même si le modèle suit une instruction hostile ; elles ne constituent pas une preuve universelle d’exactitude sémantique de la réponse.

## 12 — AI TOOLS

Tous exigent `ai.use`, un membership actif et le contexte société courant. Tous sont READ ; aucun tool SQL ni write.

| Tool | Permissions supplémentaires | Read/Write | Handler / source | Limites |
|---|---|---|---|---|
| revenue | ai.tools.finance, invoices.view | Read | revenue → get_revenue_summary | période ≤366 jours, fin ≤aujourd’hui |
| cash_flow | ai.tools.finance, finance.view, cashflow.view | Read | cash_flow → get_cash_flow_summary | période ≤366 jours |
| overdue_invoices | ai.tools.finance, invoices.view | Read | overdue → overdue_invoices | 1–20 lignes |
| customer_balance | ai.tools.finance, customers.view, invoices.view | Read | customer_balance → customers_queryset + eligible_invoices | ID positif de la société |
| low_stock | ai.tools.inventory, inventory.view, products.view | Read | low_stock → low_stock_queryset | ≤20 lignes, ≤50 dépôts ou filtre requis |
| supplier_performance | suppliers.view, purchases.view | Read | supplier_performance → supplier/purchase selectors + GoodsReceipt | ID société, période ≤366 jours |
| business_health | droits source composant par composant, ai.tools.finance/inventory pour leurs domaines | Read | health → business_health existant | ≤50 dépôts, composants non autorisés exclus |

Chaque outil : arguments Pydantic fermés, contrôle des droits avant/après, budget SQL total 3 s, résultat ≤32000 octets, sérialisation Decimal/date sûre, audit exécuté/refusé sans arguments bruts. Le LLM n’accède jamais directement à PostgreSQL. Le bilan fournisseur est un décompte de réceptions/retards observés, pas un taux inventé de livraison complète.

## 13 — GUARDRAILS

Allowlist de sept outils, aucun champ company/user accepté dans leurs arguments ; maximum 4 appels, 10 étapes de graphe, 8 chunks, contexte messages ≤24000 octets, sortie ≤32000 octets. Question ≤4000 caractères ; historique ≤12 messages, ≤6000 octets, provenance ≤64 chunks. Rate limit 10 messages et créations de conversation par minute/utilisateur/société. Bail de conversation et UUID d’idempotence.

Deadline chat 90 s, indexation 600 s, timeout SQL 3 s. Permissions sources rechargées à l’exécution, à la publication et à la relecture ; aucun bypass superuser. Demandes d’exécution SQL/shell/code, secrets ou contournement reconnues : refus. Demandes critiques reconnues : confirmation_required informative, aucun endpoint d’approbation/exécution. Aucun outil critique n’existe dans cette version.

Audit : société, acteur, trace UUID, action, nom d’outil autorisé, statut, durée/code contrôlé, nombre de chunks autorisés ; aucun prompt, extrait documentaire ni exception brute. Les regex sont une défense complémentaire, pas la frontière d’autorisation.

## 14 — LANGGRAPH

State : question, historique borné, route, appels, document_id optionnel, facts, chunks, answer. Contexte d’autorisation capturé côté serveur hors état contrôlé par le modèle. START → router ; DIRECT → answer ; TOOL → tools → answer ; RAG → rag → answer ; HYBRID → tools → rag → answer ; END. Graphe acyclique, recursion_limit 10. RoutePlan strict valide route/calls/cohérence ; réponses libres ou arguments supplémentaires refusés. Exceptions converties en erreur sûre par le service Assistant. LangChain a un rôle réel dans les embeddings et le splitter, LangGraph orchestre réellement chaque réponse autorisée.

## 15 — ASSISTANT

`POST /api/ai/assistant/chat/` : `{conversation_id: entier positif, message: texte, request_id?: UUID}`. Création préalable via `/api/ai/conversations/`. Réponse : AIMessage avec id, role, text, blocks FACT/AI ANALYSIS, sources, tools, status, simulated=false, createdAt, period=null ; errorCode contrôlé si échec. Aucun champ de reasoning ni prompt système.

Conversations propres à utilisateur+société, 30 dernières et 12 derniers messages par conversation. Même request_id avec même message renvoie la réponse existante ; autre contenu refusé. Traitement concurrent refusé, bail expiré récupérable. Sources/texte devenus interdits masqués dans l’historique et exclus du prochain prompt. Aucun modèle de mémoire autonome.

## 16 — MODELS

- Document : statut RAG, erreur contrôlée, membership demandeur, claim/bail, date d’indexation, modèle et digest.
- DocumentChunk : société, document, position unique, contenu, page, section optionnelle, token_count nullable, VectorField768, modèle/digest/version, timestamps ; suppression CASCADE avec document.
- AIConversation : société, utilisateur, titre, claim/bail, timestamps ; index société/utilisateur.
- AIMessage : conversation, rôle contraint user/assistant, contenu, payload, permissions requises, IDs de chunks, request UUID, création ; unicité conversation/rôle/request_id.

Pas de nouveau système Documents parallèle et pas de modification des modèles métier finance/stock pour cet assistant.

## 17 — CELERY

Une tâche `documents.index_document(document_id)` fait extraction + chunking + embeddings par lots + publication atomique. Réindexation utilise la même tâche idempotente. Limite soft600/hard620 ; deadline applicative600, adaptée au worker Windows solo qui n’offre pas les mêmes interruptions de process qu’un pool prefork. Broker Valkey local existant.

Restent synchrones : routage du chat, embedding de la question, retrieval, outils ERP read-only, réponse et persistance. Les appels réseau s’exécutent hors transactions de publication. Pas de scheduler automatique de réindexation ni de téléchargement de modèles.

## 18 — API

| Method | URL | Permission | Purpose |
|---|---|---|---|
| GET, POST | /api/ai/conversations/ | ai.use | liste/création privées utilisateur+société |
| GET | /api/ai/conversations/:id/ | ai.use + propriétaire | historique revalidé |
| POST | /api/ai/assistant/chat/ | ai.use + droits sources | réponse JSON |
| POST | /api/ai/chat/stream/ | idem | SSE compatible interface, réponse prévalidée |
| GET | /api/ai/messages/:id/sources/ | ai.use + propriétaire + droits actuels | citations revalidées |
| POST | /api/documents/:id/index/ | ai.use, documents.view/upload/ai_analyze + ACL document | indexation/réindexation 202 |
| GET, POST | /api/documents/ | documents.view / documents.upload | liste/upload existants ; auto-index si tous les droits IA |

Cache-Control private/no-store pour Assistant. CSRF et session proviennent des conventions DRF existantes. Le front utilise le transport SSE existant ; le endpoint JSON demandé est également branché et testé.

## 19 — TESTS

TEST_RESULTS_FINAL

Les scénarios et commandes reproductibles sont dans [ASSISTANT_MANUAL_VALIDATION.md](ASSISTANT_MANUAL_VALIDATION.md). Les tests backend emploient de vrais modèles/migrations/PostgreSQL/vector sur cluster isolé ; provider simulé pour les cas déterministes. Les tests navigateur interceptent les contrats HTTP et exercent les vrais composants React ; ne pas les présenter comme des sessions navigateur sur la base de développement. Les scripts runtime utilisent les vrais Ollama/Valkey/Celery/PostgreSQL et leurs seules fixtures synthétiques.

## 20 — FRONTEND

Assistant connecté à l’API : création/liste/détail, envoi, loading, erreurs, sources et vérification. Aucun fallback de conversation ou chiffre fictif. Cache/conversation/stream réinitialisés au changement de société/utilisateur. request_id généré au client ; délai HTTP 100 s. Documents réels par défaut et polling2,5 s pendant processing. Layout/CSS existants conservés, mobile390px testé.

Mocks Assistant supprimés. Les mocks de forecasting et d’autres modules hors périmètre subsistent ; Documents peut encore être explicitement basculé en démonstration par son flag. Les boutons d’analyse documentaire spécialisée restent désactivés en mode réel : les questions documentaires passent par Assistant.

## 21 — SECURITY CONFIRMATION

Direct LLM SQL: **NO**. SQL Agent: **NO**. Cross-company RAG: **NO**. RBAC bypass: **NO**. Superuser business bypass: **NO**. Secrets exposed par la configuration/les journaux de cette implémentation: **NO**. Arbitrary tools: **NO**. Autonomous critical mutations: **NO**. Fake ERP data: **NO**. Fake AI evidence: **NO**.

Les secrets applicatifs ne sont pas construits dans les prompts ni logs ; des motifs connus présents dans des documents sont retirés avant embedding. Cette protection n’est pas un DLP universel capable de reconnaître tout secret librement écrit dans un document. Les assertions d’isolation et de refus ont été testées, sans promettre une absence mathématique de toute faille future.

## 22 — REMAINING LIMITATIONS

- PERFORMANCE_LIMIT_FINAL
- RAG TXT/PDF texte seulement ; pas d’OCR, DOCX, images/scans ni extraction sémantique de sections.
- Recherche exacte sans ANN ; seuil0,65 à calibrer sur un corpus métier. Contexte en octets et limites strictes, pas de tokenizer complet.
- Citations et provenance contrôlées ; la vérité sémantique de chaque phrase du modèle n’est pas démontrable par le schéma. Les faits ERP affichés sont les valeurs officielles.
- SSE après validation complète, pas de streaming des tokens. « Stop » côté navigateur coupe l’attente, pas le calcul serveur déjà parti ; celui-ci reste borné.
- Historique limité, pas de pagination ancienne ni purge automatique ; réindexation/reprise d’échec manuelle. Un changement de digest sous le même tag est exclu par le retriever mais pas signalé préventivement par le badge UI.
- Aucun outil write ni approbation critique ; demande de confirmation informative uniquement. Analyses documentaires spécialisées non branchées, Assistant disponible pour le RAG.

## 23 — GIT

Aucun commit/push. HEAD observé `5f14cfd`. `.env` conservé ; pas de reset/flush de la base applicative. Logs, dépendances et données du cluster de test dans les emplacements ignorés. Voir [ASSISTANT_COMPLETION_FILES.md](ASSISTANT_COMPLETION_FILES.md) pour les sorties finales `git status --short` et `git diff --stat`, y compris la liste séparée des nouveaux fichiers non comptés par diff --stat.
