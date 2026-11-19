import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const source = join(root, 'supabase')
const sandboxName = process.env.CAFETERIA_LOCAL_SANDBOX?.trim() || '.local-inventory-validation-current'
if (!/^\.local-[a-z0-9-]+$/.test(sandboxName)) throw new Error('Nombre de sandbox local inválido')
const destination = join(root, sandboxName)
const sourceMigrations = join(source, 'migrations')
const targetMigrations = join(destination, 'supabase', 'migrations')
const guardedMigration = '20261104010000_select_cash_register_at_pos.sql'
const inventoryMigration = '20261106010000_cash_register_inventory.sql'
const testPath = join(source, 'tests', 'inventory_by_cash_register_rpc.sql')
const preflightPath = join(source, 'tests', 'inventory_temp_project_preflight.sql')
const postcheckPath = join(source, 'tests', 'inventory_temp_project_postcheck.sql')

function sha256(value) { return createHash('sha256').update(value).digest('hex') }
function requireExactlyOne(value, fragment, label) {
  if (value.split(fragment).length !== 2) throw new Error(`${label}: marcador ausente o repetido`)
}

const migrationFiles = readdirSync(sourceMigrations).filter((name) => name.endsWith('.sql')).sort()
if (!migrationFiles.includes(guardedMigration)) throw new Error('Falta la migración protegida original')
if (![testPath, preflightPath, postcheckPath].every(existsSync)) {
  throw new Error('Falta alguna prueba aislada')
}
if (!migrationFiles.includes(inventoryMigration)) throw new Error('Falta la migración formal de inventario')
const localMigrationFiles = [
  '20261105000000_local_inventory_validation_fixtures.sql',
  '20261106020000_local_inventory_validation_marker.sql',
]
if (existsSync(destination)) {
  const manifestPath = join(destination, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`El destino existente no es un sandbox reconocido: ${destination}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.purpose !== 'Validación aislada de RPC; nunca aplicar a producción') {
    throw new Error(`El manifiesto del sandbox no coincide: ${destination}`)
  }
  const expected = new Set([...migrationFiles, ...localMigrationFiles])
  const unexpected = readdirSync(targetMigrations)
    .filter((name) => name.endsWith('.sql') && !expected.has(name))
  if (unexpected.length) {
    throw new Error(`El sandbox contiene migraciones no reconocidas: ${unexpected.join(', ')}`)
  }
}
const test = readFileSync(testPath, 'utf8')
if (!/^BEGIN;\s*$/m.test(test) || !/ROLLBACK;\s*$/im.test(test)) {
  throw new Error('La prueba debe usar una transacción con ROLLBACK')
}

const originals = Object.fromEntries([
  ...migrationFiles.map((name) => [name, sha256(readFileSync(join(sourceMigrations, name)))]),
  ['inventory_by_cash_register_rpc.sql', sha256(test)],
  ['inventory_temp_project_preflight.sql', sha256(readFileSync(preflightPath))],
  ['inventory_temp_project_postcheck.sql', sha256(readFileSync(postcheckPath))],
])
mkdirSync(targetMigrations, { recursive: true })
for (const name of migrationFiles) {
  const original = readFileSync(join(sourceMigrations, name), 'utf8')
  if (name !== guardedMigration) {
    copyFileSync(join(sourceMigrations, name), join(targetMigrations, name))
    continue
  }
  const marker = 'drop policy if exists registers_select_authorized'
  requireExactlyOne(original, marker, 'migración protegida')
  if (!original.startsWith('do $$') || !original.includes('private.reset_20261104_sales')) {
    throw new Error('La precondición protegida cambió; revisar manualmente')
  }
  // La base local fresca no tiene los respaldos privados del reinicio remoto.
  // Las definiciones de políticas y RPC posteriores permanecen sin cambios.
  writeFileSync(join(targetMigrations, name),
    `-- SOLO COPIA AISLADA: se omite la comprobación de respaldos remotos.\n${original.slice(original.indexOf(marker))}`)
}
const fixtureMigration = `-- SOLO VALIDACIÓN LOCAL: completa el catálogo hasta el preflight formal de 52 productos.
DO $local_fixture$
DECLARE
  v_missing integer := 52 - (SELECT count(*) FROM public.products);
  v_category uuid;
BEGIN
  IF v_missing < 0 THEN RAISE EXCEPTION 'El catálogo local tiene más de 52 productos'; END IF;
  SELECT id INTO v_category FROM public.product_categories WHERE slug = 'general';
  IF v_category IS NULL THEN RAISE EXCEPTION 'Falta la categoría general local'; END IF;
  INSERT INTO public.products (id, name, price, category_id, subcategory, cost,
    stock_quantity, minimum_stock, sku, active)
  SELECT 'local-validation-' || lpad(n::text, 3, '0'),
    'Producto validación ' || n, 0, v_category, 'Validación', 0, 0, 0, NULL, false
  FROM generate_series(1, v_missing) n;
END
$local_fixture$;
`
writeFileSync(join(targetMigrations, '20261105000000_local_inventory_validation_fixtures.sql'), fixtureMigration)
const markerMigration = `CREATE TABLE private.inventory_validation_marker (id integer PRIMARY KEY CHECK (id = 1));
REVOKE ALL ON TABLE private.inventory_validation_marker FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.inventory_validation_marker ENABLE ROW LEVEL SECURITY;
INSERT INTO private.inventory_validation_marker (id) VALUES (1);
`
writeFileSync(join(targetMigrations, '20261106020000_local_inventory_validation_marker.sql'), markerMigration)
const config = readFileSync(join(source, 'config.toml'), 'utf8')
requireExactlyOne(config, 'project_id = "Cafeteria-Escolar"', 'configuración local')
writeFileSync(join(destination, 'supabase', 'config.toml'),
  config.replace('project_id = "Cafeteria-Escolar"', `project_id = "Cafeteria-Escolar-${sandboxName.slice(7)}"`))
writeFileSync(join(destination, 'supabase', 'seed.sql'), '-- Sin datos de producción.\n')
copyFileSync(testPath, join(destination, 'inventory_by_cash_register_rpc.sql'))
copyFileSync(preflightPath, join(destination, 'inventory_temp_project_preflight.sql'))
copyFileSync(postcheckPath, join(destination, 'inventory_temp_project_postcheck.sql'))
writeFileSync(join(destination, 'manifest.json'), JSON.stringify({
  purpose: 'Validación aislada de RPC; nunca aplicar a producción',
  sourceHashes: originals,
  generatedHashes: Object.fromEntries(readdirSync(targetMigrations).map((name) =>
    [name, sha256(readFileSync(join(targetMigrations, name)))])),
  localFixtureHash: sha256(fixtureMigration),
  localMarkerHash: sha256(markerMigration),
}, null, 2) + '\n')
process.stdout.write(`Preparado: ${destination}\nMigraciones: ${migrationFiles.length} de origen (1 adaptada); 2 auxiliares solo locales\n`)
