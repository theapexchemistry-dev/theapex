import React, { useState, useEffect } from 'react';
import { Student, Test, StudentSubmission, TestResult } from '../../types';
import { StorageService } from '../../lib/storage';
import { generateTestResponsePDF } from '../../lib/pdfGenerator';
import { LiveExamPlayer } from './LiveExamPlayer';
import {
  Trophy,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Zap,
  Play,
  Download,
  Eye,
  FileText,
  Bookmark,
  Check,
  X,
  Minus,
  Sparkles,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Users,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';

interface StudentTestsProps {
  student: Student;
}

export const StudentTests: React.FC<StudentTestsProps> = ({ student }) => {
  const [tests, setTests] = useState<Test[]>(() =>
    StorageService.getTests().filter(t => t.batchId === student.batchId)
  );

  // Active Tab: 'live' | 'results'
  const [activeTab, setActiveTab] = useState<'live' | 'results'>('live');

  // Active Live Exam State
  const [activeExamTest, setActiveExamTest] = useState<Test | null>(null);

  // Response Sheet Modal
  const [viewingResponseTest, setViewingResponseTest] = useState<Test | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<StudentSubmission | null>(null);

  // Leaderboard Modal
  const [viewingLeaderboardTest, setViewingLeaderboardTest] = useState<Test | null>(null);

  // Current Time for live schedule comparison (ticks every 10s)
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const handleStorageUpdate = () => {
      setTests(StorageService.getTests().filter(t => t.batchId === student.batchId));
    };

    window.addEventListener('apex_storage_updated', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    const clockTimer = setInterval(() => {
      setNow(new Date());
    }, 10000);

    // Check for pending test id redirection from WhatsApp/direct link
    const pendingId = localStorage.getItem('apex_pending_test_id');
    if (pendingId) {
      localStorage.removeItem('apex_pending_test_id');
      const allTests = StorageService.getTests();
      const target = allTests.find(t => t.id === pendingId);
      if (target) {
        setActiveExamTest(target);
      }
    }

    return () => {
      window.removeEventListener('apex_storage_updated', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
      clearInterval(clockTimer);
    };
  }, [student.batchId]);

  const refreshTests = () => {
    setTests(StorageService.getTests().filter(t => t.batchId === student.batchId));
  };

  const handleExamFinish = (submission: StudentSubmission) => {
    const currentTest = activeExamTest;
    setActiveExamTest(null);
    refreshTests();

    if (currentTest) {
      // Open immediate scorecard modal
      setViewingResponseTest(currentTest);
      setViewingSubmission(submission);
    }
  };

  const handleDownloadPDF = (test: Test, submission?: StudentSubmission) => {
    const sub = submission || test.submissions?.[student.id] || {
      studentId: student.id,
      studentName: student.name,
      submittedAt: new Date().toISOString().substring(0, 10),
      answers: {},
      score: test.results.find(r => r.studentId === student.id)?.marksObtained || 0,
      totalMarks: test.totalMarks,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
      accuracy: 0,
      rank: test.results.find(r => r.studentId === student.id)?.rank || 1
    };

    generateTestResponsePDF(student, test, sub);
  };

  // Check if test is currently started/live
  const isTestLiveNow = (t: Test) => {
    if (t.status === 'live') {
      if (t.scheduledStartTime) {
        return now >= new Date(t.scheduledStartTime);
      }
      return true;
    }
    if (t.scheduledStartTime) {
      const startTime = new Date(t.scheduledStartTime);
      return now >= startTime && t.status !== 'completed';
    }
    return false;
  };

  // Check if test window is expired
  const isTestExpired = (t: Test) => {
    if (!t.expiryDateTime) return false;
    return now > new Date(t.expiryDateTime);
  };

  // Get countdown string for scheduled tests
  const getScheduleCountdown = (scheduledTimeStr?: string) => {
    if (!scheduledTimeStr) return null;
    const target = new Date(scheduledTimeStr);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return 'Live Now';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) return `Starts in ${hours}h ${mins}m`;
    return `Starts in ${mins} mins`;
  };

  // Get expiry countdown string
  const getExpiryCountdown = (expiryTimeStr?: string) => {
    if (!expiryTimeStr) return null;
    const target = new Date(expiryTimeStr);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const days = Math.floor(hours / 24);

    if (days > 0) return `Closes in ${days}d ${hours % 24}h`;
    if (hours > 0) return `Closes in ${hours}h ${mins}m`;
    return `Closes in ${mins} mins`;
  };

  // If student is currently taking an exam, show the full-screen player
  if (activeExamTest) {
    return (
      <LiveExamPlayer
        test={activeExamTest}
        student={student}
        onFinish={handleExamFinish}
        onExit={() => setActiveExamTest(null)}
      />
    );
  }

  const liveTests = tests.filter(t => t.testType === 'live');
  const pastTests = tests.filter(t => t.results.some(r => r.studentId === student.id) || t.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Chemistry Test Series
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Live Tests & Performance Ranks
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Appear in live scheduled exams, evaluate question papers with instant score calculation, download PDF response sheets, and view class ranks.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'live'
                ? 'bg-white text-indigo-600 shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Live & Scheduled Tests</span>
            {liveTests.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">
                {liveTests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'results'
                ? 'bg-white text-indigo-600 shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Scorecards & Ranks</span>
          </button>
        </div>
      </div>

      {/* 1. LIVE & SCHEDULED TESTS TAB */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          {liveTests.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-400 space-y-3 shadow-sm">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">No Live Tests Active</h3>
              <p className="text-xs max-w-sm mx-auto">
                Your chemistry faculty has not scheduled any live test for your batch right now. Please check back at the scheduled test time.
              </p>
            </div>
          ) : (
            liveTests.map(t => {
              const mySubmission = t.submissions?.[student.id];
              const myResult = t.results.find(r => r.studentId === student.id);
              const isAttempted = !!mySubmission || !!myResult;
              const isLive = isTestLiveNow(t);
              const isExpired = isTestExpired(t);
              const countdown = getScheduleCountdown(t.scheduledStartTime);
              const expiryCountdown = getExpiryCountdown(t.expiryDateTime);

              return (
                <div
                  key={t.id}
                  className={`bg-white rounded-3xl border p-6 shadow-sm transition-all relative overflow-hidden space-y-5 ${
                    isLive && !isAttempted && !isExpired
                      ? 'border-indigo-300 ring-2 ring-indigo-500/10'
                      : isExpired && !isAttempted
                      ? 'border-slate-200 opacity-90'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Status Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {isAttempted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Exam Completed & Submitted
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle className="w-3.5 h-3.5" /> EXAM WINDOW CLOSED / EXPIRED
                        </span>
                      ) : isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-50 text-red-600 border border-red-200 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-red-500" /> LIVE NOW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3.5 h-3.5" /> Scheduled • {countdown}
                        </span>
                      )}

                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {t.durationMinutes || 20} Mins
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {t.totalMarks} Total Marks
                      </span>
                      {t.questions && (
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {t.questions.length} MCQ Questions
                        </span>
                      )}

                      {/* Expiry Badge */}
                      {t.expiryDateTime && (
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                            isExpired
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          ⏳ {isExpired ? 'Expired' : expiryCountdown}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 font-mono flex items-center gap-3">
                      {t.scheduledStartTime && (
                        <span>Starts: {t.scheduledStartTime.replace('T', ' ')}</span>
                      )}
                    </div>
                  </div>

                  {/* Test Details */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                        {t.topic || 'General Chemistry'}
                      </span>
                      <h3 className="text-xl font-black text-slate-900">{t.title}</h3>
                      <p className="text-xs text-slate-500">
                        Marking Scheme: +{t.marksPerQuestion || 4} for correct, -{t.negativeMarksPerQuestion !== undefined ? t.negativeMarksPerQuestion : 1} for incorrect. Auto-submits on leaving window.
                      </p>
                      {t.expiryDateTime && (
                        <p className="text-xs text-amber-700 font-semibold">
                          Closing Deadline: {t.expiryDateTime.replace('T', ' ')}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {isAttempted ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setViewingResponseTest(t);
                              setViewingSubmission(mySubmission || (myResult?.submission as StudentSubmission) || null);
                            }}
                            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-2xl border border-indigo-200 flex items-center gap-1.5 transition-all"
                          >
                            <Eye className="w-4 h-4" /> View Solutions & Scorecard
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadPDF(t, mySubmission)}
                            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all shadow-md"
                          >
                            <Download className="w-4 h-4 text-amber-400" /> Download PDF Report
                          </button>
                        </>
                      ) : isExpired ? (
                        <div className="p-3 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs font-bold text-center">
                          Exam window expired. You cannot start this exam now.
                        </div>
                      ) : !isLive ? (
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-xs font-bold flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-indigo-600" /> Exam starts at scheduled time ({countdown})
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveExamTest(t)}
                          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95"
                        >
                          <Play className="w-4 h-4 fill-white" /> Start Live Exam
                        </button>
                      )}
                    </div>
                  </div>

                  {/* If Already Attempted: Compact Summary Banner */}
                  {isAttempted && myResult && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Your Score</span>
                        <p className="text-lg font-black text-indigo-600 font-mono">
                          {myResult.marksObtained} <span className="text-xs text-slate-400">/ {t.totalMarks}</span>
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Class Rank</span>
                        <p className="text-lg font-black text-amber-600 font-mono">
                          #{myResult.rank || 1}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Percentage</span>
                        <p className="text-lg font-black text-emerald-600 font-mono">
                          {Math.round((myResult.marksObtained / t.totalMarks) * 100)}%
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Leaderboard</span>
                        <button
                          type="button"
                          onClick={() => setViewingLeaderboardTest(t)}
                          className="text-xs font-bold text-indigo-600 hover:underline block mx-auto mt-1"
                        >
                          View Standings ({t.results.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. SCORECARDS & PAST RANKS TAB */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          {pastTests.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-400 space-y-2 shadow-sm">
              <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs">No test results or scorecards available yet.</p>
            </div>
          ) : (
            pastTests.map(t => {
              const myResult = t.results.find(r => r.studentId === student.id);
              const percentage = myResult ? Math.round((myResult.marksObtained / t.totalMarks) * 100) : 0;
              const mySubmission = t.submissions?.[student.id];

              return (
                <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200 uppercase">
                        Test Date: {t.date}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">{t.title}</h3>
                      <p className="text-xs text-slate-500">{t.topic || 'Chemistry'} • {t.durationMinutes || 20} Mins</p>
                    </div>

                    {myResult ? (
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-indigo-700 to-indigo-600 text-white px-5 py-2.5 rounded-2xl shadow-md text-center">
                          <span className="text-[10px] font-black uppercase text-indigo-200 block">Class Rank</span>
                          <span className="text-2xl font-black font-mono">#{myResult.rank}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
                        Absent / Not Attempted
                      </span>
                    )}
                  </div>

                  {myResult && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <span className="text-slate-400 block font-medium">Marks Scored</span>
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {myResult.marksObtained} <span className="text-xs text-slate-400">/ {t.totalMarks}</span>
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <span className="text-slate-400 block font-medium">Percentage</span>
                        <span className="text-lg font-black text-indigo-600 font-mono">{percentage}%</span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <span className="text-slate-400 block font-medium">Performance Grade</span>
                        <span className="text-lg font-black text-emerald-600 font-mono">
                          {percentage >= 90 ? 'A+ (Excellent)' : percentage >= 75 ? 'A (Very Good)' : percentage >= 50 ? 'B (Good)' : 'C (Needs Focus)'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingResponseTest(t);
                            setViewingSubmission(mySubmission || (myResult.submission as StudentSubmission) || null);
                          }}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-center flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" /> Solutions & PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingLeaderboardTest(t)}
                          className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-center flex items-center justify-center gap-1"
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-500" /> Leaderboard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. Detailed Response Sheet & Solutions Modal */}
      {viewingResponseTest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                    TEST SCORECARD & SOLUTIONS
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">{viewingResponseTest.title}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {student.name} ({student.id}) • {viewingResponseTest.topic}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(viewingResponseTest, viewingSubmission || undefined)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Download PDF Report
                </button>
                <button
                  onClick={() => {
                    setViewingResponseTest(null);
                    setViewingSubmission(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Auto Submitted Warning Banner */}
            {viewingSubmission?.autoSubmitted && (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 text-amber-950 text-xs flex items-center gap-2.5 shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <strong className="block font-black">Auto-Submitted by Proctor System</strong>
                  <span>Reason: {viewingSubmission.autoSubmittedReason || 'Tab switch or window unfocused during live exam.'}</span>
                </div>
              </div>
            )}

            {/* Scorecard Overview Bar */}
            {viewingSubmission && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center shrink-0">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase block">Score</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {viewingSubmission.score} / {viewingResponseTest.totalMarks}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">Class Rank</span>
                  <span className="text-lg font-black text-amber-700 font-mono">
                    #{viewingSubmission.rank || 1}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Correct</span>
                  <span className="text-lg font-black text-emerald-700 font-mono">
                    {viewingSubmission.correctCount || 0}
                  </span>
                </div>
                <div className="p-3 bg-red-50 rounded-2xl border border-red-100">
                  <span className="text-[10px] font-bold text-red-600 uppercase block">Incorrect</span>
                  <span className="text-lg font-black text-red-700 font-mono">
                    {viewingSubmission.wrongCount || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Accuracy</span>
                  <span className="text-lg font-black text-slate-700 font-mono">
                    {viewingSubmission.accuracy || 0}%
                  </span>
                </div>
              </div>
            )}

            {/* Questions List with Solutions */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {(viewingResponseTest.questions || []).map((q, idx) => {
                const studentChoice = viewingSubmission?.answers?.[q.id] ?? -1;
                const isAttempted = studentChoice !== -1 && studentChoice !== undefined;
                const isCorrect = isAttempted && studentChoice === q.correctOption;
                const isWrong = isAttempted && !isCorrect;

                return (
                  <div
                    key={q.id}
                    className={`p-4 sm:p-5 rounded-2xl border space-y-3 text-xs ${
                      isCorrect
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : isWrong
                        ? 'bg-red-50/40 border-red-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-slate-900 text-sm">
                        Q{idx + 1}. {q.question}
                      </p>
                      {isCorrect ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" /> Correct (+marks)
                        </span>
                      ) : isWrong ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-300 flex items-center gap-1 shrink-0">
                          <X className="w-3 h-3" /> Incorrect (-mark)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-600 shrink-0">
                          Unanswered (0)
                        </span>
                      )}
                    </div>

                    {/* 4 Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isThisCorrect = q.correctOption === optIdx;
                        const isThisSelected = studentChoice === optIdx;

                        return (
                          <div
                            key={optIdx}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                              isThisCorrect
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-bold'
                                : isThisSelected && !isThisCorrect
                                ? 'bg-red-100 border-red-300 text-red-950 font-bold'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isThisCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : isThisSelected
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {['A', 'B', 'C', 'D'][optIdx]}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isThisCorrect && (
                              <span className="text-[10px] text-emerald-700 font-black">✓ Correct</span>
                            )}
                            {isThisSelected && !isThisCorrect && (
                              <span className="text-[10px] text-red-600 font-bold">Your Choice</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Solution Explanation */}
                    {q.explanation && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-700">
                        <strong className="text-indigo-900 block mb-0.5">Faculty Solution & Reason:</strong>
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setViewingLeaderboardTest(viewingResponseTest)}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Trophy className="w-4 h-4 text-amber-500" /> View Batch Standings
              </button>

              <button
                onClick={() => {
                  setViewingResponseTest(null);
                  setViewingSubmission(null);
                }}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Batch Leaderboard Modal */}
      {viewingLeaderboardTest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black text-slate-900">Batch Leaderboard</h3>
                </div>
                <p className="text-xs text-slate-500">
                  {viewingLeaderboardTest.title} • Max Marks: {viewingLeaderboardTest.totalMarks}
                </p>
              </div>
              <button
                onClick={() => setViewingLeaderboardTest(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {viewingLeaderboardTest.results.map(r => {
                const isMe = r.studentId === student.id;
                const pct = Math.round((r.marksObtained / viewingLeaderboardTest.totalMarks) * 100);

                return (
                  <div
                    key={r.studentId}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                      isMe
                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                          r.rank === 1
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                            : r.rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : r.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        #{r.rank}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">
                          {r.studentName} {isMe && <span className="text-indigo-600 text-xs font-black">(You)</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">{r.studentId}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black font-mono text-slate-900">
                        {r.marksObtained} / {viewingLeaderboardTest.totalMarks}
                      </p>
                      <p className="text-[10px] text-indigo-600 font-bold font-mono">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setViewingLeaderboardTest(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
