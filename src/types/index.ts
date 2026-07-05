// Shared TypeScript types for Assignment & Marks Tracker

export type UserRole = 'super_admin' | 'staff' | 'student';
export type AssignmentType = 'assignment' | 'record' | 'lab' | 'seminar' | 'cia';
export type SubmissionStatus = 'not_submitted' | 'submitted' | 'graded' | 'late';

// ── Auth / Session ──────────────────────────────────────────
export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  subjects?: string[];
  staffCode?: string;
  rollNo?: string;
  class?: string;
  year?: number;
  semester?: number;
  section?: string;
}

// ── Firestore Document Types ─────────────────────────────────
export interface AdminDoc {
  id: string;
  name: string;
  email: string;
  role: 'super_admin';
}

export interface StaffDoc {
  id: string;
  name: string;
  staffCode: string;
  pin: string;
  subjects: string[];
  role: 'staff';
  createdBy: string;
  createdAt: Date;
}

export interface StudentDoc {
  id: string;
  name: string;
  rollNo: string;
  pin: string;
  class: string;
  year: number;
  semester: number;
  section: string;
  admissionYear: number;
  role: 'student';
  createdBy: string;
  createdAt: Date;
}

export interface SubjectDoc {
  id: string;
  name: string;
  code: string;
  semester: number;
  year: number;
  class: string;
  staffId: string;
  createdAt: Date;
}

export interface AssignmentDoc {
  id: string;
  title: string;
  type: AssignmentType;
  subjectId: string;
  semester: number;
  year: number;
  class: string;
  dueDate: Date;
  maxMarks: number;
  createdBy: string;
  createdAt: Date;
}

export interface SubmissionDoc {
  id: string;
  studentId: string;
  assignmentId: string;
  subjectId: string;
  status: SubmissionStatus;
  marks: number | null;
  correctedBy: string | null;
  correctedAt: Date | null;
  remarks: string | null;
  updatedAt: Date;
  submittedEarly?: boolean;
}


export interface EnrichedSubmission extends SubmissionDoc {
  studentName: string;
  studentRollNo: string;
  assignmentTitle: string;
  subjectName: string;
  maxMarks: number;
  correctedByName?: string;
}

export interface RosterRow {
  student: StudentDoc;
  submission: SubmissionDoc | null;
}

export interface CSVStudentRow {
  name: string;
  rollNo: string;
  class: string;
  year: string;
  semester: string;
  section: string;
  admissionYear: string;
}

export interface ExportRow {
  'Roll No': string;
  'Name': string;
  'Status': string;
  'Marks': number | string;
  'Max Marks': number;
  'Corrected By': string;
  'Corrected At': string;
  'Remarks': string;
}
