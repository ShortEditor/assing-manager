'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import RoleGuard from '@/components/shared/RoleGuard';
import {
  getAssignmentById, getStudents, getSubmissionsForAssignment,
  updateSubmission, bulkMarkSubmitted, getSubjects, getStaffById,
} from '@/lib/firestore';
import { exportSingleAssignment } from '@/lib/excel';
import { useAuth } from '@/context/AuthContext';
import type { AssignmentDoc, StudentDoc, SubmissionDoc, SubjectDoc, SubmissionStatus, StaffDoc } from '@/types';
import {
  CheckSquare, Download, Loader2, Save, ChevronLeft, Users,
  ClipboardCheck, Clock, XCircle, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_OPTIONS: SubmissionStatus[] = ['not_submitted', 'submitted', 'graded', 'late'];
const STATUS_LABELS: Record<SubmissionStatus, string> = {
  not_submitted: 'Not Submitted',
  submitted: 'Submitted',
  graded: 'Graded',
  late: 'Late',
};
const STATUS_CLASSES: Record<SubmissionStatus, string> = {
  not_submitted: 'badge-not-submitted',
  submitted: 'badge-submitted',
  graded: 'badge-graded',
  late: 'badge-late',
};
const STATUS_ICONS: Record<SubmissionStatus, React.ReactNode> = {
  not_submitted: <XCircle className="w-3 h-3" />,
  submitted: <Clock className="w-3 h-3" />,
  graded: <ClipboardCheck className="w-3 h-3" />,
  late: <AlertCircle className="w-3 h-3" />,
};

interface RowState {
  status: SubmissionStatus;
  marks: string;
  remarks: string;
  dirty: boolean;
  saving: boolean;
}

export default function RosterPage() {
  const params = useParams();
  const assignmentId = params.id as string;
  const { user } = useAuth();

  const [assignment, setAssignment] = useState<AssignmentDoc | null>(null);
  const [subject, setSubject] = useState<SubjectDoc | null>(null);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Map<string, SubmissionDoc>>(new Map());
  const [rows, setRows] = useState<Map<string, RowState>>(new Map());
  const [staffMap, setStaffMap] = useState<Map<string, StaffDoc>>(new Map());
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const a = await getAssignmentById(assignmentId);
    if (!a) return;
    setAssignment(a);

    const [allStudents, subs, subjectList] = await Promise.all([
      getStudents(),
      getSubmissionsForAssignment(assignmentId),
      getSubjects(),
    ]);

    const studentList = allStudents.filter(student => student.semester === a.semester);

    const subMap = new Map(subs.map(s => [s.studentId, s]));
    setSubmissionsMap(subMap);

    const foundSubject = subjectList.find(s => s.id === a.subjectId) ?? null;
    setSubject(foundSubject);
    setStudents(studentList.sort((a, b) => a.rollNo.localeCompare(b.rollNo)));

    // Load staff who corrected
    const staffIds = [...new Set(subs.map(s => s.correctedBy).filter(Boolean) as string[])];
    if (user?.id) staffIds.push(user.id);
    const staffDocs = await Promise.all([...new Set(staffIds)].map(id => getStaffById(id)));
    const sMap = new Map<string, StaffDoc>();
    staffDocs.forEach(s => s && sMap.set(s.id, s));
    setStaffMap(sMap);

    // Init row state
    const newRows = new Map<string, RowState>();
    for (const student of studentList) {
      const sub = subMap.get(student.id);
      newRows.set(student.id, {
        status: sub?.status ?? 'not_submitted',
        marks: sub?.marks !== null && sub?.marks !== undefined ? String(sub.marks) : '',
        remarks: sub?.remarks ?? '',
        dirty: false,
        saving: false,
      });
    }
    setRows(newRows);
    setLoading(false);
  }, [assignmentId, user]);

  useEffect(() => { load(); }, [load]);

  const updateRow = (studentId: string, field: keyof RowState, value: string) => {
    setRows(prev => {
      const next = new Map(prev);
      const row = next.get(studentId);
      if (row) {
        let updatedRow = { ...row, [field]: value, dirty: true };

        if (field === 'marks') {
          if (value.trim() !== '') {
            const marksNum = parseFloat(value);
            const maxMarks = assignment?.maxMarks ?? 100;
            if (marksNum < 0 || marksNum > maxMarks) {
              alert(`Marks must be between 0 and ${maxMarks}`);
              return prev; // Reject updating state
            }
            updatedRow.status = 'graded';
          } else {
            updatedRow.status = 'not_submitted';
          }
        }

        next.set(studentId, updatedRow);
      }
      return next;
    });
  };

  const saveRow = async (studentId: string) => {
    if (!user || !assignment) return;
    const row = rows.get(studentId);
    if (!row || !row.dirty) return;

    setRows(prev => {
      const next = new Map(prev);
      const r = next.get(studentId);
      if (r) next.set(studentId, { ...r, saving: true });
      return next;
    });

    const marks = row.marks !== '' ? parseFloat(row.marks) : null;
    await updateSubmission(assignment.id, studentId, {
      status: row.status,
      marks,
      correctedBy: marks !== null ? user.id : null,
      remarks: row.remarks || null,
    });

    setRows(prev => {
      const next = new Map(prev);
      const r = next.get(studentId);
      if (r) next.set(studentId, { ...r, dirty: false, saving: false });
      return next;
    });
  };

  const handleBulkSubmit = async () => {
    if (!assignment) return;
    setBulkLoading(true);
    const notSubmitted = students
      .filter(s => rows.get(s.id)?.status === 'not_submitted')
      .map(s => s.id);
    await bulkMarkSubmitted(assignment.id, notSubmitted);
    setRows(prev => {
      const next = new Map(prev);
      notSubmitted.forEach(id => {
        const r = next.get(id);
        if (r) next.set(id, { ...r, status: 'submitted', dirty: false });
      });
      return next;
    });
    setBulkLoading(false);
  };

  const handleExport = async () => {
    if (!assignment || !subject) return;
    setExporting(true);
    const subs = [...submissionsMap.values()];
    exportSingleAssignment({ assignment, subject, submissions: subs, students, staffMap });
    setExporting(false);
  };

  // Stats
  const statusCounts = students.reduce<Record<string, number>>((acc, s) => {
    const status = rows.get(s.id)?.status ?? 'not_submitted';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <RoleGuard allowedRoles={['super_admin', 'staff']}>
        <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={['super_admin', 'staff']}>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <Link href="/staff/assignments" className="text-slate-500 hover:text-slate-300 transition-colors mt-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="page-header truncate">{assignment?.title}</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {subject?.code} — {subject?.name} &nbsp;·&nbsp; Semester {assignment?.semester} &nbsp;·&nbsp; Max: {assignment?.maxMarks} marks
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button id="bulk-submit-btn" onClick={handleBulkSubmit} disabled={bulkLoading} className="btn-secondary">
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
              Mark All Submitted
            </button>
            <button id="export-roster-btn" onClick={handleExport} disabled={exporting} className="btn-primary">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Excel
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUS_OPTIONS.map(s => (
            <div key={s} className="glass rounded-xl p-3 flex items-center gap-3">
              <span className={`badge ${STATUS_CLASSES[s]} !px-2 !py-1`}>{STATUS_ICONS[s]}</span>
              <div>
                <p className="text-lg font-bold text-slate-100">{statusCounts[s] ?? 0}</p>
                <p className="text-xs text-slate-500">{STATUS_LABELS[s]}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Section Filter & Roster Table */}
        {students.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No students in Semester {assignment?.semester}</p>
            <p className="text-sm mt-1">Add students to this semester first</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">Roster Details</span>
            </div>

            <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/70">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Roll No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-44">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-28">Marks / {assignment?.maxMarks}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => {
                    const row = rows.get(student.id);
                    if (!row) return null;
                    return (
                      <tr key={student.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-300 text-xs">{student.rollNo}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-200">
                          {student.name}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`badge ${STATUS_CLASSES[row.status]}`}>
                            {STATUS_ICONS[row.status]}
                            {STATUS_LABELS[row.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max={assignment?.maxMarks}
                            value={row.marks}
                            onChange={e => updateRow(student.id, 'marks', e.target.value)}
                            onBlur={() => saveRow(student.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            placeholder="—"
                            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100
                                       focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30
                                       disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            value={row.remarks}
                            onChange={e => updateRow(student.id, 'remarks', e.target.value)}
                            onBlur={() => saveRow(student.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            placeholder="Optional remarks"
                            className="w-full bg-transparent border-b border-slate-700 px-1 py-1 text-xs text-slate-400
                                       focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </RoleGuard>
  );
}
