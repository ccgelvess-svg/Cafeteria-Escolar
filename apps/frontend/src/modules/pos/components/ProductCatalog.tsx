import { Search, X, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

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

const categoryIconStyles = [
  'bg-blue-100 text-blue-700',
  'bg-cyan-100 text-cyan-700',
  'bg-amber-100 text-amber-700',
  'bg-orange-100 text-orange-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
]

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
  const [query, setQuery] = useState('')
  const availableSubcategories = subcategories[category] ?? []
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    return products.filter((product) => {
      const normalizedName = product.name
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      return (category === 'todos' || product.category === category) &&
        (subcategory === 'Todas' || subcategory === 'Todos' || product.subcategory === subcategory) &&
        normalizedName.includes(normalizedQuery)
    })
  }, [category, products, query, subcategory])

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:flex-row">
        <div className="category-scroll flex shrink-0 snap-x snap-mandatory justify-start gap-1 overflow-x-auto overscroll-contain rounded-xl bg-slate-800 p-1.5 sm:h-full sm:min-h-0 sm:w-20 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:overscroll-y-contain sm:snap-y sm:touch-pan-y" aria-label="Categorías">
          {categories.map(({ id, label, icon: Icon }, index) => {
            const selected = category === id
            return (
              <button
                aria-pressed={selected}
                className={`flex min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center text-[0.68rem] font-bold leading-none transition sm:w-full sm:min-w-0 ${
                  selected
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
                key={id}
                onClick={() => onCategoryChange(id)}
                type="button"
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl shadow-sm ${categoryIconStyles[index % categoryIconStyles.length]} ${selected ? 'ring-2 ring-white/80' : ''}`}>
                  <Icon aria-hidden="true" className="size-6" strokeWidth={2.3} />
                </span>
                <span className="w-full truncate" title={label}>{label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-2 min-w-0">
            <label className="relative block min-w-0">
              <span className="sr-only">Buscar productos por nombre</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                autoComplete="off"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-10 text-[0.8rem] font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar producto por nombre"
                type="search"
                value={query}
              />
              {query && <button
                aria-label="Limpiar búsqueda"
                className="absolute right-0 top-0 grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setQuery('')}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>}
            </label>
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
        {filteredProducts.length === 0 && <div className="col-span-full grid min-h-28 place-items-center rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 text-center text-sm font-bold text-slate-500">
          No hay productos que coincidan con la búsqueda y los filtros seleccionados.
        </div>}
      </div>
        </div>
      </div>
    </section>
  )
}
