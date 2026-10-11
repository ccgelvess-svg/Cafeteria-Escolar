import { administrationModule } from './administration'
import { inventoryModule } from './inventory'
import { posModule } from './pos'

export const modules = [posModule, administrationModule, inventoryModule] as const
