import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Droplet,
  LayoutGrid,
  Milk,
  Package,
  Pizza,
  Sandwich,
  Store,
  Wheat,
  Zap,
} from 'lucide-react'

import { categories as staticCategories, products as staticProducts } from './data'
import { formatCurrency } from './format'
import type { CartLine, Product, SaleMode, Student } from './types'
import { CartPanel } from './components/CartPanel'
import { CustomerPanel } from './components/CustomerPanel'
import { DemoDialog, type DialogKind } from './components/DemoDialog'
import { FooterStatus } from './components/FooterStatus'
import { ModeTabs } from './components/ModeTabs'
import { ProductCatalog } from './components/ProductCatalog'
import { TopBar } from './components/TopBar'
import { cashSaleSignature, prepareCashPaymentAttempt, studentSaleSignature, type CashPaymentAttempt } from './cashPayment'
import { canUseCashRegister, useAuth } from '../auth'
import { createIdempotencyKey, listStudentMovements, splitBalance, useStudents } from '../students'
import { listActiveCashRegisters, registerCashSale, registerStudentSale, type CashRegisterOption } from '../sales'
import { useInventory } from '../inventory'

const initialCart: CartLine[] = []

interface DialogState {
  kind: DialogKind
  title: string
  message: string
}

const closedDialog: DialogState = { kind: null, title: '', message: '' }

function productVisual(item: { id: string; name: string; categorySlug: string; subcategory: string }) {
  const predefined = staticProducts.find((product) => product.id === item.id)
  if (predefined) return predefined

  const text = `${item.name} ${item.subcategory}`.toLocaleLowerCase('es')
  if (text.includes('pizza')) return { icon: Pizza, iconColor: 'text-red-600', tint: 'bg-red-50' }
  if (/sándwich|sandwich|hamburguesa|perro|tostada|salchipapa/.test(text)) return { icon: Sandwich, iconColor: 'text-amber-700', tint: 'bg-yellow-50' }
  if (text.includes('galleta')) return { icon: Cookie, iconColor: 'text-amber-700', tint: 'bg-orange-50' }
  if (/croissant|hojaldrado|churro|empanada|arepa|pan|pastel/.test(text)) return { icon: Croissant, iconColor: 'text-orange-600', tint: 'bg-orange-50' }
  if (text.includes('gatorade')) return { icon: Zap, iconColor: 'text-blue-600', tint: 'bg-amber-50' }
  if (text.includes('agua')) return { icon: Droplet, iconColor: 'text-sky-600', tint: 'bg-sky-50' }
  if (/gaseosa|jugo|hit|kalua|pony/.test(text)) return { icon: CupSoda, iconColor: 'text-orange-600', tint: 'bg-amber-50' }
  if (/tea|té|lipton/.test(text)) return { icon: Coffee, iconColor: 'text-emerald-700', tint: 'bg-emerald-50' }
  if (text.includes('leche')) return { icon: Milk, iconColor: 'text-blue-600', tint: 'bg-blue-50' }
  if (text.includes('maní')) return { icon: Wheat, iconColor: 'text-lime-700', tint: 'bg-lime-50' }

  const category = staticCategories.find((candidate) => candidate.id === item.categorySlug)
  return { icon: category?.icon ?? Package, iconColor: 'text-blue-700', tint: 'bg-blue-50' }
}

export function PosPage() {
  const [mode, setMode] = useState<SaleMode>('free')
  const [category, setCategory] = useState('todos')
  const [subcategory, setSubcategory] = useState('Todos')
  const [cart, setCart] = useState<CartLine[]>(initialCart)
  const [undoStack, setUndoStack] = useState<CartLine[][]>([])
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [studentQuery, setStudentQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(closedDialog)
  const [registers, setRegisters] = useState<CashRegisterOption[]>([])
  const [activeRegisterId, setActiveRegisterId] = useState('')
  const [registerError, setRegisterError] = useState('')
  const purchaseInFlight = useRef(false)
  const lastCommittedSale = useRef<string | null>(null)
  const pendingCashSale = useRef<CashPaymentAttempt | null>(null)
  const pendingStudentSale = useRef<CashPaymentAttempt | null>(null)
  const { students: studentAccounts } = useStudents()
  const { products: inventoryProducts, categories: inventoryCategories } = useInventory(false)
  const { session, can } = useAuth()
  const activeRegister = registers.find((register) => register.id === activeRegisterId) ?? null

  useEffect(() => {
    void listActiveCashRegisters()
      .then((items) => {
        setRegisters(session ? items.filter((item) => canUseCashRegister(session.user.role, session.user.cashRegisterId, item.id)) : [])
        setRegisterError('')
      })
      .catch((cause) => setRegisterError(cause instanceof Error ? cause.message : 'No fue posible cargar las cajas.'))
  }, [session])

  const catalogProducts = useMemo<Product[]>(() => inventoryProducts.filter((item) => item.active).map((item) => {
    const visual = productVisual(item)
    return {
      id: item.id,
      name: item.name,
      shortName: item.name,
      price: item.price,
      category: item.categorySlug,
      subcategory: item.subcategory,
      stockQuantity: item.stockQuantity,
      tint: visual.tint,
      icon: visual.icon,
      iconColor: visual.iconColor,
    }
  }), [inventoryProducts])
  const catalogCategories = useMemo(() => [
    { id: 'todos', label: 'Todos', icon: LayoutGrid },
    ...inventoryCategories.filter((item) => item.active).map((item) => ({
      id: item.slug,
      label: item.name,
      icon: staticCategories.find((category) => category.id === item.slug)?.icon ?? Package,
    })),
  ], [inventoryCategories])
  const catalogSubcategories = useMemo(() => Object.fromEntries(catalogCategories.map((item) => [
    item.id,
    item.id === 'todos'
      ? ['Todos']
      : ['Todos', ...new Set(catalogProducts
        .filter((product) => product.category === item.id)
        .map((product) => product.subcategory))],
  ])), [catalogCategories, catalogProducts])

  const students = useMemo<Student[]>(() => studentAccounts.filter((student) => student.status === 'active').map((student) => {
    const split = splitBalance(student.netBalance)
    return { accountId: student.id, id: student.code, name: `${student.firstName} ${student.lastName}`, course: `${student.grade} ${student.group}`, balance: split.balance, debt: split.debt }
  }), [studentAccounts])
  const selectedStudent = students.find((student) => student.accountId === selectedStudentId) ?? null

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [cart],
  )

  function commitCart(nextCart: CartLine[]) {
    lastCommittedSale.current = null
    setUndoStack((history) => [...history.slice(-9), cart])
    setCart(nextCart)
  }

  function addProduct(product: Product) {
    const existing = cart.find((line) => line.product.id === product.id)
    if ((existing?.quantity ?? 0) >= (product.stockQuantity ?? Number.MAX_SAFE_INTEGER)) return
    const nextCart = existing
      ? cart.map((line) =>
          line.product.id === product.id ? { ...line, quantity: Math.min(99, product.stockQuantity ?? 99, line.quantity + 1) } : line,
        )
      : [...cart, { product, quantity: 1 }]
    commitCart(nextCart)
  }

  function changeQuantity(productId: string, delta: number) {
    const nextCart = cart
      .map((line) =>
        line.product.id === productId ? { ...line, quantity: Math.min(99, line.product.stockQuantity ?? 99, line.quantity + delta) } : line,
      )
      .filter((line) => line.quantity > 0)
    commitCart(nextCart)
  }

  function removeProduct(productId: string) {
    commitCart(cart.filter((line) => line.product.id !== productId))
  }

  function clearCart() {
    if (cart.length > 0) commitCart([])
  }

  function undoLastTouch() {
    const previousCart = undoStack.at(-1)
    if (!previousCart) return
    setCart(previousCart)
    setUndoStack((history) => history.slice(0, -1))
  }

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory)
    setSubcategory(catalogSubcategories[nextCategory]?.[0] ?? 'Todos')
  }

  function selectStudent(student: Student) {
    setSelectedStudentId(student.accountId)
    setStudentQuery('')
  }

  async function confirmStudentConsumption() {
    if (!selectedStudent || total <= 0 || purchaseInFlight.current) return
    if (!can('pos:charge') || !session) {
      setDialog({ kind: 'notice', title: 'Operación no autorizada', message: 'Tu sesión no permite registrar consumos.' })
      return
    }
    if (!activeRegister) {
      setDialog({ kind: 'notice', title: 'Selecciona una caja', message: 'Debes elegir una caja activa antes de registrar ventas.' })
      return
    }
    const saleSignature = studentSaleSignature(activeRegister.id, selectedStudent.accountId, cart.map(({ product, quantity }) => ({ productId: product.id, quantity })))
    if (lastCommittedSale.current === saleSignature) return
    purchaseInFlight.current = true
    pendingStudentSale.current = prepareCashPaymentAttempt(
      pendingStudentSale.current,
      saleSignature,
      () => createIdempotencyKey('pos-sale'),
    )
    try {
      const result = await registerStudentSale({
        cashRegisterId: activeRegister.id,
        studentId: selectedStudent.accountId,
        totalAmount: total,
        idempotencyKey: pendingStudentSale.current.idempotencyKey,
        items: cart.map(({ product, quantity }) => ({ productId: product.id, productName: product.name, unitPrice: product.price, quantity })),
      })
      lastCommittedSale.current = saleSignature
      pendingStudentSale.current = null
      setDialog(result.queued
        ? { kind: 'notice', title: 'Consumo guardado', message: `${formatCurrency(total)} quedó pendiente y se sincronizará automáticamente sin perderse.` }
        : { kind: 'notice', title: 'Consumo registrado', message: `${formatCurrency(total)} descontados de la cuenta de ${selectedStudent.name}.` })
      setCart([])
      setUndoStack([])
    } catch (cause) {
      setDialog({ kind: 'notice', title: 'No se registró el consumo', message: cause instanceof Error ? cause.message : 'Intenta nuevamente.' })
    } finally {
      purchaseInFlight.current = false
    }
  }

  async function confirmCashSale() {
    if (total <= 0 || purchaseInFlight.current) return
    if (!can('pos:charge') || !session) {
      setDialog({ kind: 'notice', title: 'Operación no autorizada', message: 'Tu sesión no permite registrar ventas.' })
      return
    }
    if (!activeRegister) {
      setDialog({ kind: 'notice', title: 'Selecciona una caja', message: 'Debes elegir una caja activa antes de registrar ventas.' })
      return
    }
    const saleSignature = cashSaleSignature(activeRegister.id, cart.map(({ product, quantity }) => ({ productId: product.id, quantity })))
    if (lastCommittedSale.current === saleSignature) return
    purchaseInFlight.current = true
    setPaymentBusy(true)
    pendingCashSale.current = prepareCashPaymentAttempt(
      pendingCashSale.current,
      saleSignature,
      () => createIdempotencyKey('cash-sale'),
    )
    try {
      const result = await registerCashSale({
        cashRegisterId: activeRegister.id,
        totalAmount: total,
        idempotencyKey: pendingCashSale.current.idempotencyKey,
        items: cart.map(({ product, quantity }) => ({ productId: product.id, productName: product.name, unitPrice: product.price, quantity })),
      })
      lastCommittedSale.current = saleSignature
      pendingCashSale.current = null
      setDialog(result.queued
        ? { kind: 'notice', title: 'Venta guardada', message: `${formatCurrency(total)} en efectivo quedó pendiente y se sincronizará automáticamente.` }
        : { kind: 'notice', title: 'Venta registrada', message: `${formatCurrency(total)} pagados en efectivo.` })
      setCart([])
      setUndoStack([])
    } catch (cause) {
      setDialog({ kind: 'notice', title: 'No se registró la venta', message: cause instanceof Error ? cause.message : 'Intenta nuevamente.' })
    } finally {
      purchaseInFlight.current = false
      setPaymentBusy(false)
    }
  }

  async function showStudentHistory() {
    if (!selectedStudent) return
    try {
      const movements = await listStudentMovements(selectedStudent.accountId)
      const message = movements.length === 0 ? 'Este estudiante todavía no tiene movimientos.' : movements.slice(0, 5).map((movement) => `${new Date(movement.occurredAt).toLocaleString('es-CO')} · ${movement.detail} · ${formatCurrency(movement.amount)}`).join('\n')
      setDialog({ kind: 'history', title: `Historial de ${selectedStudent.name}`, message })
    } catch (cause) {
      setDialog({ kind: 'notice', title: 'No fue posible consultar el historial', message: cause instanceof Error ? cause.message : 'Intenta nuevamente.' })
    }
  }

  function showDemoNotice(title: string, message: string) {
    setDialog({ kind: 'notice', title, message })
  }

  return (
    <div className="pos-shell flex min-h-dvh flex-col bg-[#eef5fa] text-slate-900">
      <TopBar activeRegisterId={activeRegisterId} registers={registers} onSelectRegister={setActiveRegisterId} />

      {!activeRegister ? <main className="mx-auto grid w-full max-w-2xl flex-1 place-items-center p-4">
        <section className="w-full rounded-2xl border border-blue-200 bg-white p-6 text-center shadow-lg">
          <Store aria-hidden="true" className="mx-auto size-12 text-blue-700" />
          <h2 className="mt-3 text-2xl font-black text-slate-950">Selecciona la caja para iniciar</h2>
          <p className="mt-2 font-semibold text-slate-500">Las ventas quedarán asociadas únicamente a la caja elegida.</p>
          {registerError && <p className="mt-4 rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{registerError}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{registers.map((register) => <button className="min-h-14 rounded-xl bg-blue-700 px-4 text-lg font-black text-white hover:bg-blue-800" key={register.id} onClick={() => setActiveRegisterId(register.id)} type="button">{register.name}</button>)}</div>
        </section>
      </main> : <main className="pos-layout mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 gap-2 p-2 sm:p-3 lg:p-2">
        <div className="pos-catalog-column flex min-w-0 flex-col gap-2">
          <ModeTabs mode={mode} onChange={setMode} />

          <CustomerPanel
            mode={mode}
            onModeChange={setMode}
            onQueryChange={setStudentQuery}
            onSelectStudent={selectStudent}
            query={studentQuery}
            selectedStudent={selectedStudent}
            students={students}
          />

          <ProductCatalog
            category={category}
            categories={catalogCategories}
            onAddProduct={addProduct}
            onCategoryChange={changeCategory}
            onSubcategoryChange={setSubcategory}
            subcategory={subcategory}
            subcategories={catalogSubcategories}
            products={catalogProducts}
          />
        </div>

        <CartPanel
          canUndo={undoStack.length > 0}
          cart={cart}
          paymentBusy={paymentBusy}
          mode={mode}
          onChangeQuantity={changeQuantity}
          onClear={clearCart}
          onPrimaryAction={() => mode === 'student'
            ? void confirmStudentConsumption()
            : void confirmCashSale()}
          onRegisterPayment={() =>
            showDemoNotice('Recargas y abonos', 'Registra el movimiento desde Administración → Estudiantes. El saldo se actualizará aquí automáticamente.')
          }
          onRemove={removeProduct}
          onShowHistory={() => mode === 'student'
            ? void showStudentHistory()
            : showDemoNotice('Historial de demostración', 'La venta libre aún no registra transacciones.')}
          onUndo={undoLastTouch}
          student={selectedStudent}
        />
      </main>}

      <FooterStatus />

      <DemoDialog
        kind={dialog.kind}
        message={dialog.message}
        onClose={() => setDialog(closedDialog)}
        title={dialog.title}
      />
    </div>
  )
}
