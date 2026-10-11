import { useState } from 'react'

import { AdminShell } from './components/AdminShell'
import { BalancesSection } from './sections/BalancesSection'
import { CashRegistersSection } from './sections/CashRegistersSection'
import { DashboardSection } from './sections/DashboardSection'
import { ReportsSection } from './sections/ReportsSection'
import { SalesSection } from './sections/SalesSection'
import { SettingsSection } from './sections/SettingsSection'
import { StudentsSection } from './sections/StudentsSection'
import { UsersSection } from './sections/UsersSection'
import type { AdministrationSection } from './types'

export function AdministrationPage() {
  const [activeSection, setActiveSection] = useState<AdministrationSection>('dashboard')

  const sections: Record<AdministrationSection, React.ReactNode> = {
    dashboard: <DashboardSection />,
    students: <StudentsSection />,
    balances: <BalancesSection />,
    users: <UsersSection />,
    registers: <CashRegistersSection />,
    sales: <SalesSection />,
    reports: <ReportsSection />,
    settings: <SettingsSection />,
  }

  return (
    <AdminShell activeSection={activeSection} onSectionChange={setActiveSection}>
      {sections[activeSection]}
    </AdminShell>
  )
}
