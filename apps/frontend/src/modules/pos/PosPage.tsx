import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'

import { products, subcategories } from './data'
import type { CartLine, Product, SaleMode, Student } from './types'
import { CartPanel } from './components/CartPanel'
import { CustomerPanel } from './components/CustomerPanel'
import { DemoDialog, type DialogKind } from './components/DemoDialog'
import { FooterStatus } from './components/FooterStatus'
import { ModeTabs } from './components/ModeTabs'
import { ProductCatalog } from './components/ProductCatalog'
import { TopBar } from './components/TopBar'

function productById(id: string) {
  const product = products.find((item) => item.id === id)
  if (!product) throw new Error(`Producto de demostración no encontrado: ${id}`)
  return product
}

const initialCart: CartLine[] = [
  { product: productById('agua-pequena'), quantity: 1 },
  { product: productById('pastel-carne'), quantity: 1 },
  { product: productById('papas-medianas'), quantity: 1 },
  { product: productById('gaseosa-pequena'), quantity: 1 },
]

interface DialogState {
  kind: DialogKind
  title: string
  message: string
}

const closedDialog: DialogState = { kind: null, title: '', message: '' }

export function PosPage() {
  const [mode, setMode] = useState<SaleMode>('free')
  const [category, setCategory] = useState('bebidas')
  const [subcategory, setSubcategory] = useState('Todas')
  const [cart, setCart] = useState<CartLine[]>(initialCart)
  const [undoStack, setUndoStack] = useState<CartLine[][]>([])
  const [cashReceived, setCashReceived] = useState(10_000)
  const [studentQuery, setStudentQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [dialog, setDialog] = useState<DialogState>(closedDialog)

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [cart],
  )

  function commitCart(nextCart: CartLine[]) {
    setUndoStack((history) => [...history.slice(-9), cart])
    setCart(nextCart)
  }

  function addProduct(product: Product) {
    const existing = cart.find((line) => line.product.id === product.id)
    const nextCart = existing
      ? cart.map((line) =>
          line.product.id === product.id ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line,
        )
      : [...cart, { product, quantity: 1 }]
    commitCart(nextCart)
  }

  function changeQuantity(productId: string, delta: number) {
    const nextCart = cart
      .map((line) =>
        line.product.id === productId ? { ...line, quantity: Math.min(99, line.quantity + delta) } : line,
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
    setSubcategory(subcategories[nextCategory]?.[0] ?? 'Todos')
  }

  function selectStudent(student: Student) {
    setSelectedStudent(student)
    setStudentQuery('')
  }

  function showDemoNotice(title: string, message: string) {
    setDialog({ kind: 'notice', title, message })
  }

  return (
    <div className="pos-shell flex min-h-dvh flex-col bg-[#eef5fa] text-slate-900">
      <TopBar />

      <main className="pos-layout mx-auto grid w-full max-w-[1600px] flex-1 gap-3 p-3 sm:p-4">
        <div className="pos-catalog-column flex min-w-0 flex-col gap-3">
          <ModeTabs mode={mode} onChange={setMode} />

          <div className="flex items-start gap-2 px-1 text-sm font-semibold text-slate-600">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-600" />
            <p>
              {mode === 'free'
                ? 'Venta libre: para clientes que pagan en efectivo y no están en la base de estudiantes.'
                : 'Modo estudiante: selecciona una cuenta para consultar saldos y preparar consumos de demostración.'}
            </p>
          </div>

          <CustomerPanel
            mode={mode}
            onModeChange={setMode}
            onQueryChange={setStudentQuery}
            onSelectStudent={selectStudent}
            query={studentQuery}
            selectedStudent={selectedStudent}
          />

          <ProductCatalog
            category={category}
            onAddProduct={addProduct}
            onCategoryChange={changeCategory}
            onSubcategoryChange={setSubcategory}
            subcategory={subcategory}
          />
        </div>

        <CartPanel
          canUndo={undoStack.length > 0}
          cart={cart}
          cashReceived={cashReceived}
          mode={mode}
          onCashReceivedChange={setCashReceived}
          onChangeQuantity={changeQuantity}
          onClear={clearCart}
          onPrimaryAction={() =>
            showDemoNotice(
              mode === 'free' ? 'Pago en efectivo preparado' : 'Consumo preparado',
              mode === 'free'
                ? `Total ${total.toLocaleString('es-CO')} listo para revisión. Esta demostración no registra pagos.`
                : 'El consumo puede revisarse en pantalla. No se aplicó al saldo del estudiante.',
            )
          }
          onRegisterPayment={() =>
            showDemoNotice('Registrar abono', 'El formulario de abonos se habilitará cuando se implemente la persistencia segura.')
          }
          onRemove={removeProduct}
          onShowHistory={() =>
            setDialog({
              kind: 'history',
              title: mode === 'student' ? 'Historial del estudiante' : 'Historial de demostración',
              message:
                mode === 'student' && selectedStudent
                  ? `Movimientos ficticios para ${selectedStudent.name}. No corresponden a transacciones reales.`
                  : 'Movimientos ficticios usados exclusivamente para validar la interfaz.',
            })
          }
          onUndo={undoLastTouch}
          student={selectedStudent}
        />
      </main>

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
