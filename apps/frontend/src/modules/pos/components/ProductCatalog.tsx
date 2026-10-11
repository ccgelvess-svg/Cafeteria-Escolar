import { categories, products, subcategories } from '../data'
import { formatCurrency } from '../format'
import type { Product } from '../types'

interface ProductCatalogProps {
  category: string
  subcategory: string
  onCategoryChange: (category: string) => void
  onSubcategoryChange: (subcategory: string) => void
  onAddProduct: (product: Product) => void
}

export function ProductCatalog({
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
  onAddProduct,
}: ProductCatalogProps) {
  const availableSubcategories = subcategories[category] ?? []
  const filteredProducts = products.filter(
    (product) =>
      product.category === category &&
      (subcategory === 'Todas' || subcategory === 'Todos' || product.subcategory === subcategory),
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Categorías">
        {categories.map(({ id, label, icon: Icon }) => {
          const selected = category === id
          return (
            <button
              aria-pressed={selected}
              className={`flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-bold leading-tight transition sm:min-h-14 sm:gap-2 sm:text-base ${
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

      <div className="mt-2 flex flex-wrap gap-2" aria-label="Subcategorías">
        {availableSubcategories.map((item) => {
          const selected = subcategory === item
          return (
            <button
              aria-pressed={selected}
              className={`min-h-11 min-w-fit flex-1 rounded-lg px-3 text-sm font-bold transition ${
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
      </div>

      <div className="product-grid mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" aria-live="polite">
        {filteredProducts.map((product) => {
          const Icon = product.icon
          return (
            <button
              aria-label={`Agregar ${product.name}, ${formatCurrency(product.price)}`}
              className={`product-card group flex flex-col items-center justify-center rounded-xl border border-white p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:translate-y-0 ${product.tint}`}
              key={product.id}
              onClick={() => onAddProduct(product)}
              type="button"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-white/80 shadow-sm transition group-hover:scale-105">
                <Icon aria-hidden="true" className={`size-9 ${product.iconColor}`} strokeWidth={2.4} />
              </span>
              <span className="mt-2 line-clamp-2 text-sm font-bold leading-tight text-slate-900">{product.shortName}</span>
              <span className="mt-1 text-base font-black text-slate-950">{formatCurrency(product.price)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
