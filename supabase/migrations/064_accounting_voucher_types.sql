-- ==============================================================================
-- MIGRACIÓN 064: TIPOS DE COMPROBANTE CONTABLE Y CAUSACIÓN SEGURA DE COMPRAS
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problema que resuelve:
--   1. Los asientos se numeraban por un prefijo derivado del document_type (VTA-2026-000001,
--      COM-2026-000001...). El dueño aprobó tipos de comprobante colombianos de fácil búsqueda
--      (FV, FP, FC, NC, ND, DV, DC, RC, CI, CE, CM, TR, AI, CC, AJ, RV, CIE) con consecutivo propio.
--   2. fn_cause_purchase_accounting (048) era SECURITY DEFINER sin control de acceso, sin
--      search_path, ejecutable por anon, sin idempotencia, asentaba por código PUC fijo
--      ('1435', '2408', '2205') y descuadraba cuando la compra tenía descuento
--      (débito por el subtotal BRUTO, crédito por el total NETO).
--
-- Qué hace:
--   1. accounting_voucher_types: catálogo POR EMPRESA (17 tipos aprobados, sembrados para cada
--      empresa existente y para las nuevas por trigger). Lectura: usuarios de la empresa.
--      Escritura: solo administradores, y solo renombrar o activar/desactivar los no-system.
--      Nadie los borra.
--   2. accounting_entries.voucher_type_code (FK compuesta (company_id, code) al catálogo,
--      nullable para no romper filas anteriores) + índice (company_id, voucher_type_code, date).
--   3. fn_resolve_voucher_type_code: document_type → tipo de comprobante (SALE con sesión de caja
--      → FP, sin sesión → FV; CUSTOMER_PAYMENT a caja → RC, a banco → CI; etc.).
--   4. fn_next_accounting_consecutive (059) redefinida: consecutivo por empresa + tipo con
--      formato CODE-000123 (sin año), atómico con advisory lock como en 059.
--   5. fn_create_accounting_entry (059) redefinida con p_voucher_type_code opcional al final
--      (DROP de la firma anterior para no dejar sobrecargas ambiguas).
--   6. fn_create_manual_accounting_entry (059) acepta p_voucher_type_code: CC (defecto), AJ, CM, TR.
--   7. Trigger que completa voucher_type_code en inserciones directas (fn_reverse_accounting_entry
--      de 048 inserta sin pasar por fn_create_accounting_entry) y lo vuelve inmutable.
--   8. accounting_default_accounts: propósitos VAT_DEDUCTIBLE (2408xx) y SUPPLIERS_PAYABLE (2205xx),
--      cargados SOLO con cuentas que ya existan en el PUC (240810 o 2408; 220505 o 2205).
--   9. Causación de compras: interna (sin permisos de cliente) + envoltorio con control de acceso,
--      idempotente (índice parcial), débito de inventario por la cuenta de cada producto (062),
--      IVA descontable y proveedores desde accounting_default_accounts, comprobante FC.
--  10. Quita a anon la ejecución de fn_reverse_accounting_entry, fn_cause_payment_accounting y
--      fn_cause_receipt_accounting (048). Su control de acceso completo queda pendiente.
--
-- No borra datos. No modifica asientos existentes (los POSTED son inmutables: conservan su número
-- y quedan con voucher_type_code NULL). Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. CATÁLOGO DE TIPOS DE COMPROBANTE (por empresa)
-- ------------------------------------------------------------------------------
-- Por empresa y no global con excepciones: el nombre y el estado son decisiones de cada empresa,
-- la FK compuesta (company_id, code) impide que un asiento use un tipo de otra empresa, la RLS es la
-- misma de accounting_default_accounts y no hace falta resolver "global vs. excepción" en cada asiento.
CREATE TABLE IF NOT EXISTS public.accounting_voucher_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code VARCHAR(5) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description TEXT,
  -- document_type que el servidor asigna por defecto a este tipo (informativo; la regla vive en
  -- fn_resolve_voucher_type_code). MANUAL indica que se puede elegir en el asiento manual.
  default_document_types TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  updated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_accounting_voucher_types UNIQUE (company_id, code),
  CONSTRAINT chk_accounting_voucher_types_code CHECK (code ~ '^[A-Z]{2,5}$'),
  CONSTRAINT chk_accounting_voucher_types_name CHECK (LENGTH(BTRIM(name)) BETWEEN 3 AND 80)
);

CREATE INDEX IF NOT EXISTS idx_accounting_voucher_types_company
  ON public.accounting_voucher_types (company_id, sort_order);

ALTER TABLE public.accounting_voucher_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select accounting_voucher_types" ON public.accounting_voucher_types;
CREATE POLICY "Tenant select accounting_voucher_types" ON public.accounting_voucher_types
  FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id());

-- Solo administradores y solo tipos no-system (el trigger repite la regla para cualquier camino).
DROP POLICY IF EXISTS "Admin update accounting_voucher_types" ON public.accounting_voucher_types;
CREATE POLICY "Admin update accounting_voucher_types" ON public.accounting_voucher_types
  FOR UPDATE TO authenticated
  USING (company_id = get_auth_company_id() AND is_admin() AND is_system = false)
  WITH CHECK (company_id = get_auth_company_id() AND is_admin() AND is_system = false);
-- Sin políticas de INSERT ni DELETE: los tipos los siembra el servidor y no se borran.

REVOKE ALL ON TABLE public.accounting_voucher_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.accounting_voucher_types TO authenticated;
-- El navegador solo puede tocar el nombre y el estado.
GRANT UPDATE (name, is_active) ON TABLE public.accounting_voucher_types TO authenticated;
GRANT ALL ON TABLE public.accounting_voucher_types TO service_role;

-- Reglas de edición (aplican también a service_role salvo lo indicado):
--   código, empresa y fecha de creación nunca cambian; un tipo no se borra;
--   is_system y default_document_types solo los cambia el servidor (contexto confiable);
--   los tipos system no se renombran ni se desactivan desde una sesión de usuario.
CREATE OR REPLACE FUNCTION public.fn_guard_accounting_voucher_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_trusted BOOLEAN := public.fn_is_trusted_server_context();
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los tipos de comprobante no se eliminan (%): desactívelo si ya no se usa.', OLD.code
      USING ERRCODE = '42501';
  END IF;

  IF NEW.code IS DISTINCT FROM OLD.code OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'El código y la empresa de un tipo de comprobante no se pueden cambiar (%).', OLD.code
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_trusted THEN
    IF NEW.is_system IS DISTINCT FROM OLD.is_system
       OR NEW.default_document_types IS DISTINCT FROM OLD.default_document_types THEN
      RAISE EXCEPTION 'Solo el servidor puede cambiar la clasificación del tipo de comprobante %.', OLD.code
        USING ERRCODE = '42501';
    END IF;
    IF OLD.is_system AND (NEW.name IS DISTINCT FROM OLD.name
                          OR NEW.description IS DISTINCT FROM OLD.description
                          OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
      RAISE EXCEPTION 'El tipo de comprobante % es del sistema: no se puede renombrar ni desactivar.', OLD.code
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.name := BTRIM(NEW.name);
  NEW.created_at := OLD.created_at;
  NEW.updated_at := NOW();
  NEW.updated_by_user_id := COALESCE(auth.uid(), OLD.updated_by_user_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_accounting_voucher_type() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_accounting_voucher_type ON public.accounting_voucher_types;
CREATE TRIGGER trg_guard_accounting_voucher_type
  BEFORE UPDATE OR DELETE ON public.accounting_voucher_types
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_accounting_voucher_type();

-- Carga inicial aprobada por el dueño (una sola lista, la usan la migración y el trigger de empresas).
-- System = tipos que el servidor asigna hoy de forma automática + CC (defecto del asiento manual).
-- ON CONFLICT DO NOTHING: re-ejecutar no pisa nombres ni estados que la empresa haya cambiado.
CREATE OR REPLACE FUNCTION public.fn_seed_accounting_voucher_types(p_company_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  INSERT INTO public.accounting_voucher_types
    (company_id, code, name, description, default_document_types, is_system, is_active, sort_order)
  SELECT p_company_id, x.code, x.name, x.description, x.doc_types, x.is_system, true, x.sort_order
  FROM (VALUES
    ('FV',  'Factura de venta', 'Ventas del módulo Ventas / factura electrónica (sin sesión de caja).', ARRAY['SALE'], true, 10),
    ('FP',  'Factura POS / documento equivalente', 'Ventas registradas en el POS con sesión de caja.', ARRAY['SALE'], true, 20),
    ('FC',  'Factura de compra', 'Causación de compras a proveedores.', ARRAY['PURCHASE'], true, 30),
    ('NC',  'Nota crédito en venta', 'Notas crédito electrónicas sobre facturas de venta.', ARRAY['CREDIT_NOTE'], true, 40),
    ('ND',  'Nota débito en venta', 'Notas débito electrónicas sobre facturas de venta.', ARRAY['DEBIT_NOTE'], true, 50),
    ('DV',  'Devolución en venta', 'Devoluciones de mercancía vendida.', ARRAY['SALE_RETURN'], false, 60),
    ('DC',  'Devolución en compra', 'Devoluciones de mercancía a proveedores.', ARRAY['PURCHASE_RETURN'], false, 70),
    ('RC',  'Recibo de caja', 'Recaudos de clientes recibidos en efectivo / caja.', ARRAY['CUSTOMER_PAYMENT'], true, 80),
    ('CI',  'Comprobante de ingreso', 'Recaudos de clientes recibidos en cuentas bancarias.', ARRAY['CUSTOMER_PAYMENT'], true, 90),
    ('CE',  'Comprobante de egreso', 'Pagos a proveedores.', ARRAY['SUPPLIER_PAYMENT'], true, 100),
    ('CM',  'Caja menor', 'Movimientos de caja menor (asiento manual).', ARRAY['PETTY_CASH', 'MANUAL'], false, 110),
    ('TR',  'Traslado de fondos', 'Traslados entre caja y cuentas bancarias (asiento manual).', ARRAY['FUNDS_TRANSFER', 'TRANSFER', 'MANUAL'], false, 120),
    ('AI',  'Ajuste de inventario', 'Ajustes contables de inventario.', ARRAY['INVENTORY_ADJUSTMENT'], false, 130),
    ('CC',  'Comprobante de contabilidad', 'Asientos manuales y documentos sin tipo específico.', ARRAY['MANUAL'], true, 140),
    ('AJ',  'Ajuste contable', 'Ajustes y reclasificaciones contables.', ARRAY['ACCOUNTING_ADJUSTMENT', 'MANUAL'], false, 150),
    ('RV',  'Reversión', 'Reversión formal de un comprobante contabilizado.', ARRAY['REVERSAL'], true, 160),
    ('CIE', 'Cierre de ejercicio', 'Cierre contable anual.', ARRAY['CLOSING_ENTRY'], false, 170)
  ) AS x(code, name, description, doc_types, is_system, sort_order)
  WHERE p_company_id IS NOT NULL
  ON CONFLICT (company_id, code) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.fn_seed_accounting_voucher_types(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_seed_accounting_voucher_types(UUID) TO service_role;

SELECT public.fn_seed_accounting_voucher_types(c.id) FROM public.companies c;

-- Empresas creadas después reciben su catálogo.
CREATE OR REPLACE FUNCTION public.fn_seed_voucher_types_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.fn_seed_accounting_voucher_types(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_seed_voucher_types_for_company() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_seed_voucher_types_for_company ON public.companies;
CREATE TRIGGER trg_seed_voucher_types_for_company
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.fn_seed_voucher_types_for_company();

-- ------------------------------------------------------------------------------
-- 2. TIPO DE COMPROBANTE EN CADA ASIENTO
-- ------------------------------------------------------------------------------
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS voucher_type_code VARCHAR(5);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounting_entries_voucher_type') THEN
    -- MATCH SIMPLE: filas antiguas sin tipo (NULL) quedan válidas.
    ALTER TABLE public.accounting_entries
      ADD CONSTRAINT fk_accounting_entries_voucher_type
      FOREIGN KEY (company_id, voucher_type_code)
      REFERENCES public.accounting_voucher_types (company_id, code)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_voucher_date
  ON public.accounting_entries (company_id, voucher_type_code, date);

-- ------------------------------------------------------------------------------
-- 3. document_type → TIPO DE COMPROBANTE
-- ------------------------------------------------------------------------------
-- Si p_document_type ya es un código del catálogo de la empresa (ej. 'FC') se devuelve tal cual.
-- SALE: FP si la venta tiene sesión de caja (POS), FV si no (módulo Ventas / factura electrónica).
--   Se decide por cash_session_id porque al causar la venta POS la factura electrónica aún puede
--   no existir; la sesión de caja sí se conoce siempre y no cambia.
-- CUSTOMER_PAYMENT: RC si el recaudo entró a una cuenta de tipo CAJA_EFECTIVO o el medio es efectivo;
--   CI en cualquier otro caso (incluido no poder determinarlo).
-- Cualquier document_type desconocido (o NULL / 'AST') → CC.
-- No mira is_active: un documento automático del sistema nunca debe fallar por un tipo desactivado.
CREATE OR REPLACE FUNCTION public.fn_resolve_voucher_type_code(
  p_company_id UUID,
  p_document_type VARCHAR,
  p_document_reference VARCHAR DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_type VARCHAR := UPPER(BTRIM(COALESCE(p_document_type, 'AST')));
  v_flag BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM public.accounting_voucher_types
             WHERE company_id = p_company_id AND code = v_type) THEN
    RETURN v_type;
  END IF;

  IF v_type = 'SALE' THEN
    SELECT s.cash_session_id IS NOT NULL INTO v_flag
    FROM public.sales s
    WHERE s.company_id = p_company_id AND s.sale_number = p_document_reference
    LIMIT 1;
    RETURN CASE WHEN COALESCE(v_flag, false) THEN 'FP' ELSE 'FV' END;
  END IF;

  IF v_type = 'CUSTOMER_PAYMENT' THEN
    SELECT (UPPER(COALESCE(ba.account_type, '')) = 'CAJA_EFECTIVO'
            OR UPPER(COALESCE(r.payment_method, '')) IN ('EFECTIVO', 'CASH'))
    INTO v_flag
    FROM public.treasury_receipts r
    LEFT JOIN public.bank_accounts ba ON ba.id = r.bank_account_id
    WHERE r.company_id = p_company_id AND r.receipt_number = p_document_reference
    LIMIT 1;
    RETURN CASE WHEN COALESCE(v_flag, false) THEN 'RC' ELSE 'CI' END;
  END IF;

  RETURN CASE v_type
    WHEN 'PURCHASE' THEN 'FC'
    WHEN 'PURCHASE_RETURN' THEN 'DC'
    WHEN 'CREDIT_NOTE' THEN 'NC'
    WHEN 'DEBIT_NOTE' THEN 'ND'
    WHEN 'SALE_RETURN' THEN 'DV'
    WHEN 'SUPPLIER_PAYMENT' THEN 'CE'
    WHEN 'REVERSAL' THEN 'RV'
    WHEN 'REV' THEN 'RV'                       -- fn_reverse_accounting_entry (048) pide 'REV'
    WHEN 'MANUAL' THEN 'CC'
    WHEN 'ACCOUNTING_ADJUSTMENT' THEN 'AJ'
    WHEN 'CLOSING_ENTRY' THEN 'CIE'
    WHEN 'INVENTORY_ADJUSTMENT' THEN 'AI'
    WHEN 'PETTY_CASH' THEN 'CM'
    WHEN 'FUNDS_TRANSFER' THEN 'TR'
    WHEN 'TRANSFER' THEN 'TR'
    ELSE 'CC'
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolve_voucher_type_code(UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_voucher_type_code(UUID, VARCHAR, VARCHAR) TO service_role;

-- Inserciones directas (fn_reverse_accounting_entry de 048, scripts del servidor): se completa el tipo.
-- Una vez asignado, el tipo de un asiento no cambia (ni siquiera al reversarlo).
CREATE OR REPLACE FUNCTION public.fn_set_entry_voucher_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.voucher_type_code IS NOT NULL AND NEW.voucher_type_code IS DISTINCT FROM OLD.voucher_type_code THEN
      RAISE EXCEPTION 'El tipo de comprobante del asiento % no se puede cambiar.', OLD.entry_number
        USING ERRCODE = '23506';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.voucher_type_code IS NULL AND NEW.company_id IS NOT NULL THEN
    NEW.voucher_type_code := public.fn_resolve_voucher_type_code(
      NEW.company_id, NEW.document_type, NEW.document_reference);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_set_entry_voucher_type() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_entry_voucher_type ON public.accounting_entries;
CREATE TRIGGER trg_set_entry_voucher_type
  BEFORE INSERT OR UPDATE OF voucher_type_code ON public.accounting_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_entry_voucher_type();

-- ------------------------------------------------------------------------------
-- 4. CONSECUTIVO POR TIPO DE COMPROBANTE (reemplaza la versión de 059)
-- ------------------------------------------------------------------------------
-- Formato CODE-000123, consecutivo continuo por empresa + tipo, SIN año: el dueño pidió códigos de
-- búsqueda directa ("FC", "FC-000012"); el año ya está en la fecha del asiento, el cierre anual no
-- exige reiniciar la numeración interna y una serie continua no deja huecos ni repite números entre
-- años. La unicidad la garantiza accounting_entries_company_entry_number_key (048).
-- p_doc_type acepta un código del catálogo ('FC') o un document_type ('PURCHASE', 'REV'...).
CREATE OR REPLACE FUNCTION public.fn_next_accounting_consecutive(
    p_company_id UUID,
    p_doc_type VARCHAR DEFAULT 'AST'
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_prefix VARCHAR(60);
    v_next_val BIGINT;
    v_code VARCHAR(5);
BEGIN
    v_code := public.fn_resolve_voucher_type_code(p_company_id, COALESCE(p_doc_type, 'AST'), NULL);
    IF NOT EXISTS (
        SELECT 1 FROM public.accounting_voucher_types WHERE company_id = p_company_id AND code = v_code
    ) THEN
        RAISE EXCEPTION 'El tipo de comprobante % no está configurado para la empresa.', v_code
            USING ERRCODE = 'P0002';
    END IF;
    v_prefix := v_code || '-';

    -- Serializa la asignación por empresa + tipo hasta el fin de la transacción.
    PERFORM pg_advisory_xact_lock(hashtext('acc-consecutive:' || p_company_id::TEXT || ':' || v_prefix));

    -- 'CI-%' no incluye 'CIE-...' (el tercer carácter es '-'); el filtro por voucher_type_code usa
    -- idx_accounting_entries_voucher_date en vez de recorrer todos los asientos de la empresa.
    SELECT COALESCE(MAX(
        CASE
            WHEN entry_number ~ ('^' || v_prefix || '[0-9]+$')
            THEN SUBSTRING(entry_number FROM LENGTH(v_prefix) + 1)::BIGINT
            ELSE 0
        END
    ), 0) + 1
    INTO v_next_val
    FROM public.accounting_entries
    WHERE company_id = p_company_id
      AND voucher_type_code = v_code
      AND entry_number LIKE (v_prefix || '%');

    RETURN v_prefix || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. CREACIÓN DE ASIENTOS CON TIPO DE COMPROBANTE (copia de 059 + p_voucher_type_code)
-- ------------------------------------------------------------------------------
-- Agregar un parámetro crea una sobrecarga: se elimina la firma de 059 y queda una sola versión.
-- Todos los llamadores usan parámetros por nombre sin p_voucher_type_code (048 pagos/recaudos,
-- 059/062 ventas, 060/062 notas, 059 manual) y resuelven a esta firma por el DEFAULT NULL.
DROP FUNCTION IF EXISTS public.fn_create_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, UUID, DATE);

CREATE OR REPLACE FUNCTION public.fn_create_accounting_entry(
    p_date DATE,
    p_concept TEXT,
    p_document_type VARCHAR,
    p_document_reference VARCHAR,
    p_lines JSONB,
    p_location_id UUID DEFAULT NULL,
    p_auto_post BOOLEAN DEFAULT TRUE,
    p_company_id UUID DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_voucher_type_code VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_entry_id UUID;
    v_entry_number VARCHAR(50);
    v_line RECORD;
    v_account_id UUID;
    v_debit_sum NUMERIC(15,2) := 0.00;
    v_credit_sum NUMERIC(15,2) := 0.00;
    v_line_debit NUMERIC(15,2);
    v_line_credit NUMERIC(15,2);
    v_period_code VARCHAR(7);
    v_period_status VARCHAR(20);
    v_voucher_code VARCHAR(5);
BEGIN
    v_company_id := COALESCE(p_company_id, public.get_auth_company_id());
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Contexto multiempresa no detectado para registrar el asiento contable.';
    END IF;

    v_user_id := auth.uid();
    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users WHERE id = v_user_id;
    IF v_user_name IS NULL THEN v_user_name := 'Sistema ERP'; END IF;

    v_period_code := TO_CHAR(p_date, 'YYYY-MM');
    SELECT status INTO v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_company_id AND period_code = v_period_code;

    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'El periodo contable % se encuentra CERRADO. No es posible asentar comprobantes en meses clausurados.', v_period_code;
    END IF;

    IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'Un asiento contable requiere al menos 2 líneas para cumplir el principio de partida doble.';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        debit_amount NUMERIC,
        credit_amount NUMERIC
    ) LOOP
        v_line_debit := COALESCE(v_line.debit_amount, 0.00);
        v_line_credit := COALESCE(v_line.credit_amount, 0.00);

        IF v_line_debit < 0 OR v_line_credit < 0 THEN
            RAISE EXCEPTION 'Los valores de débito y crédito deben ser positivos o cero.';
        END IF;
        IF v_line_debit = 0 AND v_line_credit = 0 THEN
            RAISE EXCEPTION 'Cada línea contable debe tener un valor mayor a cero en Débito o Crédito.';
        END IF;

        v_debit_sum := v_debit_sum + v_line_debit;
        v_credit_sum := v_credit_sum + v_line_credit;
    END LOOP;

    IF ROUND(ABS(v_debit_sum - v_credit_sum), 2) > 0.01 THEN
        RAISE EXCEPTION 'Partida doble descuadrada: Total Débitos ($%) no es igual a Total Créditos ($%).',
            v_debit_sum, v_credit_sum;
    END IF;

    -- Tipo de comprobante: el indicado (debe existir y estar activo en la empresa) o el que
    -- corresponde al document_type.
    v_voucher_code := UPPER(NULLIF(BTRIM(p_voucher_type_code), ''));
    IF v_voucher_code IS NULL THEN
        v_voucher_code := public.fn_resolve_voucher_type_code(
            v_company_id, COALESCE(p_document_type, 'AST'), p_document_reference);
    ELSIF NOT EXISTS (
        SELECT 1 FROM public.accounting_voucher_types
        WHERE company_id = v_company_id AND code = v_voucher_code AND is_active = true
    ) THEN
        RAISE EXCEPTION 'El tipo de comprobante % no existe o está inactivo en la empresa.', v_voucher_code
            USING ERRCODE = '22023';
    END IF;

    v_entry_number := public.fn_next_accounting_consecutive(v_company_id, v_voucher_code);
    v_entry_id := gen_random_uuid();

    INSERT INTO public.accounting_entries (
        id, company_id, location_id, entry_number, date, due_date, concept,
        document_type, document_reference, voucher_type_code, status, created_by_user_id, created_at, updated_at
    ) VALUES (
        v_entry_id, v_company_id, p_location_id, v_entry_number, p_date, p_due_date, p_concept,
        p_document_type, p_document_reference, v_voucher_code, 'DRAFT', v_user_id, NOW(), NOW()
    );

    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        account_id UUID,
        account_code VARCHAR,
        debit_amount NUMERIC,
        credit_amount NUMERIC,
        third_party_doc VARCHAR,
        third_party_name VARCHAR,
        cost_center_id UUID,
        description TEXT
    ) LOOP
        -- La cuenta debe existir tal cual en el PUC: nunca se asienta en una cuenta "parecida".
        v_account_id := v_line.account_id;
        IF v_account_id IS NULL AND v_line.account_code IS NOT NULL THEN
            SELECT id INTO v_account_id
            FROM public.accounting_accounts
            WHERE code = v_line.account_code AND is_active = true
            LIMIT 1;
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'Cuenta contable con código "%" o ID no encontrada (o inactiva) en el catálogo PUC.',
                COALESCE(v_line.account_code, v_line.account_id::TEXT);
        END IF;

        INSERT INTO public.accounting_entry_lines (
            id, entry_id, account_id, third_party_doc, third_party_name,
            cost_center_id, description, debit_amount, credit_amount, due_date, created_at
        ) VALUES (
            gen_random_uuid(), v_entry_id, v_account_id, v_line.third_party_doc, v_line.third_party_name,
            v_line.cost_center_id, COALESCE(v_line.description, p_concept),
            COALESCE(v_line.debit_amount, 0.00), COALESCE(v_line.credit_amount, 0.00), p_due_date, NOW()
        );
    END LOOP;

    IF p_auto_post THEN
        UPDATE public.accounting_entries
        SET status = 'POSTED', posted_at = NOW(), updated_at = NOW()
        WHERE id = v_entry_id;
    END IF;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'ACCOUNTING_ENTRY_CREATED', 'ACCOUNTING', 'accounting_entries',
        v_entry_id, p_location_id,
        jsonb_build_object(
            'entry_id', v_entry_id,
            'entry_number', v_entry_number,
            'voucher_type_code', v_voucher_code,
            'date', p_date,
            'due_date', p_due_date,
            'concept', p_concept,
            'document_type', p_document_type,
            'total_debit', v_debit_sum,
            'total_credit', v_credit_sum,
            'status', CASE WHEN p_auto_post THEN 'POSTED' ELSE 'DRAFT' END
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'entry_id', v_entry_id,
        'entry_number', v_entry_number,
        'voucher_type_code', v_voucher_code,
        'status', CASE WHEN p_auto_post THEN 'POSTED' ELSE 'DRAFT' END,
        'total_debit', v_debit_sum,
        'total_credit', v_credit_sum,
        'date', p_date,
        'due_date', p_due_date
    );
END;
$$;

-- Igual que 059: solo el servidor y las funciones SECURITY DEFINER crean asientos y consecutivos.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('fn_create_accounting_entry', 'fn_next_accounting_consecutive')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', r.sig);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6. ASIENTO MANUAL CON TIPO DE COMPROBANTE (CC por defecto, AJ, CM, TR)
-- ------------------------------------------------------------------------------
-- Misma seguridad que 059 (accounting.post o admin, empresa del usuario autenticado, solo MANUAL).
-- Cambio de firma: se elimina la de 059 para no dejar dos versiones.
DROP FUNCTION IF EXISTS public.fn_create_manual_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, DATE);

CREATE OR REPLACE FUNCTION public.fn_create_manual_accounting_entry(
  p_date DATE,
  p_concept TEXT,
  p_document_type VARCHAR,
  p_document_reference VARCHAR,
  p_lines JSONB,
  p_location_id UUID DEFAULT NULL,
  p_auto_post BOOLEAN DEFAULT TRUE,
  p_due_date DATE DEFAULT NULL,
  p_voucher_type_code VARCHAR DEFAULT 'CC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
  v_voucher VARCHAR(5) := UPPER(COALESCE(NULLIF(BTRIM(p_voucher_type_code), ''), 'CC'));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_permission('accounting.post')) THEN
    RAISE EXCEPTION 'Acceso denegado: requiere el permiso accounting.post.' USING ERRCODE = '42501';
  END IF;
  IF UPPER(COALESCE(p_document_type, '')) <> 'MANUAL' THEN
    RAISE EXCEPTION 'Desde Contabilidad solo se registran comprobantes manuales (MANUAL). Recibido: %.', p_document_type
      USING ERRCODE = '22023';
  END IF;
  IF v_voucher NOT IN ('CC', 'AJ', 'CM', 'TR') THEN
    RAISE EXCEPTION 'Tipo de comprobante no permitido en un asiento manual: % (use CC, AJ, CM o TR).', v_voucher
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_voucher_types
    WHERE company_id = v_company AND code = v_voucher AND is_active = true
  ) THEN
    RAISE EXCEPTION 'El tipo de comprobante % está inactivo o no existe en su empresa.', v_voucher
      USING ERRCODE = '22023';
  END IF;
  IF p_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations WHERE id = p_location_id AND company_id = v_company
  ) THEN
    RAISE EXCEPTION 'La sede indicada no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;

  -- La empresa se pasa explícita (la del usuario autenticado), nunca la del cliente.
  RETURN public.fn_create_accounting_entry(
    p_date := p_date,
    p_concept := p_concept,
    p_document_type := 'MANUAL',
    p_document_reference := p_document_reference,
    p_lines := p_lines,
    p_location_id := p_location_id,
    p_auto_post := p_auto_post,
    p_company_id := v_company,
    p_due_date := p_due_date,
    p_voucher_type_code := v_voucher
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_manual_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, DATE, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_manual_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, DATE, VARCHAR) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. CUENTAS POR DEFECTO PARA COMPRAS: IVA DESCONTABLE Y PROVEEDORES
-- ------------------------------------------------------------------------------
ALTER TABLE public.accounting_default_accounts DROP CONSTRAINT IF EXISTS chk_accounting_default_accounts_purpose;
ALTER TABLE public.accounting_default_accounts ADD CONSTRAINT chk_accounting_default_accounts_purpose CHECK (purpose IN (
  'CASH', 'CUSTOMER_CREDIT', 'SALES_INCOME', 'VAT_GENERATED', 'COST_OF_SALES', 'INVENTORY',
  'SALES_RETURNS', 'FINANCIAL_INCOME',
  'VAT_DEDUCTIBLE',     -- IVA descontable en compras (2408xx)
  'SUPPLIERS_PAYABLE'   -- Proveedores nacionales por pagar (2205xx)
));

-- Copia de 059 con los dos propósitos nuevos.
CREATE OR REPLACE FUNCTION public.fn_validate_default_account_purpose()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_acc RECORD;
  v_prefix VARCHAR(4);
BEGIN
  v_prefix := CASE NEW.purpose
    WHEN 'CASH' THEN '1105'
    WHEN 'CUSTOMER_CREDIT' THEN '1305'
    WHEN 'SALES_INCOME' THEN '41'
    WHEN 'VAT_GENERATED' THEN '2408'
    WHEN 'COST_OF_SALES' THEN '61'
    WHEN 'INVENTORY' THEN '14'
    WHEN 'SALES_RETURNS' THEN '4175'
    WHEN 'FINANCIAL_INCOME' THEN '42'
    WHEN 'VAT_DEDUCTIBLE' THEN '2408'
    WHEN 'SUPPLIERS_PAYABLE' THEN '2205'
    ELSE NULL END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Propósito contable sin regla de validación: %.', NEW.purpose USING ERRCODE = '22023';
  END IF;

  SELECT code, name, is_active INTO v_acc FROM public.accounting_accounts WHERE id = NEW.accounting_account_id;
  IF NOT FOUND OR v_acc.is_active = false THEN
    RAISE EXCEPTION 'La cuenta contable para "%" no existe o está inactiva.', NEW.purpose USING ERRCODE = '23503';
  END IF;

  -- El ingreso por ventas (41) no puede ser la cuenta de devoluciones (4175), que es de naturaleza débito.
  IF v_acc.code NOT LIKE v_prefix || '%' OR (NEW.purpose = 'SALES_INCOME' AND v_acc.code LIKE '4175%') THEN
    RAISE EXCEPTION 'La cuenta % % no corresponde al propósito "%" (se espera una cuenta del grupo %).',
      v_acc.code, v_acc.name, NEW.purpose, v_prefix USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- Solo cuentas que YA existen y están activas: la más específica disponible (240810, si no 2408;
-- 220505, si no 2205). Si ninguna existe, no se carga y la causación de compras pide configurarla.
INSERT INTO public.accounting_default_accounts (company_id, purpose, accounting_account_id)
SELECT DISTINCT ON (c.id, x.purpose) c.id, x.purpose, a.id
FROM public.companies c
CROSS JOIN (VALUES
  ('VAT_DEDUCTIBLE', '240810', 1), ('VAT_DEDUCTIBLE', '2408', 2),
  ('SUPPLIERS_PAYABLE', '220505', 1), ('SUPPLIERS_PAYABLE', '2205', 2)
) AS x(purpose, code, priority)
JOIN public.accounting_accounts a ON a.code = x.code AND a.is_active = true
ORDER BY c.id, x.purpose, x.priority
ON CONFLICT (company_id, purpose) DO NOTHING;

-- Copia de 060 (versión única de la siembra para empresas nuevas) + los dos propósitos de compras.
CREATE OR REPLACE FUNCTION public.fn_seed_default_accounts_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.accounting_default_accounts (company_id, purpose, accounting_account_id)
  SELECT NEW.id, x.purpose, a.id
  FROM (VALUES ('CASH', '110505'), ('CUSTOMER_CREDIT', '130505'), ('SALES_INCOME', '4135'),
               ('VAT_GENERATED', '2408'), ('COST_OF_SALES', '6135'), ('INVENTORY', '1435'),
               ('SALES_RETURNS', '4175'), ('FINANCIAL_INCOME', '421005')) AS x(purpose, code)
  JOIN public.accounting_accounts a ON a.code = x.code AND a.is_active = true
  ON CONFLICT (company_id, purpose) DO NOTHING;

  INSERT INTO public.accounting_default_accounts (company_id, purpose, accounting_account_id)
  SELECT DISTINCT ON (x.purpose) NEW.id, x.purpose, a.id
  FROM (VALUES ('VAT_DEDUCTIBLE', '240810', 1), ('VAT_DEDUCTIBLE', '2408', 2),
               ('SUPPLIERS_PAYABLE', '220505', 1), ('SUPPLIERS_PAYABLE', '2205', 2)) AS x(purpose, code, priority)
  JOIN public.accounting_accounts a ON a.code = x.code AND a.is_active = true
  ORDER BY x.purpose, x.priority
  ON CONFLICT (company_id, purpose) DO NOTHING;

  INSERT INTO public.dian_note_sequences (company_id, environment, document_type, prefix)
  VALUES (NEW.id, 'HABILITACION', 'CREDIT_NOTE', 'NCT'), (NEW.id, 'HABILITACION', 'DEBIT_NOTE', 'NDT')
  ON CONFLICT (company_id, environment, document_type) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. CAUSACIÓN CONTABLE DE COMPRAS (reemplaza la de 048)
-- ------------------------------------------------------------------------------
-- Un solo asiento contabilizado por compra (si los datos existentes lo permiten).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.accounting_entries
    WHERE document_type = 'PURCHASE' AND status = 'POSTED'
    GROUP BY company_id, document_reference HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Hay compras con más de un asiento contabilizado (datos anteriores). No se creó uq_accounting_entries_one_posted_purchase.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entries_one_posted_purchase
      ON public.accounting_entries (company_id, document_reference)
      WHERE document_type = 'PURCHASE' AND status = 'POSTED';
  END IF;
END $$;

-- Interna (sin control de acceso: lo hace el envoltorio). Asiento FC:
--   Dr inventario por la cuenta de cada producto (062), neto de descuentos;
--   Dr IVA descontable (VAT_DEDUCTIBLE) por el IVA de la compra;
--   Cr proveedores (SUPPLIERS_PAYABLE) por el total.
-- Inventario = total - IVA (no el subtotal bruto): así cuadra también con descuentos.
CREATE OR REPLACE FUNCTION public.fn_cause_purchase_accounting_internal(p_purchase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pur RECORD;
  v_existing RECORD;
  v_supp RECORD;
  v_status VARCHAR(30);
  v_lines JSONB := '[]'::JSONB;
  v_grp RECORD;
  v_inventory_total NUMERIC(15,2);
  v_allocated NUMERIC(15,2) := 0;
  v_accounts UUID[] := ARRAY[]::UUID[];
  v_amounts NUMERIC[] := ARRAY[]::NUMERIC[];
  v_invoice_ref TEXT;
BEGIN
  SELECT * INTO v_pur FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % no encontrada para causación contable.', p_purchase_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotencia: un solo asiento contabilizado por compra.
  SELECT id, entry_number INTO v_existing
  FROM public.accounting_entries
  WHERE company_id = v_pur.company_id AND document_type = 'PURCHASE'
    AND document_reference = v_pur.purchase_number AND status = 'POSTED'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_caused', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number);
  END IF;

  v_status := UPPER(COALESCE(v_pur.inventory_status, ''));
  IF v_status IN ('', 'DRAFT', 'BORRADOR') THEN
    RAISE EXCEPTION 'La compra % está en borrador: confírmela antes de causarla.', v_pur.purchase_number
      USING ERRCODE = '22023';
  END IF;
  IF v_status IN ('CANCELLED', 'CANCELADA') THEN
    RAISE EXCEPTION 'La compra % está anulada y no se causa.', v_pur.purchase_number USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_pur.total_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'La compra % no tiene valor para causar.', v_pur.purchase_number USING ERRCODE = '22023';
  END IF;

  SELECT tax_id, name INTO v_supp
  FROM public.suppliers WHERE id = v_pur.supplier_id AND company_id = v_pur.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proveedor de la compra % no existe en la empresa.', v_pur.purchase_number
      USING ERRCODE = 'P0002';
  END IF;
  v_invoice_ref := COALESCE(NULLIF(BTRIM(v_pur.supplier_invoice_number), ''), v_pur.purchase_number);

  -- DÉBITOS DE INVENTARIO: una línea por cuenta de inventario de los productos comprados.
  v_inventory_total := v_pur.total_amount - COALESCE(v_pur.tax_amount, 0);
  IF v_inventory_total > 0 THEN
    FOR v_grp IN
      SELECT public.fn_product_inventory_account(v_pur.company_id, pi.product_id) AS account_id,
             ROUND(SUM(GREATEST(pi.subtotal - COALESCE(pi.discount_amount, 0), 0)), 2) AS net_amount
      FROM public.purchase_items pi
      WHERE pi.purchase_id = p_purchase_id
      GROUP BY 1
      ORDER BY 2 DESC, 1
    LOOP
      IF v_grp.account_id IS NULL THEN
        RAISE EXCEPTION 'Un producto de la compra % no tiene cuenta de inventario y falta la cuenta por defecto (INVENTORY).',
          v_pur.purchase_number USING ERRCODE = 'P0002';
      END IF;
      v_accounts := v_accounts || v_grp.account_id;
      v_amounts := v_amounts || v_grp.net_amount;
      v_allocated := v_allocated + v_grp.net_amount;
    END LOOP;

    IF COALESCE(array_length(v_accounts, 1), 0) = 0 THEN
      -- Compra sin líneas: todo a la cuenta de inventario por defecto.
      v_accounts := ARRAY[public.fn_get_default_account(v_pur.company_id, 'INVENTORY')];
      v_amounts := ARRAY[v_inventory_total];
    ELSE
      -- La diferencia de redondeo contra la cabecera va a la línea de mayor valor.
      v_amounts[1] := v_amounts[1] + (v_inventory_total - v_allocated);
    END IF;

    FOR i IN 1 .. array_length(v_accounts, 1) LOOP
      CONTINUE WHEN v_amounts[i] = 0;
      IF v_amounts[i] < 0 THEN
        RAISE EXCEPTION 'Los valores de la compra % no cuadran con sus líneas.', v_pur.purchase_number
          USING ERRCODE = '22023';
      END IF;
      v_lines := v_lines || jsonb_build_object(
        'account_id', v_accounts[i],
        'debit_amount', v_amounts[i], 'credit_amount', 0,
        'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
        'description', 'Entrada de mercancías compra ' || v_pur.purchase_number);
    END LOOP;
  END IF;

  IF COALESCE(v_pur.tax_amount, 0) > 0 THEN
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_pur.company_id, 'VAT_DEDUCTIBLE'),
      'debit_amount', v_pur.tax_amount, 'credit_amount', 0,
      'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
      'description', 'IVA descontable compra ' || v_pur.purchase_number);
  END IF;

  v_lines := v_lines || jsonb_build_object(
    'account_id', public.fn_get_default_account(v_pur.company_id, 'SUPPLIERS_PAYABLE'),
    'debit_amount', 0, 'credit_amount', v_pur.total_amount,
    'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
    'description', 'Cuenta por pagar a ' || v_supp.name || ' factura ' || v_invoice_ref);

  RETURN public.fn_create_accounting_entry(
    p_date := v_pur.issue_date,
    p_concept := 'Causación compra ' || v_pur.purchase_number || ' - ' || v_supp.name || ' (factura ' || v_invoice_ref || ')',
    p_document_type := 'PURCHASE',
    p_document_reference := v_pur.purchase_number,
    p_lines := v_lines,
    p_location_id := v_pur.location_id,
    p_auto_post := true,
    p_company_id := v_pur.company_id,
    p_due_date := v_pur.due_date,
    p_voucher_type_code := 'FC'
  ) || jsonb_build_object('already_caused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_purchase_accounting_internal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cause_purchase_accounting_internal(UUID) TO service_role;

-- Envoltorio público (lo llama accountingRepository.causePurchase): mismo control que la venta (059).
CREATE OR REPLACE FUNCTION public.fn_cause_purchase_accounting(p_purchase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
BEGIN
  SELECT company_id INTO v_company FROM public.purchases WHERE id = p_purchase_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Compra % no encontrada.', p_purchase_id USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Acceso denegado: la compra no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('accounting.post')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere accounting.post.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
  END IF;
  RETURN public.fn_cause_purchase_accounting_internal(p_purchase_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_purchase_accounting(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cause_purchase_accounting(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. CIERRE MÍNIMO A anon DE LAS DEMÁS RPC CONTABLES DE 048
-- ------------------------------------------------------------------------------
-- fn_reverse_accounting_entry, fn_cause_payment_accounting y fn_cause_receipt_accounting siguen
-- siendo las de 048 (SECURITY DEFINER sin control de acceso). Aquí solo se les quita a anon (sin
-- sesión no hay ningún uso legítimo); authenticated conserva el acceso que usa la aplicación.
-- Su control de acceso completo (empresa del usuario + permiso) queda pendiente de otra migración.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_reverse_accounting_entry', 'fn_cause_payment_accounting', 'fn_cause_receipt_accounting')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

COMMIT;
