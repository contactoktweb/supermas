-- ============================================================================
-- MIGRACIÓN 046: Cajas, Arqueos, Sesiones y Movimientos de Efectivo Atómicos
-- ============================================================================

-- 1. Asegurar Aislamiento Multiempresa en Cajas Registradoras
ALTER TABLE public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_code_key;
ALTER TABLE public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_company_code_key;
ALTER TABLE public.cash_registers ADD CONSTRAINT cash_registers_company_code_key UNIQUE (company_id, code);

-- 2. Asegurar company_id en cash_movements
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Backfill company_id en cash_movements desde cash_sessions
UPDATE public.cash_movements cm
SET company_id = cs.company_id
FROM public.cash_sessions cs
WHERE cm.session_id = cs.id AND cm.company_id IS NULL;

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_cash_sessions_company_status ON public.cash_sessions (company_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_status ON public.cash_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON public.cash_movements (session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_company ON public.cash_movements (company_id);

-- 4. RLS Políticas actualizadas para cash_movements
DROP POLICY IF EXISTS "Tenant isolation insert cash_movements" ON public.cash_movements;
CREATE POLICY "Tenant isolation insert cash_movements" ON public.cash_movements
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id = public.get_auth_company_id() OR
        EXISTS (
            SELECT 1 FROM public.cash_sessions cs
            WHERE cs.id = cash_movements.session_id
              AND cs.company_id = public.get_auth_company_id()
        )
    );

DROP POLICY IF EXISTS "Tenant isolation select cash_movements" ON public.cash_movements;
CREATE POLICY "Tenant isolation select cash_movements" ON public.cash_movements
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id() OR
        EXISTS (
            SELECT 1 FROM public.cash_sessions cs
            WHERE cs.id = cash_movements.session_id
              AND cs.company_id = public.get_auth_company_id()
        )
    );

-- 5. RPC: fn_open_cash_session (Apertura de turno de caja)
CREATE OR REPLACE FUNCTION public.fn_open_cash_session(
    p_cash_register_id UUID,
    p_opening_float NUMERIC(12,2) DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.cash_registers WHERE id = p_cash_register_id;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('pos.cash_register') OR public.has_permission('pos.access') OR public.is_admin()) THEN
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


-- 6. RPC: fn_record_cash_movement (Ingreso o Retiro manual de efectivo en sesión)
CREATE OR REPLACE FUNCTION public.fn_record_cash_movement(
    p_session_id UUID,
    p_type VARCHAR,
    p_amount NUMERIC(12,2),
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

    IF v_company_id IS NULL THEN
        v_company_id := v_session.company_id;
    END IF;

    IF v_session.company_id != v_company_id THEN
        RAISE EXCEPTION 'La sesión de caja pertenece a otra empresa.'
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


-- 7. RPC: fn_get_cash_session_summary (Cálculo fiduciario de totales de turno y arqueo)
CREATE OR REPLACE FUNCTION public.fn_get_cash_session_summary(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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


-- 8. RPC: fn_close_cash_session (Arqueo y Cierre de turno de caja)
CREATE OR REPLACE FUNCTION public.fn_close_cash_session(
    p_session_id UUID,
    p_counted_cash_amount NUMERIC(12,2),
    p_supervisor_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

    IF v_company_id IS NULL THEN
        v_company_id := v_session.company_id;
    END IF;

    IF v_session.company_id != v_company_id THEN
        RAISE EXCEPTION 'La sesión de caja pertenece a otra empresa.'
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
