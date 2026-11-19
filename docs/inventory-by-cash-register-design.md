# Aislamiento de inventario y precios por caja

## Decisión

El catálogo de identidad del producto puede ser compartido, pero la oferta, el precio
y las existencias deben pertenecer a una caja. Ninguna importación de Cardenal Sancha
debe actualizar `public.products.price`, `stock_quantity`, `cost`, `minimum_stock`
o `active` mientras esos campos sigan siendo globales y utilizados por el POS.
Tampoco debe borrar productos, categorías, ventas o movimientos históricos.

La migración local propone el ID `30000000-0000-4000-8000-000000000002` para la
caja Cardenal Sancha. Antes de cualquier migración o carga, una consulta remota de
solo lectura debe confirmar que existe una única caja activa con ese ID y nombre.
Una caja es el ámbito operativo actual; el sistema no tiene una entidad `sede`.
Si la organización puede tener varias cajas por sede, hace falta modelar la sede
separadamente antes de usar este diseño para aislamiento por sede.

## Modelo propuesto

1. `products`: identidad estable del artículo (`id`, nombre y SKU canónico
   cuando realmente sea único). No se borran filas compartidas ni se reutiliza
   un ID para otro artículo. Los campos globales actuales de precio y stock
   permanecen para compatibilidad histórica durante la transición, pero dejan
   de ser fuente operativa tras el corte.
2. `cash_register_inventory`: clave primaria compuesta
   `(cash_register_id, product_id)`; claves foráneas a `cash_registers`,
   `products` y `product_categories`. Campos locales: `price` bigint
   no negativo, `cost` bigint no negativo, `stock_quantity` integer no
   negativo, `minimum_stock` integer no negativo, `active` boolean,
   `category_id`, `subcategory`, `display_name` opcional y
   `updated_at`. Un producto compartido tiene dos filas independientes.
   La categoría global no se desactiva durante una carga local.
3. `cash_register_stock_movements`: historial nuevo con
   `cash_register_id`, `product_id`, delta, tipo, motivo, actor, fecha,
   `source_sale_id`, `reverses_movement_id` e idempotencia. Su par
   `(cash_register_id, product_id)` referencia la oferta local. El reverso
   debe referenciar un movimiento de la misma caja. Las filas antiguas de
   `stock_movements` permanecen intactas como historial de ámbito desconocido.
4. `sale_items` conserva sus instantáneas de nombre y precio; `sales`
   ya contiene `cash_register_id`. No se recalculan ventas históricas con
   precios nuevos.

No se debe asignar el stock global anterior a Caja principal o a Cardenal Sancha
por inferencia. La apertura por caja exige un conteo físico o una conciliación
aprobada de cantidades, con respaldo del estado previo. Una lista de precios sin
existencias puede cargarse en una fase de preparación, pero sus ofertas quedan
inactivas hasta registrar el stock inicial autorizado.

## Escrituras y lecturas que deben cambiar juntas

- El POS consulta solo ofertas activas de la caja seleccionada; cambiar de caja
  vacía o vuelve a validar el carrito. La firma e idempotencia de venta ya
  incluyen la caja, pero la reserva offline y las cachés de producto deben
  indexarse por `cash_register_id + product_id`, no solo por producto.
- Una operación offline heredada sin `cash_register_id` se conserva bloqueada y
  visible para revisión. Solo puede corregirse mediante una asignación manual
  respaldada; nunca se infiere la caja desde la sesión que sincroniza.
- `record_cash_sale` y `record_student_sale` validan cada artículo, precio,
  total y disponibilidad contra `cash_register_inventory` de la caja
  autorizada. Bloquean las filas locales en orden estable, descuentan solo
  ese stock e insertan movimientos locales y la instantánea de `sale_items`
  en la misma transacción. Nunca confían en el precio enviado por el cliente.
- `void_sale` obtiene la caja desde la venta y devuelve unidades únicamente
  a su oferta local. Debe seguir soportando las ventas antiguas cuyos
  movimientos están en `stock_movements`, sin inventar una caja para ellas.
- Las operaciones de producto, precio, activación, mínimo y ajuste de stock
  reciben una caja explícita. El administrador puede elegir caja; inventarios
  solo opera sobre su caja asignada. Las categorías compartidas son administradas
  únicamente por el administrador general. Se revoca
  o sustituye el acceso a las RPC globales antiguas antes de habilitar las
  nuevas rutas. RLS y las funciones `security definer` deben validar la caja,
  el rol y el ámbito en servidor.
- Administración, dashboard, alertas y POS muestran precio y existencia de
  la caja elegida. Informes agregados deben etiquetar su ámbito; no sumar
  stock de cajas como si fuera una sola existencia física.
- Los costos se consultan mediante una RPC autorizada para administrador e
  inventarios. El cajero usa una lectura sin la columna `cost`, y los agregados
  de ventas se calculan en SQL sin depender del límite de filas del cliente.

## Preparación de la carga de Cardenal Sancha

El archivo `PRECIOS 2026 CARDENAL SANCHA.docx` contiene descripciones y precios,
pero no cantidades de apertura ni SKU. Antes de generar SQL de carga se requiere:

1. Convertirlo a una tabla de revisión con una fila por variante vendible,
   `product_id` existente o identidad nueva, nombre, categoría, precio COP,
   SKU si aplica, costo y cantidad inicial. Resolver descripciones que agrupan
   varios sabores o tamaños; no asignar el mismo precio a variantes implícitas.
2. Confirmar el ID remoto de Cardenal Sancha y el inventario de ambas cajas.
   Identificar productos compartidos por ID y verificar que el conjunto de
   Caja principal tendrá filas locales propias con sus precios y stock
   aprobados. No duplicar el stock global.
3. Respaldar las tablas relevantes y sus relaciones, calcular SHA-256, validar
   claves foráneas, ventas, movimientos, reversos, autorizaciones y triggers.
4. Preparar un diff por `(cash_register_id, product_id)` que muestre altas,
   cambios de precio y desactivaciones únicamente para Cardenal Sancha. Cero
   filas de Caja principal pueden cambiar. La simulación termina en
   `ROLLBACK`; la versión definitiva requiere autorización separada.
5. Ejecutar migración y frontend compatibles antes de activar ofertas locales.
   Durante el corte, bloquear ventas o usar un periodo controlado sin ventas;
   verificar POS, anulación, ajuste, offline y reportes por cada caja. No
   publicar el catálogo local si el POS sigue leyendo precio o stock global.

## Condiciones de rechazo

Detener la operación si la caja remota no coincide con el ID validado, falta
la asignación de stock por caja, hay productos sin identidad inequívoca, una
RPC antigua puede escribir stock o precio global, una venta podría tomar el
precio de otra caja, o la vista previa muestra cambios en Caja principal,
ventas históricas, usuarios o movimientos antiguos.

Este documento es diseño; no contiene una migración ejecutable ni autoriza
cambios en Supabase o despliegues.
