import { useMemo, useState } from 'react'
import { AlertTriangle, Boxes, History, Layers3, PackagePlus, Pencil, Plus, RefreshCw, Search, TrendingDown, TrendingUp } from 'lucide-react'

import { AdminDialog, EmptyState, PageHeader, StatusPill } from '../administration/components/AdminUi'
import { formatAdminCurrency } from '../administration/format'
import { useAuth } from '../auth'
import { recordStockMovement, saveInventoryCategory, saveInventoryProduct } from './inventoryRepository'
import type { CategoryDraft, InventoryProduct, ProductDraft } from './types'
import { useInventory } from './useInventory'

type View = 'products' | 'alerts' | 'history' | 'categories'
type ProductForm = Omit<ProductDraft, 'price' | 'cost' | 'minimumStock'> & { price: string; cost: string; minimumStock: string }

const emptyCategory: CategoryDraft = { name: '', slug: '', active: true }
const movementLabels = { opening: 'Existencia inicial', entry: 'Entrada', adjustment: 'Ajuste', sale: 'Venta', sale_reversal: 'Reverso de venta' }

function productForm(product?: InventoryProduct, categoryId = ''): ProductForm {
  return product ? {
    id: product.id, name: product.name, categoryId: product.categoryId, subcategory: product.subcategory,
    price: String(product.price), cost: String(product.cost), minimumStock: String(product.minimumStock),
    sku: product.sku, active: product.active,
  } : { name: '', categoryId, subcategory: 'General', price: '', cost: '', minimumStock: '0', sku: '', active: true }
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function InventorySection() {
  const { products, categories, movements, loading, error, refresh } = useInventory()
  const { can } = useAuth()
  const writable = can('inventory:write')
  const [view, setView] = useState<View>('products')
  const [query, setQuery] = useState('')
  const [productEditor, setProductEditor] = useState<ProductForm | null>(null)
  const [categoryEditor, setCategoryEditor] = useState<CategoryDraft | null>(null)
  const [stockProduct, setStockProduct] = useState<InventoryProduct | null>(null)
  const [movementType, setMovementType] = useState<'opening' | 'entry' | 'adjustment'>('entry')
  const [movementQuantity, setMovementQuantity] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const activeCategories = categories.filter((category) => category.active)
  const lowStock = products.filter((product) => product.active && product.stockQuantity <= product.minimumStock)
  const filteredProducts = useMemo(() => products.filter((product) =>
    `${product.name} ${product.sku ?? ''} ${product.categoryName} ${product.subcategory}`.toLowerCase().includes(query.toLowerCase()),
  ), [products, query])
  const inventoryValue = products.reduce((total, product) => total + product.cost * product.stockQuantity, 0)

  function openStock(product: InventoryProduct) {
    setStockProduct(product); setMovementType(product.stockQuantity === 0 ? 'opening' : 'entry')
    setMovementQuantity(''); setMovementReason('')
  }

  async function submitProduct() {
    if (!productEditor) return
    setBusy(true); setNotice('')
    try {
      await saveInventoryProduct({
        ...productEditor, price: Number(productEditor.price), cost: Number(productEditor.cost),
        minimumStock: Number(productEditor.minimumStock),
      })
      setProductEditor(null)
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'No fue posible guardar el producto.') }
    finally { setBusy(false) }
  }

  async function submitCategory() {
    if (!categoryEditor) return
    setBusy(true); setNotice('')
    try { await saveInventoryCategory(categoryEditor); setCategoryEditor(null) }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'No fue posible guardar la categoría.') }
    finally { setBusy(false) }
  }

  async function submitMovement() {
    if (!stockProduct) return
    const absolute = Number(movementQuantity)
    const delta = movementType === 'adjustment' ? absolute : Math.abs(absolute)
    setBusy(true); setNotice('')
    try {
      await recordStockMovement({ productId: stockProduct.id, quantityDelta: delta, type: movementType, reason: movementReason })
      setStockProduct(null)
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'No fue posible registrar el movimiento.') }
    finally { setBusy(false) }
  }

  const tabs: Array<{ id: View; label: string; icon: typeof Boxes; count?: number }> = [
    { id: 'products', label: 'Productos', icon: Boxes, count: products.length },
    { id: 'alerts', label: 'Alertas', icon: AlertTriangle, count: lowStock.length },
    { id: 'history', label: 'Historial', icon: History, count: movements.length },
    { id: 'categories', label: 'Categorías', icon: Layers3, count: categories.length },
  ]

  return <div className="admin-page-stack">
    <PageHeader eyebrow="Control de existencias" title="Inventarios" description="Productos, costos, entradas, ajustes, mínimos y trazabilidad conectados al POS." action={writable ? <button className="admin-primary-button" onClick={() => setProductEditor(productForm(undefined, activeCategories[0]?.id))} type="button"><Plus className="size-5" />Nuevo producto</button> : undefined} />
    {(error || notice) && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error || notice}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="admin-card"><p className="text-sm font-bold text-slate-500">Productos activos</p><p className="mt-1 text-3xl font-black">{products.filter((p) => p.active).length}</p></div>
      <div className="admin-card"><p className="text-sm font-bold text-amber-700">Alertas de mínimo</p><p className="mt-1 text-3xl font-black text-amber-800">{lowStock.length}</p></div>
      <div className="admin-card"><p className="text-sm font-bold text-slate-500">Unidades disponibles</p><p className="mt-1 text-3xl font-black">{products.reduce((sum, p) => sum + p.stockQuantity, 0)}</p></div>
      <div className="admin-card"><p className="text-sm font-bold text-emerald-700">Valor al costo</p><p className="mt-1 text-2xl font-black text-emerald-800">{formatAdminCurrency(inventoryValue)}</p></div>
    </section>

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="Vistas de inventario">
      {tabs.map(({ id, label, icon: Icon, count }) => <button aria-selected={view === id} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black ${view === id ? 'bg-blue-700 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600'}`} key={id} onClick={() => setView(id)} role="tab" type="button"><Icon className="size-5" />{label}<span className={`rounded-full px-2 py-0.5 text-xs ${view === id ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span></button>)}
    </div>

    {view === 'products' && <section className="admin-card">
      <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" /><input aria-label="Buscar productos" className="admin-input admin-input-with-icon" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, SKU o categoría" type="search" value={query} /></label><button className="admin-secondary-button" onClick={() => void refresh()} type="button"><RefreshCw className="size-4" />Actualizar</button></div>
      <div className="admin-table-wrap mt-4"><table className="admin-table"><thead><tr><th>Producto</th><th>Categoría</th><th className="text-right">Precio</th><th className="text-right">Costo</th><th className="text-right">Existencia</th><th className="text-right">Mínimo</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><span className="block text-xs text-slate-400">{product.sku || product.id}</span></td><td>{product.categoryName}<span className="block text-xs text-slate-400">{product.subcategory}</span></td><td className="text-right font-black">{formatAdminCurrency(product.price)}</td><td className="text-right">{formatAdminCurrency(product.cost)}</td><td className={`text-right text-base font-black ${product.stockQuantity <= product.minimumStock ? 'text-amber-700' : 'text-emerald-700'}`}>{product.stockQuantity}</td><td className="text-right">{product.minimumStock}</td><td><StatusPill active={product.active} /></td><td><div className="flex justify-end gap-1"><button aria-label={`Registrar entrada o ajuste de ${product.name}`} className="admin-icon-button text-emerald-700" disabled={!writable} onClick={() => openStock(product)} title="Entrada / ajuste" type="button"><PackagePlus className="size-4" /></button><button aria-label={`Editar ${product.name}`} className="admin-icon-button" disabled={!writable} onClick={() => setProductEditor(productForm(product))} title="Editar" type="button"><Pencil className="size-4" /></button></div></td></tr>)}</tbody></table></div>
      {!loading && filteredProducts.length === 0 && <EmptyState>No hay productos para este filtro.</EmptyState>}
    </section>}

    {view === 'alerts' && <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lowStock.map((product) => <article className="admin-card border-amber-200 bg-amber-50" key={product.id}><div className="flex items-start gap-3"><AlertTriangle className="size-7 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><h2 className="font-black text-slate-950">{product.name}</h2><p className="text-sm font-semibold text-slate-600">{product.categoryName} · mínimo {product.minimumStock}</p><p className="mt-2 text-2xl font-black text-amber-800">{product.stockQuantity} unidades</p></div></div>{writable && <button className="admin-secondary-button mt-4 w-full" onClick={() => openStock(product)} type="button"><PackagePlus className="size-4" />Registrar entrada</button>}</article>)}{!loading && lowStock.length === 0 && <div className="md:col-span-2 xl:col-span-3"><EmptyState>No hay alertas de stock mínimo.</EmptyState></div>}</section>}

    {view === 'history' && <section className="admin-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Motivo</th><th className="text-right">Cambio</th><th>Referencia</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.occurredAt))}</td><td><strong>{movement.productName}</strong></td><td>{movementLabels[movement.type]}</td><td>{movement.reason}</td><td className={`text-right font-black ${movement.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</td><td className="font-mono text-xs">{movement.sourceSaleId ? `Venta ${movement.sourceSaleId.slice(0, 8)}` : `Manual ${movement.actorUserId.slice(0, 8)}`}</td></tr>)}</tbody></table></div>{!loading && movements.length === 0 && <EmptyState>No hay movimientos de inventario.</EmptyState>}</section>}

    {view === 'categories' && <section className="admin-card"><div className="flex items-center justify-between gap-3"><div><h2 className="admin-card-title">Categorías</h2><p className="admin-card-subtitle">Organización visible también en el catálogo del POS.</p></div>{writable && <button className="admin-primary-button" onClick={() => setCategoryEditor({ ...emptyCategory })} type="button"><Plus className="size-4" />Nueva categoría</button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{categories.map((category) => <article className="rounded-xl border border-slate-200 p-4" key={category.id}><div className="flex items-start gap-3"><Layers3 className="size-6 text-blue-600" /><div className="min-w-0 flex-1"><h3 className="font-black">{category.name}</h3><p className="text-xs font-semibold text-slate-400">{category.slug}</p></div><StatusPill active={category.active} /></div>{writable && <button className="admin-secondary-button mt-3 w-full" onClick={() => setCategoryEditor({ ...category })} type="button"><Pencil className="size-4" />Editar</button>}</article>)}</div></section>}

    <AdminDialog open={Boolean(productEditor)} title={productEditor?.id ? 'Editar producto' : 'Crear producto'} description="Los cambios de precio y disponibilidad se reflejan en el POS." onClose={() => setProductEditor(null)} size="lg" footer={<><button className="admin-secondary-button" onClick={() => setProductEditor(null)} type="button">Cancelar</button><button className="admin-primary-button" disabled={busy || !productEditor?.name || !productEditor?.categoryId} onClick={() => void submitProduct()} type="button">Guardar producto</button></>}>
      {productEditor && <div className="grid gap-4 sm:grid-cols-2"><label className="admin-field sm:col-span-2">Nombre<input className="admin-input" onChange={(e) => setProductEditor({ ...productEditor, name: e.target.value })} value={productEditor.name} /></label><label className="admin-field">Categoría<select className="admin-select" onChange={(e) => setProductEditor({ ...productEditor, categoryId: e.target.value })} value={productEditor.categoryId}>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="admin-field">Subcategoría<input className="admin-input" onChange={(e) => setProductEditor({ ...productEditor, subcategory: e.target.value })} value={productEditor.subcategory} /></label><label className="admin-field">Precio de venta<input className="admin-input" min="0" onChange={(e) => setProductEditor({ ...productEditor, price: e.target.value })} type="number" value={productEditor.price} /></label><label className="admin-field">Costo<input className="admin-input" min="0" onChange={(e) => setProductEditor({ ...productEditor, cost: e.target.value })} type="number" value={productEditor.cost} /></label><label className="admin-field">Stock mínimo<input className="admin-input" min="0" onChange={(e) => setProductEditor({ ...productEditor, minimumStock: e.target.value })} type="number" value={productEditor.minimumStock} /></label><label className="admin-field">SKU opcional<input className="admin-input" onChange={(e) => setProductEditor({ ...productEditor, sku: e.target.value })} value={productEditor.sku ?? ''} /></label><label className="flex items-center gap-2 font-bold text-slate-700 sm:col-span-2"><input checked={productEditor.active} onChange={(e) => setProductEditor({ ...productEditor, active: e.target.checked })} type="checkbox" />Producto activo y visible en POS</label></div>}
    </AdminDialog>

    <AdminDialog open={Boolean(stockProduct)} title={`Movimiento · ${stockProduct?.name ?? ''}`} description={stockProduct ? `Existencia actual: ${stockProduct.stockQuantity}` : ''} onClose={() => setStockProduct(null)} footer={<><button className="admin-secondary-button" onClick={() => setStockProduct(null)} type="button">Cancelar</button><button className="admin-primary-button" disabled={busy || Number(movementQuantity) === 0 || movementReason.trim().length < 3} onClick={() => void submitMovement()} type="button">Registrar movimiento</button></>}>
      <div className="grid gap-4"><label className="admin-field">Tipo<select className="admin-select" onChange={(e) => setMovementType(e.target.value as typeof movementType)} value={movementType}><option value="entry">Entrada</option><option value="opening">Existencia inicial</option><option value="adjustment">Ajuste (+ o -)</option></select></label><label className="admin-field">Cantidad<input className="admin-input" onChange={(e) => setMovementQuantity(e.target.value)} placeholder={movementType === 'adjustment' ? 'Ej. -2 o 5' : 'Ej. 20'} type="number" value={movementQuantity} /></label><label className="admin-field">Motivo<textarea className="admin-input min-h-24" onChange={(e) => setMovementReason(e.target.value)} placeholder="Compra, conteo físico, merma…" value={movementReason} /></label><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">{Number(movementQuantity) >= 0 ? <TrendingUp className="size-5 text-emerald-600" /> : <TrendingDown className="size-5 text-rose-600" />}El movimiento quedará registrado con fecha, usuario y referencia única.</div></div>
    </AdminDialog>

    <AdminDialog open={Boolean(categoryEditor)} title={categoryEditor?.id ? 'Editar categoría' : 'Crear categoría'} onClose={() => setCategoryEditor(null)} footer={<><button className="admin-secondary-button" onClick={() => setCategoryEditor(null)} type="button">Cancelar</button><button className="admin-primary-button" disabled={busy || !categoryEditor?.name || !categoryEditor?.slug} onClick={() => void submitCategory()} type="button">Guardar categoría</button></>}>
      {categoryEditor && <div className="grid gap-4"><label className="admin-field">Nombre<input className="admin-input" onChange={(e) => setCategoryEditor({ ...categoryEditor, name: e.target.value, slug: categoryEditor.id ? categoryEditor.slug : slugify(e.target.value) })} value={categoryEditor.name} /></label><label className="admin-field">Identificador<input className="admin-input" onChange={(e) => setCategoryEditor({ ...categoryEditor, slug: slugify(e.target.value) })} value={categoryEditor.slug} /></label><label className="flex items-center gap-2 font-bold text-slate-700"><input checked={categoryEditor.active} onChange={(e) => setCategoryEditor({ ...categoryEditor, active: e.target.checked })} type="checkbox" />Categoría activa</label></div>}
    </AdminDialog>
  </div>
}
