'use client';

import { useEffect, useState, useRef } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getStudents, bulkAddStudents, deleteAllStudents, regenerateStudentPin, deleteStudent, importStudentsFromCSV, updateStudentName, createStudent, updateStudentPassword } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { StudentDoc, CSVStudentRow } from '@/types';
import Papa from 'papaparse';
import {
  Plus, Upload, RefreshCw, Trash2, Copy, Check, Loader2,
  FileText, X, Search, Edit2,
} from 'lucide-react';

function PinBadge({ pin, studentId, onRegen, onReset }: { pin: string; studentId: string; onRegen: (id: string) => void; onReset: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const copy = () => { navigator.clipboard.writeText(pin); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const regen = async () => { setLoading(true); await onRegen(studentId); setLoading(false); };
  return (
    <div className="flex items-center gap-1.5">
      <code className="text-sm font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">{pin}</code>
      <button onClick={copy} title="Copy"><Copy className={`w-3.5 h-3.5 ${copied ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`} /></button>
      <button onClick={regen} disabled={loading} title="Auto-Regenerate PIN">
        <RefreshCw className={`w-3.5 h-3.5 text-slate-500 hover:text-amber-400 ${loading ? 'animate-spin' : ''}`} />
      </button>
      <button onClick={() => onReset(studentId)} title="Set Custom Password" className="text-slate-500 hover:text-indigo-400 transition-colors">
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}

const YEARS = ['1', '2', '3'];
const SEMESTER_MAP: Record<string, string[]> = {
  '1': ['1', '2'],
  '2': ['3', '4'],
  '3': ['5']
};

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [filtered, setFiltered] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<CSVStudentRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPinInfo, setNewPinInfo] = useState<{ rollNo: string; pin: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [singleName, setSingleName] = useState('');
  const [singleRollNo, setSingleRollNo] = useState('');
  const [year, setYear] = useState('1');
  const [semester, setSemester] = useState('1');
  const [baseRollNo, setBaseRollNo] = useState('23N81A0501');
  const [numToGenerate, setNumToGenerate] = useState('66');
  const [bulkInput, setBulkInput] = useState('');
  const [newPinsList, setNewPinsList] = useState<{ rollNo: string; name: string; pin: string }[] | null>(null);


  // Edit / Sort State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [sortField, setSortField] = useState<'rollNo' | 'name'>('rollNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const incrementRollNo = (baseRoll: string, index: number): string => {
    const match = baseRoll.match(/\d+$/);
    if (!match) return `${baseRoll}_${index + 1}`;
    const numStr = match[0];
    const startIdx = baseRoll.lastIndexOf(numStr);
    const prefix = baseRoll.substring(0, startIdx);
    const newNum = parseInt(numStr) + index;
    const paddedNum = String(newNum).padStart(numStr.length, '0');
    return prefix + paddedNum;
  };

  const load = async () => {
    const s = await getStudents();
    setStudents(s);
    setFiltered(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let result = students;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q));
    }
    if (classFilter) result = result.filter(s => s.class === classFilter);

    // Apply Sorting
    result = [...result].sort((a, b) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    setFiltered(result);
  }, [search, classFilter, students, sortField, sortOrder]);

  const classes = [...new Set(students.map(s => s.class).filter(Boolean))].sort();

  const toggleSort = (field: 'rollNo' | 'name') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSaveName = async (studentId: string) => {
    if (!editName.trim()) return;
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, name: editName.trim() } : s));
    setEditingId(null);
    await updateStudentName(studentId, editName.trim());
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setNewPinsList(null);

    const result = await createStudent({
      name: singleName.trim(),
      rollNo: singleRollNo.trim().toUpperCase(),
      class: 'CME',
      year: parseInt(year),
      semester: parseInt(semester),
      section: 'A',
      admissionYear: new Date().getFullYear(),
      createdBy: user.id,
    }, user.id);

    setNewPinsList([{ rollNo: singleRollNo.trim().toUpperCase(), name: singleName.trim(), pin: result.pin }]);
    setSingleName('');
    setSingleRollNo('');
    setShowForm(false);
    await load();
    setSubmitting(false);
  };


  const handleCreateOrGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setNewPinsList(null);

    const computedClass = 'CME';
    const studentsToCreate: any[] = [];
    const pinsResult: { rollNo: string; name: string; pin: string }[] = [];

    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean);
    const currentYearNum = new Date().getFullYear();

    if (lines.length > 0) {
      // Parse textarea
      let baseIndex = 0;
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        let roll = '';
        let pin = '';
        let sName = '';

        if (parts.length >= 3) {
          roll = parts[0];
          pin = parts[1];
          sName = parts.slice(2).join(',');
        } else if (parts.length === 2) {
          if (/^\d{6}$/.test(parts[0])) {
            pin = parts[0];
            sName = parts[1];
            roll = incrementRollNo(baseRollNo, baseIndex++);
          } else {
            roll = parts[0];
            sName = parts[1];
            pin = Math.floor(100000 + Math.random() * 900000).toString();
          }
        } else {
          sName = parts[0];
          roll = incrementRollNo(baseRollNo, baseIndex++);
          pin = Math.floor(100000 + Math.random() * 900000).toString();
        }

        studentsToCreate.push({
          name: sName,
          rollNo: roll.toUpperCase(),
          pin,
          class: computedClass,
          year: parseInt(year),
          semester: parseInt(semester),
          section: 'A',
          admissionYear: currentYearNum
        });

        pinsResult.push({ rollNo: roll.toUpperCase(), name: sName, pin });
      }
    } else {
      // Generate empty list using count
      const count = parseInt(numToGenerate) || 0;
      for (let i = 0; i < count; i++) {
        const roll = incrementRollNo(baseRollNo, i);
        const sName = `Student ${String(i + 1).padStart(2, '0')}`;
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        studentsToCreate.push({
          name: sName,
          rollNo: roll.toUpperCase(),
          pin,
          class: computedClass,
          year: parseInt(year),
          semester: parseInt(semester),
          section: 'A',
          admissionYear: currentYearNum
        });

        pinsResult.push({ rollNo: roll.toUpperCase(), name: sName, pin });
      }
    }

    if (studentsToCreate.length > 0) {
      await bulkAddStudents(studentsToCreate, user.id);
      setNewPinsList(pinsResult);
      setBulkInput('');
    }

    setShowForm(false);
    await load();
    setSubmitting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CSVStudentRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: Papa.ParseResult<CSVStudentRow>) => {
        setCsvRows(result.data);
        setCsvErrors(result.errors.map((err: Papa.ParseError) => err.message));
      },
    });
  };

  const handleImport = async () => {
    if (!user || csvRows.length === 0) return;
    setImporting(true);
    const result = await importStudentsFromCSV(csvRows, user.id);
    setCsvErrors(result.errors);
    setCsvRows([]);
    setShowImport(false);
    await load();
    setImporting(false);
  };

  const handleRegenPin = async (studentId: string) => {
    const pin = await regenerateStudentPin(studentId);
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, pin } : s));
  };

  const handleResetPassword = async (studentId: string) => {
    const s = students.find(x => x.id === studentId);
    if (!s) return;
    const newPass = prompt(`Enter new password/PIN for student ${s.name} (${s.rollNo}):`);
    if (newPass === null) return;
    const cleanPass = newPass.trim();
    if (!cleanPass) {
      alert("Password cannot be empty");
      return;
    }
    setStudents(prev => prev.map(x => x.id === studentId ? { ...x, pin: cleanPass } : x));
    await updateStudentPassword(studentId, cleanPass);
  };


  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    await deleteStudent(id);
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const handleDeleteAll = async () => {
    if (!confirm('WARNING: Are you sure you want to delete ALL students from the database? This cannot be undone.')) return;
    setLoading(true);
    await deleteAllStudents();
    await load();
  };

  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header">Students</h1>
            <p className="text-sm text-slate-400 mt-0.5">{students.length} students registered</p>
          </div>
          <div className="flex gap-2">
            <button id="import-students-btn" onClick={() => setShowImport(v => !v)} className="btn-secondary">
              <Upload className="w-4 h-4" /> CSV Import
            </button>
            <button id="add-student-btn" onClick={() => setShowForm(v => !v)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add/Generate Students
            </button>
            <button id="delete-all-students-btn" onClick={handleDeleteAll} className="btn-danger flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Delete All Students
            </button>
          </div>
        </div>

        {newPinsList && (
          <div className="card p-5 space-y-3 bg-emerald-500/10 border border-emerald-500/20 max-w-xl">
            <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2">
              <h3 className="font-semibold text-emerald-400">✓ Generated Student PINs ({newPinsList.length})</h3>
              <button onClick={() => setNewPinsList(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5 font-mono text-xs text-slate-300 pr-2">
              {newPinsList.map(s => (
                <div key={s.rollNo} className="flex justify-between py-1 border-b border-slate-800/40">
                  <span>{s.rollNo} — {s.name}</span>
                  <code className="bg-slate-900 px-2 py-0.5 rounded text-emerald-300 font-bold">{s.pin}</code>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 italic mt-2">Please copy or save this roster list now. These PINs are not shown again.</p>
          </div>
        )}

        {/* Add/Generate form */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <div className="flex border-b border-slate-800 pb-2 mb-2 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`pb-1 text-sm font-semibold border-b-2 transition-all ${activeTab === 'single' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                Add Single Student
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bulk')}
                className={`pb-1 text-sm font-semibold border-b-2 transition-all ${activeTab === 'bulk' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                Bulk Generate Students
              </button>
            </div>

            {activeTab === 'single' ? (
              <form onSubmit={handleCreateSingle} className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Full Name</label>
                  <input className="input" value={singleName} onChange={e => setSingleName(e.target.value)} required placeholder="A. Ravi Kumar" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Roll Number</label>
                  <input className="input" value={singleRollNo} onChange={e => setSingleRollNo(e.target.value)} required placeholder="23N81A0501" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Year</label>
                  <select className="input" value={year} onChange={e => {
                    const y = e.target.value;
                    setYear(y);
                    setSemester(SEMESTER_MAP[y][0]);
                  }}>
                    {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Semester</label>
                  <select className="input" value={semester} onChange={e => setSemester(e.target.value)}>
                    {(SEMESTER_MAP[year] || []).map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add Student
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateOrGenerate} className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Year</label>
                  <select className="input" value={year} onChange={e => {
                    const y = e.target.value;
                    setYear(y);
                    setSemester(SEMESTER_MAP[y][0]);
                  }}>
                    {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Semester</label>
                  <select className="input" value={semester} onChange={e => setSemester(e.target.value)}>
                    {(SEMESTER_MAP[year] || []).map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Base Roll Number</label>
                  <input className="input" value={baseRollNo} onChange={e => setBaseRollNo(e.target.value)} placeholder="23N81A0501" required />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Number of Students to Generate (if empty area)</label>
                  <input className="input" type="number" value={numToGenerate} onChange={e => setNumToGenerate(e.target.value)} placeholder="66" min="1" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wide font-medium">Format: PIN,Name (one per line). Or leave empty to auto-generate.</label>
                  <textarea
                    className="input min-h-28 font-mono text-xs"
                    placeholder="e.g.&#10;123456,A. Ravi Kumar&#10;987654,B. Hari Krishna&#10;Or just names (one per line) to auto-generate PINs"
                    value={bulkInput}
                    onChange={e => setBulkInput(e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add/Generate
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}


        {/* CSV Import */}
        {showImport && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-200">CSV Import</h2>
              <button onClick={() => { setShowImport(false); setCsvRows([]); }}><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-xs text-slate-400 font-mono">
              Expected columns: name, rollNo, class, year, semester, section, admissionYear
            </div>
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Click to select CSV file</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>
            {csvRows.length > 0 && (
              <div>
                <p className="text-sm text-slate-300 mb-2">{csvRows.length} rows to import</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 text-xs">
                  <table className="w-full">
                    <thead className="bg-slate-900 sticky top-0">
                      <tr>{['Name','Roll No','Class','Year','Semester'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t border-slate-800">
                          <td className="px-3 py-2 text-slate-300">{r.name}</td>
                          <td className="px-3 py-2 text-slate-300">{r.rollNo}</td>
                          <td className="px-3 py-2 text-slate-300">{r.class}</td>
                          <td className="px-3 py-2 text-slate-300">{r.year}</td>
                          <td className="px-3 py-2 text-slate-300">{r.semester}</td>
                        </tr>
                      ))}
                      {csvRows.length > 5 && (
                        <tr><td colSpan={5} className="px-3 py-2 text-slate-500">…and {csvRows.length - 5} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button onClick={handleImport} disabled={importing} className="btn-primary mt-3">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import {csvRows.length} Students
                </button>
              </div>
            )}
            {csvErrors.length > 0 && (
              <div className="space-y-1">
                {csvErrors.map((e, i) => <p key={i} className="text-xs text-red-400">{e}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input className="input pl-9" placeholder="Search name or roll number…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-40" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Student list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <p className="font-medium">No students found</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th
                    onClick={() => toggleSort('rollNo')}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-indigo-400 transition-colors select-none"
                  >
                    Roll No {sortField === 'rollNo' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    onClick={() => toggleSort('name')}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-indigo-400 transition-colors select-none"
                  >
                    Name {sortField === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide select-none">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide select-none">Sem</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide select-none">PIN</th>
                  <th className="px-4 py-3 select-none"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                    <td className="px-4 py-3 font-mono text-slate-300">{s.rollNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {editingId === s.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveName(s.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button onClick={() => handleSaveName(s.id)} className="text-emerald-400 hover:text-emerald-300">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-450">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span>{s.name}</span>
                          <button
                            onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.class}</td>
                    <td className="px-4 py-3 text-slate-400">{s.semester}</td>
                    <td className="px-4 py-3"><PinBadge pin={s.pin} studentId={s.id} onRegen={handleRegenPin} onReset={handleResetPassword} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(s.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        )}
      </div>
    </RoleGuard>
  );
}
