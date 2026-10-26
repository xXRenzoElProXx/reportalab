import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { Loading } from './components/UI';
import { HomePage, LoginPage, ReportPage, TrackingPage, TrackingSearchPage } from './pages/PublicPages';
import { DashboardPage, EquipmentPage, PanelLayout, ReportDetailPage, ReportsPage } from './pages/PanelPages';
import type { Session } from './types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<Session>('/auth/me')
      .then(user => { if (active) setSession(user); })
      .catch(() => { if (active) setSession(null); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);
  return <Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/e/:token" element={<ReportPage/>}/>
    <Route path="/seguimiento" element={<TrackingSearchPage/>}/>
    <Route path="/seguimiento/:code" element={<TrackingPage/>}/>
    <Route path="/login" element={authLoading ? <Loading/> : session ? <Navigate to="/panel" replace/> : <LoginPage onLogin={setSession}/>}/>
    <Route path="/panel" element={authLoading ? <Loading/> : !session ? <Navigate to="/login" replace/> : <PanelLayout session={session} onLogout={() => setSession(null)}/> }>
      <Route index element={<DashboardPage/>}/>
      <Route path="reportes" element={<ReportsPage/>}/>
      <Route path="reportes/:id" element={<ReportDetailPage/>}/>
      <Route path="equipos" element={<EquipmentPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
