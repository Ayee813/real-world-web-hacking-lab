import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PenLine, Users, LayoutDashboard, ShieldCheck, LogOut } from 'lucide-react';
import { getUser, clearSession } from '../lib/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  function isActive(path: string) {
    return location.pathname === path;
  }

  const linkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive(path)
        ? 'bg-green-600 text-white'
        : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
    }`;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-green-700 text-lg">
            <PenLine size={20} />
            WriteUp
          </Link>

          <div className="flex items-center gap-1">
            <Link to="/dashboard" className={linkClass('/dashboard')}>
              <LayoutDashboard size={15} />
              Articles
            </Link>
            <Link to="/articles/new" className={linkClass('/articles/new')}>
              <PenLine size={15} />
              Write
            </Link>
            <Link to="/users" className={linkClass('/users')}>
              <Users size={15} />
              Members
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className={linkClass('/admin')}>
                <ShieldCheck size={15} />
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <Link
                to={`/profile/${user.id}`}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                {user.username}
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {user.role}
                </span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
