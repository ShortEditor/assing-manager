'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getAssignments, getSubjects, createAssignment, deleteAssignment } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AssignmentDoc, SubjectDoc } from '@/types';
import Link from 'next/link';
import {
  Plus, Trash2, Loader2, ClipboardList,
  Calendar, ChevronRight, BookMarked,
} from 'lucide-react';

const ASSIGNMENT_TYPES = ['assignment', 'record', 'lab', 'seminar', 'cia'] as const;

const TYPE_COLORS: Record<string, string> = {
  assignment: 'badge-submitted',
  record: 'badge-graded',
  lab: 'badge-not-submitted',
  seminar: 'badge-late',
  cia: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

export default function StaffAssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentDoc[]>([]);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form
  const [title, setTitle] = useState('');
  const [type, setType] = useState<typeof ASSIGNMENT_TYPES[number]>('assignment');
  const [subjectId, setSubjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxMarks, setMaxMarks] = useState('25');

  const load = async () => {
    if (!user) return;
    const isAdmin = user.role === 'super_admin';
    const [a, s] = await Promise.all([
      getAssignments(isAdmin ? undefined : user.id),
      getSubjects(isAdmin ? undefined : user.id),
    ]);
    setAssignments(a);
    setSubjects(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const selectedSubject = subjects.find(s => s.id === subjectId);
    if (!selectedSubject) return;
    setSubmitting(true);
    await createAssignment({
      title,
      type,
      subjectId,
      semester: selectedSubject.semester,
      year: selectedSubject.year,
      class: selectedSubject.class,
      dueDate: new Date(dueDate),
      maxMarks: parseInt(maxMarks),
      createdBy: user.id,
    }, user.id);
    setTitle(''); setSubjectId(''); setDueDate(''); setMaxMarks('25');
    setShowForm(false);
    await load();
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment? All submission records will remain.')) return;
    await deleteAssignment(id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const subjectName = (id: string) => {
    const s = subjects.find(s => s.id === id);
    return s ? `${s.code} — ${s.name}` : id;
  };

  const isAllowed = user?.role === 'super_admin' || user?.role === 'staff';

  return (
    <RoleGuard allowedRoles={['super_admin', 'staff']}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header">Assignments</h1>
            <p className="text-sm text-slate-400 mt-0.5">{assignments.length} assignments</p>
          </div>
          {isAllowed && (
            <button id="add-assignment-btn" onClick={() => setShowForm(v => !v)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Assignment
            </button>
          )}
        </div>

        {showForm && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-200">Create Assignment</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Title</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Unit 1 Record" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Type</label>
                <select className="input" value={type} onChange={e => setType(e.target.value as typeof type)}>
                  {ASSIGNMENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Subject</label>
                <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)} required>
                  <option value="">Select subject…</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Due Date</label>
                <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Max Marks</label>
                <input type="number" className="input" value={maxMarks} onChange={e => setMaxMarks(e.target.value)} min="1" required />
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Assignment
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : assignments.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm mt-1">Create your first assignment to get started</p>
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
                    <span>Max: {a.maxMarks} marks</span>
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
