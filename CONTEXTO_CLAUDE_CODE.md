# Contexto para continuar en Claude Code — Facturación DIAN Super Más

> Pega esto al iniciar la sesión de Claude Code (o pídele: "lee CONTEXTO_CLAUDE_CODE.md y CLAUDE_proyecto.md antes de hacer nada").
> Fecha de corte: 21/10/2026.

## 1. Proyecto
- ERP/POS **Super Más** (DISTRIBUIDORA SUPER MAS S.A.S, NIT 901374526-5, Cúcuta, DANE 54001, AV 8 55 CC SAN ANTONIO LC 30).
- Stack: Next.js 16 + React + TypeScript + Supabase (PostgreSQL). Gestor: pnpm.
- Carpeta: `/Users/kt/Desktop/Trabajos/Supermas`.
- Objetivo actual: **facturación electrónica DIAN, software propio, SOLO HABILITACIÓN** (Anexo Técnico 1.9, Res. 000165/2023).

## 2. Reglas obligatorias (del dueño del proyecto)
- **No** commit, push, merge ni deploy sin autorización explícita.
- **No** producción hasta autorización explícita (el código bloquea PRODUCCION).
- **No** ejecutar migraciones ni escribir en la base de datos sin backup y aprobación explícita.
- **No** modificar los 5 usuarios SUPERADMIN ni rehacer el RBAC (7 roles + legacy).
- **No** limpieza destructiva de datos. Mantener `fn_prevent_invoice_deletion` y `fn_prevent_posted_accounting_mutation`.
- **No inventar datos fiscales.** Si falta un dato, bloquear con mensaje claro.
- Certificado, contraseña, PIN y clave técnica: **solo en `.env.local` del servidor**. Nunca en Git, frontend, logs, respuestas de API ni en el chat. Mantener `.gitignore` (.env*, *.p12, *.pfx, *.pem, *.key, *.cer, *.crt).
- Distinguir siempre: IMPLEMENTADO / PROBADO LOCALMENTE / PROBADO EN HABILITACIÓN / LISTO PARA PRODUCCIÓN.
- Avisar antes de cambiar código crítico; no tocar `.env.local` ni certificados sin indicación.

## 3. Datos DIAN (ya están en el seed, no en .env)
- Software ID: d1100dd6-2a52-4dd8-95a4-ef54f98cc2b9 · TestSetId: 03b49fa0-4ea8-48a2-abd5-86ae18fcd9ec
- Resolución de pruebas 18760000001, prefijo **SETP**, rango 990000000–995000000, vigencia 2019-01-19 a 2030-01-19.
- (Las fechas 14/03/2019–14/06/2019 del portal son la vigencia del set de pruebas; no van en la factura.)
- Responsabilidades RUT: 05;07;10;14;42;48;52;55 · Consumidor final: R-99-PN (confirmado).
- WSDL habilitación: https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl
- Notas en habilitación: prefijos **NCT** (crédito) y **NDT** (débito); no requieren resolución.
- Banco: Bancolombia ahorros *2416 → subcuenta PUC **11200501** (hay 2 corrientes y 2 ahorros en total; las otras 3 subcuentas están por crear: corrientes 111005xx, ahorros 112005xx).

## 4. Decisiones ya tomadas por el dueño
- FACTURACION_POS **no** emite factura electrónica (sin `invoices.create`). Notas crédito/débito requieren `invoices.cancel` (en la práctica, administradores).
- IVA 0 %: se clasifica **por producto** como EXENTO (Art. 477) o EXCLUIDO (Art. 424). Producto al 0 % sin clasificar → no se factura (y no consume consecutivo).
- POS: **no** acepta tarjeta por ahora (bloqueado en UI, servicio y SQL). Constante `POS_CARD_PAYMENTS_ENABLED=false` en `features/pos/schemas/pos.schema.ts`; para habilitar también hay que quitar la validación en `fn_execute_pos_sale_with_payments` (migración 059) con una migración nueva.
- Ventas contabilizan a la cuenta exacta: efectivo 110505, cada cuenta bancaria su subcuenta 1110xx/1120xx.

## 5. Qué se implementó (código en la carpeta, sin commit)
**Migraciones nuevas (NO aplicadas aún en Supabase):**
- `058_dian_habilitacion_numbering_and_guards.sql`: numeración DIAN atómica (`fn_create_electronic_invoice_from_sale`), snapshot de resolución, estados de transmisión, blindaje: el navegador no crea ni altera documentos fiscales.
- `059_sale_payments_bank_accounts_puc.sql`: `sale_payments`, cuenta PUC por cuenta bancaria, `accounting_default_accounts`, `fn_execute_pos_sale_with_payments` (venta + pagos + asiento en una transacción), bloqueo de tarjeta en POS, `fn_execute_pos_sale` ya no es invocable por `authenticated`.
- `060_dian_credit_debit_notes_and_iva_treatment.sql`: `products.iva_treatment` y `sale_items.iva_treatment`, `electronic_document_lines`, `dian_note_sequences`, `fn_create_electronic_note` (valida contra la factura aceptada, no acredita más de lo facturado, devolución ligada, contabiliza: NC → Dr 4175 / Dr 2408 / Cr 130505 [+1435/6135 si hay devolución]; ND → Dr 130505 / Cr 4135 o 421005 / Cr 2408), control de sede.
- Seed: `supabase/seeds/2026-10-21_super_mas_dian_habilitacion.sql`.

**Servidor DIAN** (`features/invoices/services/dian/`): `dian-document.ts` (modelo fiscal factura/NC/ND, exento/excluido), `dian-crypto.service.ts` (CUFE, CUDE con PIN, SoftwareSecurityCode, QR), `dian-ubl-builder.service.ts` (Invoice/CreditNote/DebitNote UBL 2.1), `dian-xades-signer.ts` (XAdES-BES), `dian-certificate.ts`, `dian-zip.ts`, `dian-soap.adapter.ts` (SendTestSetAsync, SendBillSync, GetStatusZip, GetStatus, GetNumberingRange, WS-Security), `dian-orchestrator.service.ts` (estados reales, reintento con mismo número, bloqueo de envíos simultáneos, `emitFromSale`, `emitNote`), `dian.config.ts`, `dian-concepts.ts`.

**API (solo servidor):** `app/api/dian/invoices` (emitir), `invoices/[id]/send|status|xml`, `app/api/dian/notes` (notas), `app/api/dian/config`. Auth en `lib/auth/server-auth.ts`.

**UI:** panel fiscal (resolución, CUFE/CUDE, QR, estado real) `DianFiscalPanel.tsx`; modal de notas `CreditNoteModal.tsx`; representación gráfica `app/facturacion/representacion/[id]`; producto con tratamiento Exento/Excluido; POS sin tarjeta; Tesorería con subcuenta PUC por cuenta.

**Otros arreglos:** `/api/users` (escalamiento de privilegios), `/api/audit`, refresco de cookie de sesión, Sidebar (salto de vista, falta ver en navegador), ticket POS sin NIT/resolución inventados.

**Scripts:** `scripts/apply-dian-habilitacion.ts --confirmo-backup` (aplica 058, 059, 060 + seed; re-ejecutable), `pnpm audit:dian` (solo lectura), `pnpm dian:certificado [--consultar-dian] [--mostrar-clave]`, `pnpm test:dian`.

## 6. Estado de pruebas
- PROBADO LOCALMENTE (PostgreSQL 16 con las 60 migraciones, sin red): numeración y concurrencia, pagos/PUC, notas (20+ casos SQL), XML validado contra XSD UBL 2.1 (factura, NC, ND, NC con descuento), CUFE/CUDE recalculados, firma verificada con xml-crypto, QR decodificado, orquestador de punta a punta. `tsc --noEmit` sin errores.
- NO probado en habilitación (sin red a DIAN/Supabase desde el entorno anterior). NADA listo para producción.
- `invoices.logic.test.ts` necesita Supabase real (prueba de integración antigua).

## 7. Lo que falta (siguiente sesión)
1. `pnpm install` → `pnpm test:dian` (esperado 9/9, 6/6, 10/10) → `npx tsc --noEmit`.
2. Backup Supabase → aplicar `scripts/apply-dian-habilitacion.ts --confirmo-backup` (requiere OK del dueño) → `pnpm audit:dian` y revisar.
3. Dueño llena `.env.local`: `DIAN_SOFTWARE_PIN`, `DIAN_CERTIFICATE_BASE64` (`base64 -i cert.p12 | pbcopy`), `DIAN_CERTIFICATE_PASSWORD`, `DIAN_TEST_TECHNICAL_KEY` (obtenible con `pnpm dian:certificado --consultar-dian --mostrar-clave`). Claude no debe leer ni imprimir esos valores.
4. `pnpm dian:certificado --consultar-dian`: confirmar que la DIAN acepta el certificado y que la resolución SETP coincide con la BD.
5. Clasificar productos al 0 % (Exento/Excluido) y configurar subcuentas de las 4 cuentas bancarias en Tesorería.
6. `pnpm dev` y probar en navegador: venta POS → Facturación → enviar → consultar estado; luego NC y ND sobre factura aceptada. Revisar representación gráfica, panel fiscal y Sidebar.
7. Completar el **set de pruebas** del portal DIAN (facturas + notas que pida el portal) hasta que la DIAN dé el software por habilitado. Ajustar según los errores de regla que devuelva la DIAN.
8. Pendientes conocidos fuera de alcance: Ventas no atómica (POS sí); egresos/recaudos de Tesorería (048) a 1110 genérico; documento equivalente POS; envío de factura al cliente (AttachedDocument/correo); permisos `dian.manage`/`treasury.manage` inexistentes; nota rechazada no se anula (se corrige y reenvía con el mismo número); `.env.local.example` con NIT viejo (901458789) y variables obsoletas por limpiar.

## 8. Documentos de referencia
- Plan y estado detallado: documento "Plan DIAN Super Más — Auditoría e implementación" (pestaña "Resultado y pasos").
- Reglas del proyecto: `CLAUDE_proyecto.md` en la raíz.
