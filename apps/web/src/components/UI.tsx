import { createContext, type ReactNode, useContext, useLayoutEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, FlaskConical, LoaderCircle, Moon, Search, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Priority, Status } from '../types';
import { priorityLabels, statusLabels } from '../types';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('reportalab-theme');
    return saved === 'dark' || saved === 'light' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101d24' : '#f5f8f7');
    localStorage.setItem('reportalab-theme', theme);
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(value => value === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) return null;
  const { theme, toggleTheme } = context;
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`} title={`Tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}><span className="theme-toggle-icon">{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</span><span className="theme-toggle-label">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span></button>;
}

export function Brand({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return <Link to="/" className={`brand ${inverted ? 'brand-inverted' : ''}`} aria-label="Ir al inicio de ReportaLab">
    <span className="brand-mark"><FlaskConical size={22} strokeWidth={2.3} /></span>
    {!compact && <span>Reporta<span className="brand-accent">Lab</span><small>GESTIÓN DE INCIDENCIAS</small></span>}
  </Link>;
}
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status.toLowerCase().replace(/_/g, '-')}`}><span className="status-dot" />{statusLabels[status]}</span>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`priority-badge priority-${priority.toLowerCase()}`}>{priorityLabels[priority]}</span>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><ClipboardList size={25} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function ErrorBox({ message }: { message?: string | null }) {
  return message ? <div className="alert alert-error" role="alert"><AlertCircle size={18} />{message}</div> : null;
}
export function SuccessBox({ message }: { message?: string | null }) {
  return message ? <div className="alert alert-success" role="status"><CheckCircle2 size={18} />{message}</div> : null;
}
export function Loading({ label = 'Cargando información…' }: { label?: string }) {
  return <div className="loading" role="status"><LoaderCircle size={20} className="spin" /> {label}</div>;
}
export function SectionHeading({ kicker, title, description }: { kicker?: string; title: string; description?: string }) {
  return <div className="section-heading">{kicker && <span className="eyebrow">{kicker}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>;
}
export function SearchBox({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-box"><Search size={18} /><span className="sr-only">Buscar</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>;
}
export function PublicFooter() {
  return <footer className="public-footer"><span>© 2026 ReportaLab · Proyecto de portafolio</span><span>Demo con datos ficticios · No afiliado a una institución</span></footer>;
}
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="back-link"><ArrowRight size={16} style={{ transform: 'rotate(180deg)' }}/>{children}</Link>;
}
