import React, { useState, useMemo, useEffect } from 'react';
import { Student, Batch, Announcement } from '../../types';
import { StorageService } from '../../lib/storage';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  BookOpen,
  HelpCircle,
  Award,
  ArrowRight,
  Sparkles,
  Trophy,
  IndianRupee,
  Bell,
  Megaphone
} from 'lucide-react';

interface StudentDashboardProps {
  student: Student;
  onNavigate: (tab: string) => void;
  onPayFees: (month: string, amount: number) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  onNavigate,
  onPayFees
}) => {
  const batches = StorageService.getBatches();
  const studentBatch = batches.find(b => b.id === student.batchId);

  const feeRecords = StorageService.getFeeRecords().filter(f => f.studentId && f.studentId.toLowerCase() === student.id.toLowerCase());
  const tests = StorageService.getTests().filter(t => t.batchId === student.batchId);
  const doubts = StorageService.getDoubts().filter(d => d.studentId && d.studentId.toLowerCase() === student.id.toLowerCase());

  const paidCount = feeRecords.filter(f => f.status === 'paid').length;
  const unpaidCount = feeRecords.filter(f => f.status === 'unpaid').length;
  const totalFeesAmount = student.fees * feeRecords.length;
  const paidFeesAmount = feeRecords.filter(f => f.status === 'paid').reduce((a, b) => a + b.amount, 0);
  const dueFeesAmount = totalFeesAmount - paidFeesAmount;

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => StorageService.getAnnouncements());
  const studentAnnouncements = announcements.filter(
    ann => ann.targetAudience === 'all' || ann.targetAudience === student.batchId
  );

  const handleReact = (annId: string, emoji: string) => {
    const all = StorageService.getAnnouncements();
    const updated = all.map(ann => {
      if (ann.id === annId) {
        const reactions = { ...(ann.reactions || { '👍': 0, '❤️': 0, '💡': 0, '🔥': 0, '🙌': 0 }) };
        const userReactions = { ...(ann.userReactions || {}) };

        const previousEmoji = userReactions[student.id];
        if (previousEmoji === emoji) {
          reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
          delete userReactions[student.id];
        } else {
          if (previousEmoji) {
            reactions[previousEmoji] = Math.max(0, (reactions[previousEmoji] || 1) - 1);
          }
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          userReactions[student.id] = emoji;
        }

        return { ...ann, reactions, userReactions };
      }
      return ann;
    });

    StorageService.saveAnnouncements(updated);
    setAnnouncements(StorageService.getAnnouncements());
  };

  useEffect(() => {
    const handleStorageUpdate = () => {
      setAnnouncements(StorageService.getAnnouncements());
    };
    window.addEventListener('apex_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('apex_storage_updated', handleStorageUpdate);
  }, []);

    // ===== REAL SYNCED CALENDAR =====
  const scheduledDays = studentBatch?.days || ['Mon', 'Wed', 'Fri'];

  // Month navigation state (so the calendar is navigable, not static)
  const today = new Date();
  const currentMonthName = today.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const [calCursor, setCalCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth()
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const displayedFirstDay = new Date(calCursor.year, calCursor.month, 1);
  const displayedMonthName = displayedFirstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const isViewingCurrentMonth =
    calCursor.year === today.getFullYear() && calCursor.month === today.getMonth();

  const goPrevMonth = () =>
    setCalCursor(c => {
      const m = c.month - 1;
      return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
    });
  const goNextMonth = () =>
    setCalCursor(c => {
      const m = c.month + 1;
      return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
    });

  // Build real events for the displayed month from the app's database
  const monthEvents = useMemo<Record<number, { type: string; label: string; detail: string }[]>>(() => {
    const events: Record<number, { type: string; label: string; detail: string }[]> = {};
    const add = (day: number, ev: { type: string; label: string; detail: string }) => {
      (events[day] ||= []).push(ev);
    };

    // 1) Monthly fee due on the 5th (only show if unpaid for the displayed month)
    const feeForDisplayedMonth = feeRecords.find(f => f.month === displayedMonthName);
    if (feeForDisplayedMonth && feeForDisplayedMonth.status !== 'paid') {
      add(5, {
        type: 'fee',
        label: 'Fee Due',
        detail: `₹${feeForDisplayedMonth.amount} pending for ${displayedMonthName}. Pay via UPI in the Fees panel.`
      });
    } else if (!feeForDisplayedMonth && displayedMonthName === currentMonthName) {
      add(5, {
        type: 'fee',
        label: 'Fee Due',
        detail: `₹${student.fees} monthly fee due on the 5th.`
      });
    }

    // 2) Test dates for the student's batch in the displayed month
    tests.forEach(t => {
      if (!t.date) return;
      const td = new Date(t.date);
      if (td.getFullYear() === calCursor.year && td.getMonth() === calCursor.month) {
        add(td.getDate(), {
          type: 'test',
          label: 'Test',
          detail: `${t.title} • ${t.totalMarks} marks`
        });
      }
    });

    // 3) Notes uploaded for the student's batch in the displayed month
    StorageService.getNotes()
      .filter(n => n.batchId === student.batchId)
      .forEach(n => {
        if (!n.createdAt) return;
        const nd = new Date(n.createdAt);
        if (nd.getFullYear() === calCursor.year && nd.getMonth() === calCursor.month) {
          add(nd.getDate(), {
            type: 'note',
            label: 'Notes',
            detail: `"${n.title}" uploaded (${n.subject})`
          });
        }
      });

    // 4) The student's own doubts asked / answered in the displayed month
    doubts.forEach(d => {
      if (d.createdAt) {
        const dd = new Date(d.createdAt.replace(' ', 'T'));
        if (dd.getFullYear() === calCursor.year && dd.getMonth() === calCursor.month) {
          add(dd.getDate(), {
            type: 'doubt',
            label: 'Doubt Asked',
            detail: d.question.length > 50 ? d.question.slice(0, 50) + '…' : d.question
          });
        }
      }
      if (d.answeredAt) {
        const ad = new Date(d.answeredAt.replace(' ', 'T'));
        if (ad.getFullYear() === calCursor.year && ad.getMonth() === calCursor.month) {
          add(ad.getDate(), {
            type: 'answered',
            label: 'Doubt Answered',
            detail: 'Faculty replied to your question.'
          });
        }
      }
    });

    return events;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calCursor, feeRecords, tests, doubts, student, displayedMonthName, currentMonthName]);

  // Calendar grid cells (with leading blanks for the first weekday)
  const calendarCells = useMemo(() => {
    const startWeekday = displayedFirstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(calCursor.year, calCursor.month + 1, 0).getDate();
    const cells: (null | {
      dayNum: number;
      dayName: string;
      isScheduledClass: boolean;
      isToday: boolean;
      hasEvents: boolean;
    })[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(calCursor.year, calCursor.month, d);
      const dayName = dateObj.toLocaleString('en-US', { weekday: 'short' });
      cells.push({
        dayNum: d,
        dayName,
        isScheduledClass: scheduledDays.includes(dayName),
        isToday:
          isViewingCurrentMonth && d === today.getDate(),
        hasEvents: !!monthEvents[d]
      });
    }
    return cells;
  }, [calCursor, scheduledDays, monthEvents, displayedFirstDay, isViewingCurrentMonth, today]);

  const selectedDayEvents = selectedDay ? monthEvents[selectedDay] || [] : [];

  // Event type → tailwind classes for the dot + the legend
  const eventStyle: Record<string, string> = {
    fee: 'bg-rose-500',
    test: 'bg-amber-500',
    note: 'bg-emerald-500',
    doubt: 'bg-indigo-500',
    answered: 'bg-purple-500'
  };
  const eventLegend: { type: string; label: string }[] = [
    { type: 'fee', label: 'Fee Due' },
    { type: 'test', label: 'Test' },
    { type: 'note', label: 'Notes' },
    { type: 'doubt', label: 'Doubt Asked' },
    { type: 'answered', label: 'Answered' }
  ];

  // Recent test score with auto-calculated rank
  const latestTest = tests[0];
  const myTestResult = latestTest?.results.find(r => r.studentId === student.id);

  return (
    <div className="space-y-6">
      {/* Welcome Banner matching Image 1 Student Dashboard */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 font-bold text-xs rounded-full border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Welcome back, {student.name}!
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              {student.className} • {student.batchTitle || 'Chemistry Regular Batch'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Timing: <span className="text-indigo-300 font-bold">{studentBatch?.time || '04:00 PM - 05:30 PM'}</span> • Student ID: <span className="font-mono text-indigo-200 font-bold">{student.id}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('doubts')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4" /> Ask Doubt
            </button>
            <button
              onClick={() => onNavigate('fees')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <IndianRupee className="w-4 h-4 text-indigo-400" /> Pay Fees
            </button>
          </div>
        </div>
      </div>

      {/* Announcements & Broadcasts Stream */}
      {studentAnnouncements.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-600" /> Institute Announcements & Notices
            </h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
              {studentAnnouncements.length} New
            </span>
          </div>

          <div className="space-y-4">
            {studentAnnouncements.map(ann => {
              const myReaction = ann.userReactions?.[student.id];
              return (
                <div key={ann.id} className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      ann.type === 'Tests' ? 'bg-amber-100 text-amber-800' : ann.type === 'Reminder' ? 'bg-orange-100 text-orange-800' : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {ann.type || 'Notice'}
                    </span>
                    <span className="text-[11px] text-slate-400">{ann.createdAt}</span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900">{ann.title}</h4>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{ann.message}</p>

                  {ann.imageUrl && (
                    <img src={ann.imageUrl} alt="Announcement attachment" className="rounded-2xl max-h-60 object-cover w-full border border-slate-200 shadow-sm" />
                  )}

                  {/* Emoji Reactions bar for students to interact with admin */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">React:</span>
                    {(['👍', '❤️', '💡', '🔥', '🙌'] as const).map(emoji => {
                      const count = ann.reactions?.[emoji] || 0;
                      const isSelected = myReaction === emoji;
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReact(ann.id, emoji)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{count > 0 ? count : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Calendar & Fee Overview */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* INTERACTIVE CALENDAR HIGHLIGHTING ADMIN SCHEDULED DAYS */}
                {/* REAL SYNCED CALENDAR — events pulled from the database */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" /> My Calendar
              </h3>
              <p className="text-xs text-slate-500">
                {displayedMonthName} • Click a day to see your events
              </p>
            </div>
            {/* Month navigation */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrevMonth}
                className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs transition-colors"
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="text-xs font-extrabold text-slate-800 min-w-[110px] text-center">
                {displayedMonthName}
              </span>
              <button
                onClick={goNextMonth}
                className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs transition-colors"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="font-bold text-slate-400 py-1 uppercase text-[10px]">
                {d}
              </div>
            ))}

            {calendarCells.map((cell, idx) =>
              cell === null ? (
                <div key={`blank-${idx}`} />
              ) : (
                <button
                  key={cell.dayNum}
                  onClick={() => setSelectedDay(cell.dayNum)}
                  className={`p-2 rounded-xl font-bold transition-all relative flex flex-col items-center justify-start gap-1 min-h-[52px] ${
                    selectedDay === cell.dayNum
                      ? 'ring-2 ring-indigo-400 bg-indigo-50'
                      : cell.isToday
                      ? 'bg-slate-900 text-white shadow-md'
                      : cell.hasEvents
                      ? 'bg-amber-50/60 border border-amber-200/60 hover:bg-amber-100/60'
                      : cell.isScheduledClass
                      ? 'bg-indigo-50/70 text-indigo-950 border border-indigo-200/60 hover:bg-indigo-100/70'
                      : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  <span className={cell.isToday && selectedDay !== cell.dayNum ? 'text-white' : ''}>
                    {cell.dayNum}
                  </span>

                  {/* Event dots */}
                  {cell.hasEvents && (
                    <div className="flex gap-0.5 flex-wrap justify-center">
                      {(monthEvents[cell.dayNum] || []).slice(0, 4).map((ev, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${eventStyle[ev.type] || 'bg-slate-400'}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Class-day badge */}
                  {cell.isScheduledClass && !cell.hasEvents && (
                    <span className="text-[8px] font-extrabold text-indigo-500 uppercase leading-none">
                      Class
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-100">
            {eventLegend.map(l => (
              <span key={l.type} className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <span className={`w-2.5 h-2.5 rounded-full ${eventStyle[l.type]}`} /> {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-200 border border-indigo-300" /> Class Day
            </span>
          </div>

          {/* Selected day's events */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2">
              {selectedDay ? `${displayedMonthName} ${selectedDay}` : 'Select a day'} —{' '}
              {selectedDayEvents.length} event{selectedDayEvents.length === 1 ? '' : 's'}
            </p>
            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-slate-400">No events on this day.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedDayEvents.map((ev, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${eventStyle[ev.type]}`} />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{ev.label}</p>
                      <p className="text-[11px] text-slate-500 leading-snug">{ev.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* FEE STATUS OVERVIEW GAUGE matching Image 1 Student Dashboard */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Fee Payment Status</h3>
            <span className="text-xs font-bold text-slate-500">{currentMonthName}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 py-2">
            {/* Progress Gauge */}
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-indigo-600"
                  strokeDasharray={`${Math.round((paidFeesAmount / (totalFeesAmount || 1)) * 100)}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-black text-slate-900">
                  {Math.round((paidFeesAmount / (totalFeesAmount || 1)) * 100)}%
                </span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase">Paid</span>
              </div>
            </div>

            <div className="space-y-2 flex-1 w-full text-xs">
              <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="font-semibold text-emerald-900">Paid Fees:</span>
                <span className="font-extrabold text-emerald-700">₹{paidFeesAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                <span className="font-semibold text-indigo-900">Due Fees:</span>
                <span className="font-extrabold text-indigo-700">₹{dueFeesAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('fees')}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            View Fee Ledger & Pay via UPI <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recent Test & Rank Card + Quick Access Tiles */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Test Performance & Auto Rank */}
        <div className="md:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-indigo-600" /> Recent Test & Class Rank
            </h3>
            <button onClick={() => onNavigate('tests')} className="text-xs font-bold text-indigo-600 hover:underline">
              View All
            </button>
          </div>

          {latestTest && myTestResult ? (
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30 uppercase">
                    Date: {latestTest.date}
                  </span>
                  <h4 className="text-base font-bold text-white mt-1">{latestTest.title}</h4>
                </div>

                <div className="text-right bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-md">
                  <span className="text-[10px] uppercase font-black block">Class Rank</span>
                  <span className="text-xl font-black font-mono">#{myTestResult.rank}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-300">
                <span>Score: <strong className="text-white font-mono">{myTestResult.marksObtained} / {latestTest.totalMarks}</strong></span>
                <span>Percentage: <strong className="text-indigo-300 font-mono">{Math.round((myTestResult.marksObtained / latestTest.totalMarks) * 100)}%</strong></span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">No tests published for your batch yet.</p>
          )}
        </div>

        {/* Quick Access Grid */}
        <div className="md:col-span-6 grid grid-cols-2 gap-3">
          <div
            onClick={() => onNavigate('notes')}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Class Notes</h4>
            <p className="text-[11px] text-slate-400">Download PDFs & handwritten PYQs</p>
          </div>

          <div
            onClick={() => onNavigate('doubts')}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Ask Doubts</h4>
            <p className="text-[11px] text-slate-400">{doubts.length} submitted doubts</p>
          </div>

          <div
            onClick={() => onNavigate('profile')}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">My Profile</h4>
            <p className="text-[11px] text-slate-400">View student credentials</p>
          </div>

          <div
            onClick={() => onNavigate('help')}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Faculty Help</h4>
            <p className="text-[11px] text-slate-400">Connect with Mr. Subhamoy Mondal</p>
          </div>
        </div>
      </div>
    </div>
  );
};
