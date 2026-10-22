-- 081: Limpieza de parámetros de configuración que ningún módulo usa.
-- Configuración General solo conserva las claves que leen los módulos (features/settings/services/
-- runtime-settings.ts). Las demás se eliminan y los JSON vigentes quedan solo con sus campos en uso.
-- Re-ejecutable: los DELETE y las reconstrucciones son idempotentes.
BEGIN;
SET LOCAL lock_timeout = '5s';

DELETE FROM public.system_settings
WHERE key IN (
    'accounting.period.active_year',
    'alerts.scanner.interval_minutes',
    'billing.invoice.prefix',
    'billing.provider.name',
    'pricing.pos.active_list',
    'products.sku.auto_numbering',
    'products.sku.prefix',
    'security.auth.max_failed_attempts',
    'taxes.regime.autoretenedor',
    'warehouses.default.main_location_id'
);

-- Inventario: umbrales de stock predeterminados.
UPDATE public.system_settings
SET value = jsonb_build_object(
        'defaultMinStockThreshold', COALESCE(value::jsonb -> 'defaultMinStockThreshold', '10'::jsonb),
        'criticalLowStockThreshold', COALESCE(value::jsonb -> 'criticalLowStockThreshold', '3'::jsonb)
    ),
    description = 'Umbrales de stock predeterminados para productos nuevos e importados',
    is_critical = false,
    updated_at = NOW()
WHERE key = 'inventory.policies';

-- Punto de venta y cajas. La sede solo se conserva si es una sede real (antes había ids ficticios).
UPDATE public.system_settings s
SET value = jsonb_build_object(
        'defaultLocationId',
        CASE
            WHEN EXISTS (SELECT 1 FROM public.locations l WHERE l.id::text = s.value::jsonb ->> 'defaultLocationId')
                THEN s.value::jsonb -> 'defaultLocationId'
            ELSE '""'::jsonb
        END,
        'autoPrintReceipt', COALESCE(s.value::jsonb -> 'autoPrintReceipt', 'false'::jsonb),
        'cashRegisterRules', jsonb_build_object(
            'recommendedInitialFloat', COALESCE(s.value::jsonb #> '{cashRegisterRules,recommendedInitialFloat}', '100000'::jsonb),
            'maxAllowedInitialFloat', COALESCE(s.value::jsonb #> '{cashRegisterRules,maxAllowedInitialFloat}', '0'::jsonb),
            'maxDifferenceToleranceAmount', COALESCE(s.value::jsonb #> '{cashRegisterRules,maxDifferenceToleranceAmount}', '0'::jsonb)
        )
    ),
    description = 'Parámetros del punto de venta y reglas de caja',
    is_critical = false,
    updated_at = NOW()
WHERE s.key = 'pos.terminal_rules';

-- Canales web: activación de catálogos y WhatsApp comercial. La bodega de despacho vive en locations.
UPDATE public.system_settings
SET value = jsonb_build_object(
        'superCatalogEnabled', COALESCE(value::jsonb -> 'superCatalogEnabled', 'true'::jsonb),
        'distributorCatalogEnabled', COALESCE(value::jsonb -> 'distributorCatalogEnabled', 'true'::jsonb),
        'whatsapp', jsonb_build_object(
            'phoneNumber', COALESCE(value::jsonb #> '{whatsapp,phoneNumber}', '""'::jsonb),
            'defaultQuoteTemplate', COALESCE(value::jsonb #> '{whatsapp,defaultQuoteTemplate}', '""'::jsonb)
        )
    ),
    description = 'Canales web, catálogos públicos y contacto por WhatsApp',
    is_critical = false,
    updated_at = NOW()
WHERE key = 'ecommerce.dispatch_node';

UPDATE public.system_settings
SET description = 'Año gravable predeterminado para información exógena', is_critical = false
WHERE key = 'exogena.reporting.default_year';

UPDATE public.system_settings
SET description = 'Minutos de inactividad antes de cerrar la sesión', is_critical = false
WHERE key = 'security.session.timeout_minutes';

COMMIT;
