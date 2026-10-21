-- ==============================================================================
-- 069_PRICE_APPROVAL_NOTIFICATIONS.sql
-- ERP SUPER MÁS S.A.S. - Aprobación administrativa de precios con notificaciones
--
-- Regla del dueño: cuando un usuario sin permiso de aprobar (p. ej. JEFE DE
-- INGRESOS Y SALIDAS OPERATIVA) cambia un precio, el cambio NO se aplica: queda
-- una solicitud PENDIENTE y se notifica a los administradores de la empresa.
--
-- Completa lo creado en 057 (price_change_requests, fn_request_price_change,
-- fn_review_price_change) sin reconstruir el RBAC:
--   1. Bloqueo en la BASE: un usuario sin 'prices.approve' no puede escribir el
--      precio vigente (products.public_sale_price / wholesale_price ni
--      product_prices.price). Antes, cualquier rol con 'inventory.adjust'
--      (JEFE_INGRESOS_SALIDAS, ENCARGADA_VENTA) podía cambiarlo directamente.
--   2. RPC única fn_submit_price_changes: el aprobador aplica directo (auditado);
--      el resto crea solicitudes PENDIENTES con motivo obligatorio, variación y
--      costo de referencia, y notifica a ADMIN/SUPERADMIN de la empresa.
--   3. fn_review_price_change endurecida: misma empresa, usuario activo, sin
--      autoaprobación, motivo obligatorio al rechazar, aplicación atómica
--      (incluye listas que aún no existían), auditoría y aviso al solicitante.
--   4. Tabla mínima public.user_notifications (no existía una tabla de avisos por
--      usuario: system_alerts es por empresa) + fn_mark_notifications_read.
--   5. price_change_requests solo se escribe mediante las RPC; el solicitante ve
--      solo sus solicitudes y el aprobador todas las de su empresa.
--   6. Auditoría de cambios en product_prices.
--
-- No modifica usuarios, roles, permisos ni datos existentes. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. Columnas de soporte en price_change_requests (057)
-- ------------------------------------------------------------------------------
ALTER TABLE public.price_change_requests
    ADD COLUMN IF NOT EXISTS request_group_id UUID,
    ADD COLUMN IF NOT EXISTS variation_percent NUMERIC(9,2),
    ADD COLUMN IF NOT EXISTS cost_at_request NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS list_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS requested_by_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS reviewed_by_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS price_at_review NUMERIC(15,2);

COMMENT ON COLUMN public.price_change_requests.request_group_id IS
    'Agrupa las listas de precio enviadas en una misma solicitud del formulario.';
COMMENT ON COLUMN public.price_change_requests.variation_percent IS
    'Variación porcentual del precio propuesto frente al vigente al solicitar (NULL si el vigente era 0).';
COMMENT ON COLUMN public.price_change_requests.cost_at_request IS
    'Costo del producto al momento de la solicitud, para calcular el margen en la bandeja.';
COMMENT ON COLUMN public.price_change_requests.price_at_review IS
    'Precio vigente al momento de aprobar o rechazar (detecta cambios intermedios).';

CREATE INDEX IF NOT EXISTS idx_price_change_requests_company_status_date
    ON public.price_change_requests (company_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_change_requests_requester_date
    ON public.price_change_requests (requested_by, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_change_requests_group
    ON public.price_change_requests (request_group_id)
    WHERE request_group_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Tabla mínima de notificaciones por usuario
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO'
        CHECK (severity IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    link_path VARCHAR(300),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_date
    ON public.user_notifications (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_unread
    ON public.user_notifications (recipient_user_id)
    WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_entity
    ON public.user_notifications (entity_type, entity_id);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients read their own notifications" ON public.user_notifications;
CREATE POLICY "Recipients read their own notifications"
ON public.user_notifications
FOR SELECT
TO authenticated
USING (recipient_user_id = auth.uid());

-- Escritura solo mediante funciones SECURITY DEFINER.
REVOKE ALL ON TABLE public.user_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_notifications TO authenticated;
GRANT ALL ON TABLE public.user_notifications TO service_role;

-- ------------------------------------------------------------------------------
-- 3. RLS de price_change_requests: lectura acotada y escritura solo por RPC
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read price change requests in their company" ON public.price_change_requests;
DROP POLICY IF EXISTS "Requesters and approvers read price change requests" ON public.price_change_requests;
CREATE POLICY "Requesters and approvers read price change requests"
ON public.price_change_requests
FOR SELECT
TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (
        requested_by = auth.uid()
        OR public.has_permission('prices.approve')
    )
);

DROP POLICY IF EXISTS "Users with prices.request can insert price requests" ON public.price_change_requests;
DROP POLICY IF EXISTS "Users with prices.approve can update price requests" ON public.price_change_requests;

REVOKE ALL ON TABLE public.price_change_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.price_change_requests TO authenticated;
GRANT ALL ON TABLE public.price_change_requests TO service_role;

-- ------------------------------------------------------------------------------
-- 4. Funciones internas (no invocables por clientes)
-- ------------------------------------------------------------------------------

-- 4.1 ¿El usuario de la sesión puede aprobar/aplicar precios? (activo + prices.approve; ADMIN/SUPERADMIN incluidos)
CREATE OR REPLACE FUNCTION public.fn_price_caller_can_approve()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.is_active = true
    )
    AND public.has_permission('prices.approve');
$$;

REVOKE ALL ON FUNCTION public.fn_price_caller_can_approve() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_price_caller_can_approve() TO service_role;

-- 4.2 Formato de moneda COP para los mensajes ($12.500)
CREATE OR REPLACE FUNCTION public.fn_format_cop(p_value NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
    SELECT '$' || replace(to_char(round(COALESCE(p_value, 0)), 'FM999,999,999,999,990'), ',', '.');
$$;

REVOKE ALL ON FUNCTION public.fn_format_cop(NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_format_cop(NUMERIC) TO service_role;

-- 4.3 Precio vigente de una lista (product_prices; si no existe, columnas planas para NORMAL/MAYORISTA)
CREATE OR REPLACE FUNCTION public.fn_current_list_price(
    p_product_id UUID,
    p_price_list_code VARCHAR,
    OUT current_price NUMERIC,
    OUT current_list_name VARCHAR,
    OUT list_exists BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    SELECT pp.price, pp.price_list_name
    INTO current_price, current_list_name
    FROM public.product_prices pp
    WHERE pp.product_id = p_product_id
      AND pp.price_list_code = p_price_list_code;

    IF FOUND THEN
        list_exists := true;
        RETURN;
    END IF;

    list_exists := false;
    IF p_price_list_code = 'NORMAL' THEN
        SELECT p.public_sale_price INTO current_price FROM public.products p WHERE p.id = p_product_id;
        current_list_name := 'Precio Normal (Público)';
        list_exists := true; -- la columna plana es el precio vigente aunque falte la fila de lista
    ELSIF p_price_list_code = 'MAYORISTA' THEN
        SELECT p.wholesale_price INTO current_price FROM public.products p WHERE p.id = p_product_id;
        current_list_name := 'Precio Mayorista';
        list_exists := true;
    ELSE
        current_price := 0;
        current_list_name := NULL;
    END IF;

    current_price := COALESCE(current_price, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_current_list_price(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_current_list_price(UUID, VARCHAR) TO service_role;

-- 4.4 Aplica un precio de forma atómica (lista + columna plana). Solo se invoca desde RPC que ya validaron al aprobador.
CREATE OR REPLACE FUNCTION public.fn_apply_price_change_internal(
    p_company_id UUID,
    p_product_id UUID,
    p_price_list_code VARCHAR,
    p_price_list_name VARCHAR,
    p_price NUMERIC,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_meta JSONB := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
    UPDATE public.product_prices
    SET price = p_price,
        updated_at = NOW()
    WHERE product_id = p_product_id
      AND price_list_code = p_price_list_code;

    IF NOT FOUND THEN
        INSERT INTO public.product_prices (
            company_id, product_id, price_list_code, price_list_name, price,
            min_quantity, is_default, is_active, start_date, end_date
        ) VALUES (
            p_company_id,
            p_product_id,
            p_price_list_code,
            COALESCE(NULLIF(BTRIM(p_price_list_name), ''), 'Precio ' || p_price_list_code),
            p_price,
            GREATEST(COALESCE((v_meta ->> 'min_quantity')::INTEGER, 1), 1),
            p_price_list_code = 'NORMAL',
            COALESCE((v_meta ->> 'is_active')::BOOLEAN, true),
            NULLIF(v_meta ->> 'start_date', '')::TIMESTAMPTZ,
            NULLIF(v_meta ->> 'end_date', '')::TIMESTAMPTZ
        );
    END IF;

    IF p_price_list_code = 'NORMAL' THEN
        UPDATE public.products
        SET public_sale_price = p_price, updated_at = NOW()
        WHERE id = p_product_id;
    ELSIF p_price_list_code = 'MAYORISTA' THEN
        UPDATE public.products
        SET wholesale_price = p_price, updated_at = NOW()
        WHERE id = p_product_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_price_change_internal(UUID, UUID, VARCHAR, VARCHAR, NUMERIC, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_price_change_internal(UUID, UUID, VARCHAR, VARCHAR, NUMERIC, JSONB) TO service_role;

-- 4.5 Notifica a todos los aprobadores activos de la empresa (ADMIN, SUPERADMIN o rol con prices.approve)
CREATE OR REPLACE FUNCTION public.fn_notify_price_approvers(
    p_company_id UUID,
    p_exclude_user_id UUID,
    p_title VARCHAR,
    p_message TEXT,
    p_entity_id UUID,
    p_link_path VARCHAR,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO public.user_notifications (
        company_id, recipient_user_id, type, severity, title, message,
        entity_type, entity_id, link_path, metadata
    )
    SELECT
        p_company_id, u.id, 'PRICE_APPROVAL_REQUEST', 'WARNING', p_title, p_message,
        'price_change_request', p_entity_id, p_link_path, COALESCE(p_metadata, '{}'::jsonb)
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.company_id = p_company_id
      AND u.is_active = true
      AND u.id IS DISTINCT FROM p_exclude_user_id
      AND (
          r.code IN ('ADMIN', 'SUPERADMIN')
          OR EXISTS (
              SELECT 1
              FROM public.role_permissions rp
              JOIN public.permissions pm ON pm.id = rp.permission_id
              WHERE rp.role_id = u.role_id
                AND pm.code = 'prices.approve'
          )
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notify_price_approvers(UUID, UUID, VARCHAR, TEXT, UUID, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notify_price_approvers(UUID, UUID, VARCHAR, TEXT, UUID, VARCHAR, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. Bloqueo en la base: el precio vigente solo lo escribe un aprobador
--    (auth.uid() nulo = procesos del sistema / service_role / migraciones)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_product_price_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF (NEW.public_sale_price IS DISTINCT FROM OLD.public_sale_price
        OR NEW.wholesale_price IS DISTINCT FROM OLD.wholesale_price)
       AND NOT public.fn_price_caller_can_approve() THEN
        RAISE EXCEPTION 'Los cambios de precio requieren aprobación del administrador. Registre una solicitud de cambio de precio.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_product_price_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_product_price_columns ON public.products;
CREATE TRIGGER trg_guard_product_price_columns
    BEFORE UPDATE OF public_sale_price, wholesale_price ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_product_price_columns();

CREATE OR REPLACE FUNCTION public.fn_guard_product_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF auth.uid() IS NULL OR public.fn_price_caller_can_approve() THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.price IS DISTINCT FROM OLD.price
           OR NEW.price_list_code IS DISTINCT FROM OLD.price_list_code
           OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
            RAISE EXCEPTION 'Los cambios de precio requieren aprobación del administrador. Registre una solicitud de cambio de precio.'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        -- Un upsert sobre una lista existente se resuelve como UPDATE (validado arriba).
        IF EXISTS (
            SELECT 1 FROM public.product_prices pp
            WHERE pp.product_id = NEW.product_id
              AND pp.price_list_code = NEW.price_list_code
        ) THEN
            RETURN NEW;
        END IF;
        -- Lista nueva: solo durante el alta inicial del producto (precio de creación).
        IF EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = NEW.product_id
              AND p.created_at < NOW() - INTERVAL '30 minutes'
        ) THEN
            RAISE EXCEPTION 'Agregar una lista de precios a un producto existente requiere aprobación del administrador.'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    ELSE
        -- Borrado en cascada del producto: el producto ya no existe y se permite.
        IF EXISTS (SELECT 1 FROM public.products p WHERE p.id = OLD.product_id) THEN
            RAISE EXCEPTION 'Eliminar una lista de precios requiere permisos de aprobación de precios.'
                USING ERRCODE = '42501';
        END IF;
        RETURN OLD;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_product_prices() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_product_prices ON public.product_prices;
CREATE TRIGGER trg_guard_product_prices
    BEFORE INSERT OR UPDATE OR DELETE ON public.product_prices
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_product_prices();

-- ------------------------------------------------------------------------------
-- 6. Auditoría de product_prices (altas, cambios de precio/estado y bajas)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_product_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_name VARCHAR(150);
    v_action VARCHAR(50);
    v_row public.product_prices%ROWTYPE;
    v_request_id TEXT := NULLIF(current_setting('supermas.price_request_id', true), '');
    v_new JSONB;
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.price IS NOT DISTINCT FROM OLD.price
       AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
        RETURN NEW;
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name INTO v_user_name FROM public.users u WHERE u.id = v_user_id;
        IF NOT FOUND THEN v_user_id := NULL; END IF;
    END IF;
    v_user_name := COALESCE(NULLIF(BTRIM(v_user_name), ''), 'Sistema');

    IF TG_OP = 'DELETE' THEN
        v_row := OLD;
        v_action := 'PRODUCT_PRICE_DELETED';
    ELSE
        v_row := NEW;
        v_action := CASE WHEN TG_OP = 'INSERT' THEN 'PRODUCT_PRICE_CREATED' ELSE 'PRODUCT_PRICE_CHANGED' END;
    END IF;

    v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    IF v_new IS NOT NULL AND v_request_id IS NOT NULL THEN
        v_new := v_new || jsonb_build_object('price_change_request_id', v_request_id);
    END IF;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id,
        previous_value, new_value, created_at
    ) VALUES (
        v_row.company_id, v_user_id, v_user_name, v_action, 'CATALOG', 'product_prices',
        v_row.product_id::TEXT,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        v_new,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_audit_product_prices() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_product_prices ON public.product_prices;
CREATE TRIGGER trg_audit_product_prices
    AFTER INSERT OR UPDATE OR DELETE ON public.product_prices
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_product_prices();

-- ------------------------------------------------------------------------------
-- 7. RPC: fn_submit_price_changes
--    p_changes: [{ "price_list_code": "NORMAL", "proposed_price": 12500,
--                  "price_list_name"?: "...", "min_quantity"?: 1, "is_active"?: true,
--                  "start_date"?: "...", "end_date"?: "..." }, ...]
--    Aprobador  -> aplica directo y audita (mode = APPLIED).
--    Solicitante (prices.request) -> solicitudes PENDING + aviso a aprobadores (mode = PENDING).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_submit_price_changes(
    p_product_id UUID,
    p_changes JSONB,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_user RECORD;
    v_user_name VARCHAR(150);
    v_product RECORD;
    v_can_approve BOOLEAN;
    v_reason TEXT := NULLIF(BTRIM(p_reason), '');
    v_change JSONB;
    v_code VARCHAR(30);
    v_raw_code TEXT;
    v_name VARCHAR(100);
    v_price NUMERIC(15,2);
    v_meta JSONB;
    v_current RECORD;
    v_variation NUMERIC(9,2);
    v_group UUID := gen_random_uuid();
    v_request_id UUID;
    v_request_ids UUID[] := ARRAY[]::UUID[];
    v_seen TEXT[] := ARRAY[]::TEXT[];
    v_applied JSONB := '[]'::jsonb;
    v_lines TEXT[] := ARRAY[]::TEXT[];
    v_notified INTEGER := 0;
    v_title VARCHAR(200);
    v_message TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    SELECT u.id, u.company_id, u.is_active, u.full_name, u.email
    INTO v_user
    FROM public.users u
    WHERE u.id = v_uid;

    IF NOT FOUND OR v_user.is_active IS NOT TRUE OR v_user.company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: usuario inactivo o sin empresa asignada.' USING ERRCODE = '42501';
    END IF;
    v_user_name := COALESCE(NULLIF(BTRIM(v_user.full_name), ''), v_user.email);

    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'Debe indicar el producto.' USING ERRCODE = '22023';
    END IF;

    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array' OR jsonb_array_length(p_changes) = 0 THEN
        RAISE EXCEPTION 'Debe indicar al menos un cambio de precio.' USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(p_changes) > 20 THEN
        RAISE EXCEPTION 'Demasiadas listas de precio en una sola solicitud (máximo 20).' USING ERRCODE = '22023';
    END IF;

    -- Serializa cambios concurrentes sobre el mismo producto.
    SELECT p.id, p.company_id, p.name, p.sku, p.cost_price
    INTO v_product
    FROM public.products p
    WHERE p.id = p_product_id
    FOR UPDATE;

    IF NOT FOUND OR v_product.company_id <> v_user.company_id THEN
        RAISE EXCEPTION 'El producto no existe en su empresa.' USING ERRCODE = 'P0002';
    END IF;

    v_can_approve := public.fn_price_caller_can_approve();

    IF NOT v_can_approve AND NOT public.has_permission('prices.request') THEN
        RAISE EXCEPTION 'Acceso denegado: no tiene permiso para proponer cambios de precio.' USING ERRCODE = '42501';
    END IF;

    IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
        RAISE EXCEPTION 'El motivo no puede superar 500 caracteres.' USING ERRCODE = '22023';
    END IF;

    IF NOT v_can_approve AND (v_reason IS NULL OR char_length(v_reason) < 5) THEN
        RAISE EXCEPTION 'El motivo del cambio de precio es obligatorio (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    FOR v_change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
        IF jsonb_typeof(v_change) <> 'object' THEN
            RAISE EXCEPTION 'Formato de cambio de precio inválido.' USING ERRCODE = '22023';
        END IF;

        v_raw_code := UPPER(BTRIM(COALESCE(v_change ->> 'price_list_code', '')));
        IF v_raw_code = '' OR char_length(v_raw_code) > 30 OR v_raw_code !~ '^[A-Z0-9_-]+$' THEN
            RAISE EXCEPTION 'Código de lista de precios inválido: "%".', v_raw_code USING ERRCODE = '22023';
        END IF;
        v_code := v_raw_code;

        IF v_code = ANY (v_seen) THEN
            RAISE EXCEPTION 'La lista de precios % está repetida en la solicitud.', v_code USING ERRCODE = '22023';
        END IF;
        v_seen := array_append(v_seen, v_code::TEXT);

        BEGIN
            v_price := ROUND((v_change ->> 'proposed_price')::NUMERIC, 2);
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Precio propuesto inválido para la lista %.', v_code USING ERRCODE = '22023';
        END;

        IF v_price IS NULL OR v_price < 0 THEN
            RAISE EXCEPTION 'El precio propuesto para la lista % debe ser mayor o igual a 0.', v_code USING ERRCODE = '22023';
        END IF;

        -- Metadatos solo para listas nuevas (cantidad mínima, estado y vigencia).
        BEGIN
            v_meta := jsonb_strip_nulls(jsonb_build_object(
                'min_quantity', GREATEST(COALESCE((v_change ->> 'min_quantity')::INTEGER, 1), 1),
                'is_active', COALESCE((v_change ->> 'is_active')::BOOLEAN, true),
                'start_date', (NULLIF(v_change ->> 'start_date', '')::TIMESTAMPTZ)::TEXT,
                'end_date', (NULLIF(v_change ->> 'end_date', '')::TIMESTAMPTZ)::TEXT
            ));
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Datos de la lista % inválidos (cantidad mínima, estado o vigencia).', v_code USING ERRCODE = '22023';
        END;

        SELECT * INTO v_current FROM public.fn_current_list_price(p_product_id, v_code);

        -- Sin cambio real de precio: se omite.
        IF v_current.list_exists AND v_current.current_price = v_price THEN
            CONTINUE;
        END IF;
        IF NOT v_current.list_exists AND v_price = 0 THEN
            CONTINUE;
        END IF;

        v_name := COALESCE(
            v_current.current_list_name,
            LEFT(NULLIF(BTRIM(v_change ->> 'price_list_name'), ''), 100),
            'Precio ' || v_code
        );

        -- Acotada al rango de la columna NUMERIC(9,2) para precios vigentes casi nulos.
        v_variation := CASE
            WHEN v_current.current_price > 0
                THEN LEAST(GREATEST(
                    ROUND((v_price - v_current.current_price) / v_current.current_price * 100, 2),
                    -9999999.99), 9999999.99)
            ELSE NULL
        END;

        IF v_can_approve THEN
            PERFORM public.fn_apply_price_change_internal(
                v_product.company_id, p_product_id, v_code, v_name, v_price, v_meta
            );
            v_applied := v_applied || jsonb_build_array(jsonb_build_object(
                'price_list_code', v_code,
                'price_list_name', v_name,
                'previous_price', v_current.current_price,
                'new_price', v_price,
                'variation_percent', v_variation
            ));
        ELSE
            IF EXISTS (
                SELECT 1 FROM public.price_change_requests r
                WHERE r.product_id = p_product_id
                  AND r.price_list_code = v_code
                  AND r.status = 'PENDING'
            ) THEN
                RAISE EXCEPTION 'Ya existe una solicitud pendiente para "%" de este producto. Espere la decisión del administrador.', v_name
                    USING ERRCODE = '23505';
            END IF;

            INSERT INTO public.price_change_requests (
                company_id, product_id, price_list_code, price_list_name,
                previous_price, proposed_price, status, requested_by, requested_by_name,
                reason, request_group_id, variation_percent, cost_at_request, list_metadata
            ) VALUES (
                v_product.company_id, p_product_id, v_code, v_name,
                v_current.current_price, v_price, 'PENDING', v_uid, v_user_name,
                v_reason, v_group, v_variation, v_product.cost_price, v_meta
            )
            RETURNING id INTO v_request_id;

            v_request_ids := array_append(v_request_ids, v_request_id);
            v_lines := array_append(v_lines, format(
                '%s: de %s a %s%s',
                v_name,
                public.fn_format_cop(v_current.current_price),
                public.fn_format_cop(v_price),
                CASE WHEN v_variation IS NULL THEN ''
                     ELSE format(' (%s%s %%)', CASE WHEN v_variation > 0 THEN '+' ELSE '' END, v_variation)
                END
            ));
        END IF;
    END LOOP;

    -- Aplicación directa por un aprobador
    IF v_can_approve THEN
        IF jsonb_array_length(v_applied) = 0 THEN
            RETURN jsonb_build_object(
                'success', true, 'mode', 'NO_CHANGES', 'status', 'NO_CHANGES',
                'message', 'Los precios indicados son iguales a los vigentes.'
            );
        END IF;

        INSERT INTO public.audit_logs (
            company_id, user_id, user_name, action, module, entity_name, entity_id, new_value, created_at
        ) VALUES (
            v_product.company_id, v_uid, v_user_name, 'PRICE_CHANGE_APPLIED_DIRECT', 'CATALOG', 'products',
            p_product_id::TEXT,
            jsonb_build_object('changes', v_applied, 'reason', v_reason, 'sku', v_product.sku),
            NOW()
        );

        RETURN jsonb_build_object(
            'success', true,
            'mode', 'APPLIED',
            'status', 'APPROVED',
            'applied', v_applied,
            'message', 'Precio actualizado y registrado en auditoría.'
        );
    END IF;

    IF COALESCE(array_length(v_request_ids, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'success', true, 'mode', 'NO_CHANGES', 'status', 'NO_CHANGES',
            'message', 'Los precios indicados son iguales a los vigentes.'
        );
    END IF;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, new_value, created_at
    ) VALUES (
        v_product.company_id, v_uid, v_user_name, 'PRICE_CHANGE_REQUESTED', 'CATALOG', 'price_change_requests',
        v_request_ids[1]::TEXT,
        jsonb_build_object(
            'request_ids', to_jsonb(v_request_ids),
            'request_group_id', v_group,
            'product_id', p_product_id,
            'sku', v_product.sku,
            'reason', v_reason,
            'changes', to_jsonb(v_lines)
        ),
        NOW()
    );

    v_title := LEFT(format('Aprobación de precio: %s', v_product.name), 200);
    v_message := format(
        '%s solicita cambiar el precio de %s (SKU %s). %s. Motivo: %s',
        v_user_name, v_product.name, v_product.sku, array_to_string(v_lines, '; '), v_reason
    );

    v_notified := public.fn_notify_price_approvers(
        v_product.company_id,
        v_uid,
        v_title,
        v_message,
        v_request_ids[1],
        '/aprobaciones-precios?solicitud=' || v_request_ids[1]::TEXT,
        jsonb_build_object(
            'request_ids', to_jsonb(v_request_ids),
            'request_group_id', v_group,
            'product_id', p_product_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'mode', 'PENDING',
        'status', 'PENDING',
        'request_id', v_request_ids[1],
        'request_ids', to_jsonb(v_request_ids),
        'notified_approvers', v_notified,
        'message', 'Solicitud de cambio de precio enviada. El precio se aplicará cuando un administrador la apruebe.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_submit_price_changes(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_submit_price_changes(UUID, JSONB, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC 057 fn_request_price_change: misma firma, delega en fn_submit_price_changes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_request_price_change(
    p_product_id UUID,
    p_price_list_code VARCHAR,
    p_proposed_price NUMERIC,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN public.fn_submit_price_changes(
        p_product_id,
        jsonb_build_array(jsonb_build_object(
            'price_list_code', p_price_list_code,
            'proposed_price', p_proposed_price
        )),
        p_reason
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_request_price_change(UUID, VARCHAR, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_request_price_change(UUID, VARCHAR, NUMERIC, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. RPC 057 fn_review_price_change endurecida (misma firma)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_review_price_change(
    p_request_id UUID,
    p_approved BOOLEAN,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_user RECORD;
    v_user_name VARCHAR(150);
    v_req RECORD;
    v_product RECORD;
    v_current RECORD;
    v_notes TEXT := NULLIF(BTRIM(p_review_notes), '');
    v_status VARCHAR(20);
    v_title VARCHAR(200);
    v_message TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    SELECT u.id, u.company_id, u.is_active, u.full_name, u.email
    INTO v_user
    FROM public.users u
    WHERE u.id = v_uid;

    IF NOT FOUND OR v_user.is_active IS NOT TRUE OR v_user.company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: usuario inactivo o sin empresa asignada.' USING ERRCODE = '42501';
    END IF;
    v_user_name := COALESCE(NULLIF(BTRIM(v_user.full_name), ''), v_user.email);

    IF NOT public.fn_price_caller_can_approve() THEN
        RAISE EXCEPTION 'Acceso denegado: solo un administrador puede aprobar o rechazar cambios de precio.'
            USING ERRCODE = '42501';
    END IF;

    IF p_approved IS NULL THEN
        RAISE EXCEPTION 'Debe indicar si aprueba o rechaza la solicitud.' USING ERRCODE = '22023';
    END IF;

    IF v_notes IS NOT NULL AND char_length(v_notes) > 500 THEN
        RAISE EXCEPTION 'La observación no puede superar 500 caracteres.' USING ERRCODE = '22023';
    END IF;

    IF NOT p_approved AND (v_notes IS NULL OR char_length(v_notes) < 5) THEN
        RAISE EXCEPTION 'El motivo del rechazo es obligatorio (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_req
    FROM public.price_change_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND OR v_req.company_id <> v_user.company_id THEN
        RAISE EXCEPTION 'La solicitud de cambio de precio no existe.' USING ERRCODE = 'P0002';
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'La solicitud ya fue procesada anteriormente (estado actual: %).', v_req.status
            USING ERRCODE = '55000';
    END IF;

    IF v_req.requested_by = v_uid THEN
        RAISE EXCEPTION 'Acceso denegado: no está permitido aprobar o rechazar una solicitud de precio creada por usted mismo.'
            USING ERRCODE = '42501';
    END IF;

    SELECT p.id, p.name, p.sku
    INTO v_product
    FROM public.products p
    WHERE p.id = v_req.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto de la solicitud ya no existe.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_current FROM public.fn_current_list_price(v_req.product_id, v_req.price_list_code);

    IF p_approved THEN
        PERFORM set_config('supermas.price_request_id', p_request_id::TEXT, true);
        PERFORM public.fn_apply_price_change_internal(
            v_req.company_id, v_req.product_id, v_req.price_list_code,
            v_req.price_list_name, v_req.proposed_price, v_req.list_metadata
        );
        PERFORM set_config('supermas.price_request_id', '', true);
        v_status := 'APPROVED';
    ELSE
        v_status := 'REJECTED';
    END IF;

    UPDATE public.price_change_requests
    SET status = v_status,
        reviewed_by = v_uid,
        reviewed_by_name = v_user_name,
        reviewed_at = NOW(),
        review_notes = v_notes,
        price_at_review = v_current.current_price,
        updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id,
        previous_value, new_value, created_at
    ) VALUES (
        v_req.company_id, v_uid, v_user_name,
        CASE WHEN p_approved THEN 'PRICE_CHANGE_APPROVED' ELSE 'PRICE_CHANGE_REJECTED' END,
        'CATALOG', 'price_change_requests', p_request_id::TEXT,
        jsonb_build_object(
            'status', 'PENDING',
            'price_list_code', v_req.price_list_code,
            'previous_price', v_req.previous_price,
            'price_at_review', v_current.current_price
        ),
        jsonb_build_object(
            'status', v_status,
            'product_id', v_req.product_id,
            'sku', v_product.sku,
            'price_list_code', v_req.price_list_code,
            'proposed_price', v_req.proposed_price,
            'requested_by', v_req.requested_by,
            'review_notes', v_notes
        ),
        NOW()
    );

    -- Aviso al solicitante
    IF p_approved THEN
        v_title := LEFT(format('Precio aprobado: %s', v_product.name), 200);
        v_message := format(
            '%s aprobó %s de %s: %s (antes %s).%s',
            v_user_name, v_req.price_list_name, v_product.name,
            public.fn_format_cop(v_req.proposed_price), public.fn_format_cop(v_current.current_price),
            CASE WHEN v_notes IS NULL THEN '' ELSE ' Observación: ' || v_notes END
        );
    ELSE
        v_title := LEFT(format('Precio rechazado: %s', v_product.name), 200);
        v_message := format(
            '%s rechazó el cambio de %s de %s a %s. Motivo: %s',
            v_user_name, v_req.price_list_name, v_product.name,
            public.fn_format_cop(v_req.proposed_price), v_notes
        );
    END IF;

    INSERT INTO public.user_notifications (
        company_id, recipient_user_id, type, severity, title, message,
        entity_type, entity_id, link_path, metadata
    )
    SELECT
        v_req.company_id, v_req.requested_by, 'PRICE_APPROVAL_RESULT',
        CASE WHEN p_approved THEN 'SUCCESS' ELSE 'WARNING' END,
        v_title, v_message, 'price_change_request', p_request_id,
        '/aprobaciones-precios?vista=mias&solicitud=' || p_request_id::TEXT,
        jsonb_build_object('status', v_status, 'product_id', v_req.product_id)
    FROM public.users u
    WHERE u.id = v_req.requested_by;

    -- Cuando ya no quedan pendientes en el grupo, los avisos a aprobadores dejan de contar como no leídos.
    IF v_req.request_group_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.price_change_requests r
        WHERE r.request_group_id = v_req.request_group_id
          AND r.status = 'PENDING'
    ) THEN
        UPDATE public.user_notifications
        SET read_at = NOW()
        WHERE company_id = v_req.company_id
          AND type = 'PRICE_APPROVAL_REQUEST'
          AND read_at IS NULL
          AND metadata ->> 'request_group_id' = v_req.request_group_id::TEXT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_status,
        'product_id', v_req.product_id,
        'price_list_code', v_req.price_list_code,
        'applied_price', CASE WHEN p_approved THEN v_req.proposed_price ELSE NULL END,
        'message', CASE WHEN p_approved
            THEN 'Cambio de precio aprobado y aplicado al catálogo.'
            ELSE 'Solicitud de cambio de precio rechazada.'
        END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_review_price_change(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_review_price_change(UUID, BOOLEAN, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. RPC: marcar notificaciones propias como leídas (NULL = todas)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_mark_notifications_read(
    p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_count INTEGER := 0;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    IF p_notification_ids IS NOT NULL AND cardinality(p_notification_ids) > 200 THEN
        RAISE EXCEPTION 'Demasiadas notificaciones en una sola operación (máximo 200).' USING ERRCODE = '22023';
    END IF;

    UPDATE public.user_notifications
    SET read_at = NOW()
    WHERE recipient_user_id = v_uid
      AND read_at IS NULL
      AND (p_notification_ids IS NULL OR id = ANY (p_notification_ids));

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_mark_notifications_read(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mark_notifications_read(UUID[]) TO authenticated, service_role;

COMMIT;
