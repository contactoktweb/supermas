-- ==============================================================================
-- 077_CASH_TREASURY_RPC_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Endurecimiento de las RPC de caja (046) y tesorería (047) y cierre de la escritura directa
-- sobre las tablas de caja, bancos y devoluciones.
--
-- Problema (auditoría A1/A2/A3):
--   - fn_open_cash_session, fn_record_cash_movement, fn_get_cash_session_summary,
--     fn_close_cash_session (046) y fn_create_bank_account, fn_schedule_treasury_payment,
--     fn_reconcile_bank_movement, fn_next_treasury_consecutive (047) conservaban EXECUTE para
--     PUBLIC/anon. Las de caja tomaban la empresa de la fila cuando el llamante no tenía empresa,
--     cualquier usuario de la empresa registraba movimientos o cerraba la sesión de otro cajero y
--     las de tesorería no exigían permisos.
--   - fn_create_bank_account aceptaba un saldo inicial arbitrario sin asiento contable.
--   - Las políticas permitían escribir directo (sin RPC) cash_movements, cash_sessions,
--     bank_movements, bank_accounts (saldo), returns y return_items.
--
-- Cambios (mismas firmas; cuerpos copiados de 046/047 con cambios mínimos marcados "077"):
--   1. fn_next_treasury_consecutive: solo service_role. Sus llamadores son SECURITY DEFINER
--      (se ejecutan como el propietario) y siguen funcionando.
--   2. Escritura directa cerrada para anon/authenticated: se eliminan las políticas INSERT/UPDATE
--      y se revocan los privilegios de tabla. La app escribe por las RPC SECURITY DEFINER.
--   3-6. Caja: usuario autenticado con empresa (sin fallback), permiso pos.cash_register o admin,
--      y solo el cajero dueño de la sesión o un administrador (supervisor) registra movimientos,
--      consulta el resumen o cierra. El resumen admite además contexto de servidor confiable.
--   7. fn_create_bank_account: treasury.create o admin, sede de la empresa y saldo inicial 0.
--      No existe una contrapartida contable configurada para saldos de apertura y la cuenta nace
--      sin subcuenta PUC (se asigna con fn_set_bank_account_ledger), así que no se puede causar el
--      asiento: el saldo se carga después con un recaudo/comprobante que sí lo causa.
--   8. fn_schedule_treasury_payment: treasury.create o admin.
--   9. fn_reconcile_bank_movement: empresa obligatoria (o servidor confiable) y treasury.create o admin.
--  10. EXECUTE: REVOKE PUBLIC/anon; GRANT authenticated, service_role.
--
-- Datos: no modifica filas. Re-ejecutable (CREATE OR REPLACE, DROP POLICY IF EXISTS, REVOKE/GRANT).
-- Rollback: volver a ejecutar las definiciones de 046/047 y las políticas de 023/025/044/046/047.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

-- ------------------------------------------------------------------------------
-- 1. fn_next_treasury_consecutive: solo servidor
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_next_treasury_consecutive(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_treasury_consecutive(UUID, VARCHAR) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. Escritura directa cerrada: todo pasa por las RPC SECURITY DEFINER
-- ------------------------------------------------------------------------------
-- cash_movements: solo fn_open_cash_session, fn_record_cash_movement y las ventas.
DROP POLICY IF EXISTS "Tenant isolation insert cash_movements" ON public.cash_movements;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.cash_movements FROM anon, authenticated;

-- cash_sessions: solo fn_open_cash_session / fn_close_cash_session.
DROP POLICY IF EXISTS "Tenant isolation insert cash_sessions" ON public.cash_sessions;
DROP POLICY IF EXISTS "Tenant isolation update cash_sessions" ON public.cash_sessions;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.cash_sessions FROM anon, authenticated;

-- bank_movements: solo las RPC de tesorería, recaudos, pagos y ventas.
DROP POLICY IF EXISTS "Tenant isolation insert bank_movements" ON public.bank_movements;
DROP POLICY IF EXISTS "Tenant isolation update bank_movements" ON public.bank_movements;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.bank_movements FROM anon, authenticated;

-- bank_accounts: el saldo solo lo mueven las RPC; alta por fn_create_bank_account y subcuenta PUC
-- por fn_set_bank_account_ledger. Se conserva la política DELETE (solo admin) de 023.
DROP POLICY IF EXISTS "Tenant isolation insert bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Tenant isolation update bank_accounts" ON public.bank_accounts;
REVOKE INSERT, UPDATE, TRUNCATE ON TABLE public.bank_accounts FROM anon, authenticated;

-- returns / return_items: solo fn_process_customer_return, fn_process_supplier_return y
-- fn_dispatch_damaged_return_item (return_items ya estaba revocada en 068).
DROP POLICY IF EXISTS "Tenant isolation insert returns" ON public.returns;
DROP POLICY IF EXISTS "Tenant isolation update returns" ON public.returns;
DROP POLICY IF EXISTS "Tenant isolation insert return_items" ON public.return_items;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.returns FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.return_items FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. fn_open_cash_session (046): sin fallback de empresa; pos.cash_register o admin
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_open_cash_session(
    p_cash_register_id UUID,
    p_opening_float NUMERIC(12,2) DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_register RECORD;
    v_session_id UUID;
    v_active_session_count INTEGER;
    v_user_active_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- 077: la sesión es de un usuario autenticado de una empresa; sin fallback a la empresa de la caja.
    IF v_user_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere un usuario autenticado con empresa asignada.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('pos.cash_register') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para abrir turnos de caja.'
            USING ERRCODE = '42501';
    END IF;

    IF p_opening_float < 0 THEN
        RAISE EXCEPTION 'La base inicial de apertura no puede ser negativa.'
            USING ERRCODE = '42200';
    END IF;

    -- Bloqueo pesimista de la caja
    PERFORM pg_advisory_xact_lock(hashtext('cash_register_' || p_cash_register_id::text));

    SELECT id, company_id, location_id, code, name, current_status
    INTO v_register
    FROM public.cash_registers
    WHERE id = p_cash_register_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La caja registradora especificada no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_register.company_id != v_company_id THEN
        RAISE EXCEPTION 'La caja pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- Validar que la caja no tenga ya una sesión abierta
    SELECT COUNT(*) INTO v_active_session_count
    FROM public.cash_sessions
    WHERE cash_register_id = p_cash_register_id AND status = 'OPEN';

    IF v_active_session_count > 0 THEN
        RAISE EXCEPTION 'La caja registradora "%" ya tiene una sesión abierta activa.', v_register.name
            USING ERRCODE = '42200';
    END IF;

    -- Validar que el usuario no tenga ya una sesión abierta en esta empresa
    SELECT COUNT(*) INTO v_user_active_count
    FROM public.cash_sessions
    WHERE user_id = v_user_id AND company_id = v_company_id AND status = 'OPEN';

    IF v_user_active_count > 0 THEN
        RAISE EXCEPTION 'El cajero ya tiene un turno de caja abierto en el sistema.'
            USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Cajero';
    END IF;

    v_session_id := gen_random_uuid();

    -- 1. Crear sesión de caja
    INSERT INTO public.cash_sessions (
        id,
        company_id,
        location_id,
        cash_register_id,
        user_id,
        opening_time,
        opening_float,
        expected_cash_amount,
        counted_cash_amount,
        difference_amount,
        status,
        supervisor_notes,
        created_at
    ) VALUES (
        v_session_id,
        v_company_id,
        v_register.location_id,
        p_cash_register_id,
        v_user_id,
        NOW(),
        p_opening_float,
        p_opening_float,
        NULL,
        NULL,
        'OPEN',
        p_notes,
        NOW()
    );

    -- 2. Actualizar estado de la caja registradora
    UPDATE public.cash_registers
    SET current_status = 'OPEN'
    WHERE id = p_cash_register_id;

    -- 3. Movimiento inicial si base > 0
    IF p_opening_float > 0 THEN
        INSERT INTO public.cash_movements (
            id,
            company_id,
            session_id,
            type,
            amount,
            reason,
            authorized_by_user_id,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_company_id,
            v_session_id,
            'OPENING_FLOAT',
            p_opening_float,
            'Base inicial de apertura de caja ' || v_register.code,
            v_user_id,
            NOW()
        );
    END IF;

    -- 4. Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'CASH_SESSION_OPENED',
        'CASH',
        'cash_sessions',
        v_session_id,
        v_register.location_id,
        jsonb_build_object(
            'session_id', v_session_id,
            'cash_register_id', p_cash_register_id,
            'cash_register_code', v_register.code,
            'cash_register_name', v_register.name,
            'opening_float', p_opening_float,
            'notes', p_notes
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'cash_register_id', p_cash_register_id,
        'cash_register_code', v_register.code,
        'opening_float', p_opening_float,
        'opening_time', NOW(),
        'status', 'OPEN'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. fn_record_cash_movement (046): empresa obligatoria, permiso y dueño de la sesión o admin
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_cash_movement(
    p_session_id UUID,
    p_type VARCHAR,
    p_amount NUMERIC(12,2),
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_session RECORD;
    v_movement_id UUID;
    v_current_cash NUMERIC(12,2);
    v_new_balance NUMERIC(12,2);
    v_open_float NUMERIC(12,2);
    v_total_in NUMERIC(12,2);
    v_total_out NUMERIC(12,2);
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- 077: usuario autenticado con empresa y permiso de caja (sin fallback a la empresa de la sesión).
    IF v_user_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere un usuario autenticado con empresa asignada.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('pos.cash_register') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para registrar movimientos de caja.'
            USING ERRCODE = '42501';
    END IF;

    IF p_type NOT IN ('CASH_IN', 'CASH_OUT') THEN
        RAISE EXCEPTION 'Tipo de movimiento inválido. Debe ser CASH_IN o CASH_OUT.'
            USING ERRCODE = '42200';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del movimiento debe ser estrictamente mayor a 0.'
            USING ERRCODE = '42200';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Debe especificar el motivo o justificación del movimiento de efectivo.'
            USING ERRCODE = '42200';
    END IF;

    -- Bloqueo pesimista de la sesión
    PERFORM pg_advisory_xact_lock(hashtext('cash_session_' || p_session_id::text));

    SELECT id, company_id, location_id, cash_register_id, user_id, status, opening_float
    INTO v_session
    FROM public.cash_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La sesión de caja especificada no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_session.company_id != v_company_id THEN
        RAISE EXCEPTION 'La sesión de caja pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- 077: solo el cajero dueño de la sesión o un supervisor (administrador).
    IF v_session.user_id IS DISTINCT FROM v_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo el cajero de la sesión o un administrador puede registrar movimientos en ella.'
            USING ERRCODE = '42501';
    END IF;

    IF v_session.status != 'OPEN' THEN
        RAISE EXCEPTION 'No se pueden registrar movimientos en una sesión de caja cerrada.'
            USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Cajero';
    END IF;

    -- Calcular saldo actual en efectivo
    v_open_float := COALESCE(v_session.opening_float, 0.00);

    SELECT 
        COALESCE(SUM(amount) FILTER (WHERE type IN ('CASH_IN', 'SALE_CASH')), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_OUT'), 0.00)
    INTO v_total_in, v_total_out
    FROM public.cash_movements
    WHERE session_id = p_session_id;

    v_current_cash := v_open_float + v_total_in - v_total_out;

    -- Si es retiro, validar saldo suficiente
    IF p_type = 'CASH_OUT' THEN
        IF v_current_cash < p_amount THEN
            RAISE EXCEPTION 'Saldo insuficiente en caja para realizar el retiro. Saldo disponible: %, Solicitado: %.',
                v_current_cash, p_amount
                USING ERRCODE = '42200';
        END IF;
        v_new_balance := v_current_cash - p_amount;
    ELSE
        v_new_balance := v_current_cash + p_amount;
    END IF;

    v_movement_id := gen_random_uuid();

    -- Registrar movimiento
    INSERT INTO public.cash_movements (
        id,
        company_id,
        session_id,
        type,
        amount,
        reason,
        authorized_by_user_id,
        created_at
    ) VALUES (
        v_movement_id,
        v_company_id,
        p_session_id,
        p_type,
        p_amount,
        p_reason,
        v_user_id,
        NOW()
    );

    -- Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'CASH_MOVEMENT_RECORDED',
        'CASH',
        'cash_movements',
        v_movement_id,
        v_session.location_id,
        jsonb_build_object(
            'movement_id', v_movement_id,
            'session_id', p_session_id,
            'type', p_type,
            'amount', p_amount,
            'reason', p_reason,
            'previous_balance', v_current_cash,
            'new_balance', v_new_balance
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'session_id', p_session_id,
        'type', p_type,
        'amount', p_amount,
        'reason', p_reason,
        'current_cash_balance', v_new_balance
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. fn_get_cash_session_summary (046): empresa obligatoria (o servidor), permiso y dueño o admin
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_cash_session_summary(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID;
    v_session RECORD;
    v_register RECORD;
    v_open_float NUMERIC(12,2) := 0.00;
    v_sales_cash NUMERIC(12,2) := 0.00;
    v_cash_in NUMERIC(12,2) := 0.00;
    v_cash_out NUMERIC(12,2) := 0.00;
    v_expected_cash NUMERIC(12,2) := 0.00;
    v_sales_card NUMERIC(12,2) := 0.00;
    v_sales_transfer NUMERIC(12,2) := 0.00;
    v_sales_credit NUMERIC(12,2) := 0.00;
    v_sales_mixed NUMERIC(12,2) := 0.00;
    v_total_sales NUMERIC(12,2) := 0.00;
    v_transactions_count INTEGER := 0;
    v_movements_count INTEGER := 0;
BEGIN
    v_company_id := public.get_auth_company_id();

    -- 077: usuario con empresa y permiso de caja, o contexto de servidor confiable (sin JWT).
    IF auth.uid() IS NOT NULL THEN
        IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.'
                USING ERRCODE = '42501';
        END IF;
        IF NOT (public.has_permission('pos.cash_register') OR public.is_admin()) THEN
            RAISE EXCEPTION 'No tienes permisos para consultar sesiones de caja.'
                USING ERRCODE = '42501';
        END IF;
    ELSIF NOT public.fn_is_trusted_server_context() THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.'
            USING ERRCODE = '28000';
    END IF;

    SELECT cs.*, u.full_name as cashier_name, l.name as location_name
    INTO v_session
    FROM public.cash_sessions cs
    LEFT JOIN public.users u ON u.id = cs.user_id
    LEFT JOIN public.locations l ON l.id = cs.location_id
    WHERE cs.id = p_session_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La sesión de caja especificada no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_company_id IS NOT NULL AND v_session.company_id != v_company_id THEN
        RAISE EXCEPTION 'La sesión pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- 077: solo el cajero dueño de la sesión o un supervisor (administrador).
    IF auth.uid() IS NOT NULL AND v_session.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo el cajero de la sesión o un administrador puede consultarla.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_register
    FROM public.cash_registers
    WHERE id = v_session.cash_register_id;

    v_open_float := COALESCE(v_session.opening_float, 0.00);

    -- Totales de movimientos manuales de caja y ventas en efectivo
    SELECT 
        COALESCE(SUM(amount) FILTER (WHERE type = 'SALE_CASH'), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_IN'), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_OUT'), 0.00),
        COUNT(*)
    INTO v_sales_cash, v_cash_in, v_cash_out, v_movements_count
    FROM public.cash_movements
    WHERE session_id = p_session_id;

    v_expected_cash := v_open_float + v_sales_cash + v_cash_in - v_cash_out;

    -- Desglose por método de pago de ventas vinculadas a esta sesión
    SELECT 
        COALESCE(SUM(total_amount) FILTER (WHERE payment_method IN ('CREDIT_CARD', 'DEBIT_CARD')), 0.00),
        COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'BANK_TRANSFER'), 0.00),
        COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'CREDIT'), 0.00),
        COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'MIXED'), 0.00),
        COALESCE(SUM(total_amount), 0.00),
        COUNT(*)
    INTO v_sales_card, v_sales_transfer, v_sales_credit, v_sales_mixed, v_total_sales, v_transactions_count
    FROM public.sales
    WHERE cash_session_id = p_session_id AND status != 'CANCELLED';

    RETURN jsonb_build_object(
        'session_id', v_session.id,
        'status', v_session.status,
        'cash_register_id', v_register.id,
        'cash_register_code', v_register.code,
        'cash_register_name', v_register.name,
        'cashier_name', COALESCE(v_session.cashier_name, 'Cajero'),
        'location_name', COALESCE(v_session.location_name, 'Sede Principal'),
        'opening_time', v_session.opening_time,
        'closing_time', v_session.closing_time,
        'opening_float', v_open_float,
        'sales_cash', v_sales_cash,
        'cash_in', v_cash_in,
        'cash_out', v_cash_out,
        'expected_cash_amount', v_expected_cash,
        'counted_cash_amount', v_session.counted_cash_amount,
        'difference_amount', v_session.difference_amount,
        'sales_card', v_sales_card,
        'sales_transfer', v_sales_transfer,
        'sales_credit', v_sales_credit,
        'sales_mixed', v_sales_mixed,
        'total_sales', v_total_sales,
        'transactions_count', v_transactions_count,
        'movements_count', v_movements_count,
        'supervisor_notes', v_session.supervisor_notes
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. fn_close_cash_session (046): empresa obligatoria, permiso y dueño de la sesión o admin
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_close_cash_session(
    p_session_id UUID,
    p_counted_cash_amount NUMERIC(12,2),
    p_supervisor_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_session RECORD;
    v_register RECORD;
    v_open_float NUMERIC(12,2) := 0.00;
    v_sales_cash NUMERIC(12,2) := 0.00;
    v_cash_in NUMERIC(12,2) := 0.00;
    v_cash_out NUMERIC(12,2) := 0.00;
    v_expected_cash NUMERIC(12,2) := 0.00;
    v_diff NUMERIC(12,2) := 0.00;
    v_diff_type VARCHAR(20);
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- 077: usuario autenticado con empresa y permiso de caja (sin fallback a la empresa de la sesión).
    IF v_user_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere un usuario autenticado con empresa asignada.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('pos.cash_register') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para cerrar turnos de caja.'
            USING ERRCODE = '42501';
    END IF;

    IF p_counted_cash_amount < 0 THEN
        RAISE EXCEPTION 'El monto de efectivo contado no puede ser negativo.'
            USING ERRCODE = '42200';
    END IF;

    -- Bloqueo pesimista de la sesión
    PERFORM pg_advisory_xact_lock(hashtext('cash_session_' || p_session_id::text));

    SELECT *
    INTO v_session
    FROM public.cash_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La sesión de caja especificada no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_session.company_id != v_company_id THEN
        RAISE EXCEPTION 'La sesión de caja pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- 077: solo el cajero dueño de la sesión o un supervisor (administrador).
    IF v_session.user_id IS DISTINCT FROM v_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo el cajero de la sesión o un administrador puede cerrarla.'
            USING ERRCODE = '42501';
    END IF;

    IF v_session.status != 'OPEN' THEN
        RAISE EXCEPTION 'La sesión de caja ya se encuentra cerrada.'
            USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Cajero';
    END IF;

    SELECT * INTO v_register
    FROM public.cash_registers
    WHERE id = v_session.cash_register_id;

    v_open_float := COALESCE(v_session.opening_float, 0.00);

    -- Calcular efectivo esperado
    SELECT 
        COALESCE(SUM(amount) FILTER (WHERE type = 'SALE_CASH'), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_IN'), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_OUT'), 0.00)
    INTO v_sales_cash, v_cash_in, v_cash_out
    FROM public.cash_movements
    WHERE session_id = p_session_id;

    v_expected_cash := v_open_float + v_sales_cash + v_cash_in - v_cash_out;
    v_diff := p_counted_cash_amount - v_expected_cash;

    IF v_diff = 0 THEN
        v_diff_type := 'BALANCED';
    ELSIF v_diff > 0 THEN
        v_diff_type := 'SURPLUS';
    ELSE
        v_diff_type := 'SHORTAGE';
    END IF;

    -- 1. Actualizar sesión de caja a CLOSED
    UPDATE public.cash_sessions
    SET status = 'CLOSED',
        closing_time = NOW(),
        expected_cash_amount = v_expected_cash,
        counted_cash_amount = p_counted_cash_amount,
        difference_amount = v_diff,
        supervisor_notes = p_supervisor_notes
    WHERE id = p_session_id;

    -- 2. Actualizar estado de la caja registradora a CLOSED
    UPDATE public.cash_registers
    SET current_status = 'CLOSED'
    WHERE id = v_session.cash_register_id;

    -- 3. Auditoría de cierre y arqueo
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'CASH_SESSION_CLOSED',
        'CASH',
        'cash_sessions',
        p_session_id,
        v_session.location_id,
        jsonb_build_object(
            'session_id', p_session_id,
            'cash_register_id', v_session.cash_register_id,
            'cash_register_code', v_register.code,
            'opening_float', v_open_float,
            'sales_cash', v_sales_cash,
            'cash_in', v_cash_in,
            'cash_out', v_cash_out,
            'expected_cash_amount', v_expected_cash,
            'counted_cash_amount', p_counted_cash_amount,
            'difference_amount', v_diff,
            'difference_type', v_diff_type,
            'supervisor_notes', p_supervisor_notes
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'cash_register_id', v_session.cash_register_id,
        'cash_register_code', v_register.code,
        'status', 'CLOSED',
        'closing_time', NOW(),
        'opening_float', v_open_float,
        'expected_cash_amount', v_expected_cash,
        'counted_cash_amount', p_counted_cash_amount,
        'difference_amount', v_diff,
        'difference_type', v_diff_type,
        'supervisor_notes', p_supervisor_notes
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. fn_create_bank_account (047): treasury.create, sede de la empresa y saldo inicial 0
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_bank_account(
    p_bank_name VARCHAR,
    p_account_number VARCHAR,
    p_account_type VARCHAR DEFAULT 'CORRIENTE',
    p_currency VARCHAR DEFAULT 'COP',
    p_initial_balance NUMERIC(15,2) DEFAULT 0.00,
    p_location_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_account_id UUID;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_user_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    -- 077: permiso de tesorería.
    IF NOT (public.is_admin() OR public.has_permission('treasury.create')) THEN
        RAISE EXCEPTION 'Acceso denegado: crear cuentas bancarias requiere el permiso treasury.create.'
            USING ERRCODE = '42501';
    END IF;

    -- 077: la sede debe ser de la empresa.
    IF p_location_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.locations l WHERE l.id = p_location_id AND l.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'La sede indicada no existe en su empresa.' USING ERRCODE = '42501';
    END IF;

    IF p_bank_name IS NULL OR TRIM(p_bank_name) = '' THEN
        RAISE EXCEPTION 'El nombre del banco es obligatorio.' USING ERRCODE = '42200';
    END IF;

    IF p_account_number IS NULL OR TRIM(p_account_number) = '' THEN
        RAISE EXCEPTION 'El número de cuenta bancaria es obligatorio.' USING ERRCODE = '42200';
    END IF;

    -- 077: el saldo nace en 0. Un saldo inicial sin asiento descuadra bancos frente a contabilidad y
    -- la cuenta aún no tiene subcuenta PUC (se asigna después con fn_set_bank_account_ledger); el
    -- saldo se carga con un recaudo o comprobante que cause su asiento.
    IF COALESCE(p_initial_balance, 0) <> 0 THEN
        RAISE EXCEPTION 'La cuenta bancaria se crea con saldo 0. Registre el saldo inicial con un recaudo o comprobante contable.'
            USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_account_id := gen_random_uuid();

    -- 1. Crear cuenta bancaria
    INSERT INTO public.bank_accounts (
        id,
        company_id,
        location_id,
        bank_name,
        account_number,
        account_type,
        currency,
        current_balance,
        is_active,
        description,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_account_id,
        v_company_id,
        p_location_id,
        TRIM(p_bank_name),
        TRIM(p_account_number),
        COALESCE(p_account_type, 'CORRIENTE'),
        COALESCE(p_currency, 'COP'),
        0.00,
        true,
        p_description,
        v_user_id,
        NOW(),
        NOW()
    );

    -- 2. (077) Sin movimiento de apertura: la cuenta nace con saldo 0.

    -- 3. Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'BANK_ACCOUNT_CREATED',
        'TREASURY',
        'bank_accounts',
        v_account_id,
        p_location_id,
        jsonb_build_object(
            'account_id', v_account_id,
            'bank_name', p_bank_name,
            'account_number', p_account_number,
            'initial_balance', 0.00
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'bank_account_id', v_account_id,
        'bank_name', p_bank_name,
        'account_number', p_account_number,
        'current_balance', 0.00
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. fn_schedule_treasury_payment (047): treasury.create
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_schedule_treasury_payment(
    p_supplier_id UUID,
    p_bank_account_id UUID,
    p_amount NUMERIC(15,2),
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_due_date DATE DEFAULT NULL,
    p_purchase_id UUID DEFAULT NULL,
    p_payment_method VARCHAR DEFAULT 'TRANSFERENCIA',
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_payment_id UUID;
    v_payment_number VARCHAR(50);
    v_supplier RECORD;
    v_bank RECORD;
    v_purchase RECORD;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_user_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    -- 077: permiso de tesorería (mismo criterio que fn_execute_treasury_payment en 073).
    IF NOT (public.is_admin() OR public.has_permission('treasury.create')) THEN
        RAISE EXCEPTION 'Acceso denegado: programar pagos requiere el permiso treasury.create.'
            USING ERRCODE = '42501';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser estrictamente mayor a 0.'
            USING ERRCODE = '42200';
    END IF;

    -- Validar proveedor
    SELECT id, company_id, name, legal_name, tax_id
    INTO v_supplier
    FROM public.suppliers
    WHERE id = p_supplier_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El proveedor especificado no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_supplier.company_id != v_company_id THEN
        RAISE EXCEPTION 'El proveedor pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    -- Validar cuenta bancaria
    SELECT id, company_id, location_id, bank_name, account_number, is_active
    INTO v_bank
    FROM public.bank_accounts
    WHERE id = p_bank_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta bancaria especificada no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_bank.company_id != v_company_id THEN
        RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    -- Validar compra si se especifica
    IF p_purchase_id IS NOT NULL THEN
        SELECT id, company_id, purchase_number, total_amount, paid_amount
        INTO v_purchase
        FROM public.purchases
        WHERE id = p_purchase_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La factura de compra especificada no existe.' USING ERRCODE = '23503';
        END IF;
        IF v_purchase.company_id != v_company_id THEN
            RAISE EXCEPTION 'La compra pertenece a otra empresa.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_payment_id := gen_random_uuid();
    v_payment_number := public.fn_next_treasury_consecutive(v_company_id, 'PAYMENT');

    INSERT INTO public.treasury_payments (
        id,
        company_id,
        location_id,
        payment_number,
        payment_type,
        purchase_id,
        supplier_id,
        bank_account_id,
        amount,
        payment_date,
        due_date,
        payment_method,
        reference_number,
        status,
        notes,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_payment_id,
        v_company_id,
        v_bank.location_id,
        v_payment_number,
        'SUPPLIER_PAYMENT',
        p_purchase_id,
        p_supplier_id,
        p_bank_account_id,
        p_amount,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_due_date,
        COALESCE(p_payment_method, 'TRANSFERENCIA'),
        p_reference_number,
        'SCHEDULED',
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    );

    -- Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'TREASURY_PAYMENT_SCHEDULED',
        'TREASURY',
        'treasury_payments',
        v_payment_id,
        v_bank.location_id,
        jsonb_build_object(
            'payment_id', v_payment_id,
            'payment_number', v_payment_number,
            'supplier_id', p_supplier_id,
            'amount', p_amount,
            'purchase_id', p_purchase_id
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'payment_number', v_payment_number,
        'amount', p_amount,
        'status', 'SCHEDULED'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. fn_reconcile_bank_movement (047): empresa obligatoria (o servidor) y treasury.create
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_reconcile_bank_movement(
    p_movement_id UUID,
    p_reconciled BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_mov RECORD;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- 077: usuario con empresa y permiso de tesorería, o contexto de servidor confiable (sin JWT).
    IF v_user_id IS NOT NULL THEN
        IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
        END IF;
        IF NOT (public.is_admin() OR public.has_permission('treasury.create')) THEN
            RAISE EXCEPTION 'Acceso denegado: conciliar movimientos requiere el permiso treasury.create.' USING ERRCODE = '42501';
        END IF;
    ELSIF NOT public.fn_is_trusted_server_context() THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    SELECT *
    INTO v_mov
    FROM public.bank_movements
    WHERE id = p_movement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El movimiento bancario especificado no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_company_id IS NOT NULL AND v_mov.company_id != v_company_id THEN
        RAISE EXCEPTION 'El movimiento bancario pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    UPDATE public.bank_movements
    SET is_reconciled = p_reconciled,
        reconciled_at = CASE WHEN p_reconciled THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_movement_id;

    -- Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_mov.company_id,
        v_user_id,
        v_user_name,
        'BANK_MOVEMENT_RECONCILED',
        'TREASURY',
        'bank_movements',
        p_movement_id,
        v_mov.location_id,
        jsonb_build_object(
            'movement_id', p_movement_id,
            'movement_number', v_mov.movement_number,
            'is_reconciled', p_reconciled
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', p_movement_id,
        'movement_number', v_mov.movement_number,
        'is_reconciled', p_reconciled
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Privilegios EXECUTE explícitos
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_open_cash_session(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_open_cash_session(UUID, NUMERIC, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_record_cash_movement(UUID, VARCHAR, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_cash_movement(UUID, VARCHAR, NUMERIC, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_get_cash_session_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_cash_session_summary(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_close_cash_session(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_close_cash_session(UUID, NUMERIC, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_create_bank_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMERIC, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_bank_account(VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMERIC, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_schedule_treasury_payment(UUID, UUID, NUMERIC, DATE, DATE, UUID, VARCHAR, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_schedule_treasury_payment(UUID, UUID, NUMERIC, DATE, DATE, UUID, VARCHAR, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_reconcile_bank_movement(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_bank_movement(UUID, BOOLEAN) TO authenticated, service_role;

COMMIT;
