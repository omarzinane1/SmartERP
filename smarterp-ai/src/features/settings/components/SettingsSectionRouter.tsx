import type { ComponentProps } from 'react'
import { SettingsForm } from './SettingsForm'
import { IntegrationCards } from './IntegrationCards'
import { AISettingsPanel } from './AISettingsPanel'
import type { SettingsSection } from '../types/settings.types'
export function SettingsSectionRouter({ section, form, ai, integrations }: { section: SettingsSection; form: Omit<ComponentProps<typeof SettingsForm>, 'section'>; ai: ComponentProps<typeof AISettingsPanel>; integrations: ComponentProps<typeof IntegrationCards> }) { if (section === 'integrations') return <IntegrationCards {...integrations} />; return <>{section === 'ai' && <div className="mb-5"><AISettingsPanel {...ai} /></div>}<SettingsForm key={section} {...form} section={section} /></> }
