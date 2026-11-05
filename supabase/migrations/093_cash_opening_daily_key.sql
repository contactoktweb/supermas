-- ==============================================================================
-- 093 · Clave diaria de apertura de caja
-- ==============================================================================
-- Hasta ahora cualquier usuario con pos.cash_register (o administrador) abría un turno
-- de caja sin control adicional. Desde esta migración abrir la caja exige la clave de
-- apertura del día, que conoce el administrador o la persona encargada de abrir cajas.
--   - Permiso nuevo pos.opening_key ("Ver la clave diaria de apertura de caja"),
--     asignado a SUPERADMIN y ADMIN.
--   - cash_opening_keys: una clave de 6 dígitos por empresa y día (fecha de Bogotá).
--     Se genera con gen_random_bytes (pgcrypto) la primera vez que alguien autorizado la
--     consulta ese día, así que se renueva sola al cambiar el día.
--   - cash_opening_key_attempts: intentos fallidos por usuario y día; con 5 fallos el
--     usuario queda bloqueado para abrir caja hasta el día siguiente.
--   - fn_get_cash_opening_key(): devuelve (o crea) la clave de hoy a quien tenga
--     pos.opening_key o sea administrador.
--   - fn_open_cash_session recibe p_opening_key y la valida para todos los usuarios,
--     administradores incluidos. Un intento fallido NO lanza excepción: devuelve
--     success=false para que el contador de intentos y la auditoría queden guardados
--     (una excepción revertiría la transacción completa).
-- Ninguna de las dos tablas es accesible directamente por los clientes: solo vía estas
-- funciones SECURITY DEFINER.
-- Re-ejecutable.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Permiso y asignación a roles administrativos
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (code, module, description)
VALUES ('pos.opening_key', 'pos', 'Ver la clave diaria de apertura de caja')
ON CONFLICT (code) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('SUPERADMIN', 'ADMIN')
  AND p.code = 'pos.opening_key'
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Tablas (sin acceso directo para clientes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_opening_keys (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    key_code TEXT NOT NULL CHECK (key_code ~ '^[0-9]{6}$'),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, business_date)
);

COMMENT ON TABLE public.cash_opening_keys IS
    'Clave diaria (fecha America/Bogota) exigida para abrir turnos de caja. Solo se accede vía funciones SECURITY DEFINER.';

CREATE TABLE IF NOT EXISTS public.cash_opening_key_attempts (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    last_failed_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, business_date)
);

COMMENT ON TABLE public.cash_opening_key_attempts IS
    'Intentos fallidos de clave de apertura por usuario y día; 5 fallos bloquean la apertura hasta el día siguiente.';

ALTER TABLE public.cash_opening_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_opening_key_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cash_opening_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cash_opening_key_attempts FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Utilidades internas
-- ------------------------------------------------------------------------------

-- Día operativo de la clave (Colombia).
CREATE OR REPLACE FUNCTION public.fn_cash_opening_key_business_date()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT (now() AT TIME ZONE 'America/Bogota')::date;
$$;

-- Clave de hoy de la empresa, creándola si aún no existe (6 dígitos criptográficamente aleatorios).
CREATE OR REPLACE FUNCTION public.fn_cash_opening_key_ensure_internal(p_company_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_date DATE := public.fn_cash_opening_key_business_date();
    v_key TEXT;
BEGIN
    INSERT INTO public.cash_opening_keys (company_id, business_date, key_code, created_by)
    VALUES (
        p_company_id,
        v_date,
        lpad(
            ((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text,
            6,
            '0'
        ),
        p_user_id
    )
    ON CONFLICT (company_id, business_date) DO NOTHING;

    SELECT key_code INTO v_key
    FROM public.cash_opening_keys
    WHERE company_id = p_company_id AND business_date = v_date;

    RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cash_opening_key_business_date() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cash_opening_key_business_date() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_cash_opening_key_ensure_internal(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cash_opening_key_ensure_internal(UUID, UUID) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. RPC: consultar la clave del día
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_cash_opening_key()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID := public.get_auth_company_id();
    v_date DATE := public.fn_cash_opening_key_business_date();
    v_key TEXT;
BEGIN
    IF v_user_id IS NULL OR v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere un usuario autenticado con empresa asignada.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('pos.opening_key') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permiso para ver la clave de apertura de caja.'
            USING ERRCODE = '42501';
    END IF;

    v_key := public.fn_cash_opening_key_ensure_internal(v_company_id, v_user_id);

    RETURN jsonb_build_object(
        'key', v_key,
        'business_date', v_date,
        'valid_until', ((v_date + 1)::timestamp AT TIME ZONE 'America/Bogota')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_cash_opening_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_cash_opening_key() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC: apertura de turno con clave del día (cambia la firma)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_open_cash_session(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.fn_open_cash_session(
    p_cash_register_id UUID,
    p_opening_float NUMERIC DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL,
    p_opening_key TEXT DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_register RECORD;
    v_session_id UUID;
    v_active_session_count INTEGER;
    v_user_active_count INTEGER;
    -- 093: clave diaria de apertura
    c_max_failed_attempts CONSTANT INTEGER := 5;
    v_business_date DATE;
    v_expected_key TEXT;
    v_given_key TEXT;
    v_failed_count INTEGER;
    v_key_ok BOOLEAN;
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

    SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Cajero';
    END IF;

    -- 093: validar la clave del día (aplica a todos, administradores incluidos).
    -- Un fallo devuelve success=false en lugar de lanzar excepción para que el intento quede registrado.
    v_business_date := public.fn_cash_opening_key_business_date();
    PERFORM pg_advisory_xact_lock(hashtext('cash_opening_key_' || v_user_id::text));

    SELECT failed_count INTO v_failed_count
    FROM public.cash_opening_key_attempts
    WHERE user_id = v_user_id AND business_date = v_business_date;

    IF COALESCE(v_failed_count, 0) >= c_max_failed_attempts THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'OPENING_KEY_LOCKED',
            'message', 'Su usuario quedó bloqueado por hoy para abrir caja tras 5 intentos fallidos con la clave. Comuníquese con el administrador.'
        );
    END IF;

    SELECT key_code INTO v_expected_key
    FROM public.cash_opening_keys
    WHERE company_id = v_company_id AND business_date = v_business_date;

    v_given_key := NULLIF(btrim(COALESCE(p_opening_key, '')), '');
    -- Se comparan resúmenes SHA-256 de igual longitud para no filtrar por tiempo cuántos dígitos coinciden.
    v_key_ok := v_expected_key IS NOT NULL
        AND v_given_key IS NOT NULL
        AND extensions.digest(v_given_key, 'sha256') = extensions.digest(v_expected_key, 'sha256');

    IF NOT v_key_ok THEN
        INSERT INTO public.cash_opening_key_attempts (user_id, business_date, failed_count, last_failed_at)
        VALUES (v_user_id, v_business_date, 1, NOW())
        ON CONFLICT (user_id, business_date) DO UPDATE
        SET failed_count = public.cash_opening_key_attempts.failed_count + 1,
            last_failed_at = NOW()
        RETURNING failed_count INTO v_failed_count;

        INSERT INTO public.audit_logs (
            company_id, user_id, user_name, action, module, entity_name, entity_id, new_value, created_at
        ) VALUES (
            v_company_id,
            v_user_id,
            v_user_name,
            'CASH_OPENING_KEY_FAILED',
            'CASH',
            'cash_registers',
            p_cash_register_id,
            jsonb_build_object('failed_attempts_today', v_failed_count),
            NOW()
        );

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_OPENING_KEY',
            'message', 'La clave de apertura no es válida. Pídasela al administrador.'
        );
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
            'notes', p_notes,
            'opening_key_verified', true
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
$function$;

REVOKE ALL ON FUNCTION public.fn_open_cash_session(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_open_cash_session(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
