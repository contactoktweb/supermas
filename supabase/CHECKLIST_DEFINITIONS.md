# CHECKLIST FINAL DE MIGRACIÓN: PARÁMETROS PENDIENTES DE DEFINICIÓN
## SUPER MÁS ERP/POS (COLOMBIA)

Conforme a los principios de desarrollo del proyecto, **no se inventan datos fiscales, contables ni normativos**.
A continuación se consolida la lista formal de información pendiente que la dirección de Super Más,
su contador y el revisor fiscal deben completar para el paso final a producción:

---

### 1. DATOS DE LA EMPRESA (TRIBUTARIO Y LEGAL)
- [ ] **Código CIIU secundario**: Definir actividades económicas secundarias si aplica para la venta mayorista y retail.
- [ ] **Tarifas de Retención en la Fuente e ICA**:
  - PENDIENTE DE DEFINICIÓN: Porcentaje de ICA según municipio (ej. Medellín vs Cali/Yumbo).
  - PENDIENTE DE DEFINICIÓN: Calidad tributaria de Gran Contribuyente / Autorretenedor.
- [ ] **Certificado Digital (.p12 / .pfx)**:
  - PENDIENTE DE DEFINICIÓN: Carga del certificado de firma digital para emisión electrónica directa.

---

### 2. BODEGAS Y RED LOGÍSTICA
- [ ] **Nomenclatura oficial de códigos de bodega**:
  - PENDIENTE DE DEFINICIÓN: Definir si se mantiene el formato `BOD-001` / `PTO-002` o se adopta código DANE/interno de sedes.
- [ ] **Bodega de despacho de pedidos ecommerce en contingencia**:
  - PENDIENTE DE DEFINICIÓN: Si el CEDI principal no tiene stock de una orden web, ¿se permite desviar el despacho automáticamente a otra bodega o se pausa el pedido?

---

### 3. FACTURACIÓN ELECTRÓNICA DIAN
- [ ] **Resolución de Facturación Electrónica vigente**:
  - PENDIENTE DE DEFINICIÓN: Número de resolución expedida por la DIAN.
  - PENDIENTE DE DEFINICIÓN: Prefijos autorizados (ej. `FE`, `SEDM`, etc.).
  - PENDIENTE DE DEFINICIÓN: Rango de numeración autorizado (desde / hasta) y fecha de vigencia.
  - PENDIENTE DE DEFINICIÓN: Clave técnica entregada en el portal MUISCA DIAN.
- [ ] **Proveedor Tecnológico o Emisión Directa**:
  - PENDIENTE DE DEFINICIÓN: Definición del software de transmisión habilitado (FacturaTech, Siigo, The Factory HKA, Carvajal o software propio habilitado ante la DIAN).

---

### 4. CONTABILIDAD Y NIIF (PLAN ÚNICO DE CUENTAS - PUC)
- [ ] **Catálogo de Cuentas Contables oficial del contador**:
  - PENDIENTE DE DEFINICIÓN: Cuentas auxiliares clase 14 (Inventarios de mercancías no fabricadas por la empresa: 1435xx).
  - PENDIENTE DE DEFINICIÓN: Cuentas clase 41 (Ingresos operacionales por ventas: 4135xx).
  - PENDIENTE DE DEFINICIÓN: Cuentas clase 61 (Costo de ventas: 6135xx).
  - PENDIENTE DE DEFINICIÓN: Subcuentas de enlace para pasivo de IVA generado (2408xx) e IVA descontable.
- [ ] **Método de costeo de inventarios definitivo**:
  - PENDIENTE DE DEFINICIÓN: Confirmación formal del revisor fiscal: ¿Promedio Ponderado o PEPS/FIFO? (Arquitectura lista para ambos).

---

### 5. USUARIOS, ROLES Y ACCESOS
- [ ] **Matriz final de personal por sede**:
  - [x] Los 6 roles base inmutables están configurados (`SUPERADMIN`, `WAREHOUSE_ADMIN`, `POINT_ADMIN`, `ACCOUNTANT`, `SELLER`, `CASHIER`).
  - [ ] PENDIENTE DE DEFINICIÓN: Listado final de correos electrónicos de los cajeros y bodegueros reales para dar de alta en `auth.users`.

---

### 6. INFORMACIÓN EXÓGENA DIAN
- [ ] **Parámetros del año gravable vigente**:
  - PENDIENTE DE DEFINICIÓN: Topes mínimos de cuantías menores para formatos 1001 y 1007 del periodo fiscal en curso.
