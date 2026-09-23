import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getUser, hasSiemAccess } from './lib/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ArticleNew from './pages/ArticleNew';
import ArticleView from './pages/ArticleView';
import Users from './pages/Users';
import Admin from './pages/Admin';
import ProfileEdit from './pages/ProfileEdit';
import Siem from './pages/Siem';

// Analysts are SIEM-only: they never see the article platform.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = getUser();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (user?.role === 'analyst') return <Navigate to="/siem" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = getUser();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequireSiemAccess({ children }: { children: React.ReactNode }) {
  const user = getUser();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!hasSiemAccess(user)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Home() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getUser();
  return <Navigate to={user?.role === 'analyst' ? '/siem' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/articles/new" element={<RequireAuth><ArticleNew /></RequireAuth>} />
        <Route path="/articles/:id" element={<RequireAuth><ArticleView /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth><Users /></RequireAuth>} />
        <Route path="/profile/:id" element={<RequireAuth><ProfileEdit /></RequireAuth>} />

        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="/siem" element={<RequireSiemAccess><Siem /></RequireSiemAccess>} />
        <Route path="/siem/:tab" element={<RequireSiemAccess><Siem /></RequireSiemAccess>} />

        <Route path="/" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
