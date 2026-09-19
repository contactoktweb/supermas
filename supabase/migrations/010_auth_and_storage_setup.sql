-- ==============================================================================
-- 010_AUTH_AND_STORAGE_SETUP.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Trigger para sincronizar automáticamente auth.users con public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id UUID;
BEGIN
    -- Asignar rol por defecto SELLER si no viene especificado en metadata
    SELECT id INTO default_role_id FROM public.roles WHERE code = COALESCE(NEW.raw_user_meta_data->>'role', 'SELLER');
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public.roles WHERE code = 'SELLER';
    END IF;

    INSERT INTO public.users (
        id,
        email,
        full_name,
        role_id,
        phone,
        avatar_url,
        is_active
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        default_role_id,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url',
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Creación y Configuración de Buckets de Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('products', 'products', true),      -- Fotos de catálogo y productos (público)
    ('company', 'company', true),        -- Logos e identidad institucional (público)
    ('invoices', 'invoices', false),     -- PDFs y XMLs firmados de la DIAN (privado)
    ('suppliers', 'suppliers', false),   -- Facturas de compra y soportes (privado)
    ('documents', 'documents', false),   -- Remisiones, comprobantes y contratos (privado)
    ('users', 'users', true)             -- Avatares de miembros de equipo (público)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso para Supabase Storage
-- Lectura pública para productos, logos y avatares
CREATE POLICY "Public read products images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'products');
CREATE POLICY "Public read company assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'company');
CREATE POLICY "Public read user avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'users');

-- Carga permitida a usuarios autenticados
CREATE POLICY "Authenticated upload products" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products');
CREATE POLICY "Authenticated upload company" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company');
CREATE POLICY "Authenticated upload users" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'users');

-- Acceso restringido a documentos contables y tributarios (invoices, suppliers, documents)
CREATE POLICY "Private invoices access" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id IN ('invoices', 'suppliers', 'documents') AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT')
);
