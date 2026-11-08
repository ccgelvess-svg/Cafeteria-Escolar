-- Defensa en profundidad: ninguna venta puede usar una oferta con precio cero.
CREATE OR REPLACE FUNCTION private.record_cash_register_sale_stock(
  p_sale_id uuid, p_cash_register_id uuid, p_items jsonb, p_total_amount bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $sale_stock$
DECLARE
  v_item record;
  v_offer public.cash_register_inventory%rowtype;
  v_count integer;
  v_total bigint := 0;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'sale items required';
  END IF;
  SELECT count(*) INTO v_count FROM jsonb_array_elements(p_items) item;
  IF v_count <> (SELECT count(DISTINCT item->>'productId') FROM jsonb_array_elements(p_items) item) THEN
    RAISE EXCEPTION 'duplicate sale items';
  END IF;
  PERFORM 1 FROM public.cash_register_inventory
  WHERE cash_register_id = p_cash_register_id
    AND product_id IN (SELECT item->>'productId' FROM jsonb_array_elements(p_items) item)
  ORDER BY product_id FOR UPDATE;
  FOR v_item IN
    SELECT item->>'productId' AS product_id,
      (item->>'quantity')::integer AS quantity,
      (item->>'unitPrice')::bigint AS client_price
    FROM jsonb_array_elements(p_items) item ORDER BY item->>'productId'
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN RAISE EXCEPTION 'invalid sale quantity'; END IF;
    SELECT * INTO v_offer FROM public.cash_register_inventory
    WHERE cash_register_id = p_cash_register_id AND product_id = v_item.product_id;
    IF NOT FOUND OR NOT v_offer.active THEN RAISE EXCEPTION 'product unavailable in selected cash register'; END IF;
    IF v_offer.price <= 0 THEN RAISE EXCEPTION 'product price must be greater than zero'; END IF;
    IF v_offer.price IS DISTINCT FROM v_item.client_price THEN RAISE EXCEPTION 'cash register price changed'; END IF;
    IF v_offer.stock_quantity < v_item.quantity THEN RAISE EXCEPTION 'insufficient cash register stock'; END IF;
    v_total := v_total + v_offer.price * v_item.quantity;
    UPDATE public.cash_register_inventory SET
      stock_quantity = stock_quantity - v_item.quantity, updated_at = now()
    WHERE cash_register_id = p_cash_register_id AND product_id = v_item.product_id;
    INSERT INTO public.cash_register_stock_movements (
      cash_register_id, product_id, quantity_delta, movement_type, reason,
      actor_user_id, source_sale_id, idempotency_key)
    VALUES (p_cash_register_id, v_item.product_id, -v_item.quantity, 'sale',
      'Venta confirmada', auth.uid(), p_sale_id,
      'sale:' || p_sale_id::text || ':' || v_item.product_id);
    INSERT INTO public.sale_items (sale_id, product_id, product_name, unit_price, quantity)
    VALUES (p_sale_id, v_item.product_id,
      COALESCE(v_offer.display_name, (SELECT name FROM public.products WHERE id = v_item.product_id)),
      v_offer.price, v_item.quantity);
  END LOOP;
  IF p_total_amount IS NULL OR p_total_amount <= 0 OR v_total <> p_total_amount THEN
    RAISE EXCEPTION 'sale total mismatch';
  END IF;
END
$sale_stock$;

REVOKE ALL ON FUNCTION private.record_cash_register_sale_stock(uuid,uuid,jsonb,bigint)
  FROM PUBLIC, anon, authenticated;
