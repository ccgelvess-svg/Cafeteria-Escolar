import type { LucideIcon } from 'lucide-react'

import { formatCurrency } from '../format'
import type { Product } from '../types'

interface ProductCatalogProps {
  category: string
  subcategory: string
  onCategoryChange: (category: string) => void
  onSubcategoryChange: (subcategory: string) => void
  onAddProduct: (product: Product) => void
  categories: Array<{ id: string; label: string; icon: LucideIcon }>
  products: Product[]
  subcategories: Record<string, string[]>
}

export function ProductCatalog({
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
  onAddProduct,
  categories,
  products,
  subcategories,
}: ProductCatalogProps) {
  const availableSubcategories = subcategories[category] ?? []
  const filteredProducts = products.filter(
    (product) =>
      (category === 'todos' || product.category === category) &&
      (subcategory === 'Todas' || subcategory === 'Todos' || product.subcategory === subcategory),
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="category-scroll flex min-h-11 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="Categorías">
        {categories.map(({ id, label, icon: Icon }) => {
          const selected = category === id
          return (
            <button
              aria-pressed={selected}
              className={`flex min-h-11 shrink-0 snap-start items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-bold leading-tight transition sm:gap-2 sm:px-4 sm:text-base ${
                selected
                  ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md'
                  : 'border border-slate-200 bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
              key={id}
              onClick={() => onCategoryChange(id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {availableSubcategories.length > 1 && <div className="subcategory-scroll mt-1 flex min-h-11 gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="Subcategorías">
        {availableSubcategories.map((item) => {
          const selected = subcategory === item
          return (
            <button
              aria-pressed={selected}
              className={`min-h-11 min-w-fit shrink-0 rounded-lg px-4 text-sm font-bold transition ${
                selected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-blue-50'
              }`}
              key={item}
              onClick={() => onSubcategoryChange(item)}
              type="button"
            >
              {item}
            </button>
          )
        })}
      </div>}

      <div className="product-grid mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-1" aria-live="polite">
        {filteredProducts.map((product) => {
          const Icon = product.icon
          const outOfStock = product.stockQuantity !== undefined && product.stockQuantity <= 0
          return (
            <button
              aria-label={outOfStock ? `${product.name}, agotado` : `Agregar ${product.name}, ${formatCurrency(product.price)}`}
              className={`product-card group flex flex-col items-start justify-between rounded-xl border border-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 ${product.tint}`}
              disabled={outOfStock}
              key={product.id}
              onClick={() => onAddProduct(product)}
              type="button"
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="min-w-0 flex-1 text-xs font-extrabold leading-tight text-slate-900 xl:text-[0.8rem]">{product.shortName}</span>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/80 shadow-sm">
                  <Icon aria-hidden="true" className={`size-4 ${product.iconColor}`} strokeWidth={2.3} />
                </span>
              </span>
              <span className="mt-1 flex w-full flex-col items-start gap-1 border-t border-slate-900/10 pt-1">
                <span className="text-sm font-black leading-none text-slate-950">{formatCurrency(product.price)}</span>
                {product.stockQuantity !== undefined && <span className={`text-[0.7rem] font-black leading-none ${outOfStock ? 'text-rose-600' : 'text-emerald-700'}`}>{outOfStock ? 'Agotado' : `Stock: ${product.stockQuantity}`}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
