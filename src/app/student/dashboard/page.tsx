'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/shared/RoleGuard';
import { getSubmissionsForStudent, getAssignmentById, getSubjects, getStudents, getAllSubmissions, getAssignments } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import type { SubmissionDoc, AssignmentDoc, SubjectDoc, SubmissionStatus } from '@/types';
import {
  CheckCircle2, Clock, XCircle, AlertCircle,
  BookMarked, Calendar, Search, Filter, Trophy,
} from 'lucide-react';
import Link from 'next/link';


const STATUS_CONFIG: Record<SubmissionStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  not_submitted: { label: 'Not Submitted', badge: 'badge-not-submitted', icon: <XCircle className="w-3 h-3" /> },
  submitted:     { label: 'Submitted',     badge: 'badge-submitted',     icon: <Clock className="w-3 h-3" /> },
  graded:        { label: 'Graded',        badge: 'badge-graded',        icon: <CheckCircle2 className="w-3 h-3" /> },
  late:          { label: 'Late',          badge: 'badge-late',          icon: <AlertCircle className="w-3 h-3" /> },
};

interface EnrichedSub {
  sub: SubmissionDoc;
  assignment: AssignmentDoc | null;
  subject: SubjectDoc | undefined;
}

interface LeaderboardEntry {
  studentId: string;
  name: string;
  rollNo: string;
  score: number;
  marksScore: number;
  bonusScore: number;
  rank?: number;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<EnrichedSub[]>([]);
  const [filtered, setFiltered] = useState<EnrichedSub[]>([]);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | ''>('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRankInfo, setMyRankInfo] = useState<{ rank: number; total: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getSubmissionsForStudent(user.id),
      getSubjects(),
      getStudents(),
      getAllSubmissions(),
      getAssignments(),
    ]).then(async ([subs, subjectList, studentList, allSubmissions, assignmentsList]) => {
      setSubjects(subjectList);
      const subjectMap = new Map(subjectList.map(s => [s.id, s]));
      const assignmentsMap = new Map(assignmentsList.map(a => [a.id, a]));

      const enriched: EnrichedSub[] = await Promise.all(
        subs.map(async sub => {
          const assignment = await getAssignmentById(sub.assignmentId);
          return {
            sub,
            assignment,
            subject: subjectMap.get(sub.subjectId),
          };
        })
      );

      // Filter out any entries belonging to deleted assignments!
      const validEnriched = enriched.filter(e => e.assignment !== null);

      // Sort: not submitted first, then by due date
      validEnriched.sort((a, b) => {
        const statusOrder: Record<SubmissionStatus, number> = { not_submitted: 0, late: 1, submitted: 2, graded: 3 };
        const so = statusOrder[a.sub.status] - statusOrder[b.sub.status];
        if (so !== 0) return so;
        return (a.assignment?.dueDate?.getTime() ?? 0) - (b.assignment?.dueDate?.getTime() ?? 0);
      });
      setItems(validEnriched);
      setFiltered(validEnriched);

      // Compute Leaderboard
      const semStudents = studentList.filter(s => s.semester === user.semester);
      const semStudentIds = new Set(semStudents.map(s => s.id));
      const leaderboardMap = new Map<string, { marks: number; bonus: number }>();
      semStudents.forEach(s => leaderboardMap.set(s.id, { marks: 0, bonus: 0 }));

      allSubmissions.forEach(sub => {
        if (semStudentIds.has(sub.studentId) && assignmentsMap.has(sub.assignmentId)) {
          const entry = leaderboardMap.get(sub.studentId) || { marks: 0, bonus: 0 };
          const marksEarned = sub.marks || 0;

          // Dynamic early submission bonus calculation
          let bonusEarned = 0;
          if (sub.status === 'submitted' || sub.status === 'graded') {
            const assignment = assignmentsMap.get(sub.assignmentId);
            if (assignment && assignment.createdAt && assignment.dueDate) {
              const totalDuration = assignment.dueDate.getTime() - assignment.createdAt.getTime();
              const earlyDuration = assignment.dueDate.getTime() - sub.updatedAt.getTime();
              if (totalDuration > 0 && earlyDuration > 0) {
                const ratio = Math.min(1, Math.max(0, earlyDuration / totalDuration));
                // Max +5 points bonus
                bonusEarned = Math.round(ratio * 5 * 10) / 10;
              }
            }
          }

          leaderboardMap.set(sub.studentId, {
            marks: entry.marks + marksEarned,
            bonus: entry.bonus + bonusEarned,
          });
        }
      });


      const sortedLeaderboard: LeaderboardEntry[] = semStudents.map(s => {
        const stats = leaderboardMap.get(s.id) || { marks: 0, bonus: 0 };
        return {
          studentId: s.id,
          name: s.name,
          rollNo: s.rollNo,
          marksScore: stats.marks,
          bonusScore: stats.bonus,
          score: Math.round((stats.marks + stats.bonus) * 10) / 10,
        };
      }).sort((a, b) => b.score - a.score || a.rollNo.localeCompare(b.rollNo));


      let currentRank = 1;
      const finalLeaderboard = sortedLeaderboard.map((entry, idx) => {
        if (idx > 0 && entry.score < sortedLeaderboard[idx - 1].score) {
          currentRank = idx + 1;
        }
        return { ...entry, rank: currentRank };
      });

      setLeaderboard(finalLeaderboard);

      const myIdx = finalLeaderboard.findIndex(x => x.studentId === user.id);
      if (myIdx !== -1) {
        setMyRankInfo({
          rank: finalLeaderboard[myIdx].rank || (myIdx + 1),
          total: finalLeaderboard.length,
        });
      }

      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.assignment?.title.toLowerCase().includes(q) || i.subject?.name.toLowerCase().includes(q));
    }
    if (statusFilter) result = result.filter(i => i.sub.status === statusFilter);
    if (subjectFilter) result = result.filter(i => i.sub.subjectId === subjectFilter);
    setFiltered(result);
  }, [search, statusFilter, subjectFilter, items]);

  const counts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.sub.status] = (acc[i.sub.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <RoleGuard allowedRoles={['student']}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
        {/* Left Column: Assignments Roster */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-1">
            <h1 className="page-header">My Assignments</h1>
            <p className="text-sm text-slate-400">
              {user?.rollNo} &nbsp;·&nbsp; {user?.class} &nbsp;·&nbsp; Sem {user?.semester}
            </p>
          </div>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-2">
            {(['not_submitted', 'submitted', 'graded', 'late'] as SubmissionStatus[]).map(s => {
              const cfg = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(prev => prev === s ? '' : s)}
                  className={`badge ${cfg.badge} cursor-pointer px-3 py-1.5 transition-all hover:scale-105 ${statusFilter === s ? 'ring-1 ring-current ring-offset-1 ring-offset-slate-950' : ''}`}
                >
                  {cfg.icon} {counts[s] ?? 0} {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input className="input pl-9" placeholder="Search assignments…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-44" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="card p-12 text-center text-slate-500">Loading your assignments…</div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center text-slate-500">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No assignments match your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(({ sub, assignment, subject }) => {
                if (!assignment) return null;
                const cfg = STATUS_CONFIG[sub.status];
                const isOverdue = sub.status === 'not_submitted' && new Date(assignment.dueDate) < new Date();
                return (
                  <Link
                    key={sub.id}
                    href={`/student/assignments/${assignment.id}`}
                    className="card p-4 flex items-center gap-4 hover:border-slate-700 transition-all duration-200 block group"
                  >
                    {(() => {
                      let bonusEarned = 0;
                      if (assignment && assignment.createdAt && assignment.dueDate && (sub.status === 'submitted' || sub.status === 'graded')) {
                        const totalDuration = new Date(assignment.dueDate).getTime() - new Date(assignment.createdAt).getTime();
                        const earlyDuration = new Date(assignment.dueDate).getTime() - new Date(sub.updatedAt).getTime();
                        if (totalDuration > 0 && earlyDuration > 0) {
                          const ratio = Math.min(1, Math.max(0, earlyDuration / totalDuration));
                          bonusEarned = Math.round(ratio * 5 * 10) / 10;
                        }
                      }
                      return (
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-200 group-hover:text-white transition-colors">{assignment.title}</p>
                            <span className={`badge ${cfg.badge}`}>{cfg.icon}{cfg.label}</span>
                            {isOverdue && <span className="badge badge-not-submitted">Overdue</span>}
                            {bonusEarned > 0 && (
                              <span className="badge badge-graded text-[10px] py-0.5 px-1.5 font-bold uppercase tracking-wider scale-95 origin-left">
                                +{bonusEarned} Early Bonus
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><BookMarked className="w-3 h-3" />{subject?.code} — {subject?.name}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due: {new Date(assignment.dueDate).toLocaleDateString('en-IN')}</span>
                            <span className="capitalize">{assignment.type}</span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="text-right shrink-0">
                      {sub.status === 'graded' && sub.marks !== null ? (
                        <div>
                          <p className="text-2xl font-bold text-emerald-400">{sub.marks}</p>
                          <p className="text-xs text-slate-500">/ {assignment.maxMarks}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">—</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Leaderboard Sidebar */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="font-semibold text-slate-200">Sem {user?.semester} Leaderboard</h2>
            </div>

            {myRankInfo && (
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-300 font-medium">Your Rank</p>
                  <p className="text-2xl font-black text-indigo-400">#{myRankInfo.rank} <span className="text-xs font-normal text-slate-400">of {myRankInfo.total}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-indigo-300 font-medium">Total Score</p>
                  <p className="text-lg font-bold text-slate-200">
                    {leaderboard.find(x => x.studentId === user?.id)?.score || 0} <span className="text-xs font-normal text-slate-400">pts</span>
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {leaderboard.slice(0, 5).map((entry) => {
                const isMe = entry.studentId === user?.id;
                return (
                  <div
                    key={entry.studentId}
                    className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isMe ? 'bg-indigo-600/10 border border-indigo-500/25' : 'hover:bg-slate-800/30'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 text-center font-bold text-xs text-slate-500">
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${isMe ? 'text-indigo-400' : 'text-slate-200'}`}>{entry.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{entry.rollNo}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-300">{entry.score} pts</p>
                      {entry.bonusScore > 0 && (
                        <p className="text-[9px] text-emerald-400 font-medium font-sans">+{entry.bonusScore} Early Bonus</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">No submissions graded yet</p>
              )}
            </div>

            <div className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2.5">
              💡 <span className="font-semibold text-indigo-400">Early Bonus Points</span> (up to +5 pts) are dynamically awarded based on how many days before the deadline the assignment is submitted.
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
