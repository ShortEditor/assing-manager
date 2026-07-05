'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getStaff, createStaff, regenerateStaffPin, deleteStaff, getSubjects, updateSubject, updateStaffPassword } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { StaffDoc, SubjectDoc } from '@/types';
import {
  Plus, RefreshCw, Trash2, Copy, Check, Loader2,
  ChevronDown, ChevronUp, X, Edit2,
} from 'lucide-react';

function PinBadge({ pin, staffId, onRegenerate, onReset }: { pin: string; staffId: string; onRegenerate: (id: string) => void; onReset: (id: string) => void }) {

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const regen = async () => {
    setLoading(true);
    await onRegenerate(staffId);
    setLoading(false);
  };
  return (
    <div className="flex items-center gap-1.5">
      <code className="text-sm font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{pin}</code>
      <button onClick={copy} title="Copy PIN" className="text-slate-500 hover:text-slate-300 transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <button onClick={regen} title="Regenerate PIN" disabled={loading} className="text-slate-500 hover:text-amber-400 transition-colors disabled:opacity-50">
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      </button>
      <button onClick={() => onReset(staffId)} title="Set Custom Password" className="text-slate-500 hover:text-indigo-400 transition-colors">
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffDoc[]>([]);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [newPin, setNewPin] = useState<{ name: string; pin: string } | null>(null);

  const load = async () => {
    const [s, sub] = await Promise.all([getStaff(), getSubjects()]);
    setStaff(s);
    setSubjects(sub);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    // Auto-generate staffCode: initials of name + count
    const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const autoCode = `${initials}${String(staff.length + 1).padStart(2, '0')}`;
    const result = await createStaff({ name, staffCode: autoCode, subjects: selectedSubjects }, user.id);

    // Assign this staff to each selected subject
    await Promise.all(selectedSubjects.map(sid => updateSubject(sid, { staffId: result.id })));

    setNewPin({ name, pin: result.pin });
    setName(''); setSelectedSubjects([]);
    setShowForm(false);
    await load();
    setSubmitting(false);
  };

  const handleRegenPin = async (staffId: string) => {
    const pin = await regenerateStaffPin(staffId);
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, pin } : s));
  };

  const handleResetPassword = async (staffId: string) => {
    const s = staff.find(x => x.id === staffId);
    if (!s) return;
    const newPass = prompt(`Enter new password/PIN for staff member ${s.name} (${s.staffCode}):`);
    if (newPass === null) return;
    const cleanPass = newPass.trim();
    if (!cleanPass) {
      alert("Password cannot be empty");
      return;
    }
    setStaff(prev => prev.map(x => x.id === staffId ? { ...x, pin: cleanPass } : x));
    await updateStaffPassword(staffId, cleanPass);
  };


  const handleDelete = async (staffId: string) => {
    if (!confirm('Delete this staff member? This cannot be undone.')) return;
    await deleteStaff(staffId);
    setStaff(prev => prev.filter(s => s.id !== staffId));
  };

  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? id;

  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header">Staff Members</h1>
            <p className="text-sm text-slate-400 mt-0.5">{staff.length} staff registered</p>
          </div>
          <button id="add-staff-btn" onClick={() => setShowForm(v => !v)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>

        {/* New PIN reveal */}
        {newPin && (
          <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-400 mb-1">✓ Staff created successfully</p>
              <p className="text-sm text-slate-300">
                {newPin.name} — PIN: <code className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">{newPin.pin}</code>
              </p>
              <p className="text-xs text-slate-500 mt-1">Share this PIN with the staff member to log in.</p>
            </div>
            <button onClick={() => setNewPin(null)}><X className="w-4 h-4 text-slate-500" /></button>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-200">New Staff Member</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Full Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="Dr. R. Kumar" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Assign Subjects</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {subjects.map(sub => (
                    <label key={sub.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer p-2 rounded-lg hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={selectedSubjects.includes(sub.id)}
                        onChange={e => setSelectedSubjects(prev =>
                          e.target.checked ? [...prev, sub.id] : prev.filter(id => id !== sub.id)
                        )}
                        className="rounded"
                      />
                      {sub.code} — {sub.name}
                    </label>
                  ))}
                  {subjects.length === 0 && <p className="text-slate-500 text-sm col-span-2">No subjects yet. Add subjects first.</p>}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create & Generate PIN
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Staff list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : staff.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <p className="font-medium">No staff members yet</p>
            <p className="text-sm mt-1">Click &quot;Add Staff&quot; to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map(s => (
              <div key={s.id} className="card overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">{s.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 truncate">{s.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs text-slate-400 font-mono">{s.staffCode}</code>
                      <PinBadge pin={s.pin} staffId={s.id} onRegenerate={handleRegenPin} onReset={handleResetPassword} />

                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(prev => prev === s.id ? null : s.id)}
                      className="btn-secondary py-1.5 px-3 text-xs"
                    >
                      Subjects {expandedId === s.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="btn-danger py-1.5 px-3 text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {expandedId === s.id && (
                  <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/50">
                    <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-medium">Assigned Subjects</p>
                    {s.subjects.length === 0 ? (
                      <p className="text-sm text-slate-500">No subjects assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {s.subjects.map(sid => (
                          <span key={sid} className="badge badge-submitted">{subjectName(sid)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
