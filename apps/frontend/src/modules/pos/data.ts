import {
  Beef,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Droplet,
  GlassWater,
  Milk,
  Package,
  Pizza,
  Sandwich,
  Wheat,
  Zap,
} from 'lucide-react'

import type { Product, Student } from './types'

export const categories = [
  { id: 'bebidas', label: 'Bebidas', icon: GlassWater },
  { id: 'paquetes', label: 'Paquetes', icon: Sandwich },
  { id: 'pasteles', label: 'Pasteles', icon: Beef },
  { id: 'panaderia', label: 'Panadería', icon: Croissant },
  { id: 'rapidos', label: 'Rápidos', icon: Pizza },
] as const

export const subcategories: Record<string, string[]> = {
  bebidas: ['Todas', 'Agua', 'Jugos', 'Gaseosas', 'Tés y bebidas', 'Lácteos'],
  paquetes: ['Todos', 'Papas', 'Galletas', 'Snacks'],
  pasteles: ['Todos', 'Carne', 'Pollo', 'Queso'],
  panaderia: ['Todos', 'Dulce', 'Salado'],
  rapidos: ['Todos', 'Hamburguesas', 'Pizza', 'Otros'],
}

export const products: Product[] = [
  { id: 'agua-bolsa', name: 'Agua bolsa', shortName: 'Agua bolsa', price: 800, category: 'bebidas', subcategory: 'Agua', tint: 'bg-sky-50', icon: Droplet, iconColor: 'text-sky-500' },
  { id: 'agua-pequena', name: 'Agua pequeña', shortName: 'Agua peq.', price: 1200, category: 'bebidas', subcategory: 'Agua', tint: 'bg-sky-50', icon: GlassWater, iconColor: 'text-sky-500' },
  { id: 'agua-grande', name: 'Agua grande', shortName: 'Agua grande', price: 1800, category: 'bebidas', subcategory: 'Agua', tint: 'bg-sky-50', icon: GlassWater, iconColor: 'text-sky-600' },
  { id: 'gatorade', name: 'Gatorade', shortName: 'Gatorade', price: 3500, category: 'bebidas', subcategory: 'Tés y bebidas', tint: 'bg-amber-50', icon: Zap, iconColor: 'text-blue-600' },
  { id: 'gaseosa-pequena', name: 'Gaseosa pequeña', shortName: 'Gaseosa peq.', price: 2000, category: 'bebidas', subcategory: 'Gaseosas', tint: 'bg-rose-50', icon: CupSoda, iconColor: 'text-red-600' },
  { id: 'gaseosa-grande', name: 'Gaseosa grande', shortName: 'Gaseosa grande', price: 3000, category: 'bebidas', subcategory: 'Gaseosas', tint: 'bg-rose-50', icon: CupSoda, iconColor: 'text-red-700' },
  { id: 'hit-pequeno', name: 'Hit pequeño', shortName: 'Hit peq.', price: 1500, category: 'bebidas', subcategory: 'Jugos', tint: 'bg-amber-50', icon: CupSoda, iconColor: 'text-orange-500' },
  { id: 'hit-grande', name: 'Hit grande', shortName: 'Hit grande', price: 2500, category: 'bebidas', subcategory: 'Jugos', tint: 'bg-amber-50', icon: CupSoda, iconColor: 'text-orange-600' },
  { id: 'hit-caja', name: 'Hit caja', shortName: 'Hit caja', price: 1800, category: 'bebidas', subcategory: 'Jugos', tint: 'bg-orange-50', icon: Package, iconColor: 'text-orange-500' },
  { id: 'mr-tea', name: 'Mr Tea', shortName: 'Mr Tea', price: 3000, category: 'bebidas', subcategory: 'Tés y bebidas', tint: 'bg-emerald-50', icon: Coffee, iconColor: 'text-emerald-700' },
  { id: 'jugo-vaso', name: 'Jugo en vaso', shortName: 'Jugo vaso', price: 2000, category: 'bebidas', subcategory: 'Jugos', tint: 'bg-amber-50', icon: GlassWater, iconColor: 'text-orange-500' },
  { id: 'leche', name: 'Leche', shortName: 'Leche', price: 1800, category: 'bebidas', subcategory: 'Lácteos', tint: 'bg-blue-50', icon: Milk, iconColor: 'text-blue-500' },
  { id: 'papas-medianas', name: 'Papas medianas', shortName: 'Papas medianas', price: 2000, category: 'paquetes', subcategory: 'Papas', tint: 'bg-yellow-50', icon: Package, iconColor: 'text-yellow-600' },
  { id: 'galleta-chocolate', name: 'Galleta chocolate', shortName: 'Galleta', price: 1200, category: 'paquetes', subcategory: 'Galletas', tint: 'bg-orange-50', icon: Cookie, iconColor: 'text-amber-700' },
  { id: 'mani', name: 'Maní salado', shortName: 'Maní', price: 1500, category: 'paquetes', subcategory: 'Snacks', tint: 'bg-lime-50', icon: Wheat, iconColor: 'text-lime-700' },
  { id: 'pastel-carne', name: 'Pastel de carne', shortName: 'Pastel carne', price: 2500, category: 'pasteles', subcategory: 'Carne', tint: 'bg-orange-50', icon: Beef, iconColor: 'text-orange-600' },
  { id: 'pastel-pollo', name: 'Pastel de pollo', shortName: 'Pastel pollo', price: 2500, category: 'pasteles', subcategory: 'Pollo', tint: 'bg-yellow-50', icon: Beef, iconColor: 'text-yellow-700' },
  { id: 'pastel-queso', name: 'Pastel de queso', shortName: 'Pastel queso', price: 2200, category: 'pasteles', subcategory: 'Queso', tint: 'bg-amber-50', icon: Croissant, iconColor: 'text-amber-600' },
  { id: 'croissant', name: 'Croissant', shortName: 'Croissant', price: 2000, category: 'panaderia', subcategory: 'Dulce', tint: 'bg-amber-50', icon: Croissant, iconColor: 'text-amber-600' },
  { id: 'pan-queso', name: 'Pan de queso', shortName: 'Pan queso', price: 1800, category: 'panaderia', subcategory: 'Salado', tint: 'bg-orange-50', icon: Croissant, iconColor: 'text-orange-600' },
  { id: 'hamburguesa', name: 'Hamburguesa', shortName: 'Hamburguesa', price: 6500, category: 'rapidos', subcategory: 'Hamburguesas', tint: 'bg-yellow-50', icon: Sandwich, iconColor: 'text-amber-700' },
  { id: 'pizza', name: 'Porción de pizza', shortName: 'Pizza', price: 4500, category: 'rapidos', subcategory: 'Pizza', tint: 'bg-red-50', icon: Pizza, iconColor: 'text-red-600' },
]

export const students: Student[] = [
  { id: 'EST-1042', name: 'Valentina Rodríguez', course: '5° A', balance: 18500, debt: 0 },
  { id: 'EST-0871', name: 'Samuel Martínez', course: '4° B', balance: 4200, debt: 3500 },
  { id: 'EST-1156', name: 'Mariana Gómez', course: '6° A', balance: 12000, debt: 0 },
  { id: 'EST-0934', name: 'Daniel Herrera', course: '5° C', balance: 0, debt: 6800 },
]

export const demoHistory = [
  { date: '10 oct · 9:42 a. m.', detail: 'Jugo en vaso · Pastel de pollo', amount: 4500, kind: 'Consumo' },
  { date: '9 oct · 7:18 a. m.', detail: 'Abono de demostración', amount: 10000, kind: 'Abono' },
  { date: '8 oct · 10:06 a. m.', detail: 'Agua pequeña · Papas medianas', amount: 3200, kind: 'Consumo' },
]
