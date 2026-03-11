"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Award, LogOut, Trophy, BarChart3, ChevronRight, Shield, Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';

export default function JudgeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadHackathons = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch('/api/judge/hackathons', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setHackathons(Array.isArray(data) ? data : [])).catch(() => { });
  }, [router]);

  useEffect(() => { loadHackathons(); }, [loadHackathons]);

  const navItems = [
    { label: 'My Assignments', icon: Award, path: '/judge', exact: true },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col
        w-60 bg-[#1e2a4a] text-slate-200
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:flex-shrink-0
      `}>
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10 flex-shrink-0">
          <Link href="/judge" className="flex items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt="WRRIC Logo"
              width={40}
              height={40}
              className="cursor-pointer hover:opacity-80 transition-opacity rounded-lg object-contain flex-shrink-0"
              priority
            />
            <span className="text-sm font-semibold text-white tracking-wide">Judge Portal</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(item => {
            const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => router.push(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left
                  ${isActive ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </button>
            );
          })}

          {hackathons.length > 0 && (
            <div className="pt-4 mt-2 border-t border-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">Assigned Events</p>
              {hackathons.map(h => {
                const isActive = pathname.startsWith(`/judge/${h.event_id}`) && !pathname.includes('leaderboard');
                const isBoardActive = pathname === `/judge/${h.event_id}/leaderboard`;
                return (
                  <div key={h.event_id} className="space-y-0.5">
                    <button onClick={() => router.push(`/judge/${h.event_id}`)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left
                        ${isActive ? 'bg-white/10 text-white font-medium border border-white/10' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                      <BarChart3 className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate text-xs">{h.event_title}</span>
                    </button>
                    <button onClick={() => router.push(`/judge/${h.event_id}/leaderboard`)}
                      className={`w-full flex items-center gap-3 pl-10 pr-3 py-2 rounded-lg text-xs transition-all text-left
                        ${isBoardActive ? 'text-blue-400 font-medium' : 'text-slate-500 hover:bg-white/10 hover:text-white'}`}>
                      <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Standings</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 space-y-1 flex-shrink-0">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button onClick={() => { localStorage.removeItem('token'); router.push('/auth/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors lg:hidden">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="text-slate-400">Judge</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="font-medium text-slate-800">
                {pathname === '/judge' ? 'My Assignments' : pathname.includes('leaderboard') ? 'Standings' : 'Scoring Board'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block">Accredited Judge</span>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Award className="w-4 h-4 text-white" />
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
