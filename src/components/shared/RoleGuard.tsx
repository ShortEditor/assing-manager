'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import type { UserRole } from '@/types';
import Sidebar from './Sidebar';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      // Redirect to their own dashboard
      if (user.role === 'super_admin') router.replace('/admin/dashboard');
      else if (user.role === 'staff') router.replace('/staff/dashboard');
      else router.replace('/student/dashboard');
    }
  }, [user, loading, allowedRoles, router]);

  if (loading || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-950 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
