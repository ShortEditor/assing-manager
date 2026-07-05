'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GraduationCap, BookOpen, ShieldCheck, Eye, EyeOff, Loader2, ChevronRight } from 'lucide-react';

type LoginTab = 'student' | 'staff' | 'admin';

const TABS: { id: LoginTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'student', label: 'Student', icon: <GraduationCap className="w-4 h-4" />, desc: 'View your assignments & marks' },
  { id: 'staff',   label: 'Staff',   icon: <BookOpen className="w-4 h-4" />,      desc: 'Manage marks & submissions' },
  { id: 'admin',   label: 'Admin',   icon: <ShieldCheck className="w-4 h-4" />,   desc: 'System administration' },
];

export default function LoginPage() {
  const [tab, setTab] = useState<LoginTab>('student');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Student fields
  const [rollNo, setRollNo] = useState('');
  const [studentPin, setStudentPin] = useState('');

  // Staff fields
  const [staffCode, setStaffCode] = useState('');
  const [staffPin, setStaffPin] = useState('');

  // Admin fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { loginAdmin, loginStaff, loginStudent, error, clearError, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!user) return;
    if (user.role === 'super_admin') router.replace('/admin/dashboard');
    else if (user.role === 'staff') router.replace('/staff/dashboard');
    else if (user.role === 'student') router.replace('/student/dashboard');
  }, [user, router]);

  const handleTabChange = (t: LoginTab) => {
    setTab(t);
    clearError();
    setShowPin(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'student') await loginStudent(rollNo);
      else if (tab === 'staff') await loginStaff(staffCode, staffPin);
      else await loginAdmin(email, password);
    } catch {
      // error set by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex flex-col justify-between p-12 lg:w-[45%] bg-gradient-to-br from-indigo-950 via-[#0f172a] to-[#020617] border-r border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-semibold text-[#e2e8f0]">Marks Tracker</span>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              College Internal Tool
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Assignment &<br />Marks Management
            </h1>
            <p className="text-[#94a3b8] text-base leading-relaxed max-w-sm">
              One place to track every submission, record marks, and export semester reports — no more scattered notebooks.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Live Status', desc: 'Real-time submission tracking' },
              { label: 'Excel Export', desc: 'NBA-ready formatted sheets' },
              { label: 'PIN Login', desc: 'Secure, admin-managed access' },
              { label: 'Correction Log', desc: 'Who graded what, when' },
            ].map(f => (
              <div key={f.label} className="bg-slate-900/60 backdrop-blur-md border border-[#334155]/50 rounded-xl p-3.5 space-y-1">
                <p className="text-sm font-semibold text-[#e2e8f0]">{f.label}</p>
                <p className="text-xs text-[#64748b]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div />
      </div>

      {/* ── Right panel: login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-slate-950">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="font-semibold text-slate-200">Marks Tracker</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-100">Welcome back</h2>
            <p className="text-sm text-slate-400">Sign in to your account to continue</p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
            {TABS.map(t => (
              <button
                key={t.id}
                id={`login-tab-${t.id}`}
                onClick={() => handleTabChange(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === t.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500 -mt-4">
            {TABS.find(t => t.id === tab)?.desc}
          </p>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <span className="mt-0.5 shrink-0 w-4 h-4">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'student' && (
              <div className="space-y-1.5">
                <label htmlFor="rollNo" className="text-xs font-medium text-slate-400 uppercase tracking-wide">Roll Number</label>
                <input
                  id="rollNo"
                  className="input"
                  placeholder="e.g. 23N81A0501"
                  value={rollNo}
                  onChange={e => setRollNo(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            )}

            {tab === 'staff' && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="staffCode" className="text-xs font-medium text-slate-400 uppercase tracking-wide">Username</label>
                  <input
                    id="staffCode"
                    className="input"
                    placeholder="e.g. STF01"
                    value={staffCode}
                    onChange={e => setStaffCode(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="staffPin" className="text-xs font-medium text-slate-400 uppercase tracking-wide">Password</label>
                  <div className="relative">
                    <input
                      id="staffPin"
                      type={showPin ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Enter password"
                      value={staffPin}
                      onChange={e => setStaffPin(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPin(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === 'admin' && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    placeholder="admin@college.edu"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="adminPassword" className="text-xs font-medium text-slate-400 uppercase tracking-wide">Password</label>
                  <div className="relative">
                    <input
                      id="adminPassword"
                      type={showPin ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPin(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600">
            Credentials are managed by your system administrator.<br />
            Contact admin if you forgot your PIN.
          </p>
        </div>
      </div>
    </div>
  );
}
