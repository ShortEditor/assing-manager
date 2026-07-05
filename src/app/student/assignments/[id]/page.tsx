'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import RoleGuard from '@/components/shared/RoleGuard';
import { getAssignmentById, getSubjects, getStaffById } from '@/lib/firestore';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { AssignmentDoc, SubjectDoc, SubmissionDoc, StaffDoc } from '@/types';
import { ChevronLeft, Calendar, BookMarked, User, Award, MessageSquare, Clock } from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG = {
  not_submitted: { label: 'Not Submitted', badge: 'badge-not-submitted' },
  submitted:     { label: 'Submitted',     badge: 'badge-submitted'     },
  graded:        { label: 'Graded',        badge: 'badge-graded'        },
  late:          { label: 'Late',          badge: 'badge-late'          },
};

export default function StudentAssignmentDetail() {
  const params = useParams();
  const assignmentId = params.id as string;
  const { user } = useAuth();

  const [assignment, setAssignment] = useState<AssignmentDoc | null>(null);
  const [subject, setSubject] = useState<SubjectDoc | null>(null);
  const [submission, setSubmission] = useState<SubmissionDoc | null>(null);
  const [correctedBy, setCorrectedBy] = useState<StaffDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAssignmentById(assignmentId),
      getSubjects(),
    ]).then(async ([a, subjectList]) => {
      setAssignment(a);
      if (!a) { setLoading(false); return; }
      setSubject(subjectList.find(s => s.id === a.subjectId) ?? null);

      const subId = `${assignmentId}_${user.id}`;
      const subSnap = await getDoc(doc(db, 'submissions', subId));
      if (subSnap.exists()) {
        const data = subSnap.data() as SubmissionDoc;
        setSubmission(data);
        if (data.correctedBy) {
          const staff = await getStaffById(data.correctedBy);
          setCorrectedBy(staff);
        }
      }
      setLoading(false);
    });
  }, [assignmentId, user]);

  if (loading) {
    return (
      <RoleGuard allowedRoles={['student']}>
        <div className="card p-8 text-center text-slate-500">Loading…</div>
      </RoleGuard>
    );
  }

  if (!assignment) {
    return (
      <RoleGuard allowedRoles={['student']}>
        <div className="card p-8 text-center text-slate-500">Assignment not found</div>
      </RoleGuard>
    );
  }

  const cfg = STATUS_CONFIG[submission?.status ?? 'not_submitted'];
  const percentage = submission?.marks !== null && submission?.marks !== undefined
    ? Math.round((submission.marks / assignment.maxMarks) * 100)
    : null;

  return (
    <RoleGuard allowedRoles={['student']}>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/student/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="page-header flex-1 truncate">{assignment.title}</h1>
        </div>

        {/* Status card */}
        <div className={`card p-6 border-l-4 ${
          submission?.status === 'graded' ? 'border-l-emerald-500' :
          submission?.status === 'submitted' ? 'border-l-amber-500' :
          submission?.status === 'late' ? 'border-l-orange-500' :
          'border-l-red-500'
        }`}>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <span className={`badge ${cfg.badge} text-sm px-3 py-1`}>{cfg.label}</span>
              {submission?.status === 'graded' && submission.marks !== null && (
                <div className="space-y-1">
                  <p className="text-4xl font-bold text-slate-100">
                    {submission.marks} <span className="text-lg text-slate-400">/ {assignment.maxMarks}</span>
                  </p>
                  {percentage !== null && (
                    <div className="flex items-center gap-3">
                      <div className="w-40 h-2 bg-slate-800 rounded-full">
                        <div
                          className={`h-2 rounded-full ${percentage >= 75 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-400">{percentage}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Award className={`w-10 h-10 ${submission?.status === 'graded' ? 'text-emerald-400' : 'text-slate-700'}`} />
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: <BookMarked className="w-4 h-4" />, label: 'Subject', value: `${subject?.code} — ${subject?.name}` },
            { icon: <Calendar className="w-4 h-4" />, label: 'Due Date', value: new Date(assignment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
            { icon: <Award className="w-4 h-4" />, label: 'Max Marks', value: String(assignment.maxMarks) },
            { icon: <User className="w-4 h-4" />, label: 'Type', value: assignment.type.charAt(0).toUpperCase() + assignment.type.slice(1) },
            ...(correctedBy ? [{ icon: <User className="w-4 h-4" />, label: 'Corrected By', value: correctedBy.name }] : []),
            ...(submission?.correctedAt ? [{ icon: <Clock className="w-4 h-4" />, label: 'Corrected On', value: new Date(submission.correctedAt).toLocaleDateString('en-IN') }] : []),
          ].map(item => (
            <div key={item.label} className="glass rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-slate-500">
                {item.icon}
                <span className="text-xs uppercase tracking-wide font-medium">{item.label}</span>
              </div>
              <p className="text-sm font-medium text-slate-200">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Remarks */}
        {submission?.remarks && (
          <div className="card p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Remarks from Staff</span>
            </div>
            <p className="text-sm text-slate-300 italic">&ldquo;{submission.remarks}&rdquo;</p>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
