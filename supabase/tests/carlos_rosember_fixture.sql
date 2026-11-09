-- Fixture local. Falla fuera del sandbox si no existe el actor de pruebas conocido.
BEGIN;

DO $fixture$
DECLARE
  v_actor uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_actor) THEN
    RAISE EXCEPTION 'El actor local de pruebas no existe; no se insertó ningún estudiante';
  END IF;

  INSERT INTO public.students
    (id, code, first_name, last_name, grade, group_name, net_balance, status, created_by)
  VALUES
    ('c0000000-0000-4000-8000-000000000002', 'LOCAL-TEST-CARLOS-ROSEMBER',
     'Carlos', 'Rosember', 'Prueba', 'Prueba', 0, 'active', v_actor)
  ON CONFLICT (id) DO NOTHING;

  IF (SELECT count(*) FROM public.students
      WHERE id='c0000000-0000-4000-8000-000000000002'
        AND first_name='Carlos' AND last_name='Rosember'
        AND net_balance=0) <> 1 THEN
    RAISE EXCEPTION 'El fixture Carlos Rosember no coincide con el estado esperado';
  END IF;
END
$fixture$;

COMMIT;
