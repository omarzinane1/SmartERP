import { Section } from '../../../components/ui/BusinessPresentation'
import { formatDate } from '../../../lib/format'
import type { ProfileActivity } from '../types/profile.types'
export function RecentActivity({ activity }: { activity: ProfileActivity[] }) { return <Section title="Activité récente de mon compte">{activity.length ? <ol className="config-activity">{activity.map((a) => <li key={a.id}><span>{a.event}</span><time>{formatDate(a.date)}</time></li>)}</ol> : <p className="ops-empty">Aucune activité récente.</p>}</Section> }
