'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getAssignments, getSubjects, getSubmissionsForAssignment } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AssignmentDoc, SubjectDoc } from '@/types';
import { ClipboardList, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface AssignmentStats {
  assignment: AssignmentDoc;
  subject: SubjectDoc | undefined;
  total: number;
  graded: number;
  submitted: number;
  notSubmitted: number;
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AssignmentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === 'super_admin';
    Promise.all([
      getAssignments(isAdmin ? undefined : user.id),
      getSubjects(isAdmin ? undefined : user.id),
    ]).then(async ([assignments, subjects]) => {
      const subMap = new Map(subjects.map(s => [s.id, s]));
      const statsArr: AssignmentStats[] = await Promise.all(
        assignments.slice(0, 10).map(async a => {
          const subs = await getSubmissionsForAssignment(a.id);
          return {
            assignment: a,
            subject: subMap.get(a.subjectId),
            total: subs.length,
            graded: subs.filter(s => s.status === 'graded').length,
            submitted: subs.filter(s => s.status === 'submitted').length,
            notSubmitted: subs.filter(s => s.status === 'not_submitted').length,
          };
        })
      );
      setStats(statsArr);
      setLoading(false);
    });
  }, [user]);

  return (
    <RoleGuard allowedRoles={['super_admin', 'staff']}>
      <div className="space-y-8 max-w-5xl">
        <div className="space-y-1">
          <h1 className="page-header">Welcome, {user?.name}</h1>
          <p className="text-sm text-slate-400">Here&apos;s an overview of your recent assignments</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-slate-200">Recent Assignments — Correction Status</h2>
          </div>
          {loading ? (
            <div className="card p-8 text-center text-slate-500">Loading…</div>
          ) : stats.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No assignments yet. <Link href="/staff/assignments" className="text-indigo-400 hover:underline">Create one →</Link></p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.map(({ assignment, subject, total, graded, submitted, notSubmitted }) => {
                const pct = total > 0 ? Math.round((graded / total) * 100) : 0;
                return (
                  <div key={assignment.id} className="card p-4 hover:border-slate-700 transition-all">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-200">{assignment.title}</p>
                          <span className="text-xs text-slate-500">{subject?.code}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="w-3 h-3" />{graded} graded</span>
                          <span className="flex items-center gap-1 text-amber-400"><Clock className="w-3 h-3" />{submitted} pending</span>
                          <span className="text-red-400">{notSubmitted} not submitted</span>
                          <span className="text-slate-600">of {total}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-100">{pct}%</p>
                          <p className="text-xs text-slate-500">corrected</p>
                        </div>
                        <div className="w-24 bg-slate-800 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <Link href={`/staff/assignments/${assignment.id}`} className="btn-secondary py-1.5 px-3 text-xs whitespace-nowrap">
                          Open Roster
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
