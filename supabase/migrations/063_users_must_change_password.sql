-- ==============================================================================
-- 063_USERS_MUST_CHANGE_PASSWORD.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Cambio obligatorio de contraseña en el primer ingreso: el trigger de auth.users
-- deja de resincronizar public.users cuando SOLO cambia la bandera de contraseña.
--
-- Contexto:
--   - Los usuarios creados por un administrador reciben
--     auth.users.raw_app_meta_data.must_change_password = true (Admin API / service_role).
--     La bandera viaja en el JWT y el middleware la usa para exigir el cambio.
--   - Al cambiar la contraseña, el servidor la pasa a false con auth.admin.updateUserById.
--   - Desde 016, on_auth_user_created se dispara en AFTER UPDATE OF raw_app_meta_data y
--     ejecuta handle_new_auth_user(), que reescribe public.users.role_id / full_name desde
--     los metadatos. Quitar la bandera podía revertir un cambio de rol hecho después en el
--     ERP (o degradar a SELLER una cuenta con role = 'SUPERADMIN' no-bootstrap).
--
-- Cambio:
--   - on_auth_user_created queda solo para INSERT (comportamiento idéntico al alta).
--   - Nuevo on_auth_user_app_metadata_updated: AFTER UPDATE OF raw_app_meta_data, pero
--     solo cuando cambia algo DISTINTO de must_change_password.
--   - La función handle_new_auth_user() NO se modifica.
--
-- Datos: no modifica ninguna fila. Los usuarios existentes (incluidos los SUPERADMIN)
-- no tienen la bandera y no se ven afectados. Sin columna espejo en public.users: la
-- fuente de verdad es app_metadata (solo escribible con service_role).
--
-- Re-ejecutable: DROP TRIGGER IF EXISTS + CREATE TRIGGER dentro de una transacción.
-- Rollback: recrear el trigger único de 016 (AFTER INSERT OR UPDATE OF raw_app_meta_data).
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_app_metadata_updated ON auth.users;
CREATE TRIGGER on_auth_user_app_metadata_updated
AFTER UPDATE OF raw_app_meta_data ON auth.users
FOR EACH ROW
WHEN (
    (COALESCE(OLD.raw_app_meta_data, '{}'::jsonb) - 'must_change_password')
    IS DISTINCT FROM
    (COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) - 'must_change_password')
)
EXECUTE FUNCTION public.handle_new_auth_user();

COMMIT;
