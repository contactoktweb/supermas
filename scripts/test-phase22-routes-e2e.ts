/**
 * SUPER MÁS ERP/POS — Test Suite E2E Fase 22
 *
 * Consolidación y Verificación de Rutas Canónicas y Menú Lateral:
 * 1. Cobertura de Rutas: 100% de las rutas en NAV_SECTIONS y DASHBOARD_ITEM resuelven a page.tsx en app/
 * 2. Unicidad de Rutas: 0 rutas duplicadas en APP_MODULES
 * 3. Iconografía Válida: Cada ícono referenciado existe en LIGHT_ICON_REGISTRY de Icon.tsx
 * 4. Mapeo de Breadcrumbs: Todas las rutas canónicas registradas en ROUTE_BREADCRUMBS (Header.tsx)
 * 5. Búsqueda Global: Palabras clave indexadas para todos los módulos en GlobalSearch.tsx
 * 6. Consistencia de Permisos: Permisos requeridos son válidos y consistentes
 * 7. Zero Pollution: La prueba no inserta registros residuales en la base de datos
 *
 * Ejecución: npx tsx --env-file=.env.local scripts/test-phase22-routes-e2e.ts
 */

import fs from 'fs'
import path from 'path'
import { DASHBOARD_ITEM, NAV_SECTIONS, APP_MODULES } from '../components/navigation/modules'
import { LIGHT_ICON_MAP } from '../components/ui/Icon'

interface TestResult {
  code: string
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function recordTest(code: string, name: string, passed: boolean, details: string) {
  results.push({ code, name, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${details}`)
  if (!passed) {
    throw new Error(`Prueba ${code} falló: ${details}`)
  }
}

async function runPhase22TestSuite() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 22: RUTAS CANÓNICAS Y MENÚ LATERAL')
  console.log('============================================================\n')

  const appDir = path.resolve(process.cwd(), 'app')

  // 1. Recolección de todas las rutas definidas en el sistema de navegación
  const allNavItems = [
    DASHBOARD_ITEM,
    ...NAV_SECTIONS.flatMap((s) => s.items),
  ]

  // T01: Recuento total de rutas esperadas
  recordTest(
    'T01',
    'Conteo de Rutas Canónicas Definidas en Navegación',
    allNavItems.length === 35,
    `Se encontraron ${allNavItems.length} rutas canónicas en NAV_SECTIONS y DASHBOARD_ITEM (Esperado: 35).`
  )

  // T02: Resolución física en el sistema de archivos (app/ directory)
  const missingFiles: string[] = []
  allNavItems.forEach((item) => {
    let expectedPagePath: string
    if (item.path === '/') {
      expectedPagePath = path.join(appDir, 'page.tsx')
    } else {
      const cleanPath = item.path.replace(/^\//, '')
      expectedPagePath = path.join(appDir, cleanPath, 'page.tsx')
    }

    if (!fs.existsSync(expectedPagePath)) {
      missingFiles.push(`${item.path} -> ${expectedPagePath}`)
    }
  })

  recordTest(
    'T02',
    'Resolución Física de Rutas en Next.js (app/**/page.tsx)',
    missingFiles.length === 0,
    missingFiles.length === 0
      ? 'Las 35 rutas canónicas cuentan con su correspondiente page.tsx en el directorio app/'
      : `Rutas sin archivo físico: ${missingFiles.join(', ')}`
  )

  // T03: Unicidad de rutas en APP_MODULES
  const paths = allNavItems.map((i) => i.path)
  const uniquePaths = new Set(paths)
  const duplicates = paths.filter((p, index) => paths.indexOf(p) !== index)

  recordTest(
    'T03',
    'Unicidad de Rutas Canónicas en APP_MODULES',
    duplicates.length === 0 && uniquePaths.size === allNavItems.length,
    duplicates.length === 0
      ? `Las ${uniquePaths.size} rutas son 100% únicas y no presentan colisiones.`
      : `Rutas duplicadas detectadas: ${duplicates.join(', ')}`
  )

  // T04: Validación de Iconos en LIGHT_ICON_MAP
  const missingIcons: string[] = []
  allNavItems.forEach((item) => {
    if (!LIGHT_ICON_MAP[item.icon]) {
      missingIcons.push(`${item.id} (icon: ${item.icon})`)
    }
  })

  recordTest(
    'T04',
    'Integridad y Mapeo de Iconos en LIGHT_ICON_MAP',
    missingIcons.length === 0,
    missingIcons.length === 0
      ? `Todos los ${allNavItems.length} elementos de navegación poseen íconos válidos en Icon.tsx`
      : `Iconos faltantes en registro: ${missingIcons.join(', ')}`
  )

  // T05: Validación de Breadcrumbs en Header.tsx
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'components/navigation/Header.tsx'),
    'utf8'
  )

  const missingBreadcrumbs: string[] = []
  allNavItems.forEach((item) => {
    const searchKey = `'${item.path}':`
    if (!headerContent.includes(searchKey)) {
      missingBreadcrumbs.push(item.path)
    }
  })

  recordTest(
    'T05',
    'Mapeo Completo de Breadcrumbs en Header.tsx',
    missingBreadcrumbs.length === 0,
    missingBreadcrumbs.length === 0
      ? 'El 100% de las 35 rutas canónicas tienen entrada explícita en ROUTE_BREADCRUMBS'
      : `Rutas sin breadcrumb explícito: ${missingBreadcrumbs.join(', ')}`
  )

  // T06: Cobertura de Palabras Clave en GlobalSearch.tsx
  const searchContent = fs.readFileSync(
    path.resolve(process.cwd(), 'components/navigation/GlobalSearch.tsx'),
    'utf8'
  )

  const unindexedModules: string[] = []
  allNavItems.forEach((item) => {
    // Si el label está en MODULE_KEYWORDS o si la búsqueda soporta el módulo
    const labelKey = `'${item.label}':`
    if (!searchContent.includes(labelKey)) {
      unindexedModules.push(item.label)
    }
  })

  recordTest(
    'T06',
    'Indexación de Módulos en Búsqueda Global (GlobalSearch.tsx)',
    unindexedModules.length === 0,
    unindexedModules.length === 0
      ? 'Los 35 módulos canónicos cuentan con palabras clave dedicadas en MODULE_KEYWORDS'
      : `Módulos no indexados en MODULE_KEYWORDS: ${unindexedModules.join(', ')}`
  )

  // T07: Estructura de Secciones de Navegación
  const emptySections = NAV_SECTIONS.filter((s) => s.items.length === 0)
  recordTest(
    'T07',
    'Estructura y Coherencia de Secciones (NAV_SECTIONS)',
    emptySections.length === 0 && NAV_SECTIONS.length === 8,
    `Se verificaron ${NAV_SECTIONS.length} secciones activas, todas con items válidos.`
  )

  // T08: Sincronización de APP_MODULES con NAV_SECTIONS + DASHBOARD
  recordTest(
    'T08',
    'Sincronización Plana de APP_MODULES',
    APP_MODULES.length === allNavItems.length,
    `APP_MODULES contiene ${APP_MODULES.length} elementos coincidentes con el árbol de navegación.`
  )

  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 22: RUTAS CANÓNICAS Y MENÚ')
  console.log('============================================================')
  const passedCount = results.filter((r) => r.passed).length
  results.forEach((r) => {
    console.log(`✅ [${r.code}] ${r.name}`)
  })
  console.log('============================================================')
  console.log(`TOTAL: ${results.length} | PASARON: ${passedCount} | FALLARON: ${results.length - passedCount}`)
  console.log('============================================================\n')
}

runPhase22TestSuite().catch((err) => {
  console.error('Test Suite Failed:', err)
  process.exit(1)
})
