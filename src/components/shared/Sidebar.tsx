'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  BookOpen, LayoutDashboard, Users, ClipboardList,
  FileSpreadsheet, GraduationCap, LogOut, ChevronRight,
  BookMarked, ShieldCheck, Sun, Moon,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  super_admin: [
    { href: '/admin/dashboard',  label: 'Dashboard',  icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/admin/staff',      label: 'Staff',      icon: <ShieldCheck className="w-4 h-4" /> },
    { href: '/admin/students',   label: 'Students',   icon: <GraduationCap className="w-4 h-4" /> },
    { href: '/admin/subjects',   label: 'Subjects',   icon: <BookMarked className="w-4 h-4" /> },
    { href: '/admin/assignments',label: 'Assignments',icon: <ClipboardList className="w-4 h-4" /> },
  ],
  staff: [
    { href: '/staff/dashboard',    label: 'Dashboard',    icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/staff/assignments',  label: 'Assignments',  icon: <ClipboardList className="w-4 h-4" /> },
    { href: '/staff/subjects',     label: 'My Subjects',  icon: <BookMarked className="w-4 h-4" /> },
    { href: '/staff/export',       label: 'Export',       icon: <FileSpreadsheet className="w-4 h-4" /> },
  ],
  student: [
    { href: '/student/dashboard',  label: 'Dashboard',    icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/student/marks',      label: 'My Marks',     icon: <FileSpreadsheet className="w-4 h-4" /> },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  staff: 'Staff',
  student: 'Student',
};

const ROLE_COLOR: Record<UserRole, string> = {
  super_admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  staff: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  student: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

interface SidebarProps {
  onClose?: () => void;
  className?: string;
}

export default function Sidebar({ onClose, className = '' }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light', savedTheme === 'light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('light', nextTheme === 'light');
  };

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] ?? [];

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <aside className={`w-64 flex flex-col bg-slate-900 border-r border-slate-800 ${className}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shrink-0">
          <BookOpen className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">Marks Tracker</p>
          <p className="text-xs text-slate-500 truncate">Assignment System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="section-label px-2 pb-2">Navigation</p>
        {navItems.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className={active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}>
                {item.icon}
              </span>
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-3">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all duration-150"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              Dark Mode
            </>
          )}
        </button>

        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
            <span className={`badge text-[10px] border ${ROLE_COLOR[user.role]}`}>
              <Users className="w-2.5 h-2.5" />
              {ROLE_LABEL[user.role]}
            </span>
          </div>
        </div>
        <button
          id="sidebar-logout"
          onClick={() => {
            onClose?.();
            handleLogout();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
