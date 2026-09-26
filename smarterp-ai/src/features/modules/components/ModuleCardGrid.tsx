import type { ERPModule } from '../types/modules.types'
import { ModuleCard } from './ModuleCard'
export function ModuleCardGrid({ modules, allModules, onConfigure, onChange }: { modules: ERPModule[]; allModules: ERPModule[]; onConfigure: (m: ERPModule) => void; onChange: (m: ERPModule, enable: boolean) => void }) { return <div className="config-module-grid">{modules.map((module) => <ModuleCard key={module.key} module={module} modules={allModules} onConfigure={() => onConfigure(module)} onChange={(enable) => onChange(module, enable)} />)}</div> }
