DO $rename_main_cash_register$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cash_registers
    WHERE id = '30000000-0000-4000-8000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'No existe la caja principal esperada';
  END IF;

  UPDATE public.cash_registers
  SET name = 'Col. Santo Ángel'
  WHERE id = '30000000-0000-4000-8000-000000000001'::uuid
    AND name IS DISTINCT FROM 'Col. Santo Ángel';

  IF NOT EXISTS (
    SELECT 1
    FROM public.cash_registers
    WHERE id = '30000000-0000-4000-8000-000000000001'::uuid
      AND name = 'Col. Santo Ángel'
  ) THEN
    RAISE EXCEPTION 'La caja principal no quedó con el nombre esperado';
  END IF;
END
$rename_main_cash_register$;
