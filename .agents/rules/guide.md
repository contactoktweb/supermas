---
trigger: always_on
---

# SUPER MÁS ERP/POS — REGLAS MAESTRAS PARA AGENTE IA

## Contexto
Proyecto ERP/POS de Distribuidora Super Más.

Stack objetivo:
- Next.js + TypeScript.
- Supabase/PostgreSQL.
- Prisma recomendado para acceso a datos.
- Supabase Storage.
- UI administrativa en español.
- Zona horaria: America/Bogota.

Existe un sistema previo en React + NestJS + Prisma + PostgreSQL. Debe reutilizarse lo que sea técnicamente válido; no reescribir por defecto.

---

## Principios obligatorios

1. Priorizar integridad, seguridad, trazabilidad y mantenibilidad.
2. No modificar arquitectura crítica sin revisar primero el código existente.
3. No eliminar funciones existentes sin comprobar paridad funcional.
4. No hacer migraciones destructivas sin backup y aprobación.
5. No inventar reglas fiscales, contables o DIAN.
6. Preguntar antes de decisiones irreversibles sobre costeo, facturación, contabilidad, impuestos o migración de datos.

---

## Arquitectura

Usar separación clara:

UI → validación → service → repository → Prisma/PostgreSQL.

No colocar lógica compleja dentro de `route.ts`, Server Actions o componentes React.

Organización recomendada:

```text
src/
├── app/
├── features/
│   ├── warehouses/
│   ├── products/
│   ├── inventory/
│   ├── purchases/
│   ├── sales/
│   ├── accounting/
│   └── ...
├── components/
├── server/
├── lib/
└── config/
```

Cada feature puede incluir:
- components;
- schemas;
- services;
- repositories;
- types;
- tests.

No crear archivos gigantes ni duplicar servicios.

---

## React / Next.js

- Server Components por defecto.
- `"use client"` solo cuando sea necesario.
- No consultar DB desde componentes cliente.
- Formularios con Zod y validación también en servidor.
- No confiar en precios, totales, permisos, stock o impuestos enviados por frontend.
- Interfaces responsive.
- Estados loading, error y empty obligatorios.
- Evitar componentes monolíticos.

---

## Diseño

Mantener identidad visual Super Más:
- azul oscuro;
- rojo;
- blanco/grises;
- estilo SaaS administrativo moderno.

La aplicación debe sentirse muy interactiva.

Usar microanimaciones sutiles en:
- carga de vistas;
- cards;
- contadores;
- tablas;
- filtros;
- botones;
- drawers;
- modales;
- gráficas;
- tabs;
- hover.

Animaciones rápidas y profesionales. Evitar efectos pesados.

Respetar `prefers-reduced-motion`.

---

## Seguridad

Nunca exponer:
- DATABASE_URL;
- DIRECT_URL;
- SUPABASE_SERVICE_ROLE_KEY;
- JWT secrets;
- claves DIAN;
- claves WhatsApp;
- secretos de webhooks;
- tokens privados.

Solo variables realmente públicas pueden usar `NEXT_PUBLIC_*`.

No confiar en:
- role;
- locationId;
- price;
- total;
- cost;
- margin;
- tax;
enviados por cliente.

El servidor debe resolver y validar.

Implementar mínimo privilegio y permisos por acción.

Ejemplos:
- `warehouse.read`
- `warehouse.write`
- `cost.read`
- `inventory.adjust`
- `inventory.transfer`
- `sale.create`
- `sale.discount.approve`
- `purchase.create`
- `accounting.read`
- `accounting.post`
- `user.manage`

Ocultar acciones en UI mejora UX, pero la seguridad siempre se valida en backend.

---

## Variables de entorno

Mantener `.env.example` sin valores reales.

Ejemplo:

```bash
NODE_ENV=
APP_URL=
APP_TIMEZONE=America/Bogota

DATABASE_URL=
DIRECT_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

EMAIL_API_KEY=
DIAN_PROVIDER_API_KEY=
DIAN_WEBHOOK_SECRET=
WHATSAPP_API_TOKEN=
WHATSAPP_WEBHOOK_SECRET=

SENTRY_DSN=
CRON_SECRET=
```

Nunca commitear `.env` real.

---

## Base de datos

- UUID preferido.
- Dinero: Decimal/NUMERIC, nunca float.
- Fechas almacenadas en UTC.
- Mostrar fechas en America/Bogota.
- Usar enums controlados.
- Foreign keys e índices correctamente definidos.

No borrar físicamente históricos importantes.

Usar desactivación/soft delete en:
- productos;
- usuarios;
- clientes;
- proveedores;
- bodegas.

No hard delete de:
- InventoryMovement;
- facturas emitidas;
- pagos;
- asientos publicados;
- auditorías.

---

## Inventario — regla crítica

EL STOCK NUNCA SE EDITA DIRECTAMENTE.

Cada cambio debe generar `InventoryMovement`.

`StockLevel` es un agregado de lectura por:

`productId + locationId`

El Kardex / InventoryMovement es la fuente histórica de verdad.

Toda mutación crítica debe ser transaccional.

Ejemplos:
- compra;
- venta;
- transferencia;
- devolución;
- ajuste;
- recepción.

Nunca permitir:

```ts
stock.quantity = nuevaCantidad
```

sin movimiento asociado.

Evitar condiciones de carrera y overselling.

---

## Bodegas

Usar la entidad existente `Location` como base.

No crear entidades paralelas Warehouse/Store/Branch sin revisar el schema.

Cada ubicación debe poder tener:
- código;
- nombre;
- tipo;
- inventario;
- estadísticas;
- usuarios;
- clientes relacionados;
- proveedores relacionados;
- configuración.

El formato definitivo del código de bodega está pendiente de aprobación.

---

## Productos

Gestionar:
- SKU;
- código de barras;
- nombre;
- categoría;
- marca;
- unidad;
- imágenes;
- impuestos;
- precios;
- canales web;
- inventario por bodega.

No usar cuenta contable como SKU.

Precios iniciales:
- normal;
- mayorista.

Preferir listas de precios extensibles.

---

## Web / catálogos

La web pública es independiente del ERP.

Canales:
- Catálogo Super Más.
- Catálogo Distribuidora.

No confundir canales con categorías.

La web puede recibir:
- producto;
- slug;
- imágenes;
- categoría;
- precio público;
- disponibilidad.

Nunca exponer públicamente:
- costo;
- margen;
- proveedor;
- cuenta contable;
- precio mayorista interno;
- stock exacto.

Disponibilidad pública consulta todas las bodegas activas y muestra únicamente:
- AVAILABLE;
- LOW_STOCK;
- OUT_OF_STOCK.

La bodega que procesa ecommerce es una configuración distinta a la disponibilidad pública.

---

## Costos

El costo debe poder calcularse por producto + bodega.

Preparar arquitectura para:
- promedio ponderado;
- PEPS/FIFO.

Método definitivo pendiente de aprobación contable.

No usar precio de venta como costo.

---

## Compras y proveedores

Una factura de proveedor puede generar:

1. factura y líneas;
2. entrada de inventario;
3. actualización de costo;
4. cuenta por pagar;
5. asiento contable cuando aplique;
6. auditoría.

Debe ser transaccional.

Soportar:
- contado;
- crédito;
- vencimiento;
- pagos parciales;
- adjuntos PDF/imagen.

No usar únicamente `paid: boolean`.

---

## Ventas / POS

El servidor siempre recalcula:
- precios;
- descuentos;
- subtotal;
- impuestos;
- total;
- costo;
- margen;
- stock.

POS debe soportar:
- punto;
- caja;
- vendedor;
- cliente;
- productos;
- código de barras;
- pagos;
- pagos mixtos;
- cierre de venta.

---

## Facturación

Separar:
- Sale;
- Invoice;
- Payment.

No convertir Sale en una megatabla.

Documentos emitidos no se editan silenciosamente.

Usar:
- notas crédito;
- notas débito;
- anulaciones/reversiones permitidas.

La integración DIAN debe estar detrás de un adapter/provider.

No acoplar todo el ERP a un proveedor tecnológico específico.

---

## Contabilidad

Implementar doble partida.

Tablas base:
- AccountingAccount;
- AccountingRule;
- AccountingProfile;
- AccountingEntry;
- AccountingEntryLine;
- AccountingPeriod;
- ThirdParty;
- CostCenter.

Regla:

`SUM(debit) == SUM(credit)`

Estados:
- DRAFT;
- POSTED;
- REVERSED.

Un asiento POSTED no se modifica ni elimina.

No hardcodear cuentas contables dentro del código.

Las reglas contables y tributarias deben ser configurables y aprobadas por el contador.

---

## Auditoría

Registrar acciones sensibles:

- usuario;
- fecha/hora;
- entidad;
- acción;
- registro;
- valor anterior;
- valor nuevo;
- motivo cuando corresponda.

No registrar:
- passwords;
- tokens;
- secretos.

---

## Idempotencia

Procesos reintentables deben ser idempotentes:
- ventas;
- pagos;
- facturación;
- webhooks;
- compras;
- contabilización.

Usar constraints y/o `idempotencyKey`.

Nunca permitir duplicados por doble clic o retry.

---

## Testing

Obligatorio en lógica crítica.

Unit:
- costos;
- descuentos;
- impuestos;
- permisos;
- estados.

Integration:
- Prisma/PostgreSQL;
- inventario;
- ventas;
- compras;
- pagos;
- contabilidad.

E2E:
- login;
- venta POS;
- compra;
- transferencia;
- cierre de caja.

Probar concurrencia para evitar vender dos veces las últimas unidades.

---

## Migraciones

No usar sin autorización:
- `prisma migrate reset`
- `prisma db push --force-reset`
- DROP TABLE
- DROP DATABASE
- borrados masivos.

Antes de migraciones destructivas:
1. backup;
2. plan de migración;
3. revisión;
4. rollback plan.

---

## Rendimiento

Evitar:
- N+1;
- `select *`;
- cargar históricos completos;
- queries sin paginación.

Usar:
- índices;
- paginación;
- agregaciones;
- lazy loading;
- selección explícita de campos.

---

## Reglas pendientes — NO asumir

Preguntar antes de cerrar:
- códigos definitivos de bodegas;
- roles finales;
- matriz final de permisos;
- método de costeo;
- proveedor DIAN;
- reglas finales de remisiones;
- plan de cuentas;
- retenciones;
- exógena;
- política ecommerce cuando la bodega de despacho no tenga stock;
- comportamiento offline del POS;
- devoluciones;
- garantías;
- lotes/vencimientos;
- unidades por caja/empaque.

---

## Reglas para el agente

Antes de editar:
1. revisar archivos relacionados;
2. respetar convenciones existentes;
3. evitar duplicados;
4. preservar compatibilidad;
5. crear migración si cambia schema;
6. actualizar tests;
7. ejecutar typecheck/lint/tests;
8. documentar cambios críticos.

No reconstruir módulos funcionales únicamente por preferencia técnica.

---

## Prioridad final

Este ERP manejará dinero, inventario, facturación y contabilidad reales.

Antes de implementar, verificar:

- ¿puede duplicar una venta?
- ¿puede generar stock incorrecto?
- ¿puede exponer costos?
- ¿puede perder auditoría?
- ¿puede romper históricos?
- ¿puede duplicar un asiento?
- ¿puede generar un documento fiscal incorrecto?

Si existe riesgo o incertidumbre:
DETENER, documentar y solicitar definición.

Integridad + seguridad + trazabilidad tienen prioridad sobre velocidad.
