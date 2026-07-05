'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getSubjects, createSubject, deleteSubject, getStaff } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { SubjectDoc, StaffDoc } from '@/types';
import { Plus, Trash2, Loader2, BookMarked } from 'lucide-react';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const YEARS = [1, 2, 3, 4];

export default function SubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [staff, setStaff] = useState<StaffDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [semester, setSemester] = useState(1);
  const [year, setYear] = useState(1);
  const [staffId, setStaffId] = useState('');

  const load = async () => {
    const [s, st] = await Promise.all([getSubjects(), getStaff()]);
    setSubjects(s);
    setStaff(st);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    await createSubject({ name, code, semester, year, class: 'CME', staffId });
    setName(''); setCode(''); setStaffId('');
    setShowForm(false);
    await load();
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subject?')) return;
    await deleteSubject(id);
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const staffName = (id: string) => staff.find(s => s.id === id)?.name ?? '—';

  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header">Subjects</h1>
            <p className="text-sm text-slate-400 mt-0.5">{subjects.length} subjects registered</p>
          </div>
          <button id="add-subject-btn" onClick={() => setShowForm(v => !v)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        </div>

        {showForm && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-200">New Subject</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Subject Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="Data Structures" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Subject Code</label>
                <input className="input" value={code} onChange={e => setCode(e.target.value)} required placeholder="CS301" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Year</label>
                <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
                  {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Semester</label>
                <select className="input" value={semester} onChange={e => setSemester(Number(e.target.value))}>
                  {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Assign to Staff</label>
                <select className="input" value={staffId} onChange={e => setStaffId(e.target.value)} required>
                  <option value="">Select staff…</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.staffCode})</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Subject
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : subjects.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <BookMarked className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No subjects yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subjects.map(sub => (
              <div key={sub.id} className="card p-4 flex items-start justify-between gap-3 hover:border-slate-700 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{sub.code}</code>
                    <span className="badge badge-submitted">Sem {sub.semester}</span>
                    <span className="badge badge-graded">Yr {sub.year}</span>
                  </div>
                  <p className="font-semibold text-slate-200">{sub.name}</p>
                  <p className="text-xs text-slate-500">Staff: {staffName(sub.staffId)}</p>
                </div>
                <button onClick={() => handleDelete(sub.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
