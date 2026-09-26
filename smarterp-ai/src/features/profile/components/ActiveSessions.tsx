import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { Section } from '../../../components/ui/BusinessPresentation'
import { ActionConfirmation } from '../../purchases/components/PurchasingShared'
import { formatDate } from '../../../lib/format'
import type { UserSession } from '../types/profile.types'
export function ActiveSessions({ sessions, busy, error, demo, onRevoke }: { sessions: UserSession[]; busy: boolean; error: boolean; demo: boolean; onRevoke: (id: string, current: boolean) => Promise<void> }) {
  const [selected, setSelected] = useState<UserSession | null>(null)
  return <Section title="Sessions actives"><div className="business-table-scroll"><table className="business-table"><thead><tr>{['Appareil / navigateur', 'IP / localisation', 'Dernière activité', 'Création', 'Session', 'Action'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{sessions.map((s) => <tr key={s.id}><td>{s.device ?? 'Appareil non fourni'}<small>{s.browser ?? 'Navigateur non fourni'}</small></td><td>{s.ip ?? 'Non fournie'}<small>{s.location ?? 'Localisation non fournie'}</small></td><td>{formatDate(s.lastActivity)}</td><td>{formatDate(s.createdAt)}</td><td>{s.current ? <Badge tone="positive">Session actuelle</Badge> : 'Distante'}</td><td>{s.canRevoke && <Button className="business-button" variant="secondary" onClick={() => setSelected(s)}>Fermer la session</Button>}</td></tr>)}</tbody></table></div>{!sessions.some((s) => !s.current) && <p className="ops-empty">Aucune autre session active.</p>}{selected && <ActionConfirmation title={selected.current ? 'Fermer votre session actuelle ?' : 'Fermer cette session distante ?'} busy={busy} error={error ? 'Fermeture non confirmée. La session reste affichée.' : null} demo={demo} onClose={() => setSelected(null)} onConfirm={() => { void onRevoke(selected.id, selected.current).then(() => setSelected(null)).catch(() => undefined) }}><p>{selected.device ?? 'Appareil non fourni'} · {selected.browser ?? 'Navigateur non fourni'}</p>{selected.current && <p>Vous serez déconnecté après confirmation du serveur.</p>}</ActionConfirmation>}</Section>
}
