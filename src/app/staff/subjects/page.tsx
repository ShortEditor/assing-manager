'use client';

// Staff subjects page shows only subjects assigned to the logged-in staff
import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getSubjects, getAssignments } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { SubjectDoc, AssignmentDoc } from '@/types';
import Link from 'next/link';
import { BookMarked, ClipboardList, ChevronRight, Loader2 } from 'lucide-react';

export default function StaffSubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [assignmentCounts, setAssignmentCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === 'super_admin';
    getSubjects(isAdmin ? undefined : user.id).then(async subs => {
      setSubjects(subs);
      const counts = new Map<string, number>();
      await Promise.all(subs.map(async s => {
        const a = await getAssignments(undefined, s.id);
        counts.set(s.id, a.length);
      }));
      setAssignmentCounts(counts);
      setLoading(false);
    });
  }, [user]);

  return (
    <RoleGuard allowedRoles={['super_admin', 'staff']}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="page-header">My Subjects</h1>
          <p className="text-sm text-slate-400 mt-0.5">{subjects.length} subjects assigned</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : subjects.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <BookMarked className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No subjects assigned yet. Contact admin.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {subjects.map(s => (
              <div key={s.id} className="card p-5 flex items-center gap-5 hover:border-slate-700 transition-all">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <BookMarked className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold text-slate-200">{s.name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <code className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{s.code}</code>
                    <span>Class: {s.class}</span>
                    <span>Sem {s.semester}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-100">{assignmentCounts.get(s.id) ?? 0}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><ClipboardList className="w-3 h-3" />assignments</p>
                  </div>
                  <Link href={`/staff/assignments?subject=${s.id}`} className="btn-secondary py-2 px-3 text-xs">
                    View <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
