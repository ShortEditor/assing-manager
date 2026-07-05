'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getAssignments, getSubjects, deleteAssignment } from '@/lib/firestore';
import type { AssignmentDoc, SubjectDoc } from '@/types';
import Link from 'next/link';
import {
  ClipboardList, Trash2, Loader2, Calendar, BookMarked, ChevronRight,
} from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  assignment: 'badge-submitted',
  record: 'badge-graded',
  lab: 'badge-not-submitted',
  seminar: 'badge-late',
  cia: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentDoc[]>([]);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [a, s] = await Promise.all([getAssignments(), getSubjects()]);
    setAssignments(a);
    setSubjects(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment?')) return;
    await deleteAssignment(id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const subjectName = (id: string) => {
    const s = subjects.find(s => s.id === id);
    return s ? `${s.code} — ${s.name}` : id;
  };

  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header">All Assignments</h1>
            <p className="text-sm text-slate-400 mt-0.5">{assignments.length} total</p>
          </div>
          <Link href="/staff/assignments" className="btn-primary">
            <ChevronRight className="w-4 h-4" /> Staff View
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : assignments.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>No assignments yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.id} className="card p-4 flex items-center gap-4 hover:border-slate-700 transition-all group">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-200">{a.title}</p>
                    <span className={`badge ${TYPE_COLORS[a.type] ?? 'badge-submitted'}`}>{a.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><BookMarked className="w-3 h-3" />{subjectName(a.subjectId)}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due: {new Date(a.dueDate).toLocaleDateString('en-IN')}</span>
                    <span>Max: {a.maxMarks}</span>
                    <span>Class: {a.class}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/staff/assignments/${a.id}`} className="btn-secondary py-1.5 px-3 text-xs">
                    Roster <ChevronRight className="w-3 h-3" />
                  </Link>
                  <button onClick={() => handleDelete(a.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
