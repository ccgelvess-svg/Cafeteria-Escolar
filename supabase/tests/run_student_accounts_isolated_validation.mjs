import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const migration = readFileSync(new URL('../migrations/20261119010000_student_accounts_by_cash_register.sql', import.meta.url), 'utf8')
const rollback = readFileSync(new URL('../maintenance/rollback_20261119010000_student_accounts_by_cash_register.sql', import.meta.url), 'utf8')
  .replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '')

const client = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'student_accounts_validation', user: 'postgres', password: 'postgres', ssl: false })

const administratorId = 'a0000000-0000-4000-8000-000000000001'
const studentId = 'b0000000-0000-4000-8000-000000000001'
const registerOne = 'c0000000-0000-4000-8000-000000000001'
const registerTwo = 'c0000000-0000-4000-8000-000000000002'

await client.connect()
try {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS private;
    DO $roles$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $roles$;
    CREATE TYPE public.app_role AS ENUM ('administrator', 'cashier', 'inventory');
    CREATE TYPE public.student_status AS ENUM ('active', 'inactive');
    CREATE TYPE public.student_movement_type AS ENUM ('consumption', 'top-up', 'debt-payment', 'reversal');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    CREATE TABLE public.cash_registers (id uuid PRIMARY KEY, name text NOT NULL, active boolean NOT NULL DEFAULT true);
    CREATE TABLE public.profiles (
      user_id uuid PRIMARY KEY, role public.app_role NOT NULL, cash_register_id uuid,
      display_name text NOT NULL, active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE public.students (
      id uuid PRIMARY KEY, code text NOT NULL UNIQUE, first_name text NOT NULL, last_name text NOT NULL,
      grade text NOT NULL, group_name text NOT NULL, net_balance bigint NOT NULL DEFAULT 0,
      status public.student_status NOT NULL DEFAULT 'active', created_by uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.student_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.students(id),
      occurred_at timestamptz NOT NULL DEFAULT now(), type public.student_movement_type NOT NULL,
      amount bigint NOT NULL, detail text NOT NULL, actor_user_id uuid NOT NULL,
      actor_display_name text NOT NULL, cash_register_id uuid REFERENCES public.cash_registers(id),
      device_id text NOT NULL, idempotency_key text NOT NULL UNIQUE,
      reverses_movement_id uuid UNIQUE REFERENCES public.student_movements(id)
    );
    ALTER TABLE public.student_movements ENABLE ROW LEVEL SECURITY;
    CREATE POLICY movements_admin_read ON public.student_movements FOR SELECT TO authenticated
      USING (true);
    CREATE FUNCTION private.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN NEW.updated_at = now(); RETURN NEW; END';
    CREATE FUNCTION private.current_app_role() RETURNS public.app_role LANGUAGE sql STABLE AS
      'SELECT role FROM public.profiles WHERE user_id = auth.uid() AND active';
    CREATE FUNCTION private.current_cash_register_id() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT cash_register_id FROM public.profiles WHERE user_id = auth.uid() AND active';
    CREATE FUNCTION public.record_student_movement(
      uuid, public.student_movement_type, bigint, text, text, text
    ) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
  `)

  await client.query(`INSERT INTO public.cash_registers (id, name) VALUES ($1, 'Caja Uno'), ($2, 'Caja Dos')`, [registerOne, registerTwo])
  await client.query(`INSERT INTO public.profiles (user_id, role, display_name) VALUES ($1, 'administrator', 'Administrador ficticio')`, [administratorId])
  await client.query(`INSERT INTO public.students
    (id, code, first_name, last_name, grade, group_name, net_balance, created_by)
    VALUES ($1, 'TEST-001', 'Estudiante', 'Ficticio', '5', 'A', -2500, $2)`, [studentId, administratorId])
  await client.query(`INSERT INTO public.student_movements
    (student_id, type, amount, detail, actor_user_id, actor_display_name, cash_register_id, device_id, idempotency_key)
    VALUES
      ($1, 'consumption', -1000, 'Compra histórica caja uno', $2, 'Admin', $3, 'fixture', 'history:r1'),
      ($1, 'consumption', -2000, 'Compra histórica caja dos', $2, 'Admin', $4, 'fixture', 'history:r2'),
      ($1, 'top-up', 500, 'Movimiento pendiente de conciliación', $2, 'Admin', NULL, 'fixture', 'history:pending')`,
    [studentId, administratorId, registerOne, registerTwo])

  await client.query(migration)
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [administratorId])

  const initial = await client.query(`
    SELECT cash_register_id::text, net_balance FROM public.student_accounts
    WHERE student_id = $1 ORDER BY cash_register_id
  `, [studentId])
  assert.deepEqual(initial.rows, [
    { cash_register_id: registerOne, net_balance: '-1000' },
    { cash_register_id: registerTwo, net_balance: '-2000' },
  ])

  const pending = await client.query(`SELECT count(*)::int AS count FROM public.student_movements_pending_reconciliation`)
  assert.equal(pending.rows[0].count, 1)

  await client.query(`
    INSERT INTO public.student_movements
      (student_id, type, amount, detail, actor_user_id, actor_display_name, cash_register_id, device_id, idempotency_key)
    VALUES ($1, 'consumption', -700, 'Compra nueva caja uno', $2, 'Admin', $3, 'test-device', 'purchase:r1')
  `, [studentId, administratorId, registerOne])

  const paymentParams = [studentId, 400, registerOne]
  await client.query(`SELECT public.record_student_movement_by_register(
    $1, 'debt-payment', $2, 'Abono ficticio', 'test-device', 'payment:idempotent', $3)`, paymentParams)
  await client.query(`SELECT public.record_student_movement_by_register(
    $1, 'debt-payment', $2, 'Abono ficticio', 'test-device', 'payment:idempotent', $3)`, paymentParams)

  const balances = await client.query(`
    SELECT cash_register_id::text, net_balance FROM public.student_accounts
    WHERE student_id = $1 ORDER BY cash_register_id
  `, [studentId])
  assert.deepEqual(balances.rows, [
    { cash_register_id: registerOne, net_balance: '-1300' },
    { cash_register_id: registerTwo, net_balance: '-2000' },
  ])
  const paymentCount = await client.query(`SELECT count(*)::int AS count FROM public.student_movements WHERE idempotency_key = 'payment:idempotent'`)
  assert.equal(paymentCount.rows[0].count, 1)
  const historyCount = await client.query(`SELECT count(*)::int AS count FROM public.student_movements WHERE student_id = $1`, [studentId])
  assert.equal(historyCount.rows[0].count, 5)

  await client.query('BEGIN')
  await client.query(rollback)
  const afterRollback = await client.query(`SELECT to_regclass('public.student_accounts') AS accounts, count(*)::int AS history FROM public.student_movements`)
  assert.equal(afterRollback.rows[0].accounts, null)
  assert.equal(afterRollback.rows[0].history, 5)
  await client.query('ROLLBACK')
  const restored = await client.query(`SELECT count(*)::int AS count FROM public.student_accounts WHERE student_id = $1`, [studentId])
  assert.equal(restored.rows[0].count, 2)

  process.stdout.write('student accounts isolated validation: PASS\n')
} finally {
  await client.query('ROLLBACK').catch(() => undefined)
  await client.end()
}
