'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getSubmissionsForStudent, getSubjects, getAssignments } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { SubmissionDoc, SubjectDoc, AssignmentDoc } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, BookMarked, Award } from 'lucide-react';

interface SubjectSummary {
  subject: SubjectDoc;
  total: number;
  graded: number;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; totalMarks: number; maxMarks: number; percentage: number } }> }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="glass rounded-lg px-3 py-2 text-xs">
        <p className="font-semibold text-slate-200">{d.name}</p>
        <p className="text-slate-400">Marks: {d.totalMarks} / {d.maxMarks}</p>
        <p className="text-indigo-300">{d.percentage}%</p>
      </div>
    );
  }
  return null;
};

export default function StudentMarksPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getSubmissionsForStudent(user.id),
      getSubjects(),
      getAssignments(),
    ]).then(([subs, subjectList, assignmentList]) => {
      const assignmentMap = new Map<string, AssignmentDoc>(assignmentList.map(a => [a.id, a]));

      // Group graded submissions by subject
      const bySubject = new Map<string, { subs: SubmissionDoc[]; maxMarks: number }>();
      for (const sub of subs) {
        if (sub.status !== 'graded' || sub.marks === null) continue;
        const assignment = assignmentMap.get(sub.assignmentId);
        if (!assignment) continue;
        if (!bySubject.has(sub.subjectId)) bySubject.set(sub.subjectId, { subs: [], maxMarks: 0 });
        const entry = bySubject.get(sub.subjectId)!;
        entry.subs.push(sub);
        entry.maxMarks += assignment.maxMarks;
      }

      const result: SubjectSummary[] = subjectList.map(subj => {
        const entry = bySubject.get(subj.id);
        const graded = entry?.subs.length ?? 0;
        const totalMarks = entry?.subs.reduce((s, m) => s + (m.marks ?? 0), 0) ?? 0;
        const maxMarks = entry?.maxMarks ?? 0;
        const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
        const gradedCount = subs.filter(s => s.subjectId === subj.id && s.status === 'graded').length;
        return { subject: subj, total: subs.filter(s => s.subjectId === subj.id).length, graded: gradedCount, totalMarks, maxMarks, percentage };
      }).filter(s => s.total > 0);

      setSummaries(result);
      setLoading(false);
    });
  }, [user]);

  const chartData = summaries.map(s => ({
    name: s.subject.code,
    totalMarks: s.totalMarks,
    maxMarks: s.maxMarks,
    percentage: s.percentage,
  }));

  return (
    <RoleGuard allowedRoles={['student']}>
      <div className="space-y-6 max-w-4xl">
        <div className="space-y-1">
          <h1 className="page-header">My Marks Summary</h1>
          <p className="text-sm text-slate-400">Graded assignments per subject</p>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-slate-500">Loading marks…</div>
        ) : summaries.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <Award className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No graded assignments yet</p>
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-slate-200">Performance by Subject</h2>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={36}>
                  <XAxis dataKey="name" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                  <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.percentage >= 75 ? '#10b981' : entry.percentage >= 50 ? '#f59e0b' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Per-subject cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summaries.map(s => (
                <div key={s.subject.id} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <code className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{s.subject.code}</code>
                      <p className="font-semibold text-slate-200 mt-1">{s.subject.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-100">{s.totalMarks}<span className="text-sm text-slate-400"> / {s.maxMarks}</span></p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{s.graded} graded of {s.total}</span>
                      <span className={s.percentage >= 75 ? 'text-emerald-400' : s.percentage >= 50 ? 'text-amber-400' : 'text-red-400'}>
                        {s.percentage}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${s.percentage >= 75 ? 'bg-emerald-500' : s.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <BookMarked className="w-3 h-3" />
                    {s.total - s.graded} pending correction
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
