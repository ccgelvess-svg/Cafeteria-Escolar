import { Banknote, BriefcaseBusiness, GraduationCap } from 'lucide-react'

import type { SaleMode } from '../types'

interface ModeTabsProps {
  mode: SaleMode
  onChange: (mode: SaleMode) => void
}

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Tipo de venta" role="tablist">
      <button
        aria-selected={mode === 'free'}
        className={`pos-mode-tab ${mode === 'free' ? 'pos-mode-tab-active' : 'pos-mode-tab-idle'}`}
        onClick={() => onChange('free')}
        role="tab"
        type="button"
      >
        <Banknote aria-hidden="true" className="size-7" />
        Venta libre
      </button>
      <button
        aria-selected={mode === 'student'}
        className={`pos-mode-tab ${mode === 'student' ? 'pos-mode-tab-active' : 'pos-mode-tab-idle'}`}
        onClick={() => onChange('student')}
        role="tab"
        type="button"
      >
        <GraduationCap aria-hidden="true" className="size-7" />
        Estudiante
      </button>
      <button
        aria-selected={mode === 'teacher'}
        className={`pos-mode-tab ${mode === 'teacher' ? 'pos-mode-tab-active' : 'pos-mode-tab-idle'}`}
        onClick={() => onChange('teacher')}
        role="tab"
        type="button"
      >
        <BriefcaseBusiness aria-hidden="true" className="size-7" />
        Profesor
      </button>
    </div>
  )
}
