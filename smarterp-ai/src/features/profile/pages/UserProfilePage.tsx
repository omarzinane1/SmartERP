import { useEffect, useState } from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeading } from '../../../components/ui/BusinessPresentation'
import { Badge } from '../../../components/ui/Badge'
import { isBusinessForbidden } from '../../../hooks/useBusinessScope'
import { useAuthStore } from '../../../store/auth.store'
import { ActionConfirmation, PurchasingNotice, PurchasingState } from '../../purchases/components/PurchasingShared'
import { documentURL } from '../../documents/documents.utils'
import { ProfileForm } from '../components/ProfileForm'
import { PreferenceForm } from '../components/PreferenceForm'
import { SecurityPanel } from '../components/SecurityPanel'
import { ActiveSessions } from '../components/ActiveSessions'
import { RecentActivity } from '../components/RecentActivity'
import { useUserProfile } from '../hooks/useUserProfile'
import '../../settings/configuration.css'
const tabs = { profile: 'Profil', preferences: 'Préférences', security: 'Sécurité', sessions: 'Sessions', activity: 'Activité récente' }
export function UserProfilePage() {
  const q = useUserProfile(), [params, setParams] = useSearchParams(), tab = Object.hasOwn(tabs, params.get('tab') ?? '') ? params.get('tab') as keyof typeof tabs : 'profile', [dirty, setDirty] = useState(false), blocker = useBlocker(dirty), navigate = useNavigate(), client = useQueryClient()
  useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) }, [dirty])
  useEffect(() => { if (!q.data) return; const auth = useAuthStore.getState(); if (auth.user?.id === q.data.id && JSON.stringify(auth.user.preferences) !== JSON.stringify(q.data.preferences)) auth.setAuth({ user: { ...auth.user, preferences: q.data.preferences }, company: auth.company }) }, [q.data])
  if (q.isPending || q.isError || !q.data) return <PurchasingState loading={q.isPending} forbidden={isBusinessForbidden(q.error)} error="Impossible de charger les données." onRetry={() => { void q.refetch() }} />
  const d = q.data, avatar = documentURL(d.avatarUrl)
  return <main className="dashboard-page business-page ops-page"><PageHeading title="Mon profil" description="Votre identité, vos préférences et la sécurité de votre compte." /><PurchasingNotice demo={q.isDemo} asOf={d.asOf} /><section className="business-card config-profile-header">{avatar ? <img src={avatar} alt="Avatar du compte" className="config-avatar" /> : <span className="config-avatar" aria-hidden="true">{d.identity.displayName.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>}<div><h2>{d.identity.displayName}</h2><p>{d.identity.email}</p><p>{d.role} · {d.department || 'Département non fourni'}</p></div><Badge tone={d.status === 'active' ? 'positive' : 'neutral'}>{d.status === 'active' ? 'Actif' : d.status}</Badge></section><nav className="ops-tabs" role="tablist" aria-label="Sections du profil">{Object.entries(tabs).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })}>{label}</button>)}</nav>
    {tab === 'profile' && <ProfileForm profile={d} busy={q.update.isPending} onDirty={setDirty} onSave={async (identity) => { const result = await q.update.mutateAsync({ identity }); toast.success('Profil enregistré'); return result.identity }} />}
    {tab === 'preferences' && <PreferenceForm profile={d} busy={q.update.isPending} onDirty={setDirty} onSave={async (preferences) => { const result = await q.update.mutateAsync({ preferences }); toast.success('Préférences enregistrées'); return result.preferences }} />}
    {tab === 'security' && <SecurityPanel profile={d} demo={q.isDemo} passwordBusy={q.password.isPending} twoFactorBusy={q.twoFactor.isPending} onPassword={async (v) => { try { await q.password.mutateAsync(v) } finally { q.password.reset() } }} onTwoFactor={async (v) => { try { return await q.twoFactor.mutateAsync(v) } finally { q.twoFactor.reset() } }} />}
    {tab === 'sessions' && <ActiveSessions sessions={d.sessions} busy={q.revoke.isPending} error={q.revoke.isError} demo={q.isDemo} onRevoke={async (id, current) => { await q.revoke.mutateAsync(id); if (current) { useAuthStore.getState().clearAuth(); client.clear(); await navigate('/login', { replace: true }) } else toast.success(q.isDemo ? 'Session distante fermée en simulation' : 'Session distante révoquée') }} />}
    {tab === 'activity' && <RecentActivity activity={d.activity} />}
    {blocker.state === 'blocked' && <ActionConfirmation title="Quitter avec des modifications non enregistrées ?" busy={false} error={null} demo={false} onClose={() => blocker.reset()} onConfirm={() => { setDirty(false); blocker.proceed() }}><p>Les modifications du formulaire seront perdues.</p></ActionConfirmation>}
  </main>
}
