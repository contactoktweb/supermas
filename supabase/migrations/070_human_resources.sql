-- ==============================================================================
-- 070_HUMAN_RESOURCES.sql
-- ERP SUPER MÁS S.A.S. - Módulo de Recursos Humanos
--
-- Alcance (extensión aditiva, no reconstruye el RBAC de 057):
--   1. Permisos hr.read, hr.manage, hr.documents y hr.sensitive para RECURSOS_HUMANOS
--      y ADMIN (SUPERADMIN pasa por is_admin()). Ningún otro rol los recibe.
--   2. Estructura organizacional: hr_areas, hr_positions.
--   3. Empleados (hr_employees) con datos de seguridad social y contrato; el número de
--      cuenta bancaria vive aparte (hr_employee_bank_accounts) y solo se lee con
--      hr.sensitive; en la ficha general queda enmascarado (****1234).
--   4. Historial laboral inmutable (hr_employment_events): ingreso, cambios de cargo,
--      salario, sede y contrato, retiro y reingreso. Los campos laborales solo cambian
--      mediante las RPC de este archivo, que dejan el evento.
--   5. Documentos (hr_documents) con archivos en el bucket PRIVADO hr-documents
--      (PDF/JPG/PNG, máx. 5 MB, ruta empresa/empleado/archivo, URL firmada corta).
--   6. Novedades (hr_novelties): permisos, licencias, incapacidades, ausencias,
--      calamidad y suspensiones, con aprobación.
--   7. Vacaciones: periodos de causación (15 días hábiles por año de servicio,
--      Art. 186 CST, proporcional por fracción), solicitudes con aprobación, asignación
--      FIFO a los periodos más antiguos, alertas (periodo causado sin disfrutar y
--      crítica al acercarse a 2 periodos acumulados, Art. 190 CST), notificaciones a
--      RRHH/ADMIN en user_notifications (069) y bloqueo del retiro con vacaciones
--      pendientes salvo compensación en dinero registrada con motivo (Art. 189 CST).
--   8. Festivos de Colombia 2026 y 2027 (Ley 51 de 1983, "Ley Emiliani") para contar
--      días hábiles (excluye domingos y festivos).
--
-- No modifica usuarios, roles existentes ni datos. No calcula nómina. Re-ejecutable.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. Permisos del módulo (solo RECURSOS_HUMANOS y ADMIN)
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (code, module, description)
VALUES
    ('hr.read', 'hr', 'Consultar empleados, estructura organizacional, novedades, vacaciones y reportes de personal'),
    ('hr.manage', 'hr', 'Crear y actualizar empleados, ingresos, retiros, novedades, vacaciones, áreas y cargos'),
    ('hr.documents', 'hr', 'Cargar, consultar y archivar documentos de los empleados'),
    ('hr.sensitive', 'hr', 'Consultar y modificar datos sensibles del empleado (cuenta bancaria completa)')
ON CONFLICT (code) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

-- Ningún rol distinto de ADMIN, RECURSOS_HUMANOS (y SUPERADMIN heredado) conserva permisos hr.*
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.code IN ('hr.read', 'hr.manage', 'hr.documents', 'hr.sensitive')
  AND r.code NOT IN ('ADMIN', 'RECURSOS_HUMANOS', 'SUPERADMIN');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('ADMIN', 'RECURSOS_HUMANOS')
  AND p.code IN ('hr.read', 'hr.manage', 'hr.documents', 'hr.sensitive')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Funciones base de acceso
-- ------------------------------------------------------------------------------

-- Fecha operativa en Colombia
CREATE OR REPLACE FUNCTION public.fn_hr_today()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT (now() AT TIME ZONE 'America/Bogota')::date;
$$;

-- ¿El usuario de la sesión está activo, tiene empresa y el permiso indicado? (ADMIN/SUPERADMIN por has_permission)
CREATE OR REPLACE FUNCTION public.fn_hr_can(p_permission VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT p_permission IN ('hr.read', 'hr.manage', 'hr.documents', 'hr.sensitive')
       AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.is_active = true
              AND u.company_id IS NOT NULL
       )
       AND public.has_permission(p_permission);
$$;

-- Exige el permiso y devuelve la empresa del usuario (uso interno de las RPC)
CREATE OR REPLACE FUNCTION public.fn_hr_require(p_permission VARCHAR)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    IF NOT public.fn_hr_can(p_permission) THEN
        RAISE EXCEPTION 'Acceso denegado: no tiene permiso para esta operación de Recursos Humanos.'
            USING ERRCODE = '42501';
    END IF;

    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa no identificada para el usuario.' USING ERRCODE = '42501';
    END IF;

    RETURN v_company_id;
END;
$$;

-- Activa o desactiva el modo interno (solo dentro de las RPC de este módulo)
CREATE OR REPLACE FUNCTION public.fn_hr_set_internal(p_on BOOLEAN)
RETURNS VOID
LANGUAGE sql
SET search_path = pg_catalog, public
AS $$
    SELECT set_config('app.hr_internal', CASE WHEN p_on THEN 'on' ELSE 'off' END, true);
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_is_internal()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(current_setting('app.hr_internal', true), 'off') = 'on';
$$;

-- Subconjunto de llaves de un JSONB
CREATE OR REPLACE FUNCTION public.fn_hr_jsonb_subset(p_value JSONB, p_keys TEXT[])
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each(COALESCE(p_value, '{}'::jsonb)) e
    WHERE e.key = ANY (COALESCE(p_keys, ARRAY[]::TEXT[]));
$$;

-- Nombre del usuario de la sesión para auditoría
CREATE OR REPLACE FUNCTION public.fn_hr_actor_name()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(NULLIF(btrim(u.full_name), ''), 'Sistema')
    FROM (SELECT 1) x
    LEFT JOIN public.users u ON u.id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 3. Festivos de Colombia y días hábiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_holidays (
    holiday_date DATE PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    original_date DATE,
    is_moved_to_monday BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hr_holidays IS
    'Festivos nacionales de Colombia (Ley 51 de 1983). Se usan para contar días hábiles de vacaciones y novedades.';

INSERT INTO public.hr_holidays (holiday_date, name, original_date, is_moved_to_monday) VALUES
    -- 2026 (Domingo de Pascua: 5 de abril)
    ('2026-01-01', 'Año Nuevo', '2026-01-01', false),
    ('2026-01-12', 'Día de los Reyes Magos', '2026-01-06', true),
    ('2026-03-23', 'Día de San José', '2026-03-19', true),
    ('2026-04-02', 'Jueves Santo', '2026-04-02', false),
    ('2026-04-03', 'Viernes Santo', '2026-04-03', false),
    ('2026-05-01', 'Día del Trabajo', '2026-05-01', false),
    ('2026-05-18', 'Ascensión del Señor', '2026-05-14', true),
    ('2026-06-08', 'Corpus Christi', '2026-06-04', true),
    ('2026-06-15', 'Sagrado Corazón de Jesús', '2026-06-12', true),
    ('2026-06-29', 'San Pedro y San Pablo', '2026-06-29', false),
    ('2026-07-20', 'Día de la Independencia', '2026-07-20', false),
    ('2026-08-07', 'Batalla de Boyacá', '2026-08-07', false),
    ('2026-08-17', 'Asunción de la Virgen', '2026-08-15', true),
    ('2026-10-12', 'Día de la Diversidad Étnica y Cultural', '2026-10-12', false),
    ('2026-11-02', 'Día de Todos los Santos', '2026-11-01', true),
    ('2026-11-16', 'Independencia de Cartagena', '2026-11-11', true),
    ('2026-12-08', 'Inmaculada Concepción', '2026-12-08', false),
    ('2026-12-25', 'Navidad', '2026-12-25', false),
    -- 2027 (Domingo de Pascua: 28 de marzo)
    ('2027-01-01', 'Año Nuevo', '2027-01-01', false),
    ('2027-01-11', 'Día de los Reyes Magos', '2027-01-06', true),
    ('2027-03-22', 'Día de San José', '2027-03-19', true),
    ('2027-03-25', 'Jueves Santo', '2027-03-25', false),
    ('2027-03-26', 'Viernes Santo', '2027-03-26', false),
    ('2027-05-01', 'Día del Trabajo', '2027-05-01', false),
    ('2027-05-10', 'Ascensión del Señor', '2027-05-06', true),
    ('2027-05-31', 'Corpus Christi', '2027-05-27', true),
    ('2027-06-07', 'Sagrado Corazón de Jesús', '2027-06-04', true),
    ('2027-07-05', 'San Pedro y San Pablo', '2027-06-29', true),
    ('2027-07-20', 'Día de la Independencia', '2027-07-20', false),
    ('2027-08-07', 'Batalla de Boyacá', '2027-08-07', false),
    ('2027-08-16', 'Asunción de la Virgen', '2027-08-15', true),
    ('2027-10-18', 'Día de la Diversidad Étnica y Cultural', '2027-10-12', true),
    ('2027-11-01', 'Día de Todos los Santos', '2027-11-01', false),
    ('2027-11-15', 'Independencia de Cartagena', '2027-11-11', true),
    ('2027-12-08', 'Inmaculada Concepción', '2027-12-08', false),
    ('2027-12-25', 'Navidad', '2027-12-25', false)
ON CONFLICT (holiday_date) DO UPDATE
SET name = EXCLUDED.name,
    original_date = EXCLUDED.original_date,
    is_moved_to_monday = EXCLUDED.is_moved_to_monday;

ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read hr holidays" ON public.hr_holidays;
CREATE POLICY "Authenticated read hr holidays"
ON public.hr_holidays
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON TABLE public.hr_holidays FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.hr_holidays TO authenticated;
GRANT ALL ON TABLE public.hr_holidays TO service_role;

-- ¿Hay festivos registrados para todos los años del rango?
CREATE OR REPLACE FUNCTION public.fn_hr_holidays_cover(p_start DATE, p_end DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT NOT EXISTS (
        SELECT 1
        FROM generate_series(
            extract(year FROM LEAST(p_start, p_end))::int,
            extract(year FROM GREATEST(p_start, p_end))::int
        ) y
        WHERE NOT EXISTS (
            SELECT 1 FROM public.hr_holidays h
            WHERE extract(year FROM h.holiday_date)::int = y
        )
    );
$$;

-- Días hábiles entre dos fechas (inclusive): excluye domingos y festivos de Colombia
CREATE OR REPLACE FUNCTION public.fn_hr_business_days(p_start DATE, p_end DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT CASE
        WHEN p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN 0
        ELSE (
            SELECT count(*)::int
            FROM generate_series(p_start, p_end, interval '1 day') g(d)
            WHERE extract(isodow FROM g.d) <> 7
              AND NOT EXISTS (SELECT 1 FROM public.hr_holidays h WHERE h.holiday_date = g.d::date)
        )
    END;
$$;

-- Siguiente día hábil posterior a una fecha (fecha de reintegro)
CREATE OR REPLACE FUNCTION public.fn_hr_next_business_day(p_date DATE)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_day DATE := p_date + 1;
BEGIN
    FOR i IN 1..30 LOOP
        IF extract(isodow FROM v_day) <> 7
           AND NOT EXISTS (SELECT 1 FROM public.hr_holidays h WHERE h.holiday_date = v_day) THEN
            RETURN v_day;
        END IF;
        v_day := v_day + 1;
    END LOOP;
    RETURN v_day;
END;
$$;

-- Días entre fechas (inclusive) con año comercial de 360 días (meses de 30 días)
CREATE OR REPLACE FUNCTION public.fn_hr_days360(p_start DATE, p_end DATE)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
    d1 INT;
    d2 INT;
BEGIN
    IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
        RETURN 0;
    END IF;

    d1 := LEAST(extract(day FROM p_start)::int, 30);
    d2 := extract(day FROM p_end)::int;
    -- El último día del mes cuenta como día 30 (febrero incluido)
    IF (p_end + 1) = date_trunc('month', p_end + 1)::date THEN
        d2 := 30;
    END IF;
    d2 := LEAST(d2, 30);

    RETURN (extract(year FROM p_end)::int - extract(year FROM p_start)::int) * 360
         + (extract(month FROM p_end)::int - extract(month FROM p_start)::int) * 30
         + (d2 - d1) + 1;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Estructura organizacional
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code VARCHAR(20),
    name VARCHAR(120) NOT NULL CHECK (char_length(btrim(name)) >= 2),
    description VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_areas_company_name ON public.hr_areas (company_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_areas_company_code ON public.hr_areas (company_id, upper(code)) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.hr_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    area_id UUID REFERENCES public.hr_areas(id) ON DELETE RESTRICT,
    code VARCHAR(20),
    name VARCHAR(120) NOT NULL CHECK (char_length(btrim(name)) >= 2),
    description VARCHAR(500),
    arl_risk_class SMALLINT CHECK (arl_risk_class IS NULL OR arl_risk_class BETWEEN 1 AND 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_positions_company_name ON public.hr_positions (company_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_positions_company_code ON public.hr_positions (company_id, upper(code)) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hr_positions_area ON public.hr_positions (area_id);

-- ------------------------------------------------------------------------------
-- 5. Empleados
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    employee_code VARCHAR(20) NOT NULL,

    -- Identificación y datos personales
    document_type VARCHAR(5) NOT NULL CHECK (document_type IN ('CC', 'CE', 'TI', 'PA', 'PEP', 'PPT')),
    document_number VARCHAR(20) NOT NULL CHECK (document_number ~ '^[A-Z0-9-]{3,20}$'),
    first_name VARCHAR(80) NOT NULL CHECK (char_length(btrim(first_name)) >= 2),
    last_name VARCHAR(80) NOT NULL CHECK (char_length(btrim(last_name)) >= 2),
    birth_date DATE CHECK (birth_date IS NULL OR birth_date > DATE '1900-01-01'),
    email VARCHAR(150) CHECK (email IS NULL OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    phone VARCHAR(30),
    address VARCHAR(200),
    city VARCHAR(80),
    department VARCHAR(80),
    emergency_contact_name VARCHAR(120),
    emergency_contact_phone VARCHAR(30),
    emergency_contact_relationship VARCHAR(50),

    -- Seguridad social y entidades
    eps VARCHAR(100),
    afp VARCHAR(100),
    arl VARCHAR(100),
    arl_risk_class SMALLINT CHECK (arl_risk_class IS NULL OR arl_risk_class BETWEEN 1 AND 5),
    ccf VARCHAR(100),
    severance_fund VARCHAR(100),

    -- Datos bancarios (el número completo vive en hr_employee_bank_accounts)
    bank_name VARCHAR(80),
    bank_account_type VARCHAR(12) CHECK (bank_account_type IS NULL OR bank_account_type IN ('AHORROS', 'CORRIENTE', 'DEPOSITO')),
    bank_account_masked VARCHAR(20),

    -- Condiciones laborales (solo cambian por RPC con evento en el historial)
    contract_type VARCHAR(30) NOT NULL CHECK (contract_type IN (
        'INDEFINIDO', 'TERMINO_FIJO', 'OBRA_LABOR', 'APRENDIZAJE', 'PRESTACION_SERVICIOS'
    )),
    contract_end_date DATE,
    hire_date DATE NOT NULL,
    salary NUMERIC(15,2) NOT NULL CHECK (salary >= 0),
    salary_type VARCHAR(12) NOT NULL DEFAULT 'ORDINARIO' CHECK (salary_type IN ('ORDINARIO', 'INTEGRAL')),
    work_schedule VARCHAR(20) NOT NULL DEFAULT 'TIEMPO_COMPLETO' CHECK (work_schedule IN (
        'TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'POR_HORAS', 'TURNOS'
    )),
    weekly_hours NUMERIC(5,2) CHECK (weekly_hours IS NULL OR (weekly_hours > 0 AND weekly_hours <= 60)),
    position_id UUID NOT NULL REFERENCES public.hr_positions(id) ON DELETE RESTRICT,
    area_id UUID REFERENCES public.hr_areas(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
    manager_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,

    -- Estado y retiro
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'EN_VACACIONES', 'INCAPACITADO', 'RETIRADO')),
    termination_date DATE,
    termination_cause VARCHAR(40) CHECK (termination_cause IS NULL OR termination_cause IN (
        'RENUNCIA_VOLUNTARIA', 'DESPIDO_JUSTA_CAUSA', 'DESPIDO_SIN_JUSTA_CAUSA', 'MUTUO_ACUERDO',
        'VENCIMIENTO_TERMINO_FIJO', 'TERMINACION_OBRA_LABOR', 'PERIODO_PRUEBA', 'PENSION',
        'FALLECIMIENTO', 'OTRA'
    )),
    termination_reason VARCHAR(1000),

    -- Vínculo opcional con el usuario del ERP (no modifica public.users)
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Autorización de tratamiento de datos personales (Ley 1581 de 2012)
    data_consent_at DATE NOT NULL,
    data_consent_version VARCHAR(40) NOT NULL CHECK (char_length(btrim(data_consent_version)) >= 1),

    notes VARCHAR(1000),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_hr_employees_fixed_term CHECK (contract_type <> 'TERMINO_FIJO' OR contract_end_date IS NOT NULL),
    CONSTRAINT chk_hr_employees_contract_end CHECK (contract_end_date IS NULL OR contract_end_date >= hire_date),
    CONSTRAINT chk_hr_employees_termination CHECK (
        (status = 'RETIRADO') = (termination_date IS NOT NULL)
        AND (termination_date IS NULL OR (termination_date >= hire_date AND termination_cause IS NOT NULL))
    ),
    CONSTRAINT chk_hr_employees_manager_self CHECK (manager_employee_id IS NULL OR manager_employee_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employees_document ON public.hr_employees (company_id, document_type, document_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employees_code ON public.hr_employees (company_id, employee_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employees_user ON public.hr_employees (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hr_employees_company_status ON public.hr_employees (company_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_position ON public.hr_employees (position_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_area ON public.hr_employees (area_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_location ON public.hr_employees (location_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_manager ON public.hr_employees (manager_employee_id);

COMMENT ON COLUMN public.hr_employees.bank_account_masked IS
    'Últimos 4 dígitos de la cuenta (****1234). Lo mantiene el trigger de hr_employee_bank_accounts.';
COMMENT ON COLUMN public.hr_employees.data_consent_version IS
    'Versión de la política de tratamiento de datos que el empleado autorizó (Ley 1581 de 2012).';

-- Número de cuenta completo: solo hr.sensitive
CREATE TABLE IF NOT EXISTS public.hr_employee_bank_accounts (
    employee_id UUID PRIMARY KEY REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    account_number VARCHAR(30) NOT NULL CHECK (account_number ~ '^[0-9]{4,30}$'),
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_bank_accounts_company ON public.hr_employee_bank_accounts (company_id);

-- ------------------------------------------------------------------------------
-- 6. Historial laboral inmutable
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_employment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'INGRESO', 'CAMBIO_CARGO', 'CAMBIO_SALARIO', 'CAMBIO_SEDE', 'CAMBIO_CONTRATO', 'RETIRO', 'REINGRESO'
    )),
    effective_date DATE NOT NULL,
    previous_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    termination_cause VARCHAR(40),
    reason VARCHAR(1000),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(150) NOT NULL DEFAULT 'Sistema',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_events_employee_date ON public.hr_employment_events (employee_id, effective_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_events_company_type_date ON public.hr_employment_events (company_id, event_type, effective_date);

-- ------------------------------------------------------------------------------
-- 7. Documentos del empleado (metadatos; el archivo vive en Storage)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
    document_type VARCHAR(40) NOT NULL CHECK (document_type IN (
        'CONTRATO', 'OTROSI', 'HOJA_VIDA', 'DOCUMENTO_IDENTIDAD', 'CERTIFICADO_ESTUDIO',
        'CERTIFICADO_LABORAL', 'AFILIACION_SEGURIDAD_SOCIAL', 'EXAMEN_MEDICO',
        'AUTORIZACION_DATOS', 'SOPORTE_NOVEDAD', 'CARTA_RETIRO', 'PAZ_Y_SALVO', 'OTRO'
    )),
    name VARCHAR(150) NOT NULL CHECK (char_length(btrim(name)) >= 2),
    description VARCHAR(500),
    issue_date DATE,
    expires_at DATE,
    storage_path VARCHAR(300) NOT NULL,
    mime_type VARCHAR(40) NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_hr_documents_dates CHECK (expires_at IS NULL OR issue_date IS NULL OR expires_at >= issue_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_documents_storage_path ON public.hr_documents (storage_path);
CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON public.hr_documents (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_documents_expiry ON public.hr_documents (company_id, expires_at) WHERE is_archived = false AND expires_at IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 8. Novedades: permisos, licencias, incapacidades y ausencias
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_novelties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
    novelty_type VARCHAR(40) NOT NULL CHECK (novelty_type IN (
        'PERMISO_REMUNERADO', 'PERMISO_NO_REMUNERADO', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD',
        'LICENCIA_LUTO', 'INCAPACIDAD_GENERAL', 'INCAPACIDAD_LABORAL', 'AUSENCIA_INJUSTIFICADA',
        'CALAMIDAD_DOMESTICA', 'SUSPENSION_DISCIPLINARIA'
    )),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hours NUMERIC(5,2) CHECK (hours IS NULL OR (hours > 0 AND hours <= 12)),
    calendar_days INTEGER NOT NULL DEFAULT 0,
    business_days INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ANULADA')),
    description VARCHAR(500),
    support_document_id UUID REFERENCES public.hr_documents(id) ON DELETE SET NULL,
    review_notes VARCHAR(500),
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    cancel_reason VARCHAR(500),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_hr_novelties_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_hr_novelties_hours CHECK (hours IS NULL OR start_date = end_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_novelties_employee_dates ON public.hr_novelties (employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_hr_novelties_company_status ON public.hr_novelties (company_id, status, start_date DESC);

-- ------------------------------------------------------------------------------
-- 9. Vacaciones: periodos, solicitudes y asignaciones
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_vacation_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
    employment_start DATE NOT NULL,
    period_number INTEGER NOT NULL CHECK (period_number >= 1),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    days_accrued NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (days_accrued >= 0 AND days_accrued <= 15),
    days_taken NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (days_taken >= 0),
    days_compensated NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (days_compensated >= 0),
    is_complete BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'EN_CAUSACION' CHECK (status IN (
        'EN_CAUSACION', 'CAUSADO', 'DISFRUTADO', 'COMPENSADO'
    )),
    accrued_as_of DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_vacation_period UNIQUE (employee_id, employment_start, period_number),
    CONSTRAINT chk_hr_vacation_period_dates CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_hr_vacation_periods_company_status ON public.hr_vacation_periods (company_id, status);

COMMENT ON TABLE public.hr_vacation_periods IS
    'Periodos de causación de vacaciones: 15 días hábiles por año de servicio (Art. 186 CST), proporcional por fracción (360 días).';

CREATE TABLE IF NOT EXISTS public.hr_vacation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    business_days INTEGER NOT NULL DEFAULT 0,
    calendar_days INTEGER NOT NULL DEFAULT 0,
    return_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN (
        'PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'DISFRUTADA'
    )),
    notes VARCHAR(500),
    review_notes VARCHAR(500),
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    cancel_reason VARCHAR(500),
    requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_hr_vacation_request_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_vacation_requests_employee ON public.hr_vacation_requests (employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_hr_vacation_requests_company_status ON public.hr_vacation_requests (company_id, status, start_date);

CREATE TABLE IF NOT EXISTS public.hr_vacation_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    request_id UUID NOT NULL REFERENCES public.hr_vacation_requests(id) ON DELETE RESTRICT,
    period_id UUID NOT NULL REFERENCES public.hr_vacation_periods(id) ON DELETE RESTRICT,
    days NUMERIC(6,2) NOT NULL CHECK (days > 0),
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_vacation_allocations_request ON public.hr_vacation_allocations (request_id);
CREATE INDEX IF NOT EXISTS idx_hr_vacation_allocations_period ON public.hr_vacation_allocations (period_id) WHERE released_at IS NULL;

-- ------------------------------------------------------------------------------
-- 10. updated_at
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'hr_areas', 'hr_positions', 'hr_employees', 'hr_employee_bank_accounts',
        'hr_documents', 'hr_novelties', 'hr_vacation_periods', 'hr_vacation_requests'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
            t
        );
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 11. Auditoría (sin datos personales: solo campos cambiados y valores no sensibles)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_hr_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_entity TEXT := TG_ARGV[0];
    v_safe_keys TEXT[] := string_to_array(COALESCE(NULLIF(TG_ARGV[1], ''), 'id'), ',');
    v_id_key TEXT := COALESCE(NULLIF(TG_ARGV[2], ''), 'id');
    v_old JSONB;
    v_new JSONB := to_jsonb(NEW);
    v_changed TEXT[];
    v_user_id UUID := auth.uid();
    v_user_name VARCHAR(150);
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        SELECT array_agg(k ORDER BY k)
        INTO v_changed
        FROM jsonb_object_keys(v_new) k
        WHERE k NOT IN ('updated_at', 'updated_by', 'accrued_as_of')
          AND (v_old -> k) IS DISTINCT FROM (v_new -> k);

        IF v_changed IS NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    IF v_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user_id) THEN
        v_user_id := NULL;
    END IF;
    v_user_name := public.fn_hr_actor_name();

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id,
        previous_value, new_value, created_at
    ) VALUES (
        NEW.company_id,
        v_user_id,
        v_user_name,
        left('HR_' || v_entity || CASE WHEN TG_OP = 'INSERT' THEN '_CREATED' ELSE '_UPDATED' END, 50),
        'HR',
        TG_TABLE_NAME,
        v_new ->> v_id_key,
        CASE WHEN TG_OP = 'UPDATE' THEN public.fn_hr_jsonb_subset(v_old, v_safe_keys) END,
        public.fn_hr_jsonb_subset(v_new, v_safe_keys)
            || jsonb_build_object('changed_fields', COALESCE(to_jsonb(v_changed), '[]'::jsonb)),
        NOW()
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_audit_areas ON public.hr_areas;
CREATE TRIGGER trg_hr_audit_areas AFTER INSERT OR UPDATE ON public.hr_areas
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row('AREA', 'id,code,name,is_active');

DROP TRIGGER IF EXISTS trg_hr_audit_positions ON public.hr_positions;
CREATE TRIGGER trg_hr_audit_positions AFTER INSERT OR UPDATE ON public.hr_positions
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row('POSITION', 'id,code,name,area_id,is_active');

DROP TRIGGER IF EXISTS trg_hr_audit_employees ON public.hr_employees;
CREATE TRIGGER trg_hr_audit_employees AFTER INSERT OR UPDATE ON public.hr_employees
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row(
    'EMPLOYEE', 'id,employee_code,status,position_id,area_id,location_id,contract_type,hire_date,termination_date,user_id'
);

DROP TRIGGER IF EXISTS trg_hr_audit_bank_accounts ON public.hr_employee_bank_accounts;
CREATE TRIGGER trg_hr_audit_bank_accounts AFTER INSERT OR UPDATE ON public.hr_employee_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row('BANK_ACCOUNT', 'employee_id', 'employee_id');

DROP TRIGGER IF EXISTS trg_hr_audit_events ON public.hr_employment_events;
CREATE TRIGGER trg_hr_audit_events AFTER INSERT ON public.hr_employment_events
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row('EVENT', 'id,employee_id,event_type,effective_date,termination_cause');

DROP TRIGGER IF EXISTS trg_hr_audit_documents ON public.hr_documents;
CREATE TRIGGER trg_hr_audit_documents AFTER INSERT OR UPDATE ON public.hr_documents
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row('DOCUMENT', 'id,employee_id,document_type,expires_at,is_archived');

DROP TRIGGER IF EXISTS trg_hr_audit_novelties ON public.hr_novelties;
CREATE TRIGGER trg_hr_audit_novelties AFTER INSERT OR UPDATE ON public.hr_novelties
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row('NOVELTY', 'id,employee_id,novelty_type,start_date,end_date,status');

DROP TRIGGER IF EXISTS trg_hr_audit_vacation_requests ON public.hr_vacation_requests;
CREATE TRIGGER trg_hr_audit_vacation_requests AFTER INSERT OR UPDATE ON public.hr_vacation_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_audit_row('VACATION', 'id,employee_id,start_date,end_date,business_days,status');

-- ------------------------------------------------------------------------------
-- 12. Reglas de integridad por tabla
-- ------------------------------------------------------------------------------

-- 12.1 Áreas y cargos: empresa de la sesión, código normalizado, área de la misma empresa
CREATE OR REPLACE FUNCTION public.fn_hr_org_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL THEN
            NEW.company_id := public.get_auth_company_id();
            NEW.created_by := auth.uid();
        END IF;
    ELSIF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'No se puede cambiar la empresa del registro.' USING ERRCODE = '42501';
    END IF;

    NEW.name := btrim(NEW.name);
    NEW.code := NULLIF(upper(btrim(COALESCE(NEW.code, ''))), '');
    NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');

    -- La función la comparten hr_areas y hr_positions: area_id solo existe en cargos, por eso se lee
    -- desde el JSON de la fila (referenciar NEW.area_id falla en el trigger de áreas).
    IF TG_TABLE_NAME = 'hr_positions' AND (to_jsonb(NEW) ->> 'area_id') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.hr_areas a
            WHERE a.id = (to_jsonb(NEW) ->> 'area_id')::uuid AND a.company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'El área seleccionada no pertenece a la empresa.' USING ERRCODE = '23503';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_areas_before_write ON public.hr_areas;
CREATE TRIGGER trg_hr_areas_before_write BEFORE INSERT OR UPDATE ON public.hr_areas
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_org_before_write();

DROP TRIGGER IF EXISTS trg_hr_positions_before_write ON public.hr_positions;
CREATE TRIGGER trg_hr_positions_before_write BEFORE INSERT OR UPDATE ON public.hr_positions
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_org_before_write();

-- 12.2 Empleados: empresa, normalización, referencias de la misma empresa y campos protegidos
CREATE OR REPLACE FUNCTION public.fn_hr_employees_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_next INTEGER;
    v_position RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL THEN
            NEW.company_id := public.get_auth_company_id();
            NEW.created_by := auth.uid();
        END IF;

        IF NOT public.fn_hr_is_internal() THEN
            NEW.status := 'ACTIVO';
            NEW.termination_date := NULL;
            NEW.termination_cause := NULL;
            NEW.termination_reason := NULL;
            NEW.bank_account_masked := NULL;
        END IF;

        IF NEW.employee_code IS NULL OR btrim(NEW.employee_code) = '' THEN
            PERFORM pg_advisory_xact_lock(hashtext('hr_employee_code:' || NEW.company_id::text));
            SELECT COALESCE(MAX(NULLIF(regexp_replace(e.employee_code, '[^0-9]', '', 'g'), '')::int), 0) + 1
            INTO v_next
            FROM public.hr_employees e
            WHERE e.company_id = NEW.company_id
              AND e.employee_code ~ '^EMP-[0-9]+$';
            NEW.employee_code := 'EMP-' || lpad(v_next::text, 4, '0');
        END IF;

        IF NEW.hire_date > public.fn_hr_today() + 90 THEN
            RAISE EXCEPTION 'La fecha de ingreso no puede superar 90 días en el futuro.' USING ERRCODE = '22023';
        END IF;
    ELSE
        IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_code IS DISTINCT FROM OLD.employee_code THEN
            RAISE EXCEPTION 'La empresa y el código del empleado no se pueden modificar.' USING ERRCODE = '42501';
        END IF;

        IF NOT public.fn_hr_is_internal() AND (
            NEW.status IS DISTINCT FROM OLD.status
            OR NEW.hire_date IS DISTINCT FROM OLD.hire_date
            OR NEW.salary IS DISTINCT FROM OLD.salary
            OR NEW.salary_type IS DISTINCT FROM OLD.salary_type
            OR NEW.position_id IS DISTINCT FROM OLD.position_id
            OR NEW.area_id IS DISTINCT FROM OLD.area_id
            OR NEW.location_id IS DISTINCT FROM OLD.location_id
            OR NEW.manager_employee_id IS DISTINCT FROM OLD.manager_employee_id
            OR NEW.contract_type IS DISTINCT FROM OLD.contract_type
            OR NEW.contract_end_date IS DISTINCT FROM OLD.contract_end_date
            OR NEW.work_schedule IS DISTINCT FROM OLD.work_schedule
            OR NEW.weekly_hours IS DISTINCT FROM OLD.weekly_hours
            OR NEW.termination_date IS DISTINCT FROM OLD.termination_date
            OR NEW.termination_cause IS DISTINCT FROM OLD.termination_cause
            OR NEW.termination_reason IS DISTINCT FROM OLD.termination_reason
            OR NEW.bank_account_masked IS DISTINCT FROM OLD.bank_account_masked
        ) THEN
            RAISE EXCEPTION 'Las condiciones laborales, el estado y el retiro solo se modifican registrando el movimiento laboral correspondiente.'
                USING ERRCODE = '42501';
        END IF;

        IF auth.uid() IS NOT NULL THEN
            NEW.updated_by := auth.uid();
        END IF;
    END IF;

    -- Normalización
    NEW.document_number := upper(regexp_replace(btrim(NEW.document_number), '[[:space:].]', '', 'g'));
    NEW.first_name := btrim(NEW.first_name);
    NEW.last_name := btrim(NEW.last_name);
    NEW.email := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');
    NEW.data_consent_version := btrim(NEW.data_consent_version);

    IF NEW.birth_date IS NOT NULL AND NEW.birth_date > NEW.hire_date - interval '14 years' THEN
        RAISE EXCEPTION 'La fecha de nacimiento no es coherente con la fecha de ingreso.' USING ERRCODE = '22023';
    END IF;

    IF NEW.data_consent_at > public.fn_hr_today() THEN
        RAISE EXCEPTION 'La fecha de autorización de datos no puede ser futura.' USING ERRCODE = '22023';
    END IF;

    -- Referencias de la misma empresa
    SELECT p.id, p.area_id, p.is_active
    INTO v_position
    FROM public.hr_positions p
    WHERE p.id = NEW.position_id AND p.company_id = NEW.company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El cargo seleccionado no pertenece a la empresa.' USING ERRCODE = '23503';
    END IF;

    IF (TG_OP = 'INSERT' OR NEW.position_id IS DISTINCT FROM OLD.position_id) AND NOT v_position.is_active THEN
        RAISE EXCEPTION 'El cargo seleccionado está inactivo.' USING ERRCODE = '22023';
    END IF;

    IF NEW.area_id IS NULL THEN
        NEW.area_id := v_position.area_id;
    END IF;

    IF NEW.area_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.hr_areas a WHERE a.id = NEW.area_id AND a.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'El área seleccionada no pertenece a la empresa.' USING ERRCODE = '23503';
    END IF;

    IF NEW.location_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.locations l WHERE l.id = NEW.location_id AND l.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'La sede seleccionada no pertenece a la empresa.' USING ERRCODE = '23503';
    END IF;

    IF NEW.manager_employee_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.manager_employee_id IS DISTINCT FROM OLD.manager_employee_id)
       AND NOT EXISTS (
        SELECT 1 FROM public.hr_employees m
        WHERE m.id = NEW.manager_employee_id AND m.company_id = NEW.company_id AND m.status <> 'RETIRADO'
    ) THEN
        RAISE EXCEPTION 'El jefe inmediato debe ser un empleado activo de la empresa.' USING ERRCODE = '23503';
    END IF;

    IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id) AND NOT EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'El usuario del ERP seleccionado no pertenece a la empresa.' USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_employees_before_write ON public.hr_employees;
CREATE TRIGGER trg_hr_employees_before_write BEFORE INSERT OR UPDATE ON public.hr_employees
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_employees_before_write();

-- 12.3 Ingreso: evento inicial del historial
CREATE OR REPLACE FUNCTION public.fn_hr_employees_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    INSERT INTO public.hr_employment_events (
        company_id, employee_id, event_type, effective_date, previous_values, new_values,
        reason, created_by, created_by_name
    ) VALUES (
        NEW.company_id, NEW.id, 'INGRESO', NEW.hire_date, '{}'::jsonb,
        public.fn_hr_jsonb_subset(to_jsonb(NEW), ARRAY[
            'position_id', 'area_id', 'location_id', 'manager_employee_id', 'salary', 'salary_type',
            'contract_type', 'contract_end_date', 'work_schedule', 'weekly_hours'
        ]),
        'Ingreso del empleado',
        CASE WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()) THEN auth.uid() END,
        public.fn_hr_actor_name()
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_employees_after_insert ON public.hr_employees;
CREATE TRIGGER trg_hr_employees_after_insert AFTER INSERT ON public.hr_employees
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_employees_after_insert();

-- 12.4 Cuenta bancaria: empresa del empleado y máscara en la ficha
CREATE OR REPLACE FUNCTION public.fn_hr_bank_accounts_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
        RAISE EXCEPTION 'No se puede cambiar el empleado de la cuenta.' USING ERRCODE = '42501';
    END IF;

    SELECT e.company_id INTO v_company_id FROM public.hr_employees e WHERE e.id = NEW.employee_id;
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Empleado no encontrado.' USING ERRCODE = '23503';
    END IF;

    IF auth.uid() IS NOT NULL AND v_company_id IS DISTINCT FROM public.get_auth_company_id() THEN
        RAISE EXCEPTION 'El empleado no pertenece a la empresa.' USING ERRCODE = '42501';
    END IF;

    NEW.company_id := v_company_id;
    NEW.account_number := regexp_replace(NEW.account_number, '[^0-9]', '', 'g');
    IF auth.uid() IS NOT NULL THEN
        NEW.updated_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_bank_accounts_before_write ON public.hr_employee_bank_accounts;
CREATE TRIGGER trg_hr_bank_accounts_before_write BEFORE INSERT OR UPDATE ON public.hr_employee_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_bank_accounts_before_write();

CREATE OR REPLACE FUNCTION public.fn_hr_bank_accounts_after_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_was_internal BOOLEAN := public.fn_hr_is_internal();
BEGIN
    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_employees
    SET bank_account_masked = '****' || right(NEW.account_number, 4)
    WHERE id = NEW.employee_id;
    PERFORM public.fn_hr_set_internal(v_was_internal);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_bank_accounts_after_write ON public.hr_employee_bank_accounts;
CREATE TRIGGER trg_hr_bank_accounts_after_write AFTER INSERT OR UPDATE ON public.hr_employee_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_bank_accounts_after_write();

-- 12.5 Historial inmutable
CREATE OR REPLACE FUNCTION public.fn_hr_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION 'El historial laboral es inmutable: no se puede modificar ni eliminar.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_events_immutable ON public.hr_employment_events;
CREATE TRIGGER trg_hr_events_immutable BEFORE UPDATE OR DELETE ON public.hr_employment_events
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_block_mutation();

-- 12.6 Documentos: ruta empresa/empleado/archivo, campos editables limitados
CREATE OR REPLACE FUNCTION public.fn_hr_documents_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_parts TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL THEN
            NEW.company_id := public.get_auth_company_id();
            NEW.uploaded_by := auth.uid();
        END IF;
        NEW.is_archived := false;
        NEW.archived_at := NULL;
        NEW.archived_by := NULL;

        IF NOT EXISTS (
            SELECT 1 FROM public.hr_employees e WHERE e.id = NEW.employee_id AND e.company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'El empleado no pertenece a la empresa.' USING ERRCODE = '23503';
        END IF;

        v_parts := string_to_array(NEW.storage_path, '/');
        IF array_length(v_parts, 1) <> 3
           OR v_parts[1] <> NEW.company_id::text
           OR v_parts[2] <> NEW.employee_id::text
           OR v_parts[3] !~ '^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$' THEN
            RAISE EXCEPTION 'La ruta del archivo no es válida para este empleado.' USING ERRCODE = '22023';
        END IF;

        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM storage.objects o
                WHERE o.bucket_id = 'hr-documents' AND o.name = NEW.storage_path
            ) THEN
                RAISE EXCEPTION 'El archivo no se encuentra cargado en el almacenamiento.' USING ERRCODE = '23503';
            END IF;
        EXCEPTION
            WHEN insufficient_privilege OR undefined_table THEN
                NULL; -- Sin acceso al esquema storage: la política del bucket ya controla la carga
        END;
    ELSE
        IF NEW.company_id IS DISTINCT FROM OLD.company_id
           OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
           OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
           OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
           OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
           OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
            RAISE EXCEPTION 'El archivo de un documento no se puede reemplazar; cargue un documento nuevo.' USING ERRCODE = '42501';
        END IF;

        IF OLD.is_archived AND NOT NEW.is_archived THEN
            RAISE EXCEPTION 'Un documento archivado no se puede restaurar.' USING ERRCODE = '42501';
        END IF;

        IF NEW.is_archived AND NOT OLD.is_archived THEN
            NEW.archived_at := NOW();
            NEW.archived_by := auth.uid();
        ELSE
            NEW.archived_at := OLD.archived_at;
            NEW.archived_by := OLD.archived_by;
        END IF;
    END IF;

    NEW.name := btrim(NEW.name);
    NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_documents_before_write ON public.hr_documents;
CREATE TRIGGER trg_hr_documents_before_write BEFORE INSERT OR UPDATE ON public.hr_documents
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_documents_before_write();

-- 12.7 Novedades: cálculo de días, estado inicial y edición solo mientras está pendiente
CREATE OR REPLACE FUNCTION public.fn_hr_novelties_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_employee RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL THEN
            NEW.company_id := public.get_auth_company_id();
            NEW.created_by := auth.uid();
        END IF;
        IF NOT public.fn_hr_is_internal() THEN
            NEW.status := 'PENDIENTE';
            NEW.reviewed_by := NULL;
            NEW.reviewed_at := NULL;
            NEW.review_notes := NULL;
            NEW.cancel_reason := NULL;
        END IF;
    ELSE
        IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
            RAISE EXCEPTION 'No se puede cambiar la empresa ni el empleado de la novedad.' USING ERRCODE = '42501';
        END IF;
        IF public.fn_hr_is_internal() THEN
            RETURN NEW;
        END IF;
        IF OLD.status <> 'PENDIENTE' THEN
            RAISE EXCEPTION 'Solo se pueden editar novedades pendientes de aprobación.' USING ERRCODE = '55000';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status
           OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
           OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
            RAISE EXCEPTION 'La aprobación o anulación de novedades se registra con la acción correspondiente.' USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT e.id, e.company_id, e.status, e.hire_date, e.termination_date
    INTO v_employee
    FROM public.hr_employees e
    WHERE e.id = NEW.employee_id;

    IF NOT FOUND OR v_employee.company_id IS DISTINCT FROM NEW.company_id THEN
        RAISE EXCEPTION 'El empleado no pertenece a la empresa.' USING ERRCODE = '23503';
    END IF;

    IF NEW.start_date < v_employee.hire_date THEN
        RAISE EXCEPTION 'La novedad no puede iniciar antes de la fecha de ingreso del empleado.' USING ERRCODE = '22023';
    END IF;

    IF v_employee.status = 'RETIRADO' AND NEW.start_date > v_employee.termination_date THEN
        RAISE EXCEPTION 'El empleado está retirado; la novedad no puede ser posterior a su retiro.' USING ERRCODE = '22023';
    END IF;

    IF NEW.end_date - NEW.start_date > 366 THEN
        RAISE EXCEPTION 'Una novedad no puede superar 366 días; regístrela por tramos.' USING ERRCODE = '22023';
    END IF;

    IF NEW.support_document_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.hr_documents d
        WHERE d.id = NEW.support_document_id AND d.employee_id = NEW.employee_id
    ) THEN
        RAISE EXCEPTION 'El soporte debe ser un documento del mismo empleado.' USING ERRCODE = '23503';
    END IF;

    NEW.is_paid := NEW.novelty_type NOT IN ('PERMISO_NO_REMUNERADO', 'AUSENCIA_INJUSTIFICADA', 'SUSPENSION_DISCIPLINARIA');
    IF NEW.hours IS NOT NULL THEN
        NEW.calendar_days := 0;
        NEW.business_days := 0;
    ELSE
        NEW.calendar_days := (NEW.end_date - NEW.start_date) + 1;
        NEW.business_days := public.fn_hr_business_days(NEW.start_date, NEW.end_date);
    END IF;
    NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_novelties_before_write ON public.hr_novelties;
CREATE TRIGGER trg_hr_novelties_before_write BEFORE INSERT OR UPDATE ON public.hr_novelties
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_novelties_before_write();

-- ------------------------------------------------------------------------------
-- 13. Motor de vacaciones
-- ------------------------------------------------------------------------------

-- Días no remunerados aprobados que se descuentan del tiempo de servicio (Art. 51 y 53 CST)
CREATE OR REPLACE FUNCTION public.fn_hr_unpaid_days(p_employee_id UUID, p_start DATE, p_end DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(SUM((LEAST(n.end_date, p_end) - GREATEST(n.start_date, p_start)) + 1), 0)::int
    FROM public.hr_novelties n
    WHERE n.employee_id = p_employee_id
      AND n.status = 'APROBADA'
      AND n.hours IS NULL
      AND n.novelty_type IN ('PERMISO_NO_REMUNERADO', 'SUSPENSION_DISCIPLINARIA')
      AND n.start_date <= p_end
      AND n.end_date >= p_start;
$$;

-- Recalcula días tomados y estado de los periodos del empleado
CREATE OR REPLACE FUNCTION public.fn_hr_refresh_period_status(p_employee_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.hr_vacation_periods p
    SET days_taken = COALESCE((
            SELECT SUM(a.days) FROM public.hr_vacation_allocations a
            WHERE a.period_id = p.id AND a.released_at IS NULL
        ), 0)
    WHERE p.employee_id = p_employee_id;

    UPDATE public.hr_vacation_periods p
    SET status = CASE
            WHEN p.days_compensated > 0 AND (p.days_accrued - p.days_taken - p.days_compensated) <= 0 THEN 'COMPENSADO'
            WHEN NOT p.is_complete THEN 'EN_CAUSACION'
            WHEN (p.days_accrued - p.days_taken - p.days_compensated) <= 0 THEN 'DISFRUTADO'
            ELSE 'CAUSADO'
        END
    WHERE p.employee_id = p_employee_id;
END;
$$;

-- Causación de periodos hasta una fecha (15 días hábiles por año; fracción proporcional en 360 días)
CREATE OR REPLACE FUNCTION public.fn_hr_accrue_vacations(p_employee_id UUID, p_as_of DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_emp RECORD;
    v_limit DATE;
    v_start DATE;
    v_end DATE;
    v_base_end DATE;
    v_prev_end DATE;
    v_num INTEGER := 1;
    v_period RECORD;
    v_complete BOOLEAN;
    v_accrued NUMERIC(6,2);
    v_worked INTEGER;
BEGIN
    SELECT e.* INTO v_emp FROM public.hr_employees e WHERE e.id = p_employee_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Prestación de servicios no es contrato laboral; el contrato de aprendizaje no causa vacaciones (Ley 789 de 2002)
    IF v_emp.contract_type IN ('PRESTACION_SERVICIOS', 'APRENDIZAJE') THEN
        RETURN;
    END IF;

    v_limit := CASE
        WHEN v_emp.status = 'RETIRADO' THEN LEAST(p_as_of, v_emp.termination_date)
        ELSE p_as_of
    END;
    v_start := v_emp.hire_date;

    WHILE v_start <= v_limit AND v_num <= 80 LOOP
        SELECT p.* INTO v_period
        FROM public.hr_vacation_periods p
        WHERE p.employee_id = v_emp.id
          AND p.employment_start = v_emp.hire_date
          AND p.period_number = v_num;

        IF FOUND AND v_period.is_complete AND v_period.period_end <= v_limit THEN
            v_start := v_period.period_end + 1;
            v_num := v_num + 1;
            CONTINUE;
        END IF;

        -- Fin del periodo: un año de servicio, extendido por los días no remunerados del periodo
        v_base_end := (v_start + interval '1 year')::date - 1;
        v_end := v_base_end;
        FOR i IN 1..5 LOOP
            v_prev_end := v_end;
            v_end := v_base_end + public.fn_hr_unpaid_days(v_emp.id, v_start, v_end);
            EXIT WHEN v_end = v_prev_end;
        END LOOP;

        v_complete := v_end <= v_limit;
        IF v_complete THEN
            v_accrued := 15;
        ELSE
            v_worked := public.fn_hr_days360(v_start, v_limit) - public.fn_hr_unpaid_days(v_emp.id, v_start, v_limit);
            v_accrued := LEAST(15, round(GREATEST(v_worked, 0) * 15.0 / 360.0, 2));
        END IF;

        INSERT INTO public.hr_vacation_periods (
            company_id, employee_id, employment_start, period_number, period_start, period_end,
            days_accrued, is_complete, accrued_as_of
        ) VALUES (
            v_emp.company_id, v_emp.id, v_emp.hire_date, v_num, v_start, v_end,
            v_accrued, v_complete, v_limit
        )
        ON CONFLICT (employee_id, employment_start, period_number) DO UPDATE
        SET period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            days_accrued = EXCLUDED.days_accrued,
            is_complete = EXCLUDED.is_complete,
            accrued_as_of = EXCLUDED.accrued_as_of;

        v_start := v_end + 1;
        v_num := v_num + 1;
    END LOOP;

    -- Periodos posteriores al límite (p. ej. retiro con fecha anterior) no causan días
    UPDATE public.hr_vacation_periods p
    SET days_accrued = 0, is_complete = false, accrued_as_of = v_limit
    WHERE p.employee_id = v_emp.id
      AND p.employment_start = v_emp.hire_date
      AND p.period_number >= v_num
      AND (p.days_accrued <> 0 OR p.is_complete);

    PERFORM public.fn_hr_refresh_period_status(v_emp.id);
END;
$$;

-- Saldo disponible (días) del vínculo laboral vigente
CREATE OR REPLACE FUNCTION public.fn_hr_vacation_available(p_employee_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(SUM(p.days_accrued - p.days_taken - p.days_compensated), 0)
    FROM public.hr_vacation_periods p
    JOIN public.hr_employees e ON e.id = p.employee_id
    WHERE p.employee_id = p_employee_id
      AND p.employment_start = e.hire_date;
$$;

-- Estado del empleado según novedades y vacaciones aprobadas vigentes hoy
CREATE OR REPLACE FUNCTION public.fn_hr_sync_employee_status(p_employee_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_today DATE := public.fn_hr_today();
    v_current VARCHAR(20);
    v_target VARCHAR(20);
    v_was_internal BOOLEAN := public.fn_hr_is_internal();
BEGIN
    SELECT e.status INTO v_current FROM public.hr_employees e WHERE e.id = p_employee_id;
    IF NOT FOUND OR v_current = 'RETIRADO' THEN
        RETURN;
    END IF;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_vacation_requests r
    SET status = 'DISFRUTADA'
    WHERE r.employee_id = p_employee_id
      AND r.status = 'APROBADA'
      AND r.end_date < v_today;
    PERFORM public.fn_hr_set_internal(v_was_internal);

    IF EXISTS (
        SELECT 1 FROM public.hr_novelties n
        WHERE n.employee_id = p_employee_id
          AND n.status = 'APROBADA'
          AND n.novelty_type IN ('INCAPACIDAD_GENERAL', 'INCAPACIDAD_LABORAL')
          AND v_today BETWEEN n.start_date AND n.end_date
    ) THEN
        v_target := 'INCAPACITADO';
    ELSIF EXISTS (
        SELECT 1 FROM public.hr_vacation_requests r
        WHERE r.employee_id = p_employee_id
          AND r.status = 'APROBADA'
          AND v_today BETWEEN r.start_date AND r.end_date
    ) THEN
        v_target := 'EN_VACACIONES';
    ELSE
        v_target := 'ACTIVO';
    END IF;

    IF v_target IS DISTINCT FROM v_current THEN
        PERFORM public.fn_hr_set_internal(true);
        UPDATE public.hr_employees SET status = v_target WHERE id = p_employee_id;
        PERFORM public.fn_hr_set_internal(v_was_internal);
    END IF;
END;
$$;

-- 13.1 Solicitudes de vacaciones: días hábiles, saldo y solapamientos
CREATE OR REPLACE FUNCTION public.fn_hr_vacation_requests_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_employee RECORD;
    v_available NUMERIC;
    v_pending NUMERIC;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL THEN
            NEW.company_id := public.get_auth_company_id();
            NEW.requested_by := auth.uid();
        END IF;
        IF NOT public.fn_hr_is_internal() THEN
            NEW.status := 'PENDIENTE';
            NEW.reviewed_by := NULL;
            NEW.reviewed_at := NULL;
            NEW.review_notes := NULL;
            NEW.cancel_reason := NULL;
        END IF;
    ELSE
        IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
            RAISE EXCEPTION 'No se puede cambiar la empresa ni el empleado de la solicitud.' USING ERRCODE = '42501';
        END IF;
        IF public.fn_hr_is_internal() THEN
            RETURN NEW;
        END IF;
        IF OLD.status <> 'PENDIENTE' THEN
            RAISE EXCEPTION 'Solo se pueden editar solicitudes pendientes.' USING ERRCODE = '55000';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status
           OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
           OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
            RAISE EXCEPTION 'La aprobación o cancelación se registra con la acción correspondiente.' USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT e.* INTO v_employee FROM public.hr_employees e WHERE e.id = NEW.employee_id;
    IF NOT FOUND OR v_employee.company_id IS DISTINCT FROM NEW.company_id THEN
        RAISE EXCEPTION 'El empleado no pertenece a la empresa.' USING ERRCODE = '23503';
    END IF;

    IF v_employee.status = 'RETIRADO' THEN
        RAISE EXCEPTION 'El empleado está retirado; no se pueden programar vacaciones.' USING ERRCODE = '55000';
    END IF;

    IF v_employee.contract_type IN ('PRESTACION_SERVICIOS', 'APRENDIZAJE') THEN
        RAISE EXCEPTION 'El tipo de contrato del empleado no causa vacaciones.' USING ERRCODE = '55000';
    END IF;

    IF NEW.start_date < v_employee.hire_date THEN
        RAISE EXCEPTION 'Las vacaciones no pueden iniciar antes de la fecha de ingreso.' USING ERRCODE = '22023';
    END IF;

    IF NEW.end_date - NEW.start_date > 120 THEN
        RAISE EXCEPTION 'El rango de vacaciones es demasiado amplio.' USING ERRCODE = '22023';
    END IF;

    IF NOT public.fn_hr_holidays_cover(NEW.start_date, NEW.end_date + 30) THEN
        RAISE EXCEPTION 'No hay festivos registrados para el año de las vacaciones; no es posible calcular los días hábiles.'
            USING ERRCODE = '55000';
    END IF;

    NEW.business_days := public.fn_hr_business_days(NEW.start_date, NEW.end_date);
    NEW.calendar_days := (NEW.end_date - NEW.start_date) + 1;
    NEW.return_date := public.fn_hr_next_business_day(NEW.end_date);
    NEW.notes := NULLIF(btrim(COALESCE(NEW.notes, '')), '');

    IF NEW.business_days < 1 THEN
        RAISE EXCEPTION 'El rango seleccionado no contiene días hábiles.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.hr_vacation_requests r
        WHERE r.employee_id = NEW.employee_id
          AND r.id <> NEW.id
          AND r.status IN ('PENDIENTE', 'APROBADA', 'DISFRUTADA')
          AND r.start_date <= NEW.end_date
          AND r.end_date >= NEW.start_date
    ) THEN
        RAISE EXCEPTION 'Las fechas se cruzan con otra solicitud de vacaciones del empleado.' USING ERRCODE = '23P01';
    END IF;

    -- Saldo causado a hoy menos lo ya solicitado y pendiente de aprobación
    PERFORM public.fn_hr_accrue_vacations(NEW.employee_id, public.fn_hr_today());
    v_available := public.fn_hr_vacation_available(NEW.employee_id);
    SELECT COALESCE(SUM(r.business_days), 0) INTO v_pending
    FROM public.hr_vacation_requests r
    WHERE r.employee_id = NEW.employee_id AND r.id <> NEW.id AND r.status = 'PENDIENTE';

    IF NEW.business_days > (v_available - v_pending) THEN
        RAISE EXCEPTION 'Saldo insuficiente: solicita % días hábiles y el saldo disponible es % días.',
            NEW.business_days, round(GREATEST(v_available - v_pending, 0), 2)
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_vacation_requests_before_write ON public.hr_vacation_requests;
CREATE TRIGGER trg_hr_vacation_requests_before_write BEFORE INSERT OR UPDATE ON public.hr_vacation_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_hr_vacation_requests_before_write();

-- 13.2 Alertas de vacaciones (periodos causados sin disfrutar; crítica cerca de 2 periodos, Art. 190 CST)
CREATE OR REPLACE FUNCTION public.fn_hr_vacation_alerts()
RETURNS TABLE (
    employee_id UUID,
    employee_code VARCHAR,
    full_name TEXT,
    area_id UUID,
    location_id UUID,
    pending_periods INTEGER,
    pending_days NUMERIC,
    available_days NUMERIC,
    oldest_pending_period_end DATE,
    current_period_end DATE,
    days_to_next_period INTEGER,
    alert_level VARCHAR
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
    WITH base AS (
        SELECT
            e.id AS employee_id,
            e.employee_code,
            (e.first_name || ' ' || e.last_name) AS full_name,
            e.area_id,
            e.location_id,
            COUNT(p.id) FILTER (WHERE p.status = 'CAUSADO')::int AS pending_periods,
            COALESCE(SUM(p.days_accrued - p.days_taken - p.days_compensated) FILTER (WHERE p.status = 'CAUSADO'), 0) AS pending_days,
            COALESCE(SUM(p.days_accrued - p.days_taken - p.days_compensated), 0) AS available_days,
            MIN(p.period_end) FILTER (WHERE p.status = 'CAUSADO') AS oldest_pending_period_end,
            MAX(p.period_end) FILTER (WHERE NOT p.is_complete) AS current_period_end
        FROM public.hr_employees e
        LEFT JOIN public.hr_vacation_periods p
               ON p.employee_id = e.id AND p.employment_start = e.hire_date
        WHERE e.status <> 'RETIRADO'
          AND public.fn_hr_can('hr.read')
          AND e.company_id = public.get_auth_company_id()
        GROUP BY e.id
    )
    SELECT
        b.employee_id,
        b.employee_code,
        b.full_name,
        b.area_id,
        b.location_id,
        b.pending_periods,
        round(b.pending_days, 2),
        round(b.available_days, 2),
        b.oldest_pending_period_end,
        b.current_period_end,
        CASE WHEN b.current_period_end IS NULL THEN NULL ELSE (b.current_period_end - public.fn_hr_today()) END,
        (CASE
            WHEN b.pending_periods >= 2 THEN 'CRITICA'
            WHEN b.pending_periods = 1
                 AND b.current_period_end IS NOT NULL
                 AND (b.current_period_end - public.fn_hr_today()) <= 90 THEN 'CRITICA'
            WHEN b.pending_periods = 1 THEN 'PENDIENTE'
            ELSE 'AL_DIA'
        END)::varchar
    FROM base b;
$$;

-- Destinatarios de avisos de RRHH: usuarios activos con hr.read (incluye ADMIN/SUPERADMIN)
CREATE OR REPLACE FUNCTION public.fn_hr_notification_recipients(p_company_id UUID)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT u.id
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.company_id = p_company_id
      AND u.is_active = true
      AND (
          r.code IN ('ADMIN', 'SUPERADMIN')
          OR EXISTS (
              SELECT 1
              FROM public.role_permissions rp
              JOIN public.permissions pm ON pm.id = rp.permission_id
              WHERE rp.role_id = u.role_id AND pm.code = 'hr.read'
          )
      );
$$;

-- ------------------------------------------------------------------------------
-- 14. RPC: actualización diaria (causación, estados y avisos)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_hr_refresh(p_employee_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.read');
    v_today DATE := public.fn_hr_today();
    v_emp RECORD;
    v_alert RECORD;
    v_doc RECORD;
    v_processed INTEGER := 0;
    v_notified INTEGER := 0;
    v_count INTEGER;
    v_key TEXT;
BEGIN
    FOR v_emp IN
        SELECT e.id FROM public.hr_employees e
        WHERE e.company_id = v_company_id
          AND e.status <> 'RETIRADO'
          AND (p_employee_id IS NULL OR e.id = p_employee_id)
    LOOP
        PERFORM public.fn_hr_accrue_vacations(v_emp.id, v_today);
        PERFORM public.fn_hr_sync_employee_status(v_emp.id);
        v_processed := v_processed + 1;
    END LOOP;

    IF p_employee_id IS NOT NULL THEN
        RETURN jsonb_build_object('processed', v_processed, 'notified', 0);
    END IF;

    -- Avisos de vacaciones (una vez por empleado, periodo y nivel)
    FOR v_alert IN
        SELECT a.*,
               (SELECT p.id FROM public.hr_vacation_periods p
                JOIN public.hr_employees e ON e.id = p.employee_id
                WHERE p.employee_id = a.employee_id AND p.employment_start = e.hire_date AND p.status = 'CAUSADO'
                ORDER BY p.period_number LIMIT 1) AS oldest_period_id
        FROM public.fn_hr_vacation_alerts() a
        WHERE a.alert_level IN ('PENDIENTE', 'CRITICA')
    LOOP
        v_key := v_alert.alert_level || ':' || COALESCE(v_alert.oldest_period_id::text, '') || ':' || v_alert.pending_periods;

        INSERT INTO public.user_notifications (
            company_id, recipient_user_id, type, severity, title, message,
            entity_type, entity_id, link_path, metadata
        )
        SELECT
            v_company_id, r.user_id, 'HR_VACATION_ALERT',
            CASE WHEN v_alert.alert_level = 'CRITICA' THEN 'CRITICAL' ELSE 'WARNING' END,
            CASE WHEN v_alert.alert_level = 'CRITICA'
                 THEN 'Vacaciones críticas: ' || v_alert.full_name
                 ELSE 'Vacaciones pendientes: ' || v_alert.full_name END,
            CASE WHEN v_alert.pending_periods >= 2
                 THEN 'Acumula ' || v_alert.pending_periods || ' periodos sin disfrutar (' || v_alert.pending_days || ' días hábiles). Programe sus vacaciones.'
                 WHEN v_alert.alert_level = 'CRITICA'
                 THEN 'Tiene un periodo causado sin disfrutar y en ' || COALESCE(v_alert.days_to_next_period, 0) || ' días completará el segundo. Programe sus vacaciones.'
                 ELSE 'Tiene ' || v_alert.pending_days || ' días hábiles de un periodo causado sin disfrutar. Programe sus vacaciones.' END,
            'hr_employee', v_alert.employee_id,
            '/recursos-humanos/empleados/' || v_alert.employee_id || '?tab=vacaciones',
            jsonb_build_object('alert_key', v_key, 'alert_level', v_alert.alert_level)
        FROM public.fn_hr_notification_recipients(v_company_id) r
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_notifications n
            WHERE n.recipient_user_id = r.user_id
              AND n.type = 'HR_VACATION_ALERT'
              AND n.entity_id = v_alert.employee_id
              AND n.metadata ->> 'alert_key' = v_key
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_notified := v_notified + v_count;
    END LOOP;

    -- Avisos de documentos por vencer (30 días) o vencidos
    FOR v_doc IN
        SELECT d.id, d.name, d.expires_at, d.employee_id, (e.first_name || ' ' || e.last_name) AS full_name
        FROM public.hr_documents d
        JOIN public.hr_employees e ON e.id = d.employee_id
        WHERE d.company_id = v_company_id
          AND d.is_archived = false
          AND d.expires_at IS NOT NULL
          AND d.expires_at <= v_today + 30
          AND e.status <> 'RETIRADO'
    LOOP
        v_key := CASE WHEN v_doc.expires_at < v_today THEN 'VENCIDO' ELSE 'POR_VENCER' END || ':' || v_doc.expires_at;

        INSERT INTO public.user_notifications (
            company_id, recipient_user_id, type, severity, title, message,
            entity_type, entity_id, link_path, metadata
        )
        SELECT
            v_company_id, r.user_id, 'HR_DOCUMENT_EXPIRING',
            CASE WHEN v_doc.expires_at < v_today THEN 'CRITICAL' ELSE 'WARNING' END,
            CASE WHEN v_doc.expires_at < v_today THEN 'Documento vencido' ELSE 'Documento por vencer' END,
            v_doc.name || ' de ' || v_doc.full_name || CASE WHEN v_doc.expires_at < v_today THEN ' venció el ' ELSE ' vence el ' END
                || to_char(v_doc.expires_at, 'DD/MM/YYYY') || '.',
            'hr_document', v_doc.id,
            '/recursos-humanos/empleados/' || v_doc.employee_id || '?tab=documentos',
            jsonb_build_object('alert_key', v_key)
        FROM public.fn_hr_notification_recipients(v_company_id) r
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_notifications n
            WHERE n.recipient_user_id = r.user_id
              AND n.type = 'HR_DOCUMENT_EXPIRING'
              AND n.entity_id = v_doc.id
              AND n.metadata ->> 'alert_key' = v_key
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_notified := v_notified + v_count;
    END LOOP;

    RETURN jsonb_build_object('processed', v_processed, 'notified', v_notified);
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. RPC: cambios laborales, retiro y reingreso
-- ------------------------------------------------------------------------------

-- Aplica cambios laborales y deja un evento por cada grupo modificado
CREATE OR REPLACE FUNCTION public.fn_hr_apply_employment_changes(
    p_employee_id UUID,
    p_changes JSONB,
    p_effective_date DATE,
    p_reason TEXT,
    p_extra_event VARCHAR DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_groups JSONB := jsonb_build_object(
        'CAMBIO_CARGO', jsonb_build_array('position_id', 'area_id', 'manager_employee_id'),
        'CAMBIO_SALARIO', jsonb_build_array('salary', 'salary_type'),
        'CAMBIO_SEDE', jsonb_build_array('location_id'),
        'CAMBIO_CONTRATO', jsonb_build_array('contract_type', 'contract_end_date', 'work_schedule', 'weekly_hours')
    );
    v_group TEXT;
    v_keys TEXT[];
    v_events INTEGER := 0;
    v_actor UUID := CASE WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()) THEN auth.uid() END;
    v_was_internal BOOLEAN := public.fn_hr_is_internal();
    v_allowed TEXT[] := ARRAY[
        'position_id', 'area_id', 'manager_employee_id', 'salary', 'salary_type', 'location_id',
        'contract_type', 'contract_end_date', 'work_schedule', 'weekly_hours'
    ];
    v_key TEXT;
BEGIN
    p_changes := COALESCE(p_changes, '{}'::jsonb);
    FOR v_key IN SELECT jsonb_object_keys(p_changes) LOOP
        IF NOT (v_key = ANY (v_allowed)) THEN
            RAISE EXCEPTION 'Campo laboral no permitido: %', v_key USING ERRCODE = '22023';
        END IF;
    END LOOP;

    SELECT to_jsonb(e) INTO v_old FROM public.hr_employees e WHERE e.id = p_employee_id;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_employees e
    SET position_id = CASE WHEN p_changes ? 'position_id' THEN NULLIF(p_changes ->> 'position_id', '')::uuid ELSE e.position_id END,
        area_id = CASE WHEN p_changes ? 'area_id' THEN NULLIF(p_changes ->> 'area_id', '')::uuid ELSE e.area_id END,
        manager_employee_id = CASE WHEN p_changes ? 'manager_employee_id' THEN NULLIF(p_changes ->> 'manager_employee_id', '')::uuid ELSE e.manager_employee_id END,
        salary = CASE WHEN p_changes ? 'salary' THEN (p_changes ->> 'salary')::numeric ELSE e.salary END,
        salary_type = CASE WHEN p_changes ? 'salary_type' THEN p_changes ->> 'salary_type' ELSE e.salary_type END,
        location_id = CASE WHEN p_changes ? 'location_id' THEN NULLIF(p_changes ->> 'location_id', '')::uuid ELSE e.location_id END,
        contract_type = CASE WHEN p_changes ? 'contract_type' THEN p_changes ->> 'contract_type' ELSE e.contract_type END,
        contract_end_date = CASE WHEN p_changes ? 'contract_end_date' THEN NULLIF(p_changes ->> 'contract_end_date', '')::date ELSE e.contract_end_date END,
        work_schedule = CASE WHEN p_changes ? 'work_schedule' THEN p_changes ->> 'work_schedule' ELSE e.work_schedule END,
        weekly_hours = CASE WHEN p_changes ? 'weekly_hours' THEN NULLIF(p_changes ->> 'weekly_hours', '')::numeric ELSE e.weekly_hours END
    WHERE e.id = p_employee_id
    RETURNING to_jsonb(e.*) INTO v_new;
    PERFORM public.fn_hr_set_internal(v_was_internal);

    FOR v_group IN SELECT jsonb_object_keys(v_groups) LOOP
        SELECT array_agg(t.k) INTO v_keys FROM jsonb_array_elements_text(v_groups -> v_group) AS t(k);
        IF public.fn_hr_jsonb_subset(v_old, v_keys) IS DISTINCT FROM public.fn_hr_jsonb_subset(v_new, v_keys) THEN
            INSERT INTO public.hr_employment_events (
                company_id, employee_id, event_type, effective_date, previous_values, new_values,
                reason, created_by, created_by_name
            ) VALUES (
                (v_new ->> 'company_id')::uuid, p_employee_id, v_group, p_effective_date,
                public.fn_hr_jsonb_subset(v_old, v_keys), public.fn_hr_jsonb_subset(v_new, v_keys),
                p_reason, v_actor, public.fn_hr_actor_name()
            );
            v_events := v_events + 1;
        END IF;
    END LOOP;

    RETURN v_events;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_change_employment(
    p_employee_id UUID,
    p_effective_date DATE,
    p_changes JSONB,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.manage');
    v_emp RECORD;
    v_events INTEGER;
BEGIN
    SELECT e.* INTO v_emp FROM public.hr_employees e
    WHERE e.id = p_employee_id AND e.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empleado no encontrado.' USING ERRCODE = '23503';
    END IF;
    IF v_emp.status = 'RETIRADO' THEN
        RAISE EXCEPTION 'El empleado está retirado; registre primero su reingreso.' USING ERRCODE = '55000';
    END IF;
    IF p_effective_date IS NULL OR p_effective_date < v_emp.hire_date OR p_effective_date > public.fn_hr_today() + 90 THEN
        RAISE EXCEPTION 'La fecha efectiva debe estar entre el ingreso y los próximos 90 días.' USING ERRCODE = '22023';
    END IF;
    IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'Indique el motivo del cambio (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    v_events := public.fn_hr_apply_employment_changes(p_employee_id, p_changes, p_effective_date, btrim(p_reason));

    IF v_events = 0 THEN
        RAISE EXCEPTION 'No hay cambios laborales para registrar.' USING ERRCODE = '22023';
    END IF;

    PERFORM public.fn_hr_accrue_vacations(p_employee_id, public.fn_hr_today());

    RETURN jsonb_build_object('success', true, 'events', v_events);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_terminate_employee(
    p_employee_id UUID,
    p_termination_date DATE,
    p_cause VARCHAR,
    p_reason TEXT,
    p_compensate_vacations BOOLEAN DEFAULT false,
    p_compensation_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.manage');
    v_emp RECORD;
    v_pending NUMERIC := 0;
    v_to_compensate NUMERIC;
    v_period RECORD;
    v_remaining NUMERIC;
    v_take NUMERIC;
    v_actor UUID := CASE WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()) THEN auth.uid() END;
BEGIN
    SELECT e.* INTO v_emp FROM public.hr_employees e
    WHERE e.id = p_employee_id AND e.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empleado no encontrado.' USING ERRCODE = '23503';
    END IF;
    IF v_emp.status = 'RETIRADO' THEN
        RAISE EXCEPTION 'El empleado ya se encuentra retirado.' USING ERRCODE = '55000';
    END IF;
    IF p_termination_date IS NULL OR p_termination_date < v_emp.hire_date OR p_termination_date > public.fn_hr_today() THEN
        RAISE EXCEPTION 'La fecha de retiro debe estar entre la fecha de ingreso y hoy.' USING ERRCODE = '22023';
    END IF;
    IF p_cause IS NULL OR p_cause NOT IN (
        'RENUNCIA_VOLUNTARIA', 'DESPIDO_JUSTA_CAUSA', 'DESPIDO_SIN_JUSTA_CAUSA', 'MUTUO_ACUERDO',
        'VENCIMIENTO_TERMINO_FIJO', 'TERMINACION_OBRA_LABOR', 'PERIODO_PRUEBA', 'PENSION',
        'FALLECIMIENTO', 'OTRA'
    ) THEN
        RAISE EXCEPTION 'Causa de retiro no válida.' USING ERRCODE = '22023';
    END IF;
    IF char_length(btrim(COALESCE(p_reason, ''))) < 10 THEN
        RAISE EXCEPTION 'Describa el motivo del retiro (mínimo 10 caracteres).' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.hr_vacation_requests r
        WHERE r.employee_id = p_employee_id
          AND r.status = 'APROBADA'
          AND r.start_date <= p_termination_date
          AND r.end_date > p_termination_date
    ) THEN
        RAISE EXCEPTION 'Hay vacaciones aprobadas que terminan después de la fecha de retiro; cancele o ajuste esa solicitud primero.'
            USING ERRCODE = '55000';
    END IF;

    PERFORM public.fn_hr_set_internal(true);

    -- Solicitudes pendientes y vacaciones aprobadas posteriores al retiro se cancelan
    UPDATE public.hr_vacation_allocations a
    SET released_at = NOW()
    FROM public.hr_vacation_requests r
    WHERE a.request_id = r.id
      AND a.released_at IS NULL
      AND r.employee_id = p_employee_id
      AND r.status = 'APROBADA'
      AND r.start_date > p_termination_date;

    UPDATE public.hr_vacation_requests r
    SET status = 'CANCELADA', cancel_reason = 'Retiro del empleado'
    WHERE r.employee_id = p_employee_id
      AND (r.status = 'PENDIENTE' OR (r.status = 'APROBADA' AND r.start_date > p_termination_date));

    UPDATE public.hr_novelties n
    SET status = 'ANULADA', cancel_reason = 'Retiro del empleado'
    WHERE n.employee_id = p_employee_id
      AND n.status IN ('PENDIENTE', 'APROBADA')
      AND n.start_date > p_termination_date;

    PERFORM public.fn_hr_set_internal(false);

    -- Causación hasta la fecha de retiro (proporcional por fracción, Art. 189 CST)
    PERFORM public.fn_hr_accrue_vacations(p_employee_id, p_termination_date);
    v_pending := GREATEST(round(public.fn_hr_vacation_available(p_employee_id), 2), 0);

    IF v_pending > 0 THEN
        IF NOT COALESCE(p_compensate_vacations, false) THEN
            RAISE EXCEPTION 'El empleado tiene % días de vacaciones pendientes. Deben disfrutarse antes del retiro o registrarse su compensación en dinero con el motivo.', v_pending
                USING ERRCODE = '55000';
        END IF;
        IF char_length(btrim(COALESCE(p_compensation_reason, ''))) < 10 THEN
            RAISE EXCEPTION 'Indique el motivo de la compensación de vacaciones en dinero (mínimo 10 caracteres).' USING ERRCODE = '22023';
        END IF;

        v_to_compensate := v_pending;
        FOR v_period IN
            SELECT p.* FROM public.hr_vacation_periods p
            WHERE p.employee_id = p_employee_id AND p.employment_start = v_emp.hire_date
            ORDER BY p.period_number
            FOR UPDATE
        LOOP
            EXIT WHEN v_to_compensate <= 0;
            v_remaining := v_period.days_accrued - v_period.days_taken - v_period.days_compensated;
            IF v_remaining > 0 THEN
                v_take := LEAST(v_remaining, v_to_compensate);
                UPDATE public.hr_vacation_periods
                SET days_compensated = days_compensated + v_take
                WHERE id = v_period.id;
                v_to_compensate := v_to_compensate - v_take;
            END IF;
        END LOOP;
        PERFORM public.fn_hr_refresh_period_status(p_employee_id);
    END IF;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_employees
    SET status = 'RETIRADO',
        termination_date = p_termination_date,
        termination_cause = p_cause,
        termination_reason = btrim(p_reason)
    WHERE id = p_employee_id;
    PERFORM public.fn_hr_set_internal(false);

    INSERT INTO public.hr_employment_events (
        company_id, employee_id, event_type, effective_date, previous_values, new_values,
        termination_cause, reason, created_by, created_by_name
    ) VALUES (
        v_company_id, p_employee_id, 'RETIRO', p_termination_date,
        jsonb_build_object('status', v_emp.status),
        jsonb_build_object(
            'status', 'RETIRADO',
            'vacation_days_compensated', v_pending,
            'compensation_reason', CASE WHEN v_pending > 0 THEN btrim(p_compensation_reason) END
        ),
        p_cause, btrim(p_reason), v_actor, public.fn_hr_actor_name()
    );

    RETURN jsonb_build_object(
        'success', true,
        'vacation_days_compensated', v_pending,
        'has_erp_user', v_emp.user_id IS NOT NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_rehire_employee(
    p_employee_id UUID,
    p_hire_date DATE,
    p_changes JSONB,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.manage');
    v_emp RECORD;
    v_actor UUID := CASE WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()) THEN auth.uid() END;
BEGIN
    SELECT e.* INTO v_emp FROM public.hr_employees e
    WHERE e.id = p_employee_id AND e.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empleado no encontrado.' USING ERRCODE = '23503';
    END IF;
    IF v_emp.status <> 'RETIRADO' THEN
        RAISE EXCEPTION 'Solo se puede registrar el reingreso de un empleado retirado.' USING ERRCODE = '55000';
    END IF;
    IF p_hire_date IS NULL OR p_hire_date <= v_emp.termination_date OR p_hire_date > public.fn_hr_today() + 90 THEN
        RAISE EXCEPTION 'La fecha de reingreso debe ser posterior al retiro y no superar 90 días en el futuro.' USING ERRCODE = '22023';
    END IF;
    IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'Indique el motivo del reingreso (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_employees
    SET status = 'ACTIVO',
        hire_date = p_hire_date,
        termination_date = NULL,
        termination_cause = NULL,
        termination_reason = NULL,
        contract_end_date = CASE WHEN contract_end_date IS NOT NULL AND contract_end_date < p_hire_date THEN NULL ELSE contract_end_date END
    WHERE id = p_employee_id;
    PERFORM public.fn_hr_set_internal(false);

    INSERT INTO public.hr_employment_events (
        company_id, employee_id, event_type, effective_date, previous_values, new_values,
        reason, created_by, created_by_name
    ) VALUES (
        v_company_id, p_employee_id, 'REINGRESO', p_hire_date,
        jsonb_build_object('status', 'RETIRADO', 'hire_date', v_emp.hire_date, 'termination_date', v_emp.termination_date),
        jsonb_build_object('status', 'ACTIVO', 'hire_date', p_hire_date),
        btrim(p_reason), v_actor, public.fn_hr_actor_name()
    );

    IF p_changes IS NOT NULL AND p_changes <> '{}'::jsonb THEN
        PERFORM public.fn_hr_apply_employment_changes(p_employee_id, p_changes, p_hire_date, btrim(p_reason));
    END IF;

    PERFORM public.fn_hr_accrue_vacations(p_employee_id, public.fn_hr_today());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 16. RPC: aprobación y anulación de novedades
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_hr_review_novelty(
    p_novelty_id UUID,
    p_approve BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.manage');
    v_nov RECORD;
BEGIN
    SELECT n.* INTO v_nov FROM public.hr_novelties n
    WHERE n.id = p_novelty_id AND n.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Novedad no encontrada.' USING ERRCODE = '23503';
    END IF;
    IF v_nov.status <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'La novedad ya fue revisada (estado: %).', v_nov.status USING ERRCODE = '55000';
    END IF;
    IF NOT COALESCE(p_approve, false) AND char_length(btrim(COALESCE(p_notes, ''))) < 5 THEN
        RAISE EXCEPTION 'Indique el motivo del rechazo (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    IF COALESCE(p_approve, false) AND v_nov.hours IS NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.hr_novelties n
            WHERE n.employee_id = v_nov.employee_id
              AND n.id <> v_nov.id
              AND n.status = 'APROBADA'
              AND n.hours IS NULL
              AND n.start_date <= v_nov.end_date
              AND n.end_date >= v_nov.start_date
        ) THEN
            RAISE EXCEPTION 'Las fechas se cruzan con otra novedad aprobada del empleado.' USING ERRCODE = '23P01';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.hr_vacation_requests r
            WHERE r.employee_id = v_nov.employee_id
              AND r.status IN ('APROBADA', 'DISFRUTADA')
              AND r.start_date <= v_nov.end_date
              AND r.end_date >= v_nov.start_date
        ) THEN
            RAISE EXCEPTION 'Las fechas se cruzan con vacaciones aprobadas del empleado.' USING ERRCODE = '23P01';
        END IF;
    END IF;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_novelties
    SET status = CASE WHEN COALESCE(p_approve, false) THEN 'APROBADA' ELSE 'RECHAZADA' END,
        review_notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
        reviewed_by = auth.uid(),
        reviewed_at = NOW()
    WHERE id = p_novelty_id;
    PERFORM public.fn_hr_set_internal(false);

    PERFORM public.fn_hr_accrue_vacations(v_nov.employee_id, public.fn_hr_today());
    PERFORM public.fn_hr_sync_employee_status(v_nov.employee_id);

    RETURN jsonb_build_object('success', true, 'status', CASE WHEN COALESCE(p_approve, false) THEN 'APROBADA' ELSE 'RECHAZADA' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_cancel_novelty(p_novelty_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.manage');
    v_nov RECORD;
BEGIN
    SELECT n.* INTO v_nov FROM public.hr_novelties n
    WHERE n.id = p_novelty_id AND n.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Novedad no encontrada.' USING ERRCODE = '23503';
    END IF;
    IF v_nov.status NOT IN ('PENDIENTE', 'APROBADA') THEN
        RAISE EXCEPTION 'Solo se pueden anular novedades pendientes o aprobadas.' USING ERRCODE = '55000';
    END IF;
    IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'Indique el motivo de la anulación (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_novelties
    SET status = 'ANULADA', cancel_reason = btrim(p_reason)
    WHERE id = p_novelty_id;
    PERFORM public.fn_hr_set_internal(false);

    PERFORM public.fn_hr_accrue_vacations(v_nov.employee_id, public.fn_hr_today());
    PERFORM public.fn_hr_sync_employee_status(v_nov.employee_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 17. RPC: aprobación y cancelación de vacaciones
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_hr_review_vacation_request(
    p_request_id UUID,
    p_approve BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.manage');
    v_req RECORD;
    v_emp RECORD;
    v_available NUMERIC;
    v_to_allocate NUMERIC;
    v_period RECORD;
    v_remaining NUMERIC;
    v_take NUMERIC;
BEGIN
    SELECT r.* INTO v_req FROM public.hr_vacation_requests r
    WHERE r.id = p_request_id AND r.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud de vacaciones no encontrada.' USING ERRCODE = '23503';
    END IF;
    IF v_req.status <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'La solicitud ya fue revisada (estado: %).', v_req.status USING ERRCODE = '55000';
    END IF;

    IF NOT COALESCE(p_approve, false) THEN
        IF char_length(btrim(COALESCE(p_notes, ''))) < 5 THEN
            RAISE EXCEPTION 'Indique el motivo del rechazo (mínimo 5 caracteres).' USING ERRCODE = '22023';
        END IF;
        PERFORM public.fn_hr_set_internal(true);
        UPDATE public.hr_vacation_requests
        SET status = 'RECHAZADA', review_notes = btrim(p_notes), reviewed_by = auth.uid(), reviewed_at = NOW()
        WHERE id = p_request_id;
        PERFORM public.fn_hr_set_internal(false);
        RETURN jsonb_build_object('success', true, 'status', 'RECHAZADA');
    END IF;

    SELECT e.* INTO v_emp FROM public.hr_employees e WHERE e.id = v_req.employee_id FOR UPDATE;
    IF v_emp.status = 'RETIRADO' THEN
        RAISE EXCEPTION 'El empleado está retirado.' USING ERRCODE = '55000';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.hr_novelties n
        WHERE n.employee_id = v_req.employee_id
          AND n.status = 'APROBADA'
          AND n.hours IS NULL
          AND n.start_date <= v_req.end_date
          AND n.end_date >= v_req.start_date
    ) THEN
        RAISE EXCEPTION 'Las fechas se cruzan con una novedad aprobada (incapacidad, licencia o permiso).' USING ERRCODE = '23P01';
    END IF;

    PERFORM public.fn_hr_accrue_vacations(v_req.employee_id, public.fn_hr_today());
    v_available := public.fn_hr_vacation_available(v_req.employee_id);

    IF v_req.business_days > v_available THEN
        RAISE EXCEPTION 'Saldo insuficiente: la solicitud tiene % días hábiles y el saldo es % días.',
            v_req.business_days, round(v_available, 2) USING ERRCODE = '55000';
    END IF;

    -- Asignación a los periodos más antiguos primero
    v_to_allocate := v_req.business_days;
    FOR v_period IN
        SELECT p.* FROM public.hr_vacation_periods p
        WHERE p.employee_id = v_req.employee_id AND p.employment_start = v_emp.hire_date
        ORDER BY p.period_number
        FOR UPDATE
    LOOP
        EXIT WHEN v_to_allocate <= 0;
        v_remaining := v_period.days_accrued - v_period.days_taken - v_period.days_compensated;
        IF v_remaining > 0 THEN
            v_take := LEAST(v_remaining, v_to_allocate);
            INSERT INTO public.hr_vacation_allocations (company_id, request_id, period_id, days)
            VALUES (v_company_id, p_request_id, v_period.id, v_take);
            UPDATE public.hr_vacation_periods SET days_taken = days_taken + v_take WHERE id = v_period.id;
            v_to_allocate := v_to_allocate - v_take;
        END IF;
    END LOOP;

    IF v_to_allocate > 0 THEN
        RAISE EXCEPTION 'No fue posible asignar todos los días a los periodos causados.' USING ERRCODE = '55000';
    END IF;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_vacation_requests
    SET status = 'APROBADA',
        review_notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
        reviewed_by = auth.uid(),
        reviewed_at = NOW()
    WHERE id = p_request_id;
    PERFORM public.fn_hr_set_internal(false);

    PERFORM public.fn_hr_refresh_period_status(v_req.employee_id);
    PERFORM public.fn_hr_sync_employee_status(v_req.employee_id);

    RETURN jsonb_build_object('success', true, 'status', 'APROBADA', 'business_days', v_req.business_days);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_cancel_vacation_request(p_request_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.manage');
    v_req RECORD;
BEGIN
    SELECT r.* INTO v_req FROM public.hr_vacation_requests r
    WHERE r.id = p_request_id AND r.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud de vacaciones no encontrada.' USING ERRCODE = '23503';
    END IF;
    IF v_req.status NOT IN ('PENDIENTE', 'APROBADA') THEN
        RAISE EXCEPTION 'Solo se pueden cancelar solicitudes pendientes o aprobadas.' USING ERRCODE = '55000';
    END IF;
    IF v_req.status = 'APROBADA' AND v_req.start_date <= public.fn_hr_today() THEN
        RAISE EXCEPTION 'Las vacaciones ya iniciaron; no se pueden cancelar.' USING ERRCODE = '55000';
    END IF;
    IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'Indique el motivo de la cancelación (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    UPDATE public.hr_vacation_allocations
    SET released_at = NOW()
    WHERE request_id = p_request_id AND released_at IS NULL;

    PERFORM public.fn_hr_set_internal(true);
    UPDATE public.hr_vacation_requests
    SET status = 'CANCELADA', cancel_reason = btrim(p_reason)
    WHERE id = p_request_id;
    PERFORM public.fn_hr_set_internal(false);

    PERFORM public.fn_hr_refresh_period_status(v_req.employee_id);
    PERFORM public.fn_hr_sync_employee_status(v_req.employee_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 18. RPC: acceso auditado a documentos y resumen del tablero
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_hr_log_document_access(p_document_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.documents');
    v_doc RECORD;
BEGIN
    SELECT d.* INTO v_doc FROM public.hr_documents d
    WHERE d.id = p_document_id AND d.company_id = v_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento no encontrado.' USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, new_value, created_at
    ) VALUES (
        v_company_id,
        CASE WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()) THEN auth.uid() END,
        public.fn_hr_actor_name(),
        'HR_DOCUMENT_ACCESSED', 'HR', 'hr_documents', v_doc.id::text,
        jsonb_build_object('employee_id', v_doc.employee_id, 'document_type', v_doc.document_type),
        NOW()
    );

    RETURN v_doc.storage_path;
END;
$$;

-- Registro de exportaciones de reportes (sin contenido; solo tipo, filas y si incluyó datos sensibles)
CREATE OR REPLACE FUNCTION public.fn_hr_log_export(
    p_report VARCHAR,
    p_rows INTEGER,
    p_includes_sensitive BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.read');
BEGIN
    IF p_report IS NULL OR p_report NOT IN ('PLANTA', 'MOVIMIENTOS', 'AUSENTISMO', 'VACACIONES', 'NOMINA') THEN
        RAISE EXCEPTION 'Reporte no válido.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(p_includes_sensitive, false) AND NOT public.fn_hr_can('hr.sensitive') THEN
        RAISE EXCEPTION 'Acceso denegado: no tiene permiso para exportar datos sensibles.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, new_value, created_at
    ) VALUES (
        v_company_id,
        CASE WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()) THEN auth.uid() END,
        public.fn_hr_actor_name(),
        'HR_REPORT_EXPORTED', 'HR', 'hr_reports', p_report,
        jsonb_build_object('rows', GREATEST(COALESCE(p_rows, 0), 0), 'includes_sensitive', COALESCE(p_includes_sensitive, false)),
        NOW()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID := public.fn_hr_require('hr.read');
    v_today DATE := public.fn_hr_today();
    v_month_start DATE := date_trunc('month', public.fn_hr_today())::date;
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'active_employees', (SELECT count(*) FROM public.hr_employees e WHERE e.company_id = v_company_id AND e.status <> 'RETIRADO'),
        'on_vacation', (SELECT count(*) FROM public.hr_employees e WHERE e.company_id = v_company_id AND e.status = 'EN_VACACIONES'),
        'incapacitated', (SELECT count(*) FROM public.hr_employees e WHERE e.company_id = v_company_id AND e.status = 'INCAPACITADO'),
        'hires_this_month', (SELECT count(*) FROM public.hr_employment_events ev
                             WHERE ev.company_id = v_company_id AND ev.event_type IN ('INGRESO', 'REINGRESO')
                               AND ev.effective_date BETWEEN v_month_start AND v_today),
        'terminations_this_month', (SELECT count(*) FROM public.hr_employment_events ev
                                    WHERE ev.company_id = v_company_id AND ev.event_type = 'RETIRO'
                                      AND ev.effective_date BETWEEN v_month_start AND v_today),
        'active_novelties', (SELECT count(*) FROM public.hr_novelties n
                             WHERE n.company_id = v_company_id AND n.status = 'APROBADA'
                               AND v_today BETWEEN n.start_date AND n.end_date),
        'pending_novelties', (SELECT count(*) FROM public.hr_novelties n
                              WHERE n.company_id = v_company_id AND n.status = 'PENDIENTE'),
        'pending_vacation_requests', (SELECT count(*) FROM public.hr_vacation_requests r
                                      WHERE r.company_id = v_company_id AND r.status = 'PENDIENTE'),
        'vacation_overdue', (SELECT count(*) FROM public.fn_hr_vacation_alerts() a WHERE a.alert_level IN ('PENDIENTE', 'CRITICA')),
        'vacation_critical', (SELECT count(*) FROM public.fn_hr_vacation_alerts() a WHERE a.alert_level = 'CRITICA'),
        'documents_expiring', (SELECT count(*) FROM public.hr_documents d
                               JOIN public.hr_employees e ON e.id = d.employee_id
                               WHERE d.company_id = v_company_id AND d.is_archived = false AND e.status <> 'RETIRADO'
                                 AND d.expires_at BETWEEN v_today AND v_today + 30),
        'documents_expired', (SELECT count(*) FROM public.hr_documents d
                              JOIN public.hr_employees e ON e.id = d.employee_id
                              WHERE d.company_id = v_company_id AND d.is_archived = false AND e.status <> 'RETIRADO'
                                AND d.expires_at < v_today),
        'by_area', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'count', x.total) ORDER BY x.total DESC)
                             FROM (SELECT a.id, COALESCE(a.name, 'Sin área') AS name, count(*) AS total
                                   FROM public.hr_employees e
                                   LEFT JOIN public.hr_areas a ON a.id = e.area_id
                                   WHERE e.company_id = v_company_id AND e.status <> 'RETIRADO'
                                   GROUP BY a.id, a.name) x), '[]'::jsonb),
        'by_location', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'count', x.total) ORDER BY x.total DESC)
                                 FROM (SELECT l.id, COALESCE(l.name, 'Sin sede') AS name, count(*) AS total
                                       FROM public.hr_employees e
                                       LEFT JOIN public.locations l ON l.id = e.location_id
                                       WHERE e.company_id = v_company_id AND e.status <> 'RETIRADO'
                                       GROUP BY l.id, l.name) x), '[]'::jsonb),
        'as_of', v_today
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ------------------------------------------------------------------------------
-- 19. RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.hr_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_novelties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_vacation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_vacation_allocations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    -- Lectura con hr.read en la empresa de la sesión
    FOREACH t IN ARRAY ARRAY[
        'hr_areas', 'hr_positions', 'hr_employees', 'hr_employment_events', 'hr_documents',
        'hr_novelties', 'hr_vacation_periods', 'hr_vacation_requests', 'hr_vacation_allocations'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "HR read %1$s" ON public.%1$I', t);
        EXECUTE format(
            'CREATE POLICY "HR read %1$s" ON public.%1$I FOR SELECT TO authenticated
             USING (company_id = public.get_auth_company_id() AND public.fn_hr_can(''hr.read''))',
            t
        );
    END LOOP;

    -- Escritura directa con hr.manage (los triggers limitan qué se puede cambiar)
    FOREACH t IN ARRAY ARRAY['hr_areas', 'hr_positions', 'hr_employees', 'hr_novelties', 'hr_vacation_requests']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "HR insert %1$s" ON public.%1$I', t);
        EXECUTE format(
            'CREATE POLICY "HR insert %1$s" ON public.%1$I FOR INSERT TO authenticated
             WITH CHECK (company_id = public.get_auth_company_id() AND public.fn_hr_can(''hr.manage''))',
            t
        );
        EXECUTE format('DROP POLICY IF EXISTS "HR update %1$s" ON public.%1$I', t);
        EXECUTE format(
            'CREATE POLICY "HR update %1$s" ON public.%1$I FOR UPDATE TO authenticated
             USING (company_id = public.get_auth_company_id() AND public.fn_hr_can(''hr.manage''))
             WITH CHECK (company_id = public.get_auth_company_id() AND public.fn_hr_can(''hr.manage''))',
            t
        );
    END LOOP;
END $$;

-- Documentos: carga y archivo con hr.documents
DROP POLICY IF EXISTS "HR insert hr_documents" ON public.hr_documents;
CREATE POLICY "HR insert hr_documents" ON public.hr_documents
FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_auth_company_id() AND public.fn_hr_can('hr.documents'));

DROP POLICY IF EXISTS "HR update hr_documents" ON public.hr_documents;
CREATE POLICY "HR update hr_documents" ON public.hr_documents
FOR UPDATE TO authenticated
USING (company_id = public.get_auth_company_id() AND public.fn_hr_can('hr.documents'))
WITH CHECK (company_id = public.get_auth_company_id() AND public.fn_hr_can('hr.documents'));

-- Cuenta bancaria completa: solo hr.sensitive (y hr.manage para escribir)
DROP POLICY IF EXISTS "HR sensitive read bank accounts" ON public.hr_employee_bank_accounts;
CREATE POLICY "HR sensitive read bank accounts" ON public.hr_employee_bank_accounts
FOR SELECT TO authenticated
USING (company_id = public.get_auth_company_id() AND public.fn_hr_can('hr.sensitive'));

DROP POLICY IF EXISTS "HR sensitive insert bank accounts" ON public.hr_employee_bank_accounts;
CREATE POLICY "HR sensitive insert bank accounts" ON public.hr_employee_bank_accounts
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.fn_hr_can('hr.sensitive')
    AND public.fn_hr_can('hr.manage')
);

DROP POLICY IF EXISTS "HR sensitive update bank accounts" ON public.hr_employee_bank_accounts;
CREATE POLICY "HR sensitive update bank accounts" ON public.hr_employee_bank_accounts
FOR UPDATE TO authenticated
USING (company_id = public.get_auth_company_id() AND public.fn_hr_can('hr.sensitive') AND public.fn_hr_can('hr.manage'))
WITH CHECK (company_id = public.get_auth_company_id() AND public.fn_hr_can('hr.sensitive') AND public.fn_hr_can('hr.manage'));

-- Privilegios de tabla explícitos (sin DELETE para clientes)
REVOKE ALL ON TABLE
    public.hr_areas, public.hr_positions, public.hr_employees, public.hr_employee_bank_accounts,
    public.hr_employment_events, public.hr_documents, public.hr_novelties, public.hr_vacation_periods,
    public.hr_vacation_requests, public.hr_vacation_allocations
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.hr_areas, public.hr_positions, public.hr_employees, public.hr_employee_bank_accounts,
    public.hr_employment_events, public.hr_documents, public.hr_novelties, public.hr_vacation_periods,
    public.hr_vacation_requests, public.hr_vacation_allocations
TO authenticated;

GRANT INSERT, UPDATE ON TABLE
    public.hr_areas, public.hr_positions, public.hr_employees, public.hr_employee_bank_accounts,
    public.hr_documents, public.hr_novelties, public.hr_vacation_requests
TO authenticated;

GRANT ALL ON TABLE
    public.hr_areas, public.hr_positions, public.hr_employees, public.hr_employee_bank_accounts,
    public.hr_employment_events, public.hr_documents, public.hr_novelties, public.hr_vacation_periods,
    public.hr_vacation_requests, public.hr_vacation_allocations
TO service_role;

-- ------------------------------------------------------------------------------
-- 20. Privilegios de funciones
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_hr_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hr_today() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_hr_can(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hr_can(VARCHAR) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_hr_business_days(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hr_business_days(DATE, DATE) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_hr_next_business_day(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hr_next_business_day(DATE) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_hr_vacation_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hr_vacation_alerts() TO authenticated, service_role;

-- Internas: solo propietario y service_role
REVOKE ALL ON FUNCTION public.fn_hr_require(VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_set_internal(BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_is_internal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_jsonb_subset(JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_actor_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_holidays_cover(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_days360(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_unpaid_days(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_refresh_period_status(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_accrue_vacations(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_vacation_available(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_sync_employee_status(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_notification_recipients(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_apply_employment_changes(UUID, JSONB, DATE, TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
    public.fn_hr_require(VARCHAR),
    public.fn_hr_set_internal(BOOLEAN),
    public.fn_hr_is_internal(),
    public.fn_hr_jsonb_subset(JSONB, TEXT[]),
    public.fn_hr_actor_name(),
    public.fn_hr_holidays_cover(DATE, DATE),
    public.fn_hr_days360(DATE, DATE),
    public.fn_hr_unpaid_days(UUID, DATE, DATE),
    public.fn_hr_refresh_period_status(UUID),
    public.fn_hr_accrue_vacations(UUID, DATE),
    public.fn_hr_vacation_available(UUID),
    public.fn_hr_sync_employee_status(UUID),
    public.fn_hr_notification_recipients(UUID),
    public.fn_hr_apply_employment_changes(UUID, JSONB, DATE, TEXT, VARCHAR)
TO service_role;

-- Funciones de trigger: no invocables directamente
REVOKE ALL ON FUNCTION public.fn_hr_audit_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_org_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_employees_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_employees_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_bank_accounts_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_bank_accounts_after_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_block_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_documents_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_novelties_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hr_vacation_requests_before_write() FROM PUBLIC, anon, authenticated;

-- RPC del módulo (cada una valida permisos y empresa)
REVOKE ALL ON FUNCTION public.fn_hr_refresh(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_change_employment(UUID, DATE, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_terminate_employee(UUID, DATE, VARCHAR, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_rehire_employee(UUID, DATE, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_review_novelty(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_cancel_novelty(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_review_vacation_request(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_cancel_vacation_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_log_document_access(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_dashboard_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_hr_log_export(VARCHAR, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
    public.fn_hr_refresh(UUID),
    public.fn_hr_change_employment(UUID, DATE, JSONB, TEXT),
    public.fn_hr_terminate_employee(UUID, DATE, VARCHAR, TEXT, BOOLEAN, TEXT),
    public.fn_hr_rehire_employee(UUID, DATE, JSONB, TEXT),
    public.fn_hr_review_novelty(UUID, BOOLEAN, TEXT),
    public.fn_hr_cancel_novelty(UUID, TEXT),
    public.fn_hr_review_vacation_request(UUID, BOOLEAN, TEXT),
    public.fn_hr_cancel_vacation_request(UUID, TEXT),
    public.fn_hr_log_document_access(UUID),
    public.fn_hr_dashboard_summary(),
    public.fn_hr_log_export(VARCHAR, INTEGER, BOOLEAN)
TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 21. Supabase Storage: bucket privado hr-documents
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_hr_storage_can(p_object_name TEXT, p_permission VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_parts TEXT[] := string_to_array(COALESCE(p_object_name, ''), '/');
    v_company_id UUID := public.get_auth_company_id();
BEGIN
    IF v_company_id IS NULL OR NOT public.fn_hr_can(p_permission) THEN
        RETURN false;
    END IF;
    IF array_length(v_parts, 1) <> 3 OR v_parts[1] <> v_company_id::text THEN
        RETURN false;
    END IF;
    IF v_parts[3] !~ '^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$' THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.hr_employees e
        WHERE e.id::text = v_parts[2] AND e.company_id = v_company_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hr_document_path_registered(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.hr_documents d WHERE d.storage_path = p_object_name);
$$;

REVOKE ALL ON FUNCTION public.fn_hr_storage_can(TEXT, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hr_storage_can(TEXT, VARCHAR) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_hr_document_path_registered(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hr_document_path_registered(TEXT) TO authenticated, service_role;

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('hr-documents', 'hr-documents', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
    ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

    DROP POLICY IF EXISTS "HR documents read" ON storage.objects;
    CREATE POLICY "HR documents read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'hr-documents' AND public.fn_hr_storage_can(name, 'hr.documents'));

    DROP POLICY IF EXISTS "HR documents upload" ON storage.objects;
    CREATE POLICY "HR documents upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'hr-documents' AND public.fn_hr_storage_can(name, 'hr.documents'));

    -- Solo se puede borrar un archivo propio que no quedó registrado (carga fallida)
    DROP POLICY IF EXISTS "HR documents remove orphan upload" ON storage.objects;
    CREATE POLICY "HR documents remove orphan upload" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'hr-documents'
        AND owner = auth.uid()
        AND public.fn_hr_storage_can(name, 'hr.documents')
        AND NOT public.fn_hr_document_path_registered(name)
    );
EXCEPTION
    WHEN insufficient_privilege OR undefined_table OR undefined_column THEN
        RAISE WARNING 'No fue posible configurar el bucket hr-documents o sus políticas (%). Configúrelos desde el panel de Supabase.', SQLERRM;
END $$;

COMMIT;
