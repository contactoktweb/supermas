-- 087: quita los valores por defecto Medellín / Antioquia de clientes y bodegas.
-- La aplicación toma la ciudad y el departamento de la empresa al crear registros nuevos;
-- un valor fijo en la base hacía que quedaran en otra ciudad si el formulario no lo enviaba.
ALTER TABLE public.customers ALTER COLUMN city DROP DEFAULT;
ALTER TABLE public.customers ALTER COLUMN department DROP DEFAULT;
ALTER TABLE public.locations ALTER COLUMN department DROP DEFAULT;
