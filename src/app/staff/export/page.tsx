'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getSubjects, getAssignments, getStudents, getSubmissionsForAssignment, getStaff } from '@/lib/firestore';
import { exportConsolidatedSemester } from '@/lib/excel';
import { useAuth } from '@/context/AuthContext';
import type { SubjectDoc, AssignmentDoc, StudentDoc, SubmissionDoc, StaffDoc } from '@/types';
import { Download, FileSpreadsheet, Loader2, ChevronRight } from 'lucide-react';

export default function ExportPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === 'super_admin';
    getSubjects(isAdmin ? undefined : user.id).then(s => {
      setSubjects(s);
      setLoading(false);
    });
  }, [user]);

  const handleExportConsolidated = async (className: string, semester: number) => {
    setExporting(className);
    try {
      const [students, assignments, staff] = await Promise.all([
        getStudents(className),
        getAssignments(),
        getStaff(),
      ]);

      const classAssignments = assignments.filter(a => a.class === className && a.semester === semester);
      const allSubs: SubmissionDoc[] = [];
      for (const a of classAssignments) {
        const subs = await getSubmissionsForAssignment(a.id);
        allSubs.push(...subs);
      }

      const subjectMap = new Map(subjects.map(s => [s.id, s]));
      const staffMap = new Map(staff.map(s => [s.id, s]));

      exportConsolidatedSemester({
        students,
        assignments: classAssignments,
        submissions: allSubs,
        subjectMap,
        semester,
        className,
      });
    } finally {
      setExporting(null);
    }
  };

  // Group subjects by class
  const classSemGroups = subjects.reduce<Map<string, { class: string; semester: number; subjects: SubjectDoc[] }>>(
    (acc, s) => {
      const key = `${s.class}__${s.semester}`;
      if (!acc.has(key)) acc.set(key, { class: s.class, semester: s.semester, subjects: [] });
      acc.get(key)!.subjects.push(s);
      return acc;
    }, new Map()
  );

  return (
    <RoleGuard allowedRoles={['super_admin', 'staff']}>
      <div className="space-y-6 max-w-3xl">
        <div className="space-y-1">
          <h1 className="page-header">Export Marks</h1>
          <p className="text-sm text-slate-400">Generate Excel sheets for NBA/SAR docs and internal records</p>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-slate-200">Consolidated Semester Reports</h2>
          </div>
          <p className="text-xs text-slate-500">Pivot table: students as rows, all assignments as columns, with total and average</p>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
          ) : classSemGroups.size === 0 ? (
            <p className="text-slate-500 text-sm">No subjects found. Add subjects to see export options.</p>
          ) : (
            <div className="space-y-2">
              {[...classSemGroups.values()].sort((a, b) => a.class.localeCompare(b.class) || a.semester - b.semester).map(group => (
                <div key={`${group.class}__${group.semester}`} className="glass rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-200">{group.class} — Semester {group.semester}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {group.subjects.map(s => s.code).join(', ')}
                    </p>
                  </div>
                  <button
                    id={`export-${group.class}-sem${group.semester}`}
                    onClick={() => handleExportConsolidated(group.class, group.semester)}
                    disabled={exporting === group.class}
                    className="btn-primary text-xs py-2 px-3"
                  >
                    {exporting === group.class
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                      : <><Download className="w-3.5 h-3.5" /> Download .xlsx</>
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-indigo-400" />
            <h2 className="font-semibold text-slate-200">Single Assignment Export</h2>
          </div>
          <p className="text-xs text-slate-500">Download marks for one specific assignment. Go to the assignment roster and click &ldquo;Export Excel&rdquo;.</p>
          <a href="/staff/assignments" className="btn-secondary text-sm inline-flex items-center gap-2">
            Open Assignments <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </RoleGuard>
  );
}
