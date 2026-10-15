# Manifeste historique — Opportunités IA

Le milestone Opportunités est déjà intégré dans HEAD `5f14cfd` par un commit extérieur à cette intervention. Ce manifeste manquant est reconstitué depuis la comparaison `8b9be6e..5f14cfd`. Cette plage contient aussi le milestone Intelligence : la sélection ci-dessous retient les fichiers liés aux opportunités ou partagés avec leur interface.

```text
A	backend/apps/intelligence/migrations/0003_aiopportunity.py
M	backend/apps/intelligence/models.py
A	backend/apps/intelligence/opportunity_config.py
A	backend/apps/intelligence/opportunity_detectors.py
A	backend/apps/intelligence/opportunity_selectors.py
A	backend/apps/intelligence/opportunity_services.py
A	backend/apps/intelligence/tests/test_opportunities.py
M	backend/apps/intelligence/urls.py
M	backend/apps/intelligence/views.py
A	backend/docs/AI_OPPORTUNITIES_AUDIT.md
A	backend/docs/AI_OPPORTUNITIES_REPORT.md
M	smarterp-ai/.env.example
A	smarterp-ai/playwright-opportunities-final.exit
M	smarterp-ai/src/config/env.ts
M	smarterp-ai/src/features/ai-control-center/api/aiControlCenter.api.ts
M	smarterp-ai/src/features/ai-control-center/components/AlertDetailDrawer.tsx
M	smarterp-ai/src/features/ai-control-center/components/AnomalyHistory.tsx
M	smarterp-ai/src/features/ai-control-center/components/BusinessHealth.tsx
M	smarterp-ai/src/features/ai-control-center/components/ForecastRisks.tsx
M	smarterp-ai/src/features/ai-control-center/components/IntelligenceStats.tsx
M	smarterp-ai/src/features/ai-control-center/components/Opportunities.tsx
D	smarterp-ai/src/features/ai-control-center/data/aiControlCenter.mock.ts
M	smarterp-ai/src/features/ai-control-center/hooks/useAIControlCenter.ts
M	smarterp-ai/src/features/ai-control-center/pages/AIControlCenterPage.tsx
M	smarterp-ai/src/features/ai-control-center/types/aiControlCenter.types.ts
M	smarterp-ai/src/features/ai/api/ai.api.ts
M	smarterp-ai/src/features/ai/data/ai.mock.ts
M	smarterp-ai/src/features/ai/hooks/useAIWorkspace.ts
A	smarterp-ai/src/features/ai/opportunityPresentation.ts
M	smarterp-ai/src/features/ai/pages/AIOpportunitiesPage.tsx
M	smarterp-ai/src/vite-env.d.ts
M	smarterp-ai/tests/ai-control-center.spec.ts
M	smarterp-ai/tests/control-center-api.spec.ts
A	smarterp-ai/tests/control-center.fixtures.ts
M	smarterp-ai/tests/intelligence.spec.ts
A	smarterp-ai/tests/opportunities-api.spec.ts
```

Compléments dans l’arbre courant : `test_opportunities.py` stabilise les dates de fixture au midi du fuseau société et couvre la frontière nocturne ; `AI_OPPORTUNITIES_REPORT.md` consigne les validations déjà exécutées (353 tests complets, 167 ciblés, 13 navigateur). Les modifications Assistant ultérieures des fichiers partagés sont décrites séparément dans `ASSISTANT_COMPLETION_FILES.md`.

Aucune suppression supplémentaire pour ce manifeste. Aucun commit/push effectué par l’assistant.
