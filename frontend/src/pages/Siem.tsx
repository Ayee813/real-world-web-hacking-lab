import { useEffect, useState, type ComponentType } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Radar, LayoutDashboard, ScrollText, ShieldAlert, FolderOpen, Fingerprint,
  SlidersHorizontal, FileBarChart, Settings, LogOut, Menu, X, ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { getUser, clearSession, hasSiemAccess } from '../lib/auth';
import OverviewTab from '../components/siem/OverviewTab';
import LogsTab from '../components/siem/LogsTab';
import AlertsTab from '../components/siem/AlertsTab';
import CasesTab from '../components/siem/CasesTab';
import ThreatIntelTab from '../components/siem/ThreatIntelTab';
import RulesTab from '../components/siem/RulesTab';
import ReportsTab from '../components/siem/ReportsTab';
import SettingsTab from '../components/siem/SettingsTab';
import type { SiemAlert } from '../components/siem/types';

interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  component: ComponentType;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Monitoring',
    items: [
      { id: 'overview', label: 'Overview', description: 'Live security posture at a glance', icon: LayoutDashboard, component: OverviewTab },
    ],
  },
  {
    label: 'Investigate',
    items: [
      { id: 'logs', label: 'Logs', description: 'Search and filter every captured event', icon: ScrollText, component: LogsTab },
      { id: 'alerts', label: 'Alerts', description: 'Detections raised by correlation rules', icon: ShieldAlert, component: AlertsTab },
      { id: 'cases', label: 'Cases', description: 'Group alerts into investigations', icon: FolderOpen, component: CasesTab },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'threat-intel', label: 'Threat Intel', description: 'Known-bad indicators that auto-flag traffic', icon: Fingerprint, component: ThreatIntelTab },
      { id: 'rules', label: 'Detection Rules', description: 'Correlation rules powering alerting', icon: SlidersHorizontal, component: RulesTab },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { id: 'reports', label: 'Reports', description: 'Point-in-time summaries for a date range', icon: FileBarChart, component: ReportsTab },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'settings', label: 'Settings', description: 'Retention policy and the admin audit trail', icon: Settings, component: SettingsTab },
    ],
  },
];

const ALL_TABS = NAV_SECTIONS.flatMap(s => s.items);

export default function Siem() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const active = ALL_TABS.find(t => t.id === tab)?.id ?? 'overview';
  const activeTab = ALL_TABS.find(t => t.id === active)!;
  const ActiveComponent = activeTab.component;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAlertCount, setOpenAlertCount] = useState<number | null>(null);

  useEffect(() => {
    api.get<SiemAlert[]>('/siem/alerts?status=open')
      .then(alerts => setOpenAlertCount(alerts.length))
      .catch(() => {});
  }, [active]);

  function goTo(id: string) {
    setMobileOpen(false);
    navigate(`/siem/${id}`);
  }

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  const canSeePlatform = user?.role === 'admin';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
          <Radar size={17} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm leading-tight">Sentinel SIEM</div>
          <div className="text-slate-500 text-[11px] leading-tight">Security Operations</div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="ml-auto text-slate-500 hover:text-white lg:hidden">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => goTo(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-green-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.id === 'alerts' && !!openAlertCount && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400'}`}>
                        {openAlertCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-3 space-y-1">
        {canSeePlatform && (
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeftRight size={16} className="shrink-0" />
            Back to platform
          </button>
        )}
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="w-7 h-7 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-xs font-medium truncate">{user?.username}</div>
            <div className="text-slate-500 text-[11px] capitalize">{user?.role}</div>
          </div>
          <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 shrink-0" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  if (!hasSiemAccess(user)) return null;

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900">{sidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900">{sidebarContent}</aside>
        </div>
      )}

      <div className="flex-1 lg:pl-64 min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="text-gray-500 hover:text-gray-700 lg:hidden">
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{activeTab.label}</h1>
            <p className="text-xs text-gray-400 truncate hidden sm:block">{activeTab.description}</p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
