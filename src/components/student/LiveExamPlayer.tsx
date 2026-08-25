import React, { useState, useEffect, useRef } from 'react';
import { Test, Student, StudentSubmission, Question } from '../../types';
import { StorageService } from '../../lib/storage';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  Award,
  BookOpen,
  RotateCcw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

interface LiveExamPlayerProps {
  test: Test;
  student: Student;
  onFinish: (submission: StudentSubmission) => void;
  onExit: () => void;
}

export const LiveExamPlayer: React.FC<LiveExamPlayerProps> = ({
  test,
  student,
  onFinish,
  onExit
}) => {
  const questions: Question[] = test.questions || [];
  const totalQuestions = questions.length;

  // Track start time
  const [startTime] = useState<number>(() => Date.now());
  const durationSeconds = (test.durationMinutes || 20) * 60;
  const [timeLeft, setTimeLeft] = useState<number>(durationSeconds);
  const [currentIdx, setCurrentIdx] = useState<number>(0);

  // Answers map: { [questionId]: selectedOption (0, 1, 2, 3) or -1 }
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    // Try restoring from sessionStorage in case of accidental refresh
    try {
      const saved = sessionStorage.getItem(`apex_exam_answers_${test.id}_${student.id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    const initial: Record<string, number> = {};
    questions.forEach(q => {
      initial[q.id] = -1;
    });
    return initial;
  });

  // Marked for review set of question IDs
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  // Visited questions
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const isAutoSubmittedRef = useRef<boolean>(false);

  // Save answers to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(`apex_exam_answers_${test.id}_${student.id}`, JSON.stringify(answers));
    } catch {
      // ignore
    }
  }, [answers, test.id, student.id]);

  // Mark current question visited
  useEffect(() => {
    setVisited(prev => ({ ...prev, [currentIdx]: true }));
  }, [currentIdx]);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!isAutoSubmittedRef.current) {
            isAutoSubmittedRef.current = true;
            handleFinalSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const currentQ = questions[currentIdx];

  const handleSelectOption = (optionIdx: number) => {
    if (!currentQ) return;
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: optionIdx
    }));
  };

  const handleClearOption = () => {
    if (!currentQ) return;
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: -1
    }));
  };

  const toggleMarkForReview = () => {
    if (!currentQ) return;
    setMarkedForReview(prev => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id]
    }));
  };

  const handleNext = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
    }
  };

  const calculateResults = () => {
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let score = 0;

    // Use test marks distribution or default (+4, -1) or equal share
    const marksPerQ = test.marksPerQuestion || (totalQuestions > 0 ? Math.round(test.totalMarks / totalQuestions) : 4);
    const negMarksPerQ = test.negativeMarksPerQuestion !== undefined ? test.negativeMarksPerQuestion : 1;

    questions.forEach(q => {
      const selected = answers[q.id];
      if (selected === undefined || selected === -1) {
        unansweredCount++;
      } else if (selected === q.correctOption) {
        correctCount++;
        score += marksPerQ;
      } else {
        wrongCount++;
        score -= negMarksPerQ;
      }
    });

    // Score cannot be less than 0
    score = Math.max(0, score);
    const attempted = correctCount + wrongCount;
    const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;

    const timeSpentSeconds = Math.min(durationSeconds, Math.round((Date.now() - startTime) / 1000));

    const submission: StudentSubmission = {
      studentId: student.id,
      studentName: student.name,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      timeSpentSeconds,
      answers,
      score,
      totalMarks: test.totalMarks,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracy
    };

    return submission;
  };

  const handleFinalSubmit = (isTimeOver = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    const submission = calculateResults();

    try {
      sessionStorage.removeItem(`apex_exam_answers_${test.id}_${student.id}`);
      StorageService.submitLiveTest(test.id, submission);
    } catch (e) {
      console.error('Submission error:', e);
    }

    onFinish(submission);
  };

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Status counts for palette
  const answeredCount = Object.values(answers).filter(val => val !== -1).length;
  const reviewCount = Object.keys(markedForReview).filter(k => markedForReview[k]).length;
  const unansweredCount = totalQuestions - answeredCount;

  // Color logic for timer
  const isUrgent = timeLeft < 300; // < 5 mins
  const isCritical = timeLeft < 60; // < 1 min

  const optionLetters = ['A', 'B', 'C', 'D'];

  if (!currentQ || totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-900">No Questions Found</h2>
          <p className="text-sm text-slate-500">This test currently does not contain any questions.</p>
          <button
            onClick={onExit}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-2xl"
          >
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col select-none overflow-hidden font-sans">
      {/* 1. Exam Top Navigation Bar */}
      <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-indigo-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-indigo-500/20">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/20">
                LIVE EXAM
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                {test.batchTitle || 'Chemistry'}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-white truncate max-w-xs sm:max-w-md">
              {test.title}
            </h1>
          </div>
        </div>

        {/* Timer & Submit Header Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Live Countdown Timer */}
          <div
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono text-sm sm:text-base font-black transition-all border ${
              isCritical
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse shadow-lg shadow-red-500/20'
                : isUrgent
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-indigo-300 border-slate-700'
            }`}
          >
            <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${isCritical ? 'text-red-400 animate-spin' : 'text-amber-400'}`} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Submit Test</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-900 text-slate-100">
        {/* Left / Center: Question Panel */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col justify-between space-y-6">
            
            {/* Question Header Card */}
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-5 sm:p-7 shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md">
                    Q{currentIdx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    of {totalQuestions} Questions
                  </span>
                  {markedForReview[currentQ.id] && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <Bookmark className="w-3 h-3 fill-purple-300" /> Marked for Review
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono">
                    +{test.marksPerQuestion || 4} Marks
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold font-mono">
                    -{test.negativeMarksPerQuestion !== undefined ? test.negativeMarksPerQuestion : 1} Mark
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed font-sans select-text">
                {currentQ.question}
              </div>

              {/* 4 Options Grid */}
              <div className="space-y-3 pt-2">
                {currentQ.options.map((optionText, optIdx) => {
                  const isSelected = answers[currentQ.id] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 group ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                          : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                          isSelected
                            ? 'bg-indigo-500 text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 group-hover:bg-slate-600'
                        }`}
                      >
                        {optionLetters[optIdx]}
                      </span>
                      <span className="text-sm sm:text-base font-medium flex-1 pt-0.5 select-text">
                        {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentIdx === 0}
                  className="px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <button
                  type="button"
                  onClick={handleClearOption}
                  disabled={answers[currentQ.id] === -1}
                  className="px-3 sm:px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-slate-200 font-semibold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear Selection
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMarkForReview}
                  className={`px-3 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border flex items-center gap-1.5 transition-all ${
                    markedForReview[currentQ.id]
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                      : 'bg-purple-950/40 text-purple-300 border-purple-800/50 hover:bg-purple-900/50'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{markedForReview[currentQ.id] ? 'Unmark Review' : 'Mark for Review'}</span>
                </button>

                {currentIdx < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 sm:px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                  >
                    Save & Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(true)}
                    className="px-4 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
                  >
                    Submit Test <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </main>

        {/* Right Sidebar: Question Palette & Student Info */}
        <aside className="w-full lg:w-80 bg-slate-950/80 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 sm:p-5 flex flex-col justify-between shrink-0 space-y-4">
          <div className="space-y-4">
            {/* Student Info Box */}
            <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-black text-sm flex items-center justify-center uppercase">
                {student.name.substring(0, 2)}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{student.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{student.id} • {student.className}</p>
              </div>
            </div>

            {/* Question Palette Legend */}
            <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-emerald-500 text-slate-950 font-black text-[9px] flex items-center justify-center">✓</span>
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-slate-700 text-slate-300 font-black text-[9px] flex items-center justify-center">0</span>
                <span>Unanswered ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-purple-500 text-white font-black text-[9px] flex items-center justify-center">★</span>
                <span>Review ({reviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-indigo-600 ring-2 ring-indigo-400 text-white font-black text-[9px] flex items-center justify-center">●</span>
                <span>Current</span>
              </div>
            </div>

            {/* Questions Grid */}
            <div className="space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Question Palette
              </span>
              <div className="grid grid-cols-5 gap-2 max-h-56 lg:max-h-72 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isCurrent = currentIdx === idx;
                  const isAnswered = answers[q.id] !== -1 && answers[q.id] !== undefined;
                  const isReview = !!markedForReview[q.id];

                  let btnBg = 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700';
                  if (isAnswered && isReview) {
                    btnBg = 'bg-purple-600 text-white border-purple-400 ring-1 ring-purple-300';
                  } else if (isAnswered) {
                    btnBg = 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20';
                  } else if (isReview) {
                    btnBg = 'bg-purple-900/70 text-purple-200 border-purple-600';
                  } else if (visited[idx]) {
                    btnBg = 'bg-slate-800 text-slate-300 border-slate-600';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-9 rounded-xl font-black text-xs transition-all border flex items-center justify-center relative ${btnBg} ${
                        isCurrent ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 scale-105 z-10' : ''
                      }`}
                    >
                      {idx + 1}
                      {isReview && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Guidance Footer */}
          <div className="p-3 bg-indigo-950/30 rounded-2xl border border-indigo-800/30 text-[11px] text-indigo-300/80 space-y-1">
            <p className="font-bold text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Important Instructions:
            </p>
            <p>• The exam auto-submits when timer reaches 00:00.</p>
            <p>• Marks, rank, and solutions are generated immediately upon submission.</p>
          </div>
        </aside>
      </div>

      {/* 3. Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-emerald-400 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Ready to Submit Exam?</h3>
                <p className="text-xs text-slate-400 font-mono">Time Remaining: {formatTime(timeLeft)}</p>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Answered</span>
                <span className="text-lg font-black text-emerald-400 font-mono">{answeredCount}</span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Unanswered</span>
                <span className="text-lg font-black text-slate-400 font-mono">{unansweredCount}</span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">In Review</span>
                <span className="text-lg font-black text-purple-400 font-mono">{reviewCount}</span>
              </div>
            </div>

            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Notice:
              </p>
              <p>Once submitted, your responses cannot be changed. Your score, accuracy, rank, and solutions will be calculated instantly.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={() => handleFinalSubmit(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
