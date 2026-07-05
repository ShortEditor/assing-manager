'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getStaff, getStudents, getSubjects, getAssignments } from '@/lib/firestore';
import { Users, GraduationCap, BookMarked, ClipboardList, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  staffCount: number;
  studentCount: number;
  subjectCount: number;
  assignmentCount: number;
}

function StatCard({ label, value, icon, href, color }: {
  label: string; value: number; icon: React.ReactNode; href: string; color: string;
}) {
  return (
    <Link href={href} className="card p-5 hover:border-slate-700 transition-all duration-200 group block">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-slate-100">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ staffCount: 0, studentCount: 0, subjectCount: 0, assignmentCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStaff(), getStudents(), getSubjects(), getAssignments()])
      .then(([staff, students, subjects, assignments]) => {
        setStats({
          staffCount: staff.length,
          studentCount: students.length,
          subjectCount: subjects.length,
          assignmentCount: assignments.length,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <div className="space-y-8 max-w-6xl">
        <div className="space-y-1">
          <h1 className="page-header">Admin Dashboard</h1>
          <p className="text-sm text-slate-400">Overview of your assignment tracking system</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Staff Members" value={stats.staffCount} href="/admin/staff"
            icon={<Users className="w-5 h-5 text-purple-400" />} color="bg-purple-400/10" />
          <StatCard label="Students" value={stats.studentCount} href="/admin/students"
            icon={<GraduationCap className="w-5 h-5 text-emerald-400" />} color="bg-emerald-400/10" />
          <StatCard label="Subjects" value={stats.subjectCount} href="/admin/subjects"
            icon={<BookMarked className="w-5 h-5 text-indigo-400" />} color="bg-indigo-400/10" />
          <StatCard label="Assignments" value={stats.assignmentCount} href="/admin/assignments"
            icon={<ClipboardList className="w-5 h-5 text-amber-400" />} color="bg-amber-400/10" />
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-slate-200">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Add Staff Member', href: '/admin/staff', desc: 'Create staff account & generate PIN' },
              { label: 'Import Students (CSV)', href: '/admin/students', desc: 'Bulk upload via CSV' },
              { label: 'Add Subject', href: '/admin/subjects', desc: 'Create subject & assign to staff' },
              { label: 'View Assignments', href: '/admin/assignments', desc: 'All assignments across subjects' },
              { label: 'Add Student', href: '/admin/students', desc: 'Manual student registration' },
            ].map(a => (
              <Link key={a.href} href={a.href} className="glass rounded-xl p-4 hover:bg-slate-800/60 transition-all duration-200 space-y-1 block">
                <p className="text-sm font-medium text-slate-200">{a.label}</p>
                <p className="text-xs text-slate-500">{a.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
