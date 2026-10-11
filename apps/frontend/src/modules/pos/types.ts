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
}

export interface CartLine {
  product: Product
  quantity: number
}

export interface Student {
  id: string
  name: string
  course: string
  balance: number
  debt: number
}
