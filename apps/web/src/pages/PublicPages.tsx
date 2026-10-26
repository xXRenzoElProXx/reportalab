import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BellDot, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardCopy, Clock3, Cpu, FilePlus2, Hash, KeyRound, Laptop2, LockKeyhole, MapPin, MonitorCog, QrCode, RefreshCw, ScanLine, Search, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { api } from '../api';
import { BackLink, Brand, ErrorBox, Loading, PublicFooter, StatusBadge, ThemeToggle } from '../components/UI';
import type { Category, Priority, PublicEquipment, Session, Tracking } from '../types';
import { categoryLabels, formatDate, priorityLabels, statusLabels, statusOrder } from '../types';

function PublicNav() {
  return <header className="public-nav container"><Brand /><nav aria-label="Navegación principal"><Link to="/seguimiento"><Search size={16}/> Consultar reporte</Link><ThemeToggle/><Link to="/login" className="button button-dark button-small">Acceso personal <ArrowRight size={16}/></Link></nav></header>;
}
export function HomePage() {
  return <div className="public-page home-page"><PublicNav />
    <main>
      <section className="hero container"><div className="hero-copy">
        <span className="hero-chip"><span className="live-dot" /> MANTENIMIENTO, SIN COMPLICACIONES</span>
        <h1>Un equipo falla.<br /><span>El reporte llega</span><br />a quien corresponde.</h1>
        <p>Reporta incidencias en laboratorios y aulas desde un código QR. Sin crear una cuenta, sin perder el seguimiento y sin mensajes dispersos.</p>
        <div className="hero-actions"><Link className="button button-primary button-large" to="/seguimiento">Consultar mi reporte <ArrowRight size={18}/></Link><Link to="/login" className="button button-outline button-large">Entrar al panel</Link></div>
        <div className="hero-sub"><ShieldCheck size={17}/> Proyecto de demostración con información ficticia</div>
      </div><div className="hero-visual" aria-label="Ilustración del flujo de ReportaLab">
        <div className="visual-grid" />
        <div className="device-card"><div className="device-title"><span className="device-icon"><Laptop2 size={19}/></span><span><strong>PC de desarrollo 01</strong><small>LAB-A-001 · Laboratorio A</small></span><span className="device-more">•••</span></div><div className="mock-qr"><QrCode size={110} strokeWidth={1.45}/></div><div className="device-foot"><ScanLine size={16}/> Escanéame para reportar</div></div>
        <div className="floating-ticket"><div className="float-icon"><CheckCircle2 size={19}/></div><div><small>Incidencia recibida</small><strong>RL-08A2B7F9D1</strong></div><span className="float-check">✓</span></div>
        <div className="float-pill"><Wrench size={16}/> En reparación</div>
      </div></section>
      <section className="feature-strip"><div className="container feature-strip-inner"><span><QrCode size={20}/> QR por equipo</span><span><ClipboardCheck size={20}/> Reportes centralizados</span><span><Clock3 size={20}/> Seguimiento en tiempo real</span><span><LockKeyhole size={20}/> Panel privado</span></div></section>
      <section className="how-section container"><div className="section-top"><div><span className="eyebrow">ASÍ DE SIMPLE</span><h2>Del problema a la solución.</h2></div><p>Un recorrido corto para quien reporta y toda la información organizada para soporte.</p></div><div className="how-grid">
        <div className="how-card"><div className="how-symbol"><ScanLine size={26}/></div><span className="how-number">01 / IDENTIFICA</span><h3>Escanea el QR</h3><p>El equipo y su ubicación ya están asociados al formulario. No necesitas escribir códigos.</p></div>
        <div className="how-card"><div className="how-symbol"><FilePlus2 size={26}/></div><span className="how-number">02 / REPORTA</span><h3>Cuéntanos qué sucede</h3><p>Selecciona una categoría, describe la falla y recibe un código único para consultar el caso.</p></div>
        <div className="how-card"><div className="how-symbol"><MonitorCog size={26}/></div><span className="how-number">03 / SEGUIMIENTO</span><h3>Conoce el avance</h3><p>El equipo técnico revisa el reporte y actualiza su estado hasta darlo por resuelto.</p></div>
      </div></section>
      <section className="callout-section container"><div><span className="eyebrow eyebrow-light">PARA EL EQUIPO DE SOPORTE</span><h2>Todo el trabajo en un solo lugar.</h2><p>Revisa incidencias, identifica equipos, registra el mantenimiento y mantén el historial de cada caso.</p><Link to="/login" className="button button-white">Abrir panel técnico <ArrowRight size={17}/></Link></div><div className="callout-decoration"><div className="decor-line"/><ClipboardCheck size={136} strokeWidth={1}/></div></section>
    </main><PublicFooter /></div>;
}

export function ReportPage() {
  const { token = '' } = useParams();
  const [equipment, setEquipment] = useState<PublicEquipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('HARDWARE');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    api<PublicEquipment>(`/public/equipment/${token}`)
      .then(result => { if (mounted) setEquipment(result); })
      .catch((e: Error) => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFormError(null); setSaving(true);
    try {
      const response = await api<{ trackingCode: string }>('/public/incidents', {
        method: 'POST', body: JSON.stringify({ equipmentToken: token, category, priority, description }),
      });
      setCreatedCode(response.trackingCode);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setFormError((err as Error).message); }
    finally { setSaving(false); }
  }
  return <div className="public-page soft-page"><div className="simple-nav container"><Brand/><div className="simple-nav-actions"><ThemeToggle/><Link to="/seguimiento" className="text-link"><Search size={16}/> Seguimiento</Link></div></div>
    <main className="form-shell container"><BackLink to="/">Volver al inicio</BackLink>
      {loading ? <Loading label="Buscando el equipo…"/> : error || !equipment ? <div className="paper-card centered"><ErrorBox message={error || 'Equipo no encontrado.'}/><p>Revisa que el enlace QR esté completo o comunícate con el personal de soporte.</p></div> : createdCode ?
        <div className="paper-card success-page"><div className="success-emblem"><CheckCircle2 size={42}/></div><span className="eyebrow">REPORTE REGISTRADO</span><h1>¡Listo! Ya recibimos tu reporte.</h1><p>El equipo técnico podrá revisar la incidencia. Guarda este código para consultar los avances cuando quieras.</p><div className="tracking-copy"><span>TU CÓDIGO DE SEGUIMIENTO</span><div><strong>{createdCode}</strong><button className="icon-button" aria-label="Copiar código" onClick={() => navigator.clipboard.writeText(createdCode)}><ClipboardCopy size={20}/></button></div></div><Link to={`/seguimiento/${createdCode}`} className="button button-primary button-full">Ver seguimiento <ArrowRight size={17}/></Link><Link className="subtle-link" to="/">Volver al inicio</Link></div> :
        <><div className="page-intro"><span className="eyebrow">NUEVA INCIDENCIA</span><h1>Reportar un problema</h1><p>Completa el formulario. No es necesario iniciar sesión.</p></div>
          <div className="equipment-identity"><div className="equipment-identity-icon"><Cpu size={26}/></div><div><span>EQUIPO IDENTIFICADO</span><strong>{equipment.name}</strong><small><Hash size={13}/>{equipment.code}<span>·</span><MapPin size={13}/>{equipment.location}</small></div><CheckCircle2 className="identity-verified" size={21}/></div>
          <form onSubmit={submit} className="paper-card report-form"><div className="form-section-title"><span>01</span><div><h2>Detalles de la incidencia</h2><p>Cuéntanos qué está pasando con el equipo.</p></div></div>
            <label className="field"><span>Categoría del problema <b>*</b></span><select value={category} onChange={e => setCategory(e.target.value as Category)}>{(Object.keys(categoryLabels) as Category[]).map(key => <option key={key} value={key}>{categoryLabels[key]}</option>)}</select></label>
            <label className="field"><span>Descripción del problema <b>*</b></span><textarea minLength={12} maxLength={1500} rows={5} placeholder="Ej.: Al encender el equipo, la pantalla permanece negra. Probé reiniciarlo, pero el problema continúa…" required value={description} onChange={e => setDescription(e.target.value)}/><small>{description.length}/1500 caracteres · mínimo 12</small></label>
            <fieldset className="field priority-field"><legend>¿Qué tan urgente es? <b>*</b></legend><div className="priority-options">{(['LOW','MEDIUM','HIGH'] as Priority[]).map(value => <label key={value} className={`priority-option ${priority === value ? 'selected' : ''}`}><input type="radio" name="priority" checked={priority === value} onChange={() => setPriority(value)}/><span className={`priority-circle priority-circle-${value.toLowerCase()}`} /><span>{priorityLabels[value]}</span></label>)}</div><small>Selecciona según el impacto en el uso del equipo.</small></fieldset>
            <ErrorBox message={formError}/><button className="button button-primary button-full button-large" type="submit" disabled={saving || description.trim().length < 12}>{saving ? 'Enviando…' : 'Enviar reporte'} <ArrowRight size={18}/></button><p className="form-bottom-note"><ShieldCheck size={16}/> El reporte se envía sin solicitar datos personales.</p>
          </form></>}
    </main><PublicFooter /></div>;
}

export function TrackingSearchPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const valid = /^RL-[A-F0-9]{18}$/.test(code.trim().toUpperCase());
  return <div className="public-page soft-page"><div className="simple-nav container"><Brand /><div className="simple-nav-actions"><ThemeToggle/><Link to="/login" className="text-link">Acceso personal <ArrowRight size={16}/></Link></div></div><main className="form-shell container"><BackLink to="/">Volver al inicio</BackLink><div className="page-intro"><span className="eyebrow">CONSULTA PÚBLICA</span><h1>¿Cómo va tu reporte?</h1><p>Ingresa el código que recibiste al enviar tu incidencia. No necesitas una cuenta.</p></div><form className="paper-card lookup-form" onSubmit={e => { e.preventDefault(); if (valid) navigate(`/seguimiento/${code.trim().toUpperCase()}`); }}><div className="lookup-icon"><Search size={28}/></div><label className="field"><span>Código de seguimiento</span><input autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="RL-XXXXXXXXXXXXXXXXXX" maxLength={21} autoCapitalize="characters" spellCheck={false}/><small>Ejemplo de formato: RL- seguido de 18 caracteres hexadecimales.</small></label><button type="submit" className="button button-primary button-full" disabled={!valid}>Consultar estado <ArrowRight size={17}/></button></form><p className="help-note"><BellDot size={18}/> ¿Perdiste tu código? Solicita ayuda al personal encargado del laboratorio.</p></main><PublicFooter /></div>;
}
export function TrackingPage() {
  const { code = '' } = useParams();
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  async function refreshTracking() {
    setError(null);
    setRefreshing(true);
    try { setData(await api<Tracking>(`/public/incidents/${encodeURIComponent(code)}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { let mounted = true;
    api<Tracking>(`/public/incidents/${encodeURIComponent(code)}`).then(d => { if (mounted) setData(d); }).catch((e: Error) => { if (mounted) setError(e.message); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [code]);
  return <div className="public-page soft-page"><div className="simple-nav container"><Brand/><div className="simple-nav-actions"><ThemeToggle/><Link className="text-link" to="/seguimiento">Consultar otro <ArrowRight size={16}/></Link></div></div><main className="form-shell container"><BackLink to="/seguimiento">Buscar otro código</BackLink>{loading ? <Loading/> : error || !data ? <div className="paper-card centered"><ErrorBox message={error || 'No se encontró el reporte.'}/><Link to="/seguimiento" className="button button-outline">Volver a buscar</Link></div> :
    <><div className="page-intro"><span className="eyebrow">ESTADO DEL REPORTE</span><h1>Seguimiento de incidencia</h1><p>Este es el avance más reciente de tu reporte.</p></div><ErrorBox message={error}/><div className="paper-card tracking-panel"><div className="tracking-panel-head"><div><small>CÓDIGO DE SEGUIMIENTO</small><h2>{data.trackingCode}</h2></div><div className="tracking-actions"><StatusBadge status={data.status}/><button type="button" className="button button-outline button-small" onClick={refreshTracking} disabled={refreshing} aria-label="Actualizar estado del reporte"><RefreshCw size={15} className={refreshing ? 'spin' : ''}/><span>{refreshing ? 'Actualizando…' : 'Actualizar'}</span></button></div></div><div className="tracking-equipment"><div className="item-icon"><Laptop2 size={22}/></div><div><strong>{data.equipmentName}</strong><p>{data.equipmentCode} · {data.location}</p></div></div><div className="tracking-meta"><div><span>Fecha del reporte</span><strong>{formatDate(data.createdAt)}</strong></div><div><span>Última actualización</span><strong>{formatDate(data.updatedAt)}</strong></div></div><div className="progress-heading"><h3>Progreso de atención</h3><p>{data.status === 'RESOLVED' ? 'El reporte ha sido resuelto.' : `Estado actual: ${statusLabels[data.status].toLowerCase()}.`}</p></div><ol className="progress-list">{statusOrder.map((s, i) => { const reached = statusOrder.indexOf(data.status) >= i; const current = s === data.status; return <li key={s} className={`${reached ? 'done' : ''} ${current ? 'current' : ''}`}><span className="progress-bullet">{reached ? <CheckCircle2 size={19}/> : i+1}</span><div><strong>{statusLabels[s]}</strong>{current && <small>Estado actual</small>}</div></li>; })}</ol><div className="public-privacy"><LockKeyhole size={17}/> Las notas técnicas internas no se muestran en esta consulta.</div></div></>}
    </main><PublicFooter /></div>;
}

export function LoginPage({ onLogin }: { onLogin: (user: Session) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setLoading(true);
    try { const user = await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onLogin(user); navigate('/panel'); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }
  return <div className="login-layout"><aside className="login-aside"><Brand inverted/><div className="login-aside-message"><div className="login-graphic"><div className="login-graphic-icon"><QrCode size={40}/></div><div><span>INCIDENCIA #RL-08A2</span><strong>Equipo en revisión</strong><div className="mock-bars"><i/><i/><i/></div></div></div><span className="eyebrow eyebrow-light">SOPORTE ORGANIZADO</span><h1>Cada incidencia,<br/>bajo control.</h1><p>Centraliza reportes, registra las acciones del equipo técnico y mantén todo el historial a la mano.</p></div><div className="aside-disclaimer"><Sparkles size={16}/> Entorno de demostración · No utilizar datos reales</div></aside><main className="login-main"><div className="login-top"><Link to="/"><ArrowRight size={16} style={{transform:'rotate(180deg)'}}/> Volver al inicio</Link><ThemeToggle/></div><div className="login-form-wrap"><span className="login-lock"><KeyRound size={26}/></span><span className="eyebrow">ACCESO DEL PERSONAL</span><h1>Bienvenido de nuevo</h1><p>Ingresa tus credenciales para continuar al panel de gestión.</p><form onSubmit={submit}><label className="field"><span>Correo electrónico</span><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@institucion.edu" required/></label><label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Ingresa tu contraseña" required/></label><ErrorBox message={error}/><button className="button button-primary button-full button-large" disabled={loading}>{loading ? 'Ingresando…' : 'Iniciar sesión'}<ArrowRight size={17}/></button></form><div className="demo-credentials"><div><ShieldCheck size={17}/><strong>Cuenta de demostración</strong></div><p>En el entorno local puedes ingresar con las credenciales del archivo README. No uses cuentas reales.</p><button type="button" className="text-link" onClick={() => { setEmail('admin@reportalab.demo'); setPassword('DemoAdmin2026!'); }}>Rellenar acceso de administrador <ChevronRight size={15}/></button></div></div></main></div>;
}
