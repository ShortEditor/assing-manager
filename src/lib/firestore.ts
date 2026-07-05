import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  StudentDoc,
  StaffDoc,
  SubjectDoc,
  AssignmentDoc,
  SubmissionDoc,
  SubmissionStatus,
  CSVStudentRow,
} from '@/types';

// ── Helpers ──────────────────────────────────────────────────
function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts as string);
}

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Students ─────────────────────────────────────────────────
export async function getStudents(classFilter?: string): Promise<StudentDoc[]> {
  let q;
  if (classFilter) {
    q = query(collection(db, 'students'), where('class', '==', classFilter));
  } else {
    q = query(collection(db, 'students'));
  }
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: tsToDate(d.data().createdAt) } as StudentDoc));
  return list.sort((a, b) => (a.rollNo || '').localeCompare(b.rollNo || ''));
}

export async function getStudentById(id: string): Promise<StudentDoc | null> {
  const snap = await getDoc(doc(db, 'students', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data(), createdAt: tsToDate(snap.data().createdAt) } as StudentDoc;
}

export async function createStudent(
  data: Omit<StudentDoc, 'id' | 'pin' | 'role' | 'createdAt' | 'createdBy'> & { createdBy?: string },
  adminId: string
): Promise<{ id: string; pin: string }> {
  const pin = generatePin();
  const ref = doc(collection(db, 'students'));
  await setDoc(ref, {
    ...data,
    rollNo: data.rollNo.toUpperCase(),
    pin,
    role: 'student',
    createdBy: adminId,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, pin };
}

export async function importStudentsFromCSV(
  rows: CSVStudentRow[],
  adminId: string
): Promise<{ count: number; errors: string[] }> {
  const batch = writeBatch(db);
  const errors: string[] = [];
  let count = 0;

  for (const row of rows) {
    if (!row.name || !row.rollNo) {
      errors.push(`Skipped row: missing name or rollNo (${JSON.stringify(row)})`);
      continue;
    }
    const ref = doc(collection(db, 'students'));
    const pin = generatePin();
    batch.set(ref, {
      name: row.name.trim(),
      rollNo: row.rollNo.trim().toUpperCase(),
      class: row.class?.trim() ?? '',
      year: parseInt(row.year) || 1,
      semester: parseInt(row.semester) || 1,
      section: row.section?.trim() ?? '',
      admissionYear: parseInt(row.admissionYear) || new Date().getFullYear(),
      pin,
      role: 'student',
      createdBy: adminId,
      createdAt: serverTimestamp(),
    });
    count++;
  }

  await batch.commit();
  return { count, errors };
}

export async function regenerateStudentPin(studentId: string): Promise<string> {
  const pin = generatePin();
  await updateDoc(doc(db, 'students', studentId), { pin });
  return pin;
}

export async function deleteStudent(studentId: string): Promise<void> {
  await deleteDoc(doc(db, 'students', studentId));
}

export async function updateStudentName(studentId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'students', studentId), { name });
}

export async function updateStudentPassword(studentId: string, pin: string): Promise<void> {
  await updateDoc(doc(db, 'students', studentId), { pin });
}



export interface BulkStudentInput {
  name: string;
  rollNo: string;
  pin: string;
  class: string;
  year: number;
  semester: number;
  section: string;
  admissionYear: number;
}

export async function bulkAddStudents(students: BulkStudentInput[], adminId: string): Promise<void> {
  const batch = writeBatch(db);
  students.forEach(s => {
    const ref = doc(collection(db, 'students'));
    batch.set(ref, {
      name: s.name,
      rollNo: s.rollNo.toUpperCase(),
      class: s.class,
      year: s.year,
      semester: s.semester,
      section: s.section,
      admissionYear: s.admissionYear,
      pin: s.pin || Math.floor(100000 + Math.random() * 900000).toString(),
      role: 'student',
      createdBy: adminId,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function deleteAllStudents(): Promise<void> {
  const snap = await getDocs(collection(db, 'students'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.delete(d.ref);
  });
  await batch.commit();
}


// ── Staff ─────────────────────────────────────────────────────
export async function getStaff(): Promise<StaffDoc[]> {
  const snap = await getDocs(query(collection(db, 'staff'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: tsToDate(d.data().createdAt) } as StaffDoc));
}

export async function getStaffById(id: string): Promise<StaffDoc | null> {
  const snap = await getDoc(doc(db, 'staff', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data(), createdAt: tsToDate(snap.data().createdAt) } as StaffDoc;
}

export async function createStaff(
  data: { name: string; staffCode: string; subjects: string[] },
  adminId: string
): Promise<{ id: string; pin: string }> {
  const pin = generatePin();
  const ref = doc(collection(db, 'staff'));
  await setDoc(ref, {
    ...data,
    staffCode: data.staffCode.toUpperCase(),
    pin,
    role: 'staff',
    createdBy: adminId,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, pin };
}

export async function regenerateStaffPin(staffId: string): Promise<string> {
  const pin = generatePin();
  await updateDoc(doc(db, 'staff', staffId), { pin });
  return pin;
}

export async function updateStaffPassword(staffId: string, pin: string): Promise<void> {
  await updateDoc(doc(db, 'staff', staffId), { pin });
}


export async function deleteStaff(staffId: string): Promise<void> {
  // 1. Get all assignments created by this staff
  const assignSnap = await getDocs(
    query(collection(db, 'assignments'), where('createdBy', '==', staffId))
  );
  const assignments = assignSnap.docs.map(d => d.id);

  // 2. Cascade delete all submissions and assignments
  const batch = writeBatch(db);
  for (const aid of assignments) {
    const subSnap = await getDocs(
      query(collection(db, 'submissions'), where('assignmentId', '==', aid))
    );
    subSnap.docs.forEach(subDoc => {
      batch.delete(subDoc.ref);
    });
    batch.delete(doc(db, 'assignments', aid));
  }

  // 3. Unassign subjects
  const subjectSnap = await getDocs(
    query(collection(db, 'subjects'), where('staffId', '==', staffId))
  );
  subjectSnap.docs.forEach(subDoc => {
    batch.update(subDoc.ref, { staffId: '' });
  });

  // 4. Delete staff doc
  batch.delete(doc(db, 'staff', staffId));

  await batch.commit();
}

// ── Subjects ──────────────────────────────────────────────────
export async function getSubjects(staffId?: string): Promise<SubjectDoc[]> {
  let q;
  if (staffId) {
    q = query(collection(db, 'subjects'), where('staffId', '==', staffId));
  } else {
    q = query(collection(db, 'subjects'), orderBy('name'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: tsToDate(d.data().createdAt) } as SubjectDoc));
}

export async function createSubject(
  data: Omit<SubjectDoc, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'subjects'), {
    ...data,
    code: data.code.toUpperCase(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSubject(id: string, data: Partial<SubjectDoc>): Promise<void> {
  await updateDoc(doc(db, 'subjects', id), data);
}

export async function deleteSubject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'subjects', id));
}

// ── Assignments ───────────────────────────────────────────────
export async function getAssignments(staffId?: string, subjectId?: string): Promise<AssignmentDoc[]> {
  let q;
  if (subjectId) {
    q = query(collection(db, 'assignments'), where('subjectId', '==', subjectId));
  } else if (staffId) {
    // Get subject IDs for this staff first
    const subjects = await getSubjects(staffId);
    const subjectIds = subjects.map(s => s.id);
    if (subjectIds.length === 0) return [];
    q = query(collection(db, 'assignments'), where('subjectId', 'in', subjectIds));
  } else {
    q = query(collection(db, 'assignments'));
  }
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    dueDate: tsToDate(d.data().dueDate),
    createdAt: tsToDate(d.data().createdAt),
  } as AssignmentDoc));

  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getAssignmentById(id: string): Promise<AssignmentDoc | null> {
  const snap = await getDoc(doc(db, 'assignments', id));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    dueDate: tsToDate(snap.data().dueDate),
    createdAt: tsToDate(snap.data().createdAt),
  } as AssignmentDoc;
}

export async function createAssignment(
  data: Omit<AssignmentDoc, 'id' | 'createdAt'>,
  staffId: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'assignments'), {
    ...data,
    createdBy: staffId,
    createdAt: serverTimestamp(),
  });

  // Auto-create submission placeholders for all students in that semester
  const allStudents = await getStudents();
  const students = allStudents.filter(student => student.semester === data.semester);
  if (students.length > 0) {
    const batch = writeBatch(db);
    for (const student of students) {
      const subRef = doc(db, 'submissions', `${ref.id}_${student.id}`);
      batch.set(subRef, {
        studentId: student.id,
        assignmentId: ref.id,
        subjectId: data.subjectId,
        status: 'not_submitted',
        marks: null,
        correctedBy: null,
        correctedAt: null,
        remarks: null,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return ref.id;
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assignments', id));
}

// ── Submissions ───────────────────────────────────────────────
export async function getSubmissionsForAssignment(assignmentId: string): Promise<SubmissionDoc[]> {
  const q = query(collection(db, 'submissions'), where('assignmentId', '==', assignmentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    correctedAt: d.data().correctedAt ? tsToDate(d.data().correctedAt) : null,
    updatedAt: tsToDate(d.data().updatedAt),
  } as SubmissionDoc));
}

export async function getSubmissionsForStudent(studentId: string): Promise<SubmissionDoc[]> {
  const q = query(collection(db, 'submissions'), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    correctedAt: d.data().correctedAt ? tsToDate(d.data().correctedAt) : null,
    updatedAt: tsToDate(d.data().updatedAt),
  } as SubmissionDoc));
}

export async function updateSubmission(
  assignmentId: string,
  studentId: string,
  data: {
    status?: SubmissionStatus;
    marks?: number | null;
    correctedBy?: string | null;
    remarks?: string | null;
  }
): Promise<void> {
  const subId = `${assignmentId}_${studentId}`;
  const update: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.status === 'graded' || (data.marks !== undefined && data.marks !== null)) {
    update.correctedAt = serverTimestamp();
  }

  // Detect early submission status
  try {
    const snap = await getDoc(doc(db, 'assignments', assignmentId));
    if (snap.exists()) {
      const assignment = snap.data();
      const isEarly = new Date() < tsToDate(assignment.dueDate);
      if (data.status === 'submitted' || data.status === 'graded') {
        update.submittedEarly = isEarly;
      } else if (data.status === 'late' || data.status === 'not_submitted') {
        update.submittedEarly = false;
      }
    }
  } catch (err) {
    console.error("Error setting early submission status:", err);
  }

  await updateDoc(doc(db, 'submissions', subId), update);
}

export async function bulkMarkSubmitted(assignmentId: string, studentIds: string[]): Promise<void> {
  let isEarly = false;
  try {
    const snap = await getDoc(doc(db, 'assignments', assignmentId));
    if (snap.exists()) {
      isEarly = new Date() < tsToDate(snap.data().dueDate);
    }
  } catch (err) {
    console.error("Error checking bulk assignment due date:", err);
  }

  const batch = writeBatch(db);
  for (const studentId of studentIds) {
    const subId = `${assignmentId}_${studentId}`;
    batch.update(doc(db, 'submissions', subId), {
      status: 'submitted',
      submittedEarly: isEarly,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function getAllSubmissions(): Promise<SubmissionDoc[]> {
  const snap = await getDocs(collection(db, 'submissions'));
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    correctedAt: d.data().correctedAt ? tsToDate(d.data().correctedAt) : null,
    updatedAt: tsToDate(d.data().updatedAt),
  } as SubmissionDoc));
}

