import type { LucideIcon } from 'lucide-react'

export type SaleMode = 'free' | 'student'

export interface Product {
  id: string
  name: string
  shortName: string
  price: number
  category: string
  subcategory: string
  tint: string
  icon: LucideIcon
  iconColor: string
  stockQuantity?: number
}

export interface CartLine {
  product: Product
  quantity: number
}

export interface Student {
  accountId: string
  id: string
  name: string
  course: string
  balance: number
  debt: number
}
