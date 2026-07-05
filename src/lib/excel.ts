import * as XLSX from 'xlsx';
import type { SubmissionDoc, StudentDoc, AssignmentDoc, SubjectDoc, StaffDoc } from '@/types';

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Single Assignment Export ──────────────────────────────────
export function exportSingleAssignment(params: {
  assignment: AssignmentDoc;
  subject: SubjectDoc;
  submissions: SubmissionDoc[];
  students: StudentDoc[];
  staffMap: Map<string, StaffDoc>;
}): void {
  const { assignment, subject, submissions, students, staffMap } = params;

  const subMap = new Map(submissions.map(s => [s.studentId, s]));

  const rows = students.map(student => {
    const sub = subMap.get(student.id);
    const correctedBy = sub?.correctedBy ? (staffMap.get(sub.correctedBy)?.name ?? sub.correctedBy) : '—';
    return {
      'Roll No': student.rollNo,
      'Student Name': student.name,
      'Status': sub ? formatStatus(sub.status) : 'Not Submitted',
      'Marks': sub?.marks ?? '—',
      'Max Marks': assignment.maxMarks,
      'Corrected By': correctedBy,
      'Corrected At': formatDate(sub?.correctedAt ?? null),
      'Remarks': sub?.remarks ?? '—',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 10 },
    { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Marks');

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${subject.code}_${assignment.title.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── Consolidated Semester Export (Pivot) ──────────────────────
export function exportConsolidatedSemester(params: {
  students: StudentDoc[];
  assignments: AssignmentDoc[];
  submissions: SubmissionDoc[];
  subjectMap: Map<string, SubjectDoc>;
  semester: number;
  className: string;
}): void {
  const { students, assignments, submissions, subjectMap, semester, className } = params;

  // Build submission lookup: studentId → assignmentId → marks
  const lookup = new Map<string, Map<string, number | null>>();
  for (const sub of submissions) {
    if (!lookup.has(sub.studentId)) lookup.set(sub.studentId, new Map());
    lookup.get(sub.studentId)!.set(sub.assignmentId, sub.marks);
  }

  const rows = students.map(student => {
    const row: Record<string, string | number> = {
      'Roll No': student.rollNo,
      'Student Name': student.name,
    };
    let total = 0;
    let graded = 0;
    for (const assignment of assignments) {
      const subj = subjectMap.get(assignment.subjectId);
      const colHeader = `${subj?.code ?? '?'} - ${assignment.title}`;
      const marks = lookup.get(student.id)?.get(assignment.id);
      if (marks !== undefined && marks !== null) {
        row[colHeader] = marks;
        total += marks;
        graded++;
      } else {
        row[colHeader] = '—';
      }
    }
    row['Total'] = total;
    row['Average'] = graded > 0 ? parseFloat((total / graded).toFixed(2)) : 0;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto column widths
  const headers = Object.keys(rows[0] ?? {});
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Sem ${semester}`);

  const filename = `Consolidated_${className.replace(/\s+/g, '_')}_Sem${semester}_${new Date().getFullYear()}.xlsx`;
  XLSX.writeFile(wb, filename);
}
