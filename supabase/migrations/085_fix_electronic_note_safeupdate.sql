-- ==============================================================================
-- 085_FIX_ELECTRONIC_NOTE_SAFEUPDATE.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
--
-- fn_create_electronic_note vaciaba su tabla temporal con "DELETE FROM tmp_note_lines;".
-- Supabase carga pg-safeupdate en las peticiones de la API, que rechaza todo DELETE sin
-- WHERE ("DELETE requires a WHERE clause"), así que ninguna nota crédito/débito se podía
-- emitir desde la aplicación. Se cambia solo esa sentencia sobre la definición vigente.
-- ==============================================================================

DO $$
DECLARE
  v_def TEXT;
  v_fixed TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_create_electronic_note';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No existe public.fn_create_electronic_note.';
  END IF;

  v_fixed := replace(v_def, 'DELETE FROM tmp_note_lines;', 'DELETE FROM tmp_note_lines WHERE true;');

  IF v_fixed = v_def THEN
    IF position('DELETE FROM tmp_note_lines WHERE true;' IN v_def) > 0 THEN
      RAISE NOTICE 'fn_create_electronic_note ya estaba corregida.';
      RETURN;
    END IF;
    RAISE EXCEPTION 'No se encontró la sentencia a corregir en fn_create_electronic_note.';
  END IF;

  EXECUTE v_fixed;
END $$;
