"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import {
  Calendar,
  Home,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Plus,
  Tag,
  Building2,
  Sparkles,
  Activity,
  UserCheck,
  TrendingUp,
  FileText,
  Sun,
  Moon,
  Handshake,
  Trophy,
  Menu,
  X,
  Shield,
  BarChart3,
  UploadCloud,
} from 'lucide-react';
import { checkAdminAccess } from '@/utils/auth';

interface AdminLayoutProps { children: React.ReactNode; }

// Groups define the sidebar structure
const topNav = [
  { path: '/admin', label: 'Dashboard', icon: Home, exact: true },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/hackathons', label: 'Hackathons', icon: Trophy },
  { path: '/admin/events', label: 'Events', icon: Calendar },
  { path: '/admin/categories', label: 'Categories', icon: Tag },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

const dataGroup = [
  { path: '/admin/entities', label: 'Entities', icon: Building2 },
  { path: '/admin/partners', label: 'Partners', icon: Handshake },
  { path: '/admin/matches', label: 'Matches', icon: Sparkles },
];

const analyticsGroup = [
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/admin/bulk-import', label: 'Bulk Import', icon: UploadCloud },
  { path: '/admin/imported-users', label: 'Imported Users', icon: UserCheck },
  { path: '/admin/import-analytics', label: 'Import Analytics', icon: TrendingUp },
];

function NavItem({ item, pathname, onClick }: { item: any; pathname: string; onClick: () => void }) {
  const Icon = item.icon;
  const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left
        ${isActive ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
    </button>
  );
}

function NavGroup({ label, icon: GroupIcon, items, pathname, router, defaultOpen }: {
  label: string; icon: any; items: any[]; pathname: string; router: any; defaultOpen?: boolean;
}) {
  const isAnyActive = items.some(i => pathname.startsWith(i.path));
  const [open, setOpen] = useState(defaultOpen || isAnyActive);

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-all text-left">
        <GroupIcon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-50 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {items.map(item => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => router.push(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left
                  ${isActive ? 'bg-blue-600/80 text-white font-medium' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const checkAdminStatus = useCallback(async () => {
    try {
      const hasAccess = await checkAdminAccess();
      setIsAdmin(hasAccess);
      if (!hasAccess) router.push('/');
    } catch { router.push('/'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { checkAdminStatus(); }, [checkAdminStatus]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('login_response');
    localStorage.removeItem('banner_dismissed');
    sessionStorage.removeItem('token');
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push('/auth/login');
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="text-sm text-slate-500">Verifying access...</p>
      </div>
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col
        w-60 bg-[#1e2a4a] text-slate-200
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:flex-shrink-0
      `}>
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10 flex-shrink-0">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt="WRRIC Logo"
              width={40}
              height={40}
              className="cursor-pointer hover:opacity-80 transition-opacity object-contain rounded-lg flex-shrink-0"
              priority
            />
            <span className="text-sm font-semibold text-white tracking-wide">Admin Portal</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {/* Top-level items */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">Navigation</p>
          {topNav.map(item => (
            <NavItem key={item.path} item={item} pathname={pathname}
              onClick={() => router.push(item.path)} />
          ))}

          {/* Data group */}
          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">Data</p>
            <NavGroup label="Entities & Partners" icon={Building2} items={dataGroup} pathname={pathname} router={router} />
          </div>

          {/* Analytics group */}
          <div className="pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">Insights</p>
            <NavGroup label="Analytics & Imports" icon={BarChart3} items={analyticsGroup} pathname={pathname} router={router} />
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 space-y-1 flex-shrink-0">
          <button onClick={() => router.push('/admin/events/new')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors lg:hidden">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="text-slate-400">Admin</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="font-medium text-slate-800">{getPageTitle(pathname)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.jpeg"
                alt="WRRIC"
                width={28}
                height={28}
                className="object-contain rounded-lg flex-shrink-0"
              />
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-xs font-bold text-slate-800 tracking-wide">WRRIC</span>
                <span className="text-[10px] text-slate-400 font-medium">Admin Portal</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard';
  if (pathname === '/admin/users') return 'Users';
  if (pathname === '/admin/bulk-import') return 'Bulk Import';
  if (pathname === '/admin/imported-users') return 'Imported Users';
  if (pathname === '/admin/import-analytics') return 'Import Analytics';
  if (pathname === '/admin/partners') return 'Partners';
  if (pathname === '/admin/entities') return 'Entities';
  if (pathname === '/admin/matches') return 'Matches';
  if (pathname === '/admin/hackathons') return 'Hackathons';
  if (pathname.match(/^\/admin\/hackathons\/[^/]+\/participants$/)) return 'Participants';
  if (pathname.match(/^\/admin\/hackathons\/[^/]+\/scoring$/)) return 'Scoring Schema';
  if (pathname.match(/^\/admin\/hackathons\/[^/]+\/judges$/)) return 'Judges';
  if (pathname.match(/^\/admin\/hackathons\/[^/]+\/leaderboard$/)) return 'Leaderboard';
  if (pathname.match(/^\/admin\/hackathons\/[^/]+\/email$/)) return 'Email Participants';
  if (pathname.match(/^\/admin\/hackathons\/[^/]+$/)) return 'Event Dashboard';
  if (pathname === '/admin/events') return 'Events';
  if (pathname === '/admin/events/new') return 'Create Event';
  if (pathname.match(/^\/admin\/events\/[^/]+\/edit$/)) return 'Edit Event';
  if (pathname.match(/^\/admin\/events\/[^/]+$/)) return 'Event Details';
  if (pathname === '/admin/categories') return 'Categories';
  if (pathname === '/admin/analytics') return 'Analytics';
  if (pathname === '/admin/settings') return 'Settings';
  return 'Admin Panel';
}