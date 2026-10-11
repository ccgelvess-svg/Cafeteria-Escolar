import { Banknote, GraduationCap } from 'lucide-react'

import type { SaleMode } from '../types'

interface ModeTabsProps {
  mode: SaleMode
  onChange: (mode: SaleMode) => void
}

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Tipo de venta" role="tablist">
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
    </div>
  )
}
