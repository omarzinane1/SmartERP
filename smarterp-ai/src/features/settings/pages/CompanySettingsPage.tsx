import { useEffect, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BusinessState, PageHeading } from '../../../components/ui/BusinessPresentation'
import { ActionConfirmation, PurchasingNotice } from '../../purchases/components/PurchasingShared'
import { SettingsSidebar } from '../components/SettingsSidebar'
import { SettingsSectionRouter } from '../components/SettingsSectionRouter'
import { useCompanySettings } from '../hooks/useCompanySettings'
import { settingSections, type SettingsPayload, type SettingsSection } from '../types/settings.types'
import '../configuration.css'
export function CompanySettingsPage() {
  const [params, setParams] = useSearchParams(), section = settingSections.includes(params.get('section') as SettingsSection) ? params.get('section') as SettingsSection : 'general', [dirty, setDirty] = useState(false), blocker = useBlocker(dirty), q = useCompanySettings(section)
  useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) }, [dirty])
  if (q.isPending || q.isError || !q.data?.permissions.includes('settings.view')) return <BusinessState query={q} permission="settings.view" />
  const d = q.data
  return <main className="dashboard-page business-page ops-page"><PageHeading title="Paramètres société" description="Configuration de l’entreprise, politiques et services connectés." /><PurchasingNotice demo={q.isDemo} asOf={d.asOf} /><div className="config-layout"><SettingsSidebar data={d} section={section} onSelect={(value) => { if (value !== section) { q.update.reset(); q.integration.reset(); setParams({ section: value }) } }} /><div className="config-content">{!d.policies[section].canView ? <section className="business-card config-form"><h2>Accès non autorisé</h2><p>Cette section ne fait pas partie de votre périmètre.</p></section> : <SettingsSectionRouter section={section} form={{ data: d, busy: q.update.isPending, error: q.update.isError, demo: q.isDemo, onDirty: setDirty, onSave: async (input) => { const result = await q.update.mutateAsync({ input, version: d.version }); toast.success('Paramètres enregistrés'); return { section: input.section, values: result.values[input.section] } as SettingsPayload } }} ai={{ query: q.ai }} integrations={{ items: d.values.integrations.items, canTest: d.permissions.includes('settings.manage') && d.policies.integrations.canManage, busyId: q.integration.isPending ? q.integration.variables ?? null : null, result: q.integration.isSuccess ? { id: q.integration.variables!, data: q.integration.data } : null, errorId: q.integration.isError ? q.integration.variables ?? null : null, onTest: (id) => q.integration.mutate(id) }} />}</div></div>{blocker.state === 'blocked' && <ActionConfirmation title="Quitter avec des modifications non enregistrées ?" busy={false} error={null} demo={false} onClose={() => blocker.reset()} onConfirm={() => { setDirty(false); blocker.proceed() }}><p>Les changements de cette section seront perdus.</p></ActionConfirmation>}</main>
}
