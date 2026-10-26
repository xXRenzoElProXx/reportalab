import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ClipboardList, Clock3, Cpu, ExternalLink, Filter, FlaskConical, Hash, LayoutDashboard, LogOut, MapPin, Menu, MessageSquareText, MoreHorizontal, Plus, QrCode, RefreshCw, Settings2, Shield, Trash2, Wrench, X } from 'lucide-react';
import * as QRCode from 'qrcode';
import { api } from '../api';
import { EmptyState, ErrorBox, Loading, PriorityBadge, SearchBox, SectionHeading, StatusBadge, SuccessBox, ThemeToggle } from '../components/UI';
import type { Category, Equipment, Incident, IncidentDetail, OperationalStatus, Session, Stats, Status } from '../types';
import { categoryLabels, formatDate, formatShortDate, operationalLabels, statusLabels, statusOrder } from '../types';

const navLinks = [
  { to: '/panel', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/panel/reportes', label: 'Incidencias', icon: ClipboardList, end: false },
  { to: '/panel/equipos', label: 'Equipos y QR', icon: Cpu, end: false },
];
const iconForStatus: Record<Status, typeof ClipboardList> = { RECEIVED: ClipboardList, UNDER_REVIEW: Clock3, IN_REPAIR: Wrench, RESOLVED: CheckCircle2 };
const sessionContext = () => useOutletContext<{ session: Session }>();

export function PanelLayout({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  async function signOut() { await api('/auth/logout', { method: 'POST' }).catch(() => null); onLogout(); navigate('/login'); }
  return <div className="panel-layout"><aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
    <div className="side-top"><Link to="/" className="panel-brand" onClick={() => setOpen(false)}><span className="panel-brand-icon"><FlaskConical size={21}/></span><span>Reporta<strong>Lab</strong><small>PANEL DE GESTIÓN</small></span></Link><button className="sidebar-close icon-button" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
    <div className="side-workspace"><span className="workspace-avatar"><FlaskConical size={19}/></span><div><small>ESPACIO DE TRABAJO</small><strong>Laboratorio demo</strong></div><ChevronDown size={15}/></div>
    <div className="side-section-caption">GENERAL</div><nav className="side-nav" aria-label="Panel de gestión">{navLinks.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({isActive}) => `side-link ${isActive ? 'active' : ''}`}><item.icon size={19}/>{item.label}{item.label === 'Incidencias' && <span className="side-link-mini">↗</span>}</NavLink>)}</nav>
    <div className="side-spacer"/><div className="side-card"><span className="side-card-icon"><QrCode size={21}/></span><strong>Reporta desde un QR</strong><p>Cada equipo puede tener su propio enlace para reportar fallas al instante.</p><Link to="/panel/equipos" onClick={() => setOpen(false)}>Ver equipos <ArrowRight size={15}/></Link></div>
    <div className="side-account"><span className="avatar-small">{session.email.slice(0,1).toUpperCase()}</span><div><strong>{session.role === 'ADMIN' ? 'Administrador' : 'Técnico de soporte'}</strong><small title={session.email}>{session.email}</small></div><button onClick={signOut} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={19}/></button></div>
  </aside>
  {open && <button className="mobile-overlay" onClick={() => setOpen(false)} aria-label="Cerrar menú"/>}
  <div className="panel-main"><header className="panel-topbar"><div><button className="menu-toggle icon-button" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={22}/></button><span className="topbar-breadcrumb">Laboratorio demo <span>/</span> Gestión de incidencias</span></div><div className="topbar-right"><ThemeToggle/><span className="live-tag"><span className="live-dot"/> Sistema activo</span><span className="topbar-avatar">{session.email.slice(0,1).toUpperCase()}</span></div></header><div className="panel-content"><Outlet context={{ session }}/></div></div></div>;
}
function ReportRow({ report }: { report: Incident }) {
  return <Link className="report-row" to={`/panel/reportes/${report.id}`}>
    <div className="report-id">{report.trackingCode.slice(0, 13)}… <small>{formatShortDate(report.createdAt)}</small></div>
    <div className="report-equipment"><span className="mini-device"><Cpu size={18}/></span><span><strong>{report.equipmentName}</strong><small>{report.equipmentCode} · {report.location}</small></span></div>
    <div className="report-category">{categoryLabels[report.category]}</div><div><PriorityBadge priority={report.priority}/></div><div><StatusBadge status={report.status}/></div><ArrowRight size={17} className="row-arrow"/>
  </Link>;
}
function ReportList({ reports, empty = 'No se encontraron incidencias.' }: { reports: Incident[]; empty?: string }) {
  return <div className="reports-list"><div className="report-table-head"><span>CÓDIGO / FECHA</span><span>EQUIPO</span><span>CATEGORÍA</span><span>PRIORIDAD</span><span>ESTADO</span><span/></div>{reports.length ? reports.map(report => <ReportRow key={report.id} report={report}/>) : <EmptyState title="Sin resultados" description={empty}/>}</div>;
}
export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; Promise.all([api<Stats>('/dashboard/stats'), api<Incident[]>('/incidents')]).then(([s,r]) => { if (active) { setStats(s); setReports(r); } }).catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const cards = stats ? [
    { title: 'Total de reportes', value: stats.total, hint: 'Registrados en el sistema', icon: ClipboardList, tone: 'neutral' },
    { title: 'Pendientes', value: stats.received, hint: 'Aún sin revisar', icon: Clock3, tone: 'amber' },
    { title: 'En proceso', value: stats.review + stats.repair, hint: 'En revisión o reparación', icon: Wrench, tone: 'blue' },
    { title: 'Resueltos', value: stats.resolved, hint: 'Incidencias finalizadas', icon: CheckCircle2, tone: 'green' },
  ] : [];
  const distribution: { status: Status; count: number; color: string }[] = stats ? [
    { status: 'RECEIVED', count: stats.received, color: '#d49b43' },
    { status: 'UNDER_REVIEW', count: stats.review, color: '#438eb1' },
    { status: 'IN_REPAIR', count: stats.repair, color: '#8a70bd' },
    { status: 'RESOLVED', count: stats.resolved, color: '#38a17b' },
  ] : [];
  let chartEnd = 0;
  const chartStops = distribution.map(item => {
    const start = chartEnd;
    chartEnd += stats?.total ? item.count / stats.total * 100 : 0;
    return `${item.color} ${start}% ${chartEnd}%`;
  }).join(', ');
  return <><div className="dashboard-heading"><SectionHeading kicker="CENTRO DE OPERACIONES" title="Vista general" description="Un resumen del estado de los equipos y reportes del laboratorio."/><Link to="/panel/equipos" className="button button-primary"><QrCode size={17}/> Ver códigos QR</Link></div><ErrorBox message={error}/>{loading ? <Loading /> : stats ? <>
    <div className="stats-grid">{cards.map(card => <div className="stat-card" key={card.title}><div className="stat-head"><span>{card.title}</span><span className={`stat-icon ${card.tone}`}><card.icon size={21}/></span></div><strong>{card.value.toString().padStart(2,'0')}</strong><small>{card.hint}</small></div>)}</div>
    <div className="dashboard-mid"><div className="card-panel overview-card"><div className="card-title-row"><div><span className="eyebrow">DISTRIBUCIÓN</span><h2>Estado de las incidencias</h2></div><Activity size={19}/></div><div className="distribution-chart"><div className="status-donut" role="img" aria-label={`Distribución de ${stats.total} incidencias por estado`} style={{background:stats.total?`conic-gradient(${chartStops})`:undefined}}><div><strong>{stats.total}</strong><span>reportes</span></div></div><div className="distribution-bars">{statusOrder.map((status) => { const counts: Record<Status,number> = {RECEIVED:stats.received,UNDER_REVIEW:stats.review,IN_REPAIR:stats.repair,RESOLVED:stats.resolved}; const pct = stats.total ? counts[status]/stats.total*100 : 0; const Icon = iconForStatus[status]; return <div className="distribution-item" key={status}><div className="distribution-label"><span><Icon size={17}/>{statusLabels[status]}</span><strong>{counts[status]} <small>({Math.round(pct)}%)</small></strong></div><div className="distribution-rail"><span className={`fill fill-${status.toLowerCase().replace(/_/g,'-')}`} style={{width:`${pct}%`}}/></div></div>; })}</div></div></div>
      <div className="card-panel action-card"><span className="eyebrow">ACCESO RÁPIDO</span><h2>Gestiona el laboratorio</h2><p>Accede a las tareas más habituales desde el panel.</p><Link to="/panel/reportes" className="quick-link"><span className="quick-icon"><ClipboardList size={20}/></span><span><strong>Revisar reportes</strong><small>Filtra, responde y actualiza estados</small></span><ArrowRight size={18}/></Link><Link to="/panel/equipos" className="quick-link"><span className="quick-icon"><Cpu size={20}/></span><span><strong>Administrar equipos</strong><small>{stats.equipment} equipos registrados</small></span><ArrowRight size={18}/></Link></div></div>
    <div className="recent-section"><div className="list-heading"><div><h2>Reportes recientes</h2><p>Últimas incidencias registradas</p></div><Link to="/panel/reportes" className="text-link">Ver todos <ArrowRight size={16}/></Link></div><ReportList reports={reports.slice(0,5)} empty="Los nuevos reportes aparecerán aquí cuando se registren desde un QR."/></div>
  </> : <EmptyState title="No se pudo cargar el panel" description="Intenta recargar la página para consultar la información."/>}</>;
}

export function ReportsPage() {
  const [reports,setReports] = useState<Incident[]>([]);
  const [status,setStatus] = useState<Status | ''>('');
  const [category,setCategory] = useState<Category | ''>('');
  const [search,setSearch] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  useEffect(() => { let active = true; setLoading(true); setError(null);
    const params = new URLSearchParams(); if (status) params.set('status',status); if (category) params.set('category',category);
    const path = `/incidents${params.toString() ? '?'+params : ''}`;
    api<Incident[]>(path).then(data => { if (active) setReports(data); }).catch((e:Error) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[status,category]);
  const visible = useMemo(() => reports.filter(r => `${r.trackingCode} ${r.equipmentName} ${r.equipmentCode} ${r.location}`.toLowerCase().includes(search.toLowerCase())),[reports,search]);
  return <><div className="dashboard-heading"><SectionHeading kicker="GESTIÓN DE REPORTES" title="Incidencias" description="Consulta los reportes enviados desde los equipos del laboratorio."/><span className="records-tag">{visible.length} reportes</span></div><div className="filter-bar"><SearchBox value={search} onChange={setSearch} placeholder="Buscar por código o equipo…"/><div className="filter-controls"><span className="filter-label"><Filter size={16}/> Filtros</span><label className="sr-only" htmlFor="filter-status">Estado</label><select id="filter-status" value={status} onChange={e => setStatus(e.target.value as Status|'')}><option value="">Todos los estados</option>{statusOrder.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select><label className="sr-only" htmlFor="filter-category">Categoría</label><select id="filter-category" value={category} onChange={e=>setCategory(e.target.value as Category|'')}><option value="">Todas las categorías</option>{(Object.keys(categoryLabels) as Category[]).map(c=><option key={c} value={c}>{categoryLabels[c]}</option>)}</select></div></div><ErrorBox message={error}/>{loading ? <Loading/> : <ReportList reports={visible} empty="Prueba con otros filtros o espera a que llegue un nuevo reporte."/>}<p className="table-caption">Se muestran hasta 100 incidencias recientes por consulta.</p></>;
}

export function ReportDetailPage() {
  const { id = '' } = useParams();
  const [report,setReport] = useState<IncidentDetail|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [success,setSuccess] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [selectedStatus,setSelectedStatus] = useState<Status>('RECEIVED');
  const [note,setNote] = useState('');
  async function refresh() { const data = await api<IncidentDetail>(`/incidents/${id}`); setReport(data); setSelectedStatus(data.status); }
  useEffect(() => { let active = true; api<IncidentDetail>(`/incidents/${id}`).then(data=>{if(active){setReport(data);setSelectedStatus(data.status);}}).catch((e:Error)=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;};},[id]);
  async function changeStatus() { setError(null); setSuccess(null); setSaving(true); try { await api(`/incidents/${id}/status`,{method:'PATCH',body:JSON.stringify({status:selectedStatus})}); await refresh(); setSuccess('Estado actualizado correctamente.'); } catch(e) { setError((e as Error).message); } finally { setSaving(false); } }
  async function addNote(e:FormEvent<HTMLFormElement>) { e.preventDefault();setError(null);setSuccess(null);setSaving(true);try { await api(`/incidents/${id}/notes`,{method:'POST',body:JSON.stringify({note})});setNote('');await refresh();setSuccess('Nota guardada en el historial interno.');}catch(e){setError((e as Error).message);}finally{setSaving(false);} }
  return <><Link className="back-link" to="/panel/reportes"><ArrowLeft size={17}/> Volver a incidencias</Link>{loading ? <Loading/> : error && !report ? <ErrorBox message={error}/> : report ? <>
    <div className="detail-heading"><div><span className="eyebrow">DETALLE DE INCIDENCIA</span><h1>{report.tracking_code}</h1><p>Registrada el {formatDate(report.created_at)}</p></div><StatusBadge status={report.status}/></div><ErrorBox message={error}/><SuccessBox message={success}/><div className="detail-grid"><div className="detail-main"><section className="card-panel detail-card"><div className="detail-card-title"><h2>Información del reporte</h2><MoreHorizontal size={19}/></div><div className="detail-equipment"><span className="detail-device-icon"><Cpu size={25}/></span><div><span>EQUIPO AFECTADO</span><strong>{report.equipmentName}</strong><small>{report.equipmentCode} · {report.location}</small></div></div><div className="detail-meta-grid"><div><span>Categoría</span><strong>{categoryLabels[report.category]}</strong></div><div><span>Prioridad</span><PriorityBadge priority={report.priority}/></div><div><span>Fecha del reporte</span><strong>{formatDate(report.created_at)}</strong></div><div><span>Última actualización</span><strong>{formatDate(report.updated_at)}</strong></div></div><div className="description-block"><h3>Descripción del problema</h3><p>{report.description}</p></div></section>
      <section className="card-panel timeline-card"><div className="detail-card-title"><h2>Historial del reporte</h2><span className="mini-count">{report.events.length} eventos</span></div><div className="timeline">{report.events.map(event => <div key={event.id} className="timeline-entry"><span className={`timeline-icon ${event.eventType==='INTERNAL_NOTE'?'note':''}`}>{event.eventType==='INTERNAL_NOTE'?<MessageSquareText size={17}/>:event.eventType==='CREATED'?<ClipboardList size={17}/>:<RefreshCw size={17}/>}</span><div><div className="timeline-title"><strong>{event.eventType==='CREATED'?'Reporte creado':event.eventType==='INTERNAL_NOTE'?'Nota interna':'Estado actualizado'}</strong><time>{formatDate(event.createdAt)}</time></div>{event.eventType==='STATUS_CHANGED' && <p>{event.previousStatus ? statusLabels[event.previousStatus] : 'Sin estado'} <ArrowRight size={13}/> {event.nextStatus ? statusLabels[event.nextStatus] : ''}</p>}{event.note && <p className="timeline-note">{event.note}</p>}{event.actorEmail && <small>Por: {event.actorEmail}</small>}</div></div>)}</div></section></div>
      <aside className="detail-side"><section className="card-panel action-panel"><span className="eyebrow">GESTIÓN</span><h2>Actualizar estado</h2><p>Selecciona la etapa actual de atención.</p><label className="field"><span>Estado del reporte</span><select value={selectedStatus} onChange={e=>setSelectedStatus(e.target.value as Status)}>{statusOrder.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></label><button className="button button-primary button-full" disabled={saving || selectedStatus === report.status} onClick={changeStatus}>Guardar cambio <CheckCircle2 size={17}/></button></section>
      <section className="card-panel note-panel"><span className="eyebrow">SOLO PERSONAL</span><h2>Añadir nota interna</h2><p>Estas notas no son visibles para quien reportó.</p><form onSubmit={addNote}><label className="field"><span>Observación técnica</span><textarea value={note} onChange={e=>setNote(e.target.value)} minLength={3} maxLength={1000} rows={5} placeholder="Ej.: Se verificó el cable de video y se programó una revisión del monitor…" required/></label><button type="submit" className="button button-outline button-full" disabled={saving||note.trim().length<3}>Guardar nota <Plus size={17}/></button></form></section><div className="info-side-note"><Shield size={17}/> La consulta pública muestra únicamente el estado y la información básica del reporte.</div></aside></div>
  </> : null}</>;
}

const defaultEquipment = {code:'',name:'',type:'Computadora',location:'',operationalStatus:'OPERATIVE' as OperationalStatus};
type EquipmentForm = typeof defaultEquipment;
export function EquipmentPage() {
  const { session } = sessionContext();
  const [items,setItems] = useState<Equipment[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [success,setSuccess] = useState<string|null>(null);
  const [search,setSearch] = useState('');
  const [edit,setEdit] = useState<Equipment | null>(null);
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState<EquipmentForm>({...defaultEquipment});
  const [saving,setSaving] = useState(false);
  const [deleting,setDeleting] = useState(false);
  const [deleteEquipment,setDeleteEquipment] = useState<Equipment|null>(null);
  const [deleteError,setDeleteError] = useState<string|null>(null);
  const [qrEquipment,setQrEquipment] = useState<Equipment|null>(null);
  const [qrData,setQrData] = useState('');
  useEffect(()=>{
    if(!showForm&&!qrEquipment&&!deleteEquipment)return;
    const body=document.body;
    const root=document.documentElement;
    const scrollY=window.scrollY;
    const previousBodyOverflow=body.style.overflow;
    const previousRootOverflow=root.style.overflow;
    const previousPaddingRight=body.style.paddingRight;
    const previousScrollBehavior=root.style.scrollBehavior;
    const scrollbarWidth=window.innerWidth-root.clientWidth;
    body.style.overflow='hidden';
    root.style.overflow='hidden';
    if(scrollbarWidth>0)body.style.paddingRight=`${scrollbarWidth}px`;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!deleting){setShowForm(false);setQrEquipment(null);setDeleteEquipment(null);}};
    window.addEventListener('keydown',closeOnEscape);
    return()=>{
      window.removeEventListener('keydown',closeOnEscape);
      body.style.overflow=previousBodyOverflow;
      root.style.overflow=previousRootOverflow;
      body.style.paddingRight=previousPaddingRight;
      root.style.scrollBehavior='auto';
      window.scrollTo(0,scrollY);
      root.style.scrollBehavior=previousScrollBehavior;
    };
  },[showForm,qrEquipment,deleteEquipment,deleting]);
  async function load() { const data = await api<Equipment[]>('/equipment'); setItems(data); }
  useEffect(()=>{let active=true;api<Equipment[]>('/equipment').then(data=>{if(active)setItems(data);}).catch((e:Error)=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  useEffect(()=>{let mounted=true;if(qrEquipment){ QRCode.toDataURL(`${window.location.origin}/e/${qrEquipment.publicToken}`,{width:420,margin:2,color:{dark:'#103342',light:'#FFFFFF'}}).then(data=>{if(mounted)setQrData(data);}).catch(()=>{if(mounted)setQrData('');});}return()=>{mounted=false;};},[qrEquipment]);
  const visible = useMemo(()=>items.filter(item=>`${item.code} ${item.name} ${item.location} ${item.type}`.toLowerCase().includes(search.toLowerCase())),[items,search]);
  function openNew() { setEdit(null);setForm({...defaultEquipment});setShowForm(true);setError(null);setSuccess(null); }
  function openEdit(item:Equipment) { setEdit(item);setForm({code:item.code,name:item.name,type:item.type,location:item.location,operationalStatus:item.operationalStatus});setShowForm(true);setError(null);setSuccess(null); }
  async function save(e:FormEvent<HTMLFormElement>) { e.preventDefault();setSaving(true);setError(null);setSuccess(null);try{await api(edit?`/equipment/${edit.id}`:'/equipment',{method:edit?'PATCH':'POST',body:JSON.stringify(form)});await load();setShowForm(false);setSuccess(edit?'Equipo actualizado.':'Equipo registrado. Ya puedes descargar su QR.');}catch(e){setError((e as Error).message);}finally{setSaving(false);} }
  async function removeEquipment() { if(!deleteEquipment)return;setDeleting(true);setDeleteError(null);try{const result=await api<{deletedIncidents:number}>(`/equipment/${deleteEquipment.id}`,{method:'DELETE',body:JSON.stringify({deleteHistory:deleteEquipment.incidentCount>0})});await load();setSuccess(result.deletedIncidents?`Se eliminó el equipo ${deleteEquipment.code} y ${result.deletedIncidents} ${result.deletedIncidents===1?'incidencia':'incidencias'} de su historial.`:`Se eliminó el equipo ${deleteEquipment.code}.`);setDeleteEquipment(null);}catch(e){setDeleteError((e as Error).message);}finally{setDeleting(false);} }
  function downloadQr() { if(!qrEquipment || !qrData)return;const link=document.createElement('a');link.href=qrData;link.download=`ReportaLab-QR-${qrEquipment.code}.png`;link.click(); }
  const qrUrl = qrEquipment ? `${window.location.origin}/e/${qrEquipment.publicToken}` : '';
  return <><div className="dashboard-heading"><SectionHeading kicker="INVENTARIO BÁSICO" title="Equipos y códigos QR" description="Cada equipo tiene un enlace público para registrar incidencias."/>{session.role==='ADMIN' && <button className="button button-primary" onClick={openNew}><Plus size={18}/> Añadir equipo</button>}</div><div className="equipment-top"><SearchBox value={search} onChange={setSearch} placeholder="Buscar por equipo, código o ubicación…"/><span className="records-tag">{visible.length} equipos</span></div><ErrorBox message={error}/><SuccessBox message={success}/>{loading?<Loading/>:<div className="equipment-grid">{visible.length?visible.map(item=><article className="equipment-card" key={item.id}><div className="equipment-card-top"><span className="equipment-card-icon"><Cpu size={24}/></span><span className={`operational ${item.operationalStatus.toLowerCase()}`}><span className="status-dot"/>{operationalLabels[item.operationalStatus]}</span></div><strong>{item.name}</strong><div className="equipment-code"><Hash size={14}/>{item.code}</div><div className="equipment-location"><MapPin size={16}/>{item.location}</div><div className="equipment-actions"><button className="button button-outline" onClick={()=>{setQrEquipment(item);setQrData('');}}><QrCode size={17}/> Ver QR</button>{session.role==='ADMIN'&&<><button className="button button-plain" onClick={()=>openEdit(item)}><Settings2 size={17}/> Editar</button><button type="button" className="button button-danger button-compact" title={`Eliminar ${item.name}`} aria-label={`Eliminar ${item.name}`} onClick={()=>{setDeleteError(null);setDeleteEquipment(item);}}><Trash2 size={16}/></button></>}</div></article>):<div className="equipment-empty"><EmptyState title="No hay equipos que coincidan" description="Cambia el texto de búsqueda para ver otros resultados."/></div>}</div>}
    {showForm && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false);}}><div className="modal-card" role="dialog" aria-modal="true" aria-label={edit?'Editar equipo':'Añadir equipo'}><div className="modal-title"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>{edit?'Editar equipo':'Registrar equipo'}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={()=>setShowForm(false)}><X size={20}/></button></div><form onSubmit={save} className="equipment-form"><label className="field"><span>Código del equipo</span><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} pattern="[A-Za-z0-9_-]+" minLength={3} maxLength={40} placeholder="LAB-A-015" required/></label><label className="field"><span>Nombre</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} minLength={3} maxLength={150} placeholder="PC de desarrollo 15" required/></label><div className="form-two-col"><label className="field"><span>Tipo</span><input value={form.type} onChange={e=>setForm({...form,type:e.target.value})} minLength={2} maxLength={80} placeholder="Computadora" required/></label><label className="field"><span>Estado operativo</span><select value={form.operationalStatus} onChange={e=>setForm({...form,operationalStatus:e.target.value as OperationalStatus})}>{(Object.keys(operationalLabels) as OperationalStatus[]).map(k=><option key={k} value={k}>{operationalLabels[k]}</option>)}</select></label></div><label className="field"><span>Ubicación</span><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} minLength={3} maxLength={180} placeholder="Laboratorio B · Puesto 15" required/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowForm(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving?'Guardando…':edit?'Guardar cambios':'Registrar equipo'}<CheckCircle2 size={17}/></button></div></form></div></div>}
    {deleteEquipment && <div className="modal-backdrop" onMouseDown={e=>{if(!deleting&&e.target===e.currentTarget)setDeleteEquipment(null);}}><div className="modal-card confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-equipment-title" aria-describedby="delete-equipment-description"><div className="confirm-icon"><AlertTriangle size={23}/></div><button className="icon-button confirm-close" aria-label="Cerrar" onClick={()=>!deleting&&setDeleteEquipment(null)} disabled={deleting}><X size={19}/></button><span className="eyebrow">ELIMINAR DEL INVENTARIO</span><h2 id="delete-equipment-title">{deleteEquipment.incidentCount?'¿Eliminar equipo e historial?':'¿Eliminar este equipo?'}</h2><p id="delete-equipment-description">{deleteEquipment.incidentCount?<>Se eliminará <strong>{deleteEquipment.name}</strong> junto con sus <strong>{deleteEquipment.incidentCount} {deleteEquipment.incidentCount===1?'incidencia':'incidencias'}</strong>, notas y eventos asociados. Esta acción es permanente y no se puede deshacer.</>:<>Se eliminará <strong>{deleteEquipment.name}</strong> de forma permanente del inventario.</>}</p><div className="confirm-equipment"><Cpu size={19}/><span><strong>{deleteEquipment.code}</strong><small>{deleteEquipment.location}</small></span></div>{deleteEquipment.incidentCount>0&&<div className="confirm-history-warning"><AlertTriangle size={17}/><span>También se borrará todo el historial asociado. Esta acción no se puede deshacer.</span></div>}<ErrorBox message={deleteError}/><div className="modal-actions confirm-actions"><button type="button" className="button button-outline" onClick={()=>setDeleteEquipment(null)} disabled={deleting}>Cancelar</button><button type="button" className="button button-danger" onClick={removeEquipment} disabled={deleting}>{deleting?'Eliminando…':deleteEquipment.incidentCount?'Eliminar todo':'Eliminar equipo'}<Trash2 size={16}/></button></div></div></div>}
    {qrEquipment && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setQrEquipment(null);}}><div className="modal-card modal-qr" role="dialog" aria-modal="true" aria-label={`Código QR de ${qrEquipment.name}`}><div className="modal-title"><div><span className="eyebrow">IDENTIFICACIÓN DE EQUIPO</span><h2>Código QR</h2></div><button className="icon-button" aria-label="Cerrar" onClick={()=>setQrEquipment(null)}><X size={20}/></button></div><div className="qr-modal-inner"><strong>{qrEquipment.name}</strong><small>{qrEquipment.code} · {qrEquipment.location}</small><div className="qr-image-wrap">{qrData?<img src={qrData} alt={`Código QR para reportar fallas de ${qrEquipment.name}`}/>:<Loading label="Generando QR…"/>}</div><p>Escanea este código para abrir el formulario asociado al equipo.</p><a className="qr-url" href={qrUrl} target="_blank" rel="noopener noreferrer">Abrir formulario público <ExternalLink size={15}/></a></div><div className="modal-actions"><button className="button button-outline" onClick={()=>navigator.clipboard.writeText(qrUrl)}><Hash size={16}/> Copiar enlace</button><button className="button button-primary" onClick={downloadQr} disabled={!qrData}><ArrowDownToLine size={17}/> Descargar PNG</button></div></div></div>}
  </>;
}
