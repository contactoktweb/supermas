'use client'

import { useMemo, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { WarehousePage } from '@/features/warehouses/components/WarehousePage'
import { DashboardView } from '@/features/dashboard/components/DashboardView'
import { ProductsPage } from '@/features/products/components/ProductsPage'
import { KardexPage } from '@/features/kardex/components/KardexPage'
import { InventoryPage } from '@/features/inventory/components/InventoryPage'
import { Footer } from '@/components/Footer'

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

const products = [{name:'Arroz Diana 500g',sku:'SKU-001842',barcode:'7701234567890',category:'Granos',brand:'Diana',stock:482,state:'Disponible',cost:'$2,480',price:'$3,400',wholesale:'$3,050',margin:'27.1%',total:'$1.19M'},{name:'Aceite Premier 900ml',sku:'SKU-002107',barcode:'7709876543210',category:'Despensa',brand:'Premier',stock:38,state:'Stock bajo',cost:'$7,420',price:'$9,800',wholesale:'$8,900',margin:'24.3%',total:'$282K'},{name:'Leche Entera Alquería 1L',sku:'SKU-003501',barcode:'7705556677889',category:'Lácteos',brand:'Alquería',stock:0,state:'Agotado',cost:'$3,120',price:'$4,500',wholesale:'$4,050',margin:'30.7%',total:'$0'},{name:'Café Sello Rojo 500g',sku:'SKU-004229',barcode:'7703334445556',category:'Despensa',brand:'Sello Rojo',stock:84,state:'Disponible',cost:'$10,800',price:'$14,200',wholesale:'$12,900',margin:'23.9%',total:'$907K'},{name:'Gaseosa Coca-Cola 1.5L',sku:'SKU-005882',barcode:'7701112223334',category:'Bebidas',brand:'Coca-Cola',stock:12,state:'Crítico',cost:'$3,250',price:'$5,200',wholesale:'$4,600',margin:'37.5%',total:'$39K'}]
const movements = [{type:'Compra',product:'Arroz Diana 500g',sku:'SKU-001842',warehouse:'Bodega Principal',doc:'FV-1542',in:'+120',out:'—',balance:'482',user:'Laura Gómez',time:'Hoy, 10:32 AM'},{type:'Transferencia salida',product:'Aceite Premier 900ml',sku:'SKU-002107',warehouse:'Bodega Principal',doc:'TR-000154',in:'—',out:'25',balance:'38',user:'Mauricio A.',time:'Hoy, 9:48 AM'},{type:'Venta',product:'Gaseosa Coca-Cola 1.5L',sku:'SKU-005882',warehouse:'Punto Centro',doc:'POS-88421',in:'—',out:'3',balance:'12',user:'Caja Centro',time:'Hoy, 9:21 AM'},{type:'Ajuste',product:'Leche Entera Alquería 1L',sku:'SKU-003501',warehouse:'Bodega Norte',doc:'AJ-00092',in:'—',out:'12',balance:'0',user:'Carlos Ruiz',time:'Ayer, 4:15 PM'}]
const transfers = [{code:'TR-000154',date:'18 feb, 2025',from:'Bodega Principal',to:'Punto Centro',products:'12 productos',units:125,owner:'Mauricio A.',status:'En tránsito',updated:'Hace 18 min'},{code:'TR-000153',date:'18 feb, 2025',from:'Bodega Norte',to:'Punto Sur',products:'8 productos',units:64,owner:'Laura Gómez',status:'Pendiente',updated:'Hace 1 h'},{code:'TR-000152',date:'17 feb, 2025',from:'Bodega Principal',to:'Bodega Norte',products:'24 productos',units:310,owner:'Carlos Ruiz',status:'Recibida',updated:'Ayer, 5:42 PM'},{code:'TR-000151',date:'17 feb, 2025',from:'Punto Centro',to:'Bodega Principal',products:'3 productos',units:18,owner:'Caja Centro',status:'Rechazada',updated:'Ayer, 2:10 PM'}]

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

function Transfers(){
  const [selected,setSelected]=useState<typeof transfers[number]|null>(null);
  const [mode,setMode]=useState('Tabla');
  return <>
    <PageHead eyebrow="Logística interna" title="Transferencias" sub="Controla el movimiento de mercancía entre bodegas y puntos de venta." action="Nueva transferencia"/>
    <section className="stats-grid products-stats">
      {[
        ['Transferencias pendientes','9','kardex','amber'],
        ['En tránsito','4','transfers','blue'],
        ['Recibidas','128','check','teal'],
        ['Rechazadas','3','close','red'],
        ['Unidades este mes','12,840','inventory','blue']
      ].map(([t,v,icon,tone])=><Stat key={t as string} title={t as string} value={v as string} iconName={icon as LightIconName} tone={tone as string} note={tone==='red'?'Revisar':'+12.4%'}/>)}
    </section>
    <div className="toolbar">
      <div className="search-box wide">
        <AppIcon name="search" size={16}/>
        <input placeholder="Buscar código o bodega..."/>
      </div>
      {['Origen','Destino','Estado','Periodo'].map(x=><button className="filter-button" key={x}>{x} <AppIcon name="chevronDown" size={13}/></button>)}
      <div className="segmented">
        <button className={mode==='Tabla'?'selected':''} onClick={()=>setMode('Tabla')}>Tabla</button>
        <button className={mode==='Flujo'?'selected':''} onClick={()=>setMode('Flujo')}>Flujo</button>
      </div>
    </div>
    {mode==='Flujo'?<div className="flow-grid">{transfers.map(t=><article className="flow-card" key={t.code} onClick={()=>setSelected(t)}><span className={`state ${t.status.toLowerCase().replace(' ','-')}`}>{t.status}</span><div className="flow-location"><strong>{t.from}</strong><AppIcon name="transfers" size={18}/><strong>{t.to}</strong></div><div className="flow-units"><b>{t.units}</b><span>unidades en movimiento</span></div><div className="stepper"><span className="done">✓</span><i className="done"/><span className="done">✓</span><i/><span>○</span></div><small>{t.code} · {t.updated}</small></article>)}</div>:<div className="table-panel animated-table"><div className="table-scroll"><table><thead><tr><th>Código</th><th>Fecha</th><th>Origen</th><th>Destino</th><th>Productos</th><th>Unidades</th><th>Responsable</th><th>Estado</th><th>Última actualización</th><th/></tr></thead><tbody>{transfers.map(t=><tr key={t.code} onClick={()=>setSelected(t)}><td><strong>{t.code}</strong></td><td>{t.date}</td><td>{t.from}</td><td><AppIcon name="arrowLeftRight" size={13}/> {t.to}</td><td>{t.products}</td><td><b>{t.units}</b></td><td>{t.owner}</td><td><span className={`state ${t.status.toLowerCase().replace(' ','-')}`}>{t.status}</span></td><td>{t.updated}</td><td><button className="icon-button"><AppIcon name="chevronRight" size={15}/></button></td></tr>)}</tbody></table></div></div>}
    {selected&&<div className="drawer-backdrop" onClick={()=>setSelected(null)}><aside className="transfer-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">Detalle de transferencia</p><h2>{selected.code}</h2></div><button className="icon-button" onClick={()=>setSelected(null)}><AppIcon name="close" size={18}/></button></div><div className="transfer-route"><strong>{selected.from}</strong><AppIcon name="arrowLeftRight" size={18}/><strong>{selected.to}</strong></div><span className={`state ${selected.status.toLowerCase().replace(' ','-')}`}>{selected.status}</span><div className="detail-stepper"><div className="step done"><AppIcon name="check" size={14}/><span>Creada</span></div><i/><div className="step done"><AppIcon name="check" size={14}/><span>Preparada</span></div><i/><div className="step"><span>3</span><span>Despachada</span></div><i/><div className="step"><span>4</span><span>Recibida</span></div></div><div className="drawer-section"><h3>Productos · {selected.products}</h3>{products.slice(0,3).map(p=><div className="transfer-product" key={p.sku}><div className="product-thumb"><AppIcon name="products" size={16}/></div><div><strong>{p.name}</strong><span>{p.sku}</span></div><b>{Math.ceil(selected.units/3)} uds</b></div>)}</div><div className="drawer-section info-list"><p><span>Creó</span><b>{selected.owner}</b></p><p><span>Última actualización</span><b>{selected.updated}</b></p><p><span>Observaciones</span><b>Despacho programado para hoy.</b></p></div></aside></div>}
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

const moduleRows:Record<string,string[][]>={
  Compras:[['CP-002184','Distribuciones La 14','Bodega Principal','18 feb, 2025','$8.42M','Crédito','Pendiente'],['CP-002183','Alimentos Diana S.A.','Bodega Norte','17 feb, 2025','$4.18M','Contado','Pagada'],['CP-002182','Lácteos del Valle','Punto Centro','16 feb, 2025','$2.76M','Crédito','Por vencer'],['CP-002181','Bebidas Nacionales','Bodega Principal','15 feb, 2025','$6.92M','Crédito','Vencida']],
  Proveedores:[['Distribuciones La 14','900.421.882-1','Andrés Pérez','310 445 8821','3 bodegas','24','$18.4M','Activo'],['Alimentos Diana S.A.','860.003.211-7','María Rojas','315 220 1630','2 bodegas','18','$7.2M','Activo'],['Lácteos del Valle','901.288.044-3','Camilo Díaz','300 814 0032','1 bodega','9','$2.8M','Activo'],['Bebidas Nacionales','800.140.998-6','Laura Nieto','318 445 7700','4 bodegas','31','$9.1M','En revisión']],
  Clientes:[['Comercializadora El Sol','NIT 901.442.118','300 458 2011','compras@elsol.co','Punto Centro','18 feb, 2025','$2.4M','$180K','Activo'],['Tienda La 32','CC 43.882.901','310 220 4410','tienda32@mail.com','Punto Sur','17 feb, 2025','$1.8M','$0','Activo'],['Restaurante Sazón','NIT 900.112.883','315 998 1200','admin@sazon.co','Bodega Norte','15 feb, 2025','$980K','$240K','Crédito'],['Mini mercado 24H','NIT 901.883.210','301 773 1009','contacto@24h.co','Punto Centro','14 feb, 2025','$640K','$0','Activo']],
  Ventas:[['VT-88421','18 feb, 10:42 AM','Comercializadora El Sol','Punto Centro','Laura Gómez','14 productos','$482K','Tarjeta','Emitida'],['VT-88420','18 feb, 10:31 AM','Tienda La 32','Punto Sur','Carlos Ruiz','8 productos','$218K','Efectivo','Emitida'],['VT-88419','18 feb, 10:12 AM','Restaurante Sazón','Punto Centro','Laura Gómez','22 productos','$1.24M','Crédito','Pendiente'],['VT-88418','18 feb, 9:54 AM','Venta mostrador','Punto Norte','Andrés M.','5 productos','$96K','Transferencia','Emitida']],
  Facturación:[['FV-88421','18 feb, 10:42 AM','Comercializadora El Sol','Punto Centro','POS','$482K','Emitida','Aceptada'],['FV-88420','18 feb, 10:31 AM','Tienda La 32','Punto Sur','Electrónica','$218K','Emitida','Aceptada'],['FV-88419','18 feb, 10:12 AM','Restaurante Sazón','Punto Centro','POS','$1.24M','Pendiente','Procesando'],['FV-88418','18 feb, 9:54 AM','Venta mostrador','Punto Norte','Electrónica','$96K','Anulada','Anulada']],
  Remisiones:[['RM-001284','Comercializadora El Sol','Bodega Principal','18 feb, 2025','14 productos','84','Mauricio A.','Despachada','—'],['RM-001283','Tienda La 32','Bodega Norte','18 feb, 2025','8 productos','42','Laura Gómez','Entregada','FV-88392'],['RM-001282','Restaurante Sazón','Punto Centro','17 feb, 2025','22 productos','126','Carlos Ruiz','Pendiente','—'],['RM-001281','Mini mercado 24H','Bodega Principal','17 feb, 2025','5 productos','18','Andrés M.','Facturada','FV-88380']],
}

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

function POS(){
  const [cart,setCart]=useState<typeof products>([]);
  return <>
    <PageHead eyebrow="Punto de venta" title="POS" sub="Vende rápido, consulta inventario y centraliza cada transacción." action="Abrir caja"/>
    <div className="pos-layout">
      <section className="pos-products">
        <div className="search-box wide">
          <AppIcon name="search" size={16}/>
          <input placeholder="Buscar producto o código de barras..."/>
        </div>
        <div className="segmented">
          <button className="selected">Todos</button>
          <button>Despensa</button>
          <button>Bebidas</button>
          <button>Lácteos</button>
        </div>
        <div className="product-grid">
          {products.map(p=><article className="product-card" key={p.sku} onClick={()=>setCart(c=>c.some(x=>x.sku===p.sku)?c:[...c,p])}>
            <div className="product-thumb"><AppIcon name="products" size={18}/></div>
            <p>{p.category}</p>
            <h3>{p.name}</h3>
            <span>{p.stock} disponibles</span>
            <strong>{p.price}</strong>
          </article>)}
        </div>
      </section>
      <aside className="pos-cart">
        <div className="drawer-header">
          <div><p className="eyebrow">Venta actual</p><h2>Carrito <span>{cart.length}</span></h2></div>
          <button className="outline-button">Cliente</button>
        </div>
        {cart.length===0?<div className="drawer-empty"><AppIcon name="purchases" size={32}/><p>Tu carrito está vacío</p><span>Agrega productos para comenzar.</span></div>:cart.map(p=><div className="cart-row" key={p.sku}><div><strong>{p.name}</strong><span>1 × {p.price}</span></div><button className="icon-button" onClick={()=>setCart(c=>c.filter(x=>x.sku!==p.sku))}><AppIcon name="close" size={14}/></button></div>)}
        <div className="cart-total"><span>Total</span><strong>${cart.reduce((a,p)=>a+Number(p.price.replace(/[$.]/g,'').replace(',','')),0).toLocaleString('es-CO')}</strong></div>
        <button className="primary-button" disabled={!cart.length}>Finalizar venta <AppIcon name="chevronRight" size={14}/></button>
      </aside>
    </div>
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

const adminConfigs:Record<string,{eyebrow:string;sub:string;stats:string[];values:string[];iconName:LightIconName;tabs:string[]}>={
 Contabilidad:{eyebrow:'Control financiero',sub:'Consolida la información contable y el resultado de cada operación.',stats:['Activos','Pasivos','Inventario','Cuentas por cobrar','Cuentas por pagar','Ingresos del mes','Costos','Utilidad bruta'],values:['$1.84B','$642M','$912.6M','$184M','$96M','$428M','$286M','$142M'],iconName:'accounting',tabs:['Resumen','Plan de cuentas','Asientos','Libro diario','Libro mayor','Balance de prueba','Periodos']},
 Impuestos:{eyebrow:'Administración tributaria',sub:'Gestiona tarifas, vigencias y productos asociados a cada impuesto.',stats:['IVA generado','IVA descontable','Retenciones','Impuestos del periodo'],values:['$48.2M','$31.6M','$8.4M','$24.9M'],iconName:'taxes',tabs:['Resumen','Tipos de impuesto','Tarifas','Vigencias']},
 Exógena:{eyebrow:'Información tributaria',sub:'Prepara, valida y exporta la información exógena de la compañía.',stats:['Registros','Terceros','Inconsistencias','Formatos preparados'],values:['18,426','2,184','12','8 / 12'],iconName:'exogena',tabs:['Resumen','Formatos','Inconsistencias','Historial']},
 'Pedidos Web':{eyebrow:'Canal digital',sub:'Coordina los pedidos recibidos desde la página web hasta su entrega.',stats:['Nuevos','Confirmados','En preparación','Listos','Despachados','Entregados','Cancelados'],values:['24','18','12','9','31','284','6'],iconName:'webOrders',tabs:['Tabla','Kanban']},
 'Catálogo Super Más':{eyebrow:'Canal ecommerce',sub:'Administra los productos publicados para compra en el catálogo Super Más.',stats:['Productos publicados','Disponibles','Pocas unidades','Agotados'],values:['6,840','6,512','214','114'],iconName:'ecommerceSM',tabs:['Productos','Categorías','Publicación']},
 'Catálogo Distribuidora':{eyebrow:'Canal distribuidora',sub:'Gestiona disponibilidad, WhatsApp y compra web para clientes mayoristas.',stats:['Publicados','Solo WhatsApp','Compra + WhatsApp','Sin disponibilidad'],values:['4,208','1,482','2,726','38'],iconName:'ecommerceDist',tabs:['Productos','Canales','Precios mayoristas']},
 Reportes:{eyebrow:'Inteligencia operativa',sub:'Genera reportes accionables para cada área de Super Más.',stats:['Reportes disponibles','Generados este mes','Programados','Última actualización'],values:['42','186','12','Hace 8 min'],iconName:'reports',tabs:['Todos','Ventas','Compras','Inventario','Contabilidad']},
 Alertas:{eyebrow:'Centro de atención',sub:'Revisa eventos operativos que requieren seguimiento del equipo.',stats:['Nuevas','Inventario','Compras','Ventas','Facturación','Sistema'],values:['3','8','4','12','2','6'],iconName:'alerts',tabs:['Todas','Inventario','Compras','Ventas','Facturación','Sistema']},
 Auditoría:{eyebrow:'Trazabilidad de cambios',sub:'Consulta quién hizo cada cambio y compara los valores antes y después.',stats:['Eventos hoy','Usuarios activos','Módulos auditados','Cambios aprobados'],values:['284','18','12','96%'],iconName:'audit',tabs:['Todos','Inventario','Ventas','Configuración']},
 Usuarios:{eyebrow:'Accesos administrativos',sub:'Administra las personas con acceso al sistema y su actividad reciente.',stats:['Usuarios activos','Administradores','Vendedores','Usuarios bloqueados'],values:['18','3','9','2'],iconName:'users',tabs:['Todos','Activos','Bloqueados']},
 Roles:{eyebrow:'Gobierno de permisos',sub:'Define el alcance operativo de cada rol con una matriz clara de permisos.',stats:['Roles configurados','Permisos activos','Usuarios asignados','Revisiones pendientes'],values:['8','142','18','2'],iconName:'roles',tabs:['Roles','Matriz de permisos','Historial']},
 Configuración:{eyebrow:'Centro de configuración',sub:'Ajusta la operación general, canales, seguridad e integraciones.',stats:['Secciones','Cambios pendientes','Integraciones','Última sincronización'],values:['12','4','6','Hace 3 min'],iconName:'settings',tabs:['General','Empresa','Inventario','Facturación','Ecommerce','Seguridad']}
}

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
    <Transfers />
  ) : view === 'POS' ? (
    <POS />
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
