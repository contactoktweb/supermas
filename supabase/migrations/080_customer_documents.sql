-- 080: Expediente documental del cliente (RUT, Cámara de Comercio, cédula, pagarés...).
-- Archivo en el bucket privado customer-documents (ruta empresa/cliente/uuid.ext) y metadatos
-- en customer_documents. Lectura con customers.read; carga y archivo con customers.write.
-- Los documentos no se eliminan: se archivan para conservar la trazabilidad.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.customer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    category VARCHAR(30) NOT NULL
        CHECK (category IN ('RUT', 'CAMARA_COMERCIO', 'CEDULA', 'ACUERDO_COMERCIAL', 'OTRO')),
    name VARCHAR(150) NOT NULL CHECK (btrim(name) <> ''),
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
    storage_path TEXT NOT NULL UNIQUE,
    mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.users(id),
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_customer
    ON public.customer_documents (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_documents_company
    ON public.customer_documents (company_id);

CREATE OR REPLACE FUNCTION public.fn_customer_documents_before_write()
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
        NEW.created_at := NOW();

        IF NOT EXISTS (
            SELECT 1 FROM public.customers c WHERE c.id = NEW.customer_id AND c.company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'El cliente no pertenece a la empresa.' USING ERRCODE = '23503';
        END IF;

        v_parts := string_to_array(NEW.storage_path, '/');
        IF array_length(v_parts, 1) <> 3
           OR v_parts[1] <> NEW.company_id::text
           OR v_parts[2] <> NEW.customer_id::text
           OR v_parts[3] !~ '^[0-9a-f-]{36}\.(pdf|jpg|png)$' THEN
            RAISE EXCEPTION 'La ruta del archivo no es válida para este cliente.' USING ERRCODE = '22023';
        END IF;

        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM storage.objects o
                WHERE o.bucket_id = 'customer-documents' AND o.name = NEW.storage_path
            ) THEN
                RAISE EXCEPTION 'El archivo no se encuentra cargado en el almacenamiento.' USING ERRCODE = '23503';
            END IF;
        EXCEPTION
            WHEN insufficient_privilege OR undefined_table THEN
                NULL; -- Sin acceso al esquema storage: la política del bucket ya controla la carga
        END;
    ELSE
        IF NEW.company_id IS DISTINCT FROM OLD.company_id
           OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
           OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
           OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
           OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
           OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'El archivo de un documento no se puede reemplazar; adjunte uno nuevo.' USING ERRCODE = '42501';
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
    NEW.notes := NULLIF(btrim(COALESCE(NEW.notes, '')), '');
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_customer_documents_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_customer_documents_before_write ON public.customer_documents;
CREATE TRIGGER trg_customer_documents_before_write
    BEFORE INSERT OR UPDATE ON public.customer_documents
    FOR EACH ROW EXECUTE FUNCTION public.fn_customer_documents_before_write();

ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customer_documents FROM anon;
REVOKE DELETE, TRUNCATE ON public.customer_documents FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customer_documents TO authenticated;

DROP POLICY IF EXISTS customer_documents_select ON public.customer_documents;
CREATE POLICY customer_documents_select ON public.customer_documents
    FOR SELECT TO authenticated
    USING (company_id = public.get_auth_company_id() AND public.has_permission('customers.read'));

DROP POLICY IF EXISTS customer_documents_insert ON public.customer_documents;
CREATE POLICY customer_documents_insert ON public.customer_documents
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() AND public.has_permission('customers.write'));

DROP POLICY IF EXISTS customer_documents_update ON public.customer_documents;
CREATE POLICY customer_documents_update ON public.customer_documents
    FOR UPDATE TO authenticated
    USING (company_id = public.get_auth_company_id() AND public.has_permission('customers.write'))
    WITH CHECK (company_id = public.get_auth_company_id() AND public.has_permission('customers.write'));

-- Acceso al bucket: ruta empresa/cliente/uuid.ext de la empresa del usuario y permiso del módulo.
CREATE OR REPLACE FUNCTION public.fn_customer_storage_can(p_object_name TEXT, p_permission VARCHAR)
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
    IF v_company_id IS NULL OR NOT public.has_permission(p_permission) THEN
        RETURN false;
    END IF;
    IF array_length(v_parts, 1) <> 3 OR v_parts[1] <> v_company_id::text THEN
        RETURN false;
    END IF;
    IF v_parts[3] !~ '^[0-9a-f-]{36}\.(pdf|jpg|png)$' THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id::text = v_parts[2] AND c.company_id = v_company_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_customer_document_path_registered(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.customer_documents d WHERE d.storage_path = p_object_name);
$$;

REVOKE ALL ON FUNCTION public.fn_customer_storage_can(TEXT, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_customer_storage_can(TEXT, VARCHAR) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_customer_document_path_registered(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_customer_document_path_registered(TEXT) TO authenticated, service_role;

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('customer-documents', 'customer-documents', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
    ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

    DROP POLICY IF EXISTS "Customer documents read" ON storage.objects;
    CREATE POLICY "Customer documents read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'customer-documents' AND public.fn_customer_storage_can(name, 'customers.read'));

    DROP POLICY IF EXISTS "Customer documents upload" ON storage.objects;
    CREATE POLICY "Customer documents upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'customer-documents' AND public.fn_customer_storage_can(name, 'customers.write'));

    -- Solo se puede borrar un archivo propio que no quedó registrado (carga fallida)
    DROP POLICY IF EXISTS "Customer documents remove orphan upload" ON storage.objects;
    CREATE POLICY "Customer documents remove orphan upload" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'customer-documents'
        AND owner = auth.uid()
        AND public.fn_customer_storage_can(name, 'customers.write')
        AND NOT public.fn_customer_document_path_registered(name)
    );
END $$;

COMMIT;
