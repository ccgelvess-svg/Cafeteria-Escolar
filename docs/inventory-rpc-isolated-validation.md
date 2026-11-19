# Validación aislada de inventarios por caja

## Alcance

La prueba utiliza una copia local de las migraciones, usuarios ficticios y dos cajas.
No usa credenciales, respaldos ni datos de producción. El ID de Cardenal Sancha es
`30000000-0000-4000-8000-000000000002`; Caja principal usa
`30000000-0000-4000-8000-000000000001`.

El generador `supabase/tests/prepare_inventory_rpc_sandbox.mjs` crea
`.local-inventory-validation-current/`, ignorado por Git. Puede actualizar una copia previa
solo si su manifiesto demuestra que es el sandbox esperado y no contiene migraciones ajenas.
Conserva las migraciones originales intactas. En la copia, omite exclusivamente
la precondición de respaldos privados de
`20261104010000_select_cash_register_at_pos.sql`, porque esos respaldos no
existen en una base nueva. El resto de esa migración se copia sin cambios.
Dos migraciones auxiliares exclusivamente locales completan el catálogo de prueba
hasta 52 productos y agregan un marcador privado con RLS y sin permisos para los
roles API. `manifest.json` registra
los SHA-256 de fuentes y archivos generados.

## Prerrequisitos

- Docker, Supabase CLI y `psql` disponibles localmente. Actualmente no están
  disponibles en este equipo; la ejecución de PostgreSQL queda pendiente.
- Los puertos locales definidos en `supabase/config.toml` deben estar libres.
- No enlazar esta copia con un proyecto remoto ni copiar archivos `.env`.

## Ejecución futura, solo en el entorno aislado

Desde PowerShell, en `D:\Proyectos\Cafeteria-Escolar`:

```powershell
npm run supabase:local:prepare
Set-Location .\.local-inventory-validation-current
npx supabase start
npx supabase db reset --local
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 -U postgres -d postgres -f .\inventory_by_cash_register_rpc.sql
```

Verificar que ambas conexiones de `psql` apuntan a `127.0.0.1:54322` antes de
introducir una contraseña local. Si `supabase db reset --local` o alguna sentencia falla, detenerse
y conservar el error; no sustituir la conexión por una URL remota. El archivo de
prueba termina en `ROLLBACK`; si `psql` se detiene por error, la conexión cierra
la transacción sin confirmar los datos de prueba.

## Casos comprobados por la prueba SQL

1. Dos ofertas del mismo `product_id` tienen precios y existencias diferentes.
2. Inventarios ve ambas cajas; un cajero solo su caja y no puede vender en otra.
3. Las ventas en efectivo y a cuenta usan el precio local y descuentan solo su stock.
4. Un precio enviado por el cliente que no coincide se rechaza.
   Una venta sin existencias se rechaza sin persistir.
5. Reintentar una venta no duplica ventas ni movimientos.
6. La anulación restituye unidades solo a la caja de la venta y revierte el saldo
   estudiantil; repetirla no duplica el reverso.
7. Los precios y existencias globales de `products` no cambian durante los casos
   nuevos; el cajero no puede editar el precio global directamente.

El éxito de las pruebas locales no autoriza una migración remota. Antes de una
activación posterior hacen falta la conciliación de existencias de cada caja, la
revisión de datos reales, una prueba de concurrencia con dos conexiones locales y
una ventana de corte que coordine RPC y frontend.
