'use client'

import { useMemo, useState } from 'react'
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
import { Footer } from '@/components/Footer'
import { db } from '@/lib/supabase'

const modules: [string, LightIconName][] = [
  ['Dashboard', 'dashboard'],
  ['Bodegas', 'warehouse'],
  ['Productos', 'products'],
  ['Inventario', 'inventory'],
  ['Kardex', 'kardex'],
  ['Transferencias', 'transfers'],
  ['Compras', 'purchases'],
  ['Proveedores', 'suppliers'],
  ['Clientes', 'customers'],
  ['Ventas', 'sales'],
  ['POS', 'pos'],
  ['Facturación', 'invoices'],
  ['Remisiones', 'remisiones'],
  ['Cajas', 'cashRegisters'],
  ['Contabilidad', 'accounting'],
  ['Impuestos', 'taxes'],
  ['Exógena', 'exogena'],
  ['Pedidos Web', 'webOrders'],
  ['Catálogo Super Más', 'ecommerceSM'],
  ['Catálogo Distribuidora', 'ecommerceDist'],
  ['Reportes', 'reports'],
  ['Alertas', 'alerts'],
  ['Auditoría', 'audit'],
  ['Usuarios', 'users'],
  ['Roles', 'roles'],
  ['Configuración', 'settings'],
]

const movements = [
  {type:'Compra',product:'Arroz Diana 500g',sku:'SKU-001842',warehouse:'Bodega Principal',doc:'FV-1542',in:'+120',out:'—',balance:'482',user:'Laura Gómez',time:'Hoy, 10:32 AM'},
  {type:'Transferencia salida',product:'Aceite Premier 900ml',sku:'SKU-002107',warehouse:'Bodega Principal',doc:'TR-000154',in:'—',out:'25',balance:'38',user:'Mauricio A.',time:'Hoy, 9:48 AM'},
  {type:'Venta',product:'Gaseosa Coca-Cola 1.5L',sku:'SKU-005882',warehouse:'Punto Centro',doc:'POS-88421',in:'—',out:'3',balance:'12',user:'Caja Centro',time:'Hoy, 9:21 AM'},
  {type:'Ajuste',product:'Leche Entera Alquería 1L',sku:'SKU-003501',warehouse:'Bodega Norte',doc:'AJ-00092',in:'—',out:'12',balance:'0',user:'Carlos Ruiz',time:'Ayer, 4:15 PM'}
]
const transfers = db.transfers

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
      <div className="workspace">
        <div className="workspace-icon">
          <AppIcon name="suppliers" size={18}/>
        </div>
        <div>
          <strong>Super Más S.A.S.</strong>
          <span>Principal</span>
        </div>
        <AppIcon name="chevronDown" size={14}/>
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
      <button className="user-mini" onClick={logout}>
        <div className="avatar">AM</div>
        <div><strong>Admin Mauricio</strong><span>Administrador</span></div>
        <AppIcon name="logout" size={18}/>
      </button>
    </aside>
  </>
}

function Header({view,open}:{view:string;open:()=>void}){
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
      <div className="search-box">
        <AppIcon name="search" size={16}/>
        <input placeholder="Buscar en el sistema..."/>
      </div>
      <button className="notification icon-button" aria-label="Notificaciones">
        <AppIcon name="alerts" size={18}/>
        <i>3</i>
      </button>
      <div className="top-avatar">AM</div>
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

function Kardex(){
  const [mode,setMode]=useState('Tabla');
  return <>
    <PageHead eyebrow="Trazabilidad de inventario" title="Kardex" sub="Consulta y rastrea cada movimiento del inventario de Super Más." action="Exportar Kardex"/>
    <section className="stats-grid products-stats">
      {[
        ['Entradas del periodo','12,480','arrowDownRight','teal'],
        ['Salidas del periodo','9,842','arrowUpRight','red'],
        ['Movimientos totales','22,322','kardex','blue'],
        ['Valor de entradas','$86.4M','sales','teal'],
        ['Valor de salidas','$71.8M','sales','amber'],
        ['Productos movimentados','4,208','products','blue']
      ].map(([t,v,icon,tone])=><Stat key={t as string} title={t as string} value={v as string} iconName={icon as LightIconName} tone={tone as string}/>)}
    </section>
    <div className="toolbar">
      <div className="search-box wide">
        <AppIcon name="search" size={16}/>
        <input placeholder="Producto, SKU o documento..."/>
      </div>
      {['Producto','Bodega','Movimiento','Fecha'].map(x=><button className="filter-button" key={x}>{x} <AppIcon name="chevronDown" size={13}/></button>)}
      <div className="segmented">
        <button className={mode==='Tabla'?'selected':''} onClick={()=>setMode('Tabla')}>Tabla</button>
        <button className={mode==='Línea de tiempo'?'selected':''} onClick={()=>setMode('Línea de tiempo')}>Línea de tiempo</button>
      </div>
    </div>
    {mode==='Tabla'?<div className="table-panel animated-table"><div className="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Producto</th><th>Bodega</th><th>Movimiento</th><th>Documento</th><th>Entrada</th><th>Salida</th><th>Saldo</th><th>Usuario</th></tr></thead><tbody>{movements.map(m=><tr key={m.doc}><td>{m.time}</td><td><strong>{m.product}</strong><small>{m.sku}</small></td><td>{m.warehouse}</td><td><span className={`movement-badge ${m.type.toLowerCase().replace(' ','-')}`}>{m.type}</span></td><td>{m.doc}</td><td className="positive-text">{m.in}</td><td className="negative-text">{m.out}</td><td><b>{m.balance}</b></td><td>{m.user}</td></tr>)}</tbody></table></div></div>:<div className="timeline">{movements.map((m)=><div className="timeline-item" key={m.doc}><div className="timeline-node"/><div className="timeline-content"><div><span className={`movement-badge ${m.type.toLowerCase().replace(' ','-')}`}>{m.type}</span><time>{m.time}</time></div><h3>{m.product}</h3><p>{m.in!=='—'?`+${m.in} unidades`:`-${m.out} unidades`} · {m.doc} · {m.warehouse}</p><small>Usuario: {m.user} · Saldo posterior: {m.balance}</small></div></div>)}</div>}
  </>
}



function Login({onLogin}:{onLogin:()=>void}){
  const [email,setEmail]=useState('admin@supermas.com.co');
  const [pass,setPass]=useState('••••••••');
  return <main className="login-shell">
    <section className="login-visual">
      <div className="visual-grid"/>
      <div className="visual-copy">
        <Brand/>
        <p className="eyebrow">Sistema de administración general</p>
        <h1>Toda la operación de Super Más,<br/><em>en un solo lugar.</em></h1>
        <p className="visual-description">Administra bodegas, inventario, ventas, compras, facturación y estadísticas desde una plataforma centralizada.</p>
        <div className="visual-metrics"><div><strong>4</strong><span>bodegas conectadas</span></div><div><strong>100%</strong><span>operación centralizada</span></div></div>
      </div>
      <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
    </section>
    <section className="login-panel">
      <div className="login-card">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="login-heading"><span className="status-dot">● En línea</span><h2>Bienvenido de nuevo</h2><p>Ingresa a tu centro de control</p></div>
        <div style={{marginBottom:18,padding:'12px 14px',borderRadius:10,background:'#eef4fd',border:'1px solid #001b5c24',display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:11,fontWeight:800,color:'var(--navy)',display:'flex',alignItems:'center',gap:5}}>
              <AppIcon name="webOrders" size={14} color="var(--red)"/> Acceso temporal directo
            </span>
            <span style={{fontSize:10,background:'#001b5c14',color:'var(--navy)',padding:'2px 6px',borderRadius:4,fontWeight:700}}>Superadmin</span>
          </div>
          <button type="button" onClick={onLogin} style={{width:'100%',height:42,background:'var(--navy)',color:'#fff',border:0,borderRadius:8,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer',boxShadow:'0 6px 16px #001b5c2b',transition:'transform .2s, background .2s'}} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>
            <AppIcon name="users" size={16}/> Ingresar como Administrador <AppIcon name="chevronRight" size={14}/>
          </button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0 16px',color:'var(--muted)',fontSize:11}}><div style={{flex:1,height:1,background:'var(--line)'}}/><span>o con credenciales</span><div style={{flex:1,height:1,background:'var(--line)'}}/></div>
        <form onSubmit={e=>{e.preventDefault();onLogin()}}>
          <label htmlFor="email">Correo electrónico</label>
          <div className="input-wrap">
            <AppIcon name="mail" size={18}/>
            <input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com" required/>
          </div>
          <label htmlFor="password">Contraseña</label>
          <div className="input-wrap">
            <AppIcon name="lock" size={18}/>
            <input id="password" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required/>
          </div>
          <button className="primary-button" type="submit" style={{marginTop:8}}>
            Ingresar al sistema <AppIcon name="chevronRight" size={15}/>
          </button>
        </form>
      </div>
    </section>
  </main>
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
  return <>
    <PageHead eyebrow="Control de efectivo" title="Cajas" sub="Controla aperturas, ventas, arqueos y cierres por punto de venta." action="Abrir caja"/>
    <section className="stats-grid products-stats">
      {['Cajas abiertas','Cajas cerradas','Efectivo actual','Ventas del turno','Diferencias pendientes'].map((s,i)=><Stat key={s} title={s} value={['3','12','$8.42M','$18.6M','2'][i]} iconName={['check','close','sales','cashRegisters','warning'][i] as LightIconName} tone={['teal','blue','amber','blue','red'][i]} note={i===4?'Revisar':'+6.2%'}/>)}
    </section>
    <div className="flow-grid">
      {['Punto Centro · Caja 01','Punto Sur · Caja 02','Punto Norte · Caja 01'].map((c,i)=><article className="flow-card" key={c}>
        <span className="state disponible">{i===2?'Cerrada':'Abierta'}</span>
        <h3>{c}</h3>
        <p>Cajero: {['Laura Gómez','Carlos Ruiz','Andrés M.'][i]}</p>
        <div className="distribution">
          <div><span>Base inicial</span><b>$500K</b></div>
          <div><span>Ventas del turno</span><b>${['8.42M','6.18M','3.96M'][i]}</b></div>
        </div>
        <div className="stepper"><span className="done">✓</span><i className="done"/><span className="done">✓</span><i className={i===2?'done':''}/><span>{i===2?'✓':'○'}</span></div>
        <small>Apertura → Operación → Arqueo → Cierre</small>
      </article>)}
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
      {c.stats.map((s,i)=><Stat key={s} title={s} value={c.values[i]} iconName={c.iconName} tone={['blue','teal','amber','red'][i%4]} note={i===c.stats.length-1&&['Alertas','Auditoría'].includes(name)?'Revisar':'+8.4%'}/>)}
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
  const [auth,setAuth]=useState(false);
  const [view,setView]=useState('Dashboard');
  const [menu,setMenu]=useState(false);

  if(!auth)return <Login onLogin={()=>setAuth(true)}/>;

  if (view === 'POS') {
    return <POSView onExit={() => setView('Dashboard')} />;
  }

  const content = view === 'Dashboard' ? (
    <DashboardView onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Bodegas' ? (
    <WarehousePage />
  ) : view === 'Productos' ? (
    <Products onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Inventario' ? (
    <InventoryPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Kardex' ? (
    <KardexPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Transferencias' ? (
    <TransferPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Compras' ? (
    <PurchasesPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Proveedores' ? (
    <SuppliersPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Clientes' ? (
    <CustomersPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Ventas' ? (
    <SalesPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'POS' ? (
    <POSView onExit={() => setView('Dashboard')} />
  ) : view === 'Facturación' ? (
    <InvoicesPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Remisiones' ? (
    <RemissionsPage onNavigate={(targetView) => setView(targetView)} />
  ) : view === 'Cajas' ? (
    <Cajas />
  ) : adminConfigs[view] ? (
    <AdminModule name={view} />
  ) : moduleMeta[view] ? (
    <ModulePage name={view} />
  ) : (
    <DashboardView onNavigate={(targetView) => setView(targetView)} />
  );

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        open={menu}
        close={()=>setMenu(false)}
        logout={()=>setAuth(false)}
      />
      <div className="main-area">
        <Header view={view} open={()=>setMenu(true)}/>
        <main className="dashboard-content">
          {content}
          <Footer isDark={false}/>
        </main>
      </div>
    </div>
  );
}
export default function Page(){return <App/>}
