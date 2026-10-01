import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/audit_output.json', 'utf-8'));

console.log('====================================================');
console.log('📊 RESUMEN EJECUTIVO DE AUDITORÍA STAGING (Paso 14)');
console.log('====================================================\n');

// 1. Tablas y RLS
const totalTables = data.tables.length;
const rlsEnabledTables = data.tables.filter((t: any) => t.rls_enabled);
const rlsDisabledTables = data.tables.filter((t: any) => !t.rls_enabled);

console.log(`1. TABLAS TOTALES: ${totalTables}`);
console.log(`   - Con RLS habilitado: ${rlsEnabledTables.length}`);
console.log(`   - Sin RLS habilitado: ${rlsDisabledTables.length} -> [${rlsDisabledTables.map((t: any) => t.table_name).join(', ')}]`);

// 2. Tablas sin PK
const tablesWithPK = new Set(data.primary_keys.map((p: any) => p.table_name));
const tablesWithoutPK = data.tables.filter((t: any) => !tablesWithPK.has(t.table_name));
console.log(`\n2. TABLAS SIN PRIMARY KEY: ${tablesWithoutPK.length}`);
if (tablesWithoutPK.length > 0) {
  console.log(`   -> [${tablesWithoutPK.map((t: any) => t.table_name).join(', ')}]`);
}

// 3. FKs sin índice
// Buscamos si existe un índice en table_name que comience con column_name
const indexesByTable: Record<string, string[]> = {};
for (const idx of data.indexes) {
  if (!indexesByTable[idx.tablename]) indexesByTable[idx.tablename] = [];
  indexesByTable[idx.tablename].push(idx.indexdef);
}

const fksWithoutIndex: any[] = [];
for (const fk of data.foreign_keys) {
  const tableIdxs = indexesByTable[fk.table_name] || [];
  // Comprobar si algún índice contiene la columna
  const hasIndex = tableIdxs.some((def: string) => {
    // def tiene formato: CREATE [UNIQUE] INDEX ... ON public.table (col1, ...)
    const match = def.match(/\((.*?)\)/);
    if (!match) return false;
    const cols = match[1].split(',').map((c: string) => c.trim().replace(/"/g, ''));
    return cols[0] === fk.column_name;
  });

  if (!hasIndex) {
    fksWithoutIndex.push({
      table: fk.table_name,
      column: fk.column_name,
      foreign_table: fk.foreign_table_name,
    });
  }
}

console.log(`\n3. FOREIGN KEYS SIN ÍNDICE EN COLUMNA ORIGEN: ${fksWithoutIndex.length}`);
fksWithoutIndex.forEach((fk) => {
  console.log(`   - ${fk.table}.${fk.column} -> REFERENCES ${fk.foreign_table}`);
});

// 4. Multi-Tenant: Tablas con y sin company_id
console.log('\n4. ANÁLISIS MULTI-TENANT (company_id):');
const coreTenantTables = [
  'companies', 'users', 'locations', 'products', 'categories', 'brands',
  'customers', 'suppliers', 'sales', 'sale_items', 'purchases', 'purchase_items',
  'stock_levels', 'inventory_movements', 'accounting_entries', 'accounting_entry_lines',
  'treasury_payments', 'treasury_receipts', 'audit_logs'
];

for (const tableName of coreTenantTables) {
  const info = data.tenant_columns[tableName];
  if (!info) {
    console.log(`   - ${tableName}: NO EXISTE LA TABLA`);
  } else {
    console.log(`   - ${tableName}: has_company_id=${info.has_company_id} (nullable: ${info.company_nullable}), has_location_id=${info.has_location_id}`);
  }
}

// 5. Políticas RLS
console.log(`\n5. POLÍTICAS RLS TOTALES: ${data.policies.length}`);
const policiesByTable: Record<string, any[]> = {};
for (const pol of data.policies) {
  if (!policiesByTable[pol.tablename]) policiesByTable[pol.tablename] = [];
  policiesByTable[pol.tablename].push(pol);
}

for (const t of rlsEnabledTables) {
  const pols = policiesByTable[t.table_name] || [];
  const cmds = pols.map((p) => p.cmd);
  if (pols.length === 0) {
    console.log(`   ⚠️ ALERTA: ${t.table_name} tiene RLS activado pero CERO políticas (bloqueo total)!`);
  } else {
    console.log(`   - ${t.table_name}: ${pols.length} políticas [${[...new Set(cmds)].join(', ')}]`);
  }
}

// 6. Funciones SECURITY DEFINER y search_path
console.log('\n6. FUNCIONES Y PROCEDIMIENTOS:');
const secDefFuncs = data.functions.filter((f: any) => f.is_security_definer);
console.log(`   Total funciones en public: ${data.functions.length}`);
console.log(`   Total SECURITY DEFINER: ${secDefFuncs.length}`);

const secDefWithoutSearchPath = secDefFuncs.filter((f: any) => {
  if (!f.config_params) return true;
  return !f.config_params.some((cfg: string) => cfg.includes('search_path'));
});

console.log(`   SECURITY DEFINER SIN SET search_path: ${secDefWithoutSearchPath.length}`);
secDefWithoutSearchPath.forEach((f: any) => {
  console.log(`   ⚠️ ${f.function_name}(${f.arguments})`);
});

// 7. Triggers
console.log(`\n7. TRIGGERS TOTALES: ${data.triggers.length}`);
const triggersByTable: Record<string, string[]> = {};
for (const trg of data.triggers) {
  if (!triggersByTable[trg.event_object_table]) triggersByTable[trg.event_object_table] = [];
  triggersByTable[trg.event_object_table].push(`${trg.trigger_name} (${trg.action_timing} ${trg.event_manipulation})`);
}

for (const tbl of Object.keys(triggersByTable)) {
  console.log(`   - ${tbl}:`);
  triggersByTable[tbl].forEach((trg) => console.log(`       * ${trg}`));
}

// 8. Integridad de Datos (Kardex, Contabilidad, etc.)
console.log('\n8. VERIFICACIÓN DE INTEGRIDAD:');
console.log(`   - Asientos contables sin líneas: ${data.integrity.unlinked_accounting_entries.length}`);
console.log(`   - Asientos desbalanceados (Débito != Crédito): ${data.integrity.unbalanced_accounting_entries.length}`);
console.log(`   - Stock levels huérfanos de producto: ${data.integrity.orphan_stock_levels.length}`);
console.log(`   - Movimientos huérfanos de producto: ${data.integrity.orphan_movements.length}`);
console.log(`   - Descuadres entre Stock Levels y Kardex: ${data.integrity.kardex_stock_mismatch.length}`);

// 9. Conteo de registros actual
console.log('\n9. CONTEO ACTUAL DE REGISTROS (Staging):');
for (const [tbl, cnt] of Object.entries(data.row_counts)) {
  console.log(`   - ${tbl}: ${cnt}`);
}

// 10. Matriz de Roles y Permisos
console.log('\n10. MATRIZ DE ROLES Y PERMISOS:');
data.roles_permissions.forEach((r: any) => {
  console.log(`   - Rol ${r.role_code}: ${r.permissions_count} permisos asignados`);
});
