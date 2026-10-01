'use client'

import { useMemo, useState, useEffect } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { WarehousePage } from '@/features/warehouses/components/WarehousePage'
import { DashboardView } from '@/features/dashboard/components/DashboardView'
import { ProductsPage } from '@/features/products/components/ProductsPage'
import { KardexPage } from '@/features/kardex/components/KardexPage'
import { InventoryPage } from '@/features/inventory/components/InventoryPage'
import { TransferPage } from '@/features/transfers/components/TransferPage'
import { PurchasesPage } from '@/features/purchases/components/PurchasesPage'
import { SuppliersPage } from '@/features/suppliers'
import { CustomersPage } from '@/features/customers'
import { SalesPage } from '@/features/sales'
import { POSView } from '@/features/pos'
import { InvoicesPage } from '@/features/invoices'
import { RemissionsPage } from '@/features/remissions'
import { TaxPage } from '@/features/taxes/components/TaxPage'
import { ExogenaPage } from '@/features/exogena/components/ExogenaPage'
import { AccountingPage } from '@/features/accounting/components/AccountingPage'
import { WebOrdersPage } from '@/features/web-orders/components/WebOrdersPage'
import { SuperCatalogPage } from '@/features/super-catalog/components/SuperCatalogPage'
import { DistributorCatalogPage } from '@/features/distributor-catalog/components/DistributorCatalogPage'
import { ReportsHubPage } from '@/features/reports/components/ReportsHubPage'
import { AlertsPage } from '@/features/alerts/components/AlertsPage'
import { AuditPage } from '@/features/audit/components/AuditPage'
import { UsersPage } from '@/features/users/components/UsersPage'
import { RolesView } from '@/features/roles/components/RolesView'
import { SettingsPage } from '@/features/settings/components/SettingsPage'
import { Footer } from '@/components/Footer'
import { APP_MODULES } from '@/components/navigation/modules'
import { GlobalSearch } from '@/components/navigation/GlobalSearch'
import { NotificationButton } from '@/components/navigation/NotificationButton'
import { useAuth, LoginForm } from '@/features/auth'
import { UserMini } from '@/components/navigation/UserMini'
import { TopAvatar } from '@/components/navigation/TopAvatar'
import { db } from '@/lib/supabase'

const modules = APP_MODULES

function Brand({compact=false}:{compact?:boolean}){return <div className={`brand ${compact?'brand-compact':''}`}><img src="/super-mas-logo.svg" alt="Super Más"/><span>ERP / POS</span></div>}

function Sidebar({view,setView,open,close,logout}:{view:string;setView:(x:string)=>void;open:boolean;close:()=>void;logout:()=>void}){
  return <>
    {open && <div className="sidebar-backdrop" onClick={close} />}
    <aside className={`sidebar ${open?'sidebar-open':''}`}>
      <div className="sidebar-top">
        <Brand compact/>
        <button className="mobile-close icon-button" onClick={close} aria-label="Cerrar menú">
          <AppIcon name="close" size={18}/>
        </button>
      </div>
      <nav>
        <p className="nav-caption">Menú principal</p>
        {modules.map(([label,iconName])=>(
          <button key={label} className={`nav-item ${view===label?'active':''}`} onClick={()=>{setView(label);close()}}>
            <AppIcon name={iconName} size={18}/>
            <span>{label}</span>
            {label==='Alertas'&&<b>3</b>}
          </button>
        ))}
      </nav>
      <UserMini onLogout={logout} />
    </aside>
  </>
}

function Header({view,open,onNavigate}:{view:string;open:()=>void;onNavigate:(v:string)=>void}){
  return <header className="topbar">
    <button className="menu-trigger icon-button" onClick={open} aria-label="Abrir menú">
      <AppIcon name="menu" size={20}/>
    </button>
    <div className="breadcrumbs">
      <span>Inicio</span>
      <AppIcon name="chevronRight" size={14}/>
      <strong>{view}</strong>
    </div>
    <div className="top-actions">
      <GlobalSearch onNavigate={onNavigate} />
      <NotificationButton onNavigate={onNavigate} count={3} />
      <TopAvatar />
    </div>
  </header>
}

function Stat({title,value,iconName='sales',tone='blue',note='+8.4%'}:{title:string;value:string;iconName?:LightIconName;tone?:string;note?:string}){
  return <article className="stat-card">
    <div className={`stat-icon ${tone}`}>
      <AppIcon name={iconName} size={18}/>
    </div>
    <div className="stat-text">
      <span>{title}</span>
      <strong>{value}</strong>
      <small className={note==='Revisar'?'warning-text':'positive'}>
        <AppIcon name={note==='Revisar'?'warning':'arrowUpRight'} size={13}/>
        {note}
      </small>
    </div>
    <svg className="sparkline" viewBox="0 0 90 30"><polyline points="0,25 12,22 22,24 35,15 48,19 60,10 72,14 90,3"/></svg>
  </article>
}

function PageHead({eyebrow,title,sub,action}:{eyebrow:string;title:string;sub:string;action:string}){
  return <div className="page-heading page-enter">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="welcome-subtitle">{sub}</p>
    </div>
    <div className="heading-actions">
      <button className="outline-button">
        <AppIcon name="download" size={15}/> Exportar
      </button>
      <button className="primary-button compact">
        <AppIcon name="plus" size={15}/> {action}
      </button>
    </div>
  </div>
}

function Products({ onNavigate }: { onNavigate?: (view: string) => void }) {
  return <ProductsPage onNavigate={onNavigate} />
}






const moduleRows: Record<string, string[][]> = db.operationalModules.moduleRows

const moduleMeta:Record<string,{eyebrow:string;sub:string;action:string;stats:string[];icons:LightIconName[];headers:string[]}>= {
 Compras:{eyebrow:'Abastecimiento central',sub:'Gestiona compras, facturas y cuentas por pagar de toda la operación.',action:'Nueva compra',stats:['Compras de hoy','$18.4M','Facturas pendientes','Cuentas por pagar','$42.8M','Proveedores activos'],icons:['purchases','suppliers','sales','invoices','transfers','check'],headers:['Compra / factura','Proveedor','Bodega','Fecha','Total','Pago','Estado']},
 Proveedores:{eyebrow:'Red de abastecimiento',sub:'Administra aliados comerciales, saldos y productos suministrados.',action:'Nuevo proveedor',stats:['Total proveedores','Activos','Cuentas por pagar','Facturas pendientes','Facturas vencidas'],icons:['suppliers','check','cashRegisters','invoices','warning'],headers:['Proveedor','NIT','Contacto','Teléfono','Bodegas','Facturas','Saldo','Estado']},
 Clientes:{eyebrow:'Relación comercial',sub:'Consulta clientes, compras, cartera y comportamiento por punto de venta.',action:'Nuevo cliente',stats:['Clientes registrados','Clientes activos','Nuevos este mes','Ventas asociadas','Cartera pendiente'],icons:['customers','check','plus','sales','cashRegisters'],headers:['Cliente','Documento','Teléfono','Email','Bodega frecuente','Última compra','Total comprado','Saldo','Estado']},
 Ventas:{eyebrow:'Rendimiento comercial',sub:'Monitorea ventas, utilidad y desempeño de cada punto de venta.',action:'Exportar ventas',stats:['Ventas hoy','Ventas del mes','Número de ventas','Ticket promedio','Utilidad','Ventas a crédito'],icons:['sales','exogena','receipt','dollar','check','creditCard'],headers:['Venta','Fecha','Cliente','Punto de venta','Vendedor','Productos','Total','Pago','Estado']},
 Facturación:{eyebrow:'Documentos fiscales',sub:'Centraliza facturas, notas y estados fiscales de la operación.',action:'Nueva factura',stats:['Facturado hoy','Facturado este mes','Facturas emitidas','Pendientes','Modificadas','Notas crédito'],icons:['invoices','accounting','check','clock','edit','fileText'],headers:['Número','Fecha','Cliente','Punto','Tipo','Total','Estado','Estado fiscal']},
 Remisiones:{eyebrow:'Despachos y entregas',sub:'Sigue cada despacho desde la bodega hasta la entrega al cliente.',action:'Nueva remisión',stats:['Pendientes','Despachadas','Entregadas','Facturadas','Anuladas'],icons:['remisiones','transfers','check','invoices','close'],headers:['Número','Cliente','Bodega','Fecha','Productos','Unidades','Responsable','Estado','Factura']},
}

function ModulePage({name}:{name:string}){
  const meta=moduleMeta[name];
  const rows=moduleRows[name]||[];
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string[]|null>(null);
  const filtered=rows.filter(r=>r.join(' ').toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHead eyebrow={meta.eyebrow} title={name} sub={meta.sub} action={meta.action}/>
    <section className="stats-grid products-stats">
      {meta.stats.map((s,i)=><Stat key={s} title={s} value={i%2===0?(name==='Compras'&&i===0?'$18.4M':name==='Ventas'&&i===0?'$24.8M':name==='Facturación'&&i===0?'$18.2M':i===1?'8,492':i===2?'1,284':'$42.8M'):'+'+(i+3)+'%'} iconName={meta.icons[i%meta.icons.length] || 'sales'} tone={['blue','teal','amber','red'][i%4]} note={i===3?'Revisar':'+8.4%'}/>)}
    </section>
    {name==='Facturación'&&<div className="segmented module-tabs">{['Todas','POS','Electrónicas','Modificadas','Pendientes','Anuladas','Notas crédito','Notas débito'].map((t,i)=><button className={i===0?'selected':''} key={t}>{t}</button>)}</div>}
    <div className="toolbar">
      <div className="search-box wide">
        <AppIcon name="search" size={16}/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={'Buscar en '+name.toLowerCase()+'...'}/>
      </div>
      {['Estado','Bodega','Fecha'].map(x=><button className="filter-button" key={x}>{x} <AppIcon name="chevronDown" size={13}/></button>)}
    </div>
    <div className="table-panel animated-table">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{meta.headers.map(h=><th key={h}>{h}</th>)}<th>Acciones</th></tr>
          </thead>
          <tbody>
            {filtered.map((r,i)=><tr key={i} onClick={()=>setSelected(r)}>{r.map((c,j)=><td key={j}>{j===r.length-1?<span className={'state '+c.toLowerCase().replaceAll(' ','-')}>{c}</span>:j===0?<strong>{c}</strong>:c}</td>)}<td><button className="icon-button" aria-label="Ver detalle"><AppIcon name="eye" size={16}/></button></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
    {selected&&<div className="drawer-backdrop" onClick={()=>setSelected(null)}>
      <aside className="product-drawer" onClick={e=>e.stopPropagation()}>
        <div className="drawer-header">
          <div><p className="eyebrow">Detalle operativo</p><h2>{selected[0]}</h2></div>
          <button className="icon-button" onClick={()=>setSelected(null)} aria-label="Cerrar"><AppIcon name="close" size={18}/></button>
        </div>
        <div className="drawer-section">
          <h3>Resumen de gestión</h3>
          <p className="welcome-subtitle">Información consolidada, historial y acciones disponibles para este registro.</p>
          {selected.slice(1).map((v,i)=><div className="distribution" key={i}><div><span>{meta.headers[i+1]}</span><b>{v}</b></div></div>)}
        </div>
        <button className="primary-button">Gestionar registro <AppIcon name="chevronRight" size={14}/></button>
      </aside>
    </div>}
  </>
}

function Cajas(){
  const cashRegisters = (db.cashRegisters || []) as any[]
  const openCount = cashRegisters.filter((c) => c.status === 'OPEN').length
  const closedCount = cashRegisters.filter((c) => c.status === 'CLOSED').length

  return <>
    <PageHead eyebrow="Control de efectivo" title="Cajas" sub="Controla aperturas, ventas, arqueos y cierres por punto de venta." action="Abrir caja"/>
    <section className="stats-grid products-stats">
      {[
        { title: 'Cajas abiertas', value: String(openCount), icon: 'check', tone: 'teal', note: openCount > 0 ? 'En operación' : 'Sin datos suficientes' },
        { title: 'Cajas cerradas', value: String(closedCount), icon: 'close', tone: 'blue', note: 'Registradas' },
        { title: 'Efectivo actual', value: '$0', icon: 'sales', tone: 'amber', note: 'Sin datos suficientes' },
        { title: 'Ventas del turno', value: '$0', icon: 'cashRegisters', tone: 'blue', note: 'Sin datos suficientes' },
        { title: 'Diferencias pendientes', value: '0', icon: 'warning', tone: 'red', note: 'Al día' },
      ].map((s) => (
        <Stat key={s.title} title={s.title} value={s.value} iconName={s.icon as LightIconName} tone={s.tone} note={s.note} />
      ))}
    </section>
    <div className="table-panel animated-table page-enter">
      <div className="table-scroll">
        <table aria-label="Control de cajas registradoras">
          <thead>
            <tr>
              <th style={{ minWidth: 110 }}>Código</th>
              <th style={{ minWidth: 180 }}>Caja / Nombre</th>
              <th style={{ minWidth: 160 }}>Ubicación</th>
              <th style={{ minWidth: 140 }}>Cajero Asignado</th>
              <th style={{ minWidth: 130, textAlign: 'right' }}>Base Inicial</th>
              <th style={{ minWidth: 130, textAlign: 'right' }}>Ventas Efectivo</th>
              <th style={{ minWidth: 110, textAlign: 'center' }}>Estado</th>
              <th style={{ minWidth: 90, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cashRegisters.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: '#e9eef8',
                        color: 'var(--navy)',
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <AppIcon name="cashRegisters" size={24} />
                    </div>
                    <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
                      No hay cajas registradas
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                      No hay cajas que coincidan con los filtros o aún no se han registrado cajas registradoras en el sistema.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              cashRegisters.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' }}>
                    {c.code || c.id}
                  </td>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.locationName || c.locationId || 'Sede Principal'}</td>
                  <td>{c.cashierName || 'Sin asignar'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    ${(c.openingBalance || c.currentBalance || 0).toLocaleString('es-CO')}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                    ${(c.cashSales || 0).toLocaleString('es-CO')}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`state ${c.status === 'OPEN' ? 'disponible' : 'inactivo'}`}>
                      {c.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="icon-button"
                      style={{ width: 32, height: 32, margin: '0 auto' }}
                      title="Ver detalles de caja"
                      aria-label="Ver detalles"
                    >
                      <AppIcon name="eye" size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>
}

const adminConfigs: Record<string, { eyebrow: string; sub: string; stats: string[]; values: string[]; iconName: LightIconName; tabs: string[] }> = db.operationalModules.adminConfigs as unknown as Record<string, { eyebrow: string; sub: string; stats: string[]; values: string[]; iconName: LightIconName; tabs: string[] }>

function AdminModule({name}:{name:string}){
  const c=adminConfigs[name];
  const [tab,setTab]=useState(c.tabs[0]);
  const [query,setQuery]=useState('');
  const items=name==='Reportes'?['Ventas por bodega','Rotación de inventario','Utilidad por categoría','Cartera por cliente','Compras por proveedor','Balance de prueba','Kardex valorizado','Desempeño de cajas']:name==='Configuración'?['Empresa','Bodegas','Inventario','Alertas','Precios','Impuestos','Facturación','Contabilidad','Ecommerce','Notificaciones','Seguridad','Integraciones']:name==='Roles'?['Administrador','Administrador de bodega','Punto de venta','Vendedor','Contabilidad']:name==='Usuarios'?['Mauricio Andrade','Laura Gómez','Carlos Ruiz','Andrés Martínez','Camila Torres']:name==='Auditoría'?['Ajuste de inventario · SKU-005882','Cambio de precio · Arroz Diana','Factura anulada · FV-88418','Nuevo usuario · Camila Torres','Transferencia aprobada · TR-000154']:['Preparación operativa','Validación de datos','Publicación y seguimiento','Revisión del periodo','Actividad reciente'];
  const filtered=items.filter(x=>x.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHead eyebrow={c.eyebrow} title={name} sub={c.sub} action={name==='Configuración'?'Guardar cambios':'Nuevo registro'}/>
    <section className="stats-grid products-stats">
      {c.stats.map((s,i)=><Stat key={s} title={s} value={c.values[i]} iconName={c.iconName} tone={['blue','teal','amber','red'][i%4]} note={i===c.stats.length-1&&['Alertas','Auditoría'].includes(name)?'Revisar':'Estable'}/>)}
    </section>
    <div className="segmented module-tabs">
      {c.tabs.map(t=><button className={tab===t?'selected':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}
    </div>
    <div className="toolbar">
      <div className="search-box wide">
        <AppIcon name="search" size={16}/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={'Buscar en '+name.toLowerCase()+'...'}/>
      </div>
      <button className="filter-button">Bodega <AppIcon name="chevronDown" size={13}/></button>
      <button className="filter-button">Periodo <AppIcon name="chevronDown" size={13}/></button>
      <button className="outline-button"><AppIcon name="download" size={14}/> Exportar</button>
    </div>
    <div className="admin-workspace">
      <section className="table-panel admin-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tab}</p>
            <h2>{name==='Roles'?'Roles y permisos':name==='Configuración'?'Secciones de configuración':name==='Reportes'?'Reportes disponibles':'Actividad operativa'}</h2>
          </div>
          <span className="live-pill"><i/> Actualizado ahora</span>
        </div>
        <div className="admin-list">
          {filtered.map((item,i)=><article className="admin-row" key={item}>
            <div className="admin-row-icon">
              <AppIcon name={c.iconName} size={18}/>
            </div>
            <div className="admin-row-copy">
              <strong>{item}</strong>
              <span>{name==='Roles'?'Ver · Crear · Modificar · Aprobar':name==='Reportes'?'Información consolidada para gestión administrativa':'Última actualización hace '+(i+1)+' min'}</span>
            </div>
            {name==='Roles'?<div className="permission-switches"><span className="permission-on">Ver</span><span className={i%2?'permission-off':'permission-on'}>Crear</span><span className="permission-off">Anular</span></div>:<><span className={'state '+(i%3===0?'disponible':i%3===1?'pendiente':'publicado')}>{i%3===0?'Activo':i%3===1?'En revisión':'Listo'}</span><button className="icon-button" aria-label={'Abrir '+item}><AppIcon name="chevronRight" size={15}/></button></>}
          </article>)}
        </div>
      </section>
      <aside className="insight-card">
        <div className="insight-head"><span>Resumen del periodo</span><AppIcon name="more" size={16}/></div>
        <div className="chart-placeholder">
          <svg viewBox="0 0 300 120" preserveAspectRatio="none">
            <path d="M0 95 C35 88 42 65 70 74 S110 35 140 58 S180 32 207 45 S250 20 300 28"/>
            <path className="chart-fill" d="M0 95 C35 88 42 65 70 74 S110 35 140 58 S180 32 207 45 S250 20 300 28 V120 H0Z"/>
          </svg>
        </div>
        <div className="insight-metric"><strong>{c.values[0]}</strong><span>+12.4% frente al periodo anterior</span></div>
        <div className="mini-bars">{[42,68,52,84,61,92,76].map((h,i)=><i key={i} style={{height:h+'%'}}/>)}</div>
      </aside>
    </div>
  </>
}

function App(){
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [view,setView]=useState('Dashboard');
  const [menu,setMenu]=useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      if (v) {
        const found = APP_MODULES.find(([m]) => m.toLowerCase() === v.toLowerCase());
        if (found) {
          setView(found[0]);
        }
      }
    }
  }, []);

  const handleSetView = (targetView: string) => {
    setView(targetView);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (targetView === 'Dashboard') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', targetView);
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#001b5c',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: '#ffffff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '14px', letterSpacing: '0.5px' }}>
          Verificando sesión fiduciaria...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (view === 'POS') {
    return <POSView onExit={() => handleSetView('Dashboard')} />;
  }

  const content = view === 'Dashboard' ? (
    <DashboardView onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Bodegas' ? (
    <WarehousePage />
  ) : view === 'Productos' ? (
    <Products onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Inventario' ? (
    <InventoryPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Kardex' ? (
    <KardexPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Transferencias' ? (
    <TransferPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Compras' ? (
    <PurchasesPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Proveedores' ? (
    <SuppliersPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Clientes' ? (
    <CustomersPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Ventas' ? (
    <SalesPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Facturación' ? (
    <InvoicesPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Remisiones' ? (
    <RemissionsPage onNavigate={(targetView) => handleSetView(targetView)} />
  ) : view === 'Cajas' ? (
    <Cajas />
  ) : view === 'Contabilidad' ? (
    <AccountingPage />
  ) : view === 'Impuestos' ? (
    <TaxPage />
  ) : view === 'Exógena' ? (
    <ExogenaPage />
  ) : view === 'Pedidos Web' ? (
    <WebOrdersPage />
  ) : view === 'Catálogo Super Más' ? (
    <SuperCatalogPage />
  ) : view === 'Catálogo Distribuidora' ? (
    <DistributorCatalogPage />
  ) : view === 'Reportes' ? (
    <ReportsHubPage initialReportType="OVERVIEW" />
  ) : view === 'Alertas' ? (
    <AlertsPage />
  ) : view === 'Auditoría' ? (
    <AuditPage />
  ) : view === 'Usuarios' ? (
    <UsersPage currentRole={user?.roleCode || 'SUPERADMIN'} />
  ) : view === 'Roles' ? (
    <RolesView />
  ) : view === 'Configuración' ? (
    <SettingsPage />
  ) : adminConfigs[view] ? (
    <AdminModule name={view} />
  ) : moduleMeta[view] ? (
    <ModulePage name={view} />
  ) : (
    <DashboardView onNavigate={(targetView) => handleSetView(targetView)} />
  );

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={handleSetView}
        open={menu}
        close={()=>setMenu(false)}
        logout={signOut}
      />
      <div className="main-area">
        <Header view={view} open={()=>setMenu(true)} onNavigate={handleSetView}/>
        <main className="dashboard-content">
          {content}
          <Footer isDark={false}/>
        </main>
      </div>
    </div>
  );
}
export default function Page(){return <App/>}
