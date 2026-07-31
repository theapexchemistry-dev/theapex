import { googleSignIn } from '../../lib/auth';
import React, { useState } from 'react';
import { StorageService } from '../../lib/storage';
import { runMonthlyFeeReminderTask } from '../../lib/scheduledTasks';
import { Student, Batch, FeeRecord } from '../../types';
import { ChunkedImage } from '../ChunkedImage';
import {
  Search,
  Bell,
  CheckCircle2,
  Clock,
  MessageCircle,
  Calendar,
  Send,
  IndianRupee,
  Eye,
  XCircle
} from 'lucide-react';

export const AdminFees: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(() => StorageService.getStudents());
  const [batches] = useState<Batch[]>(() => StorageService.getBatches());
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() => StorageService.getFeeRecords());

  // Search filter options
  const [filterType, setFilterType] = useState<'ALL' | 'BATCH' | 'STUDENT'>('ALL');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSentMessage, setReminderSentMessage] = useState('');
  
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);
  const [selectedModalRecord, setSelectedModalRecord] = useState<FeeRecord | null>(null);
  const [selectedModalStudent, setSelectedModalStudent] = useState<Student | null>(null);

  const openScreenshotModal = (record: FeeRecord, student: Student) => {
    setSelectedModalRecord(record);
    setSelectedModalStudent(student);
    setScreenshotModalOpen(true);
  };

  const refreshData = () => {
    setStudents(StorageService.getStudents());
    setFeeRecords(StorageService.getFeeRecords());
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    if (filterType === 'BATCH' && selectedBatchId && student.batchId !== selectedBatchId) return false;
    if (filterType === 'STUDENT' && selectedStudentId && student.id !== selectedStudentId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return student.name.toLowerCase().includes(q) || student.id.toLowerCase().includes(q) || student.phone.includes(q);
    }
    return true;
  });

  // Handle personal Fee Reminder
  const handleSendReminder = (student: Student, dueAmount: number) => {
    const formattedPhone = student.phone.replace(/[^0-9]/g, '');
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const msg = `🚨 *Fee Payment Reminder - The Apex Chemistry*
Dear ${student.name},
This is a gentle reminder regarding your pending tuition fee of *₹${dueAmount}* for the month of *${currentMonth}*.

Please login to your student portal to complete payment via UPI QR Code or contact Mr. Subhamoy Mondal.
Portal Link: ${window.location.origin}

Thank you,
The Apex Chemistry`;

    const url = `https://wa.me/91${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    // Notify student on portal
    StorageService.addNotification({
      title: 'Fee Payment Reminder',
      message: `Gentle reminder: Please visit your Fees panel at ${window.location.origin} to clear your pending fee of ₹${dueAmount}.`,
      type: 'fee_reminder',
      timestamp: 'Just now',
      targetRole: 'student',
      targetStudentId: student.id,
      read: false
    });

    setReminderSentMessage(`Reminder sent to ${student.name}!`);
    setTimeout(() => setReminderSentMessage(''), 3000);
  };

  // Mark a student's current-month fee as paid manually (cash payment)
  const handleMarkPaidManually = (student: Student) => {
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Find the current month's fee record (or create one if none exists)
    let record = feeRecords.find(
      f => f.studentId === student.id && f.month === currentMonth
    );

    if (!record) {
      // No fee record exists yet — create one and mark it paid
      record = StorageService.addFeeRecord({
        studentId: student.id,
        studentName: student.name,
        batchId: student.batchId,
        month: currentMonth,
        amount: student.fees,
        status: 'unpaid'
      });
    }

    // Mark as paid with a cash transaction reference
    StorageService.updateFeeStatus(record.id, 'paid', 'CASH_MANUAL', undefined);

    // Notify the student
    StorageService.addNotification({
      title: `Fee Received - ${currentMonth}`,
      message: `Your fee of ₹${student.fees} for ${currentMonth} has been marked as paid by cash. Thank you!`,
      type: 'payment_received',
      timestamp: 'Just now',
      targetRole: 'student',
      targetStudentId: student.id,
      read: false
    });

    refreshData();
    setReminderSentMessage(`✓ ${student.name}'s fee for ${currentMonth} marked as PAID (Cash).`);
    setTimeout(() => setReminderSentMessage(''), 4000);
  };
  
    // Trigger 5th of Month Automated Batch Fee Reminders
  // → sends in-app notifications AND emails to registered students
  const handleTriggerMonthlyAutoReminders = async () => {
    setReminderLoading(true);
    setReminderSentMessage('');
    try {
      // Ensure the admin is signed into Google so we can send emails via Gmail.
      // If the popup is cancelled, we still send in-app notifications.
      try {
        await googleSignIn();
      } catch (e: any) {
        console.warn('Google sign-in skipped/failed — emails will be skipped:', e);
      }

      const result = await runMonthlyFeeReminderTask(true);
      refreshData();
      setReminderSentMessage(result.message);
      setTimeout(() => setReminderSentMessage(''), 8000);
    } catch (err: any) {
      console.error('Monthly reminder trigger failed:', err);
      setReminderSentMessage('Failed to trigger reminders: ' + (err?.message || 'Unknown error'));
      setTimeout(() => setReminderSentMessage(''), 8000);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleVerifyPayment = (recordId: string, status: 'paid' | 'unpaid') => {
    StorageService.updateFeeStatus(recordId, status);
    if (status === 'unpaid') {
      // Add notification for the student that their payment was declined
      const record = feeRecords.find(r => r.id === recordId);
      if (record) {
        StorageService.addNotification({
          title: 'Fee Payment Declined',
          message: `Your payment proof for ${record.month} was declined by Admin. Please retry.`,
          type: 'fee_reminder',
          timestamp: 'Just now',
          targetRole: 'student',
          targetStudentId: record.studentId,
          read: false
        });
      }
    }
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Fee Management & Reminders</h2>
          <p className="text-sm text-slate-500">Track student payment history, verify UPI receipts, and dispatch fee alerts.</p>
        </div>

        {/* 5th of Month Auto Reminder Banner Button */}
        <button
          onClick={handleTriggerMonthlyAutoReminders}
          disabled={reminderLoading}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          {reminderLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          {reminderLoading ? 'Sending Reminders...' : 'Trigger 5th-Day Monthly Fee Reminder'}
        </button>
      </div>

      {reminderSentMessage && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-xl animate-in fade-in">
          ✓ {reminderSentMessage}
        </div>
      )}

      {/* SEARCH PANEL WITH DROPDOWNS FOR BATCH OR STUDENT */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Search & Filter Fee Ledger</h3>

        <div className="grid md:grid-cols-12 gap-3">
          {/* Dropdown 1: Filter Mode */}
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search Mode</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="w-full text-xs px-3 py-2.5 sm:py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="ALL">All Students</option>
              <option value="BATCH">Filter by Batch Dropdown</option>
              <option value="STUDENT">Filter by Specific Student</option>
            </select>
          </div>

          {/* Conditional Dropdown 2: Batch Select */}
          {filterType === 'BATCH' && (
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Select Batch</label>
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="w-full text-xs px-3 py-2.5 sm:py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="">-- Choose Batch --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.className})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional Dropdown 3: Student Select */}
          {filterType === 'STUDENT' && (
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Select Student</label>
              <select
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full text-xs px-3 py-2.5 sm:py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="">-- Choose Student --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Query Input */}
          <div className="md:col-span-5 relative">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Name, Student ID, or Phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Student Fee Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-3.5">Student Details</th>
                <th className="p-3.5">Batch</th>
                <th className="p-3.5">Monthly Fee</th>
                <th className="p-3.5">Payment History</th>
                <th className="p-3.5">Verification</th>
                <th className="p-3.5 text-right">Personal Fee Reminder</th>
                <th className="p-3.5 text-right">Fee Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStudents.map(student => {
                const sRecords = feeRecords.filter(f => f.studentId === student.id);
                const pendingRecords = sRecords.filter(f => f.status === 'unpaid' || f.status === 'pending_verification');
                const totalDue = pendingRecords.reduce((acc, f) => acc + f.amount, 0);

                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900">{student.name}</p>
                      <p className="text-[11px] font-mono text-amber-600 font-semibold">{student.id}</p>
                      <p className="text-[11px] text-slate-400">{student.phone}</p>
                    </td>

                    <td className="p-3.5">
                      <p className="font-semibold text-slate-800">{student.className}</p>
                      <p className="text-[11px] text-slate-500">{student.batchTitle}</p>
                    </td>

                    <td className="p-3.5 font-extrabold text-slate-900">₹{student.fees.toLocaleString()} / mo</td>

                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {sRecords.map(r => (
                          <div
                            key={r.id}
                            title={`${r.month}: ${r.status}`}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded-lg border ${
                              r.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : r.status === 'pending_verification'
                                ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            <span>
                              {r.month.split(' ')[0]}: {r.status === 'paid' ? 'Paid' : r.status === 'pending_verification' ? 'Pending' : 'Unpaid'}
                            </span>
                            {r.screenshotUrl && (
                              <button
                                onClick={() => openScreenshotModal(r, student)}
                                className="p-0.5 hover:bg-black/10 rounded transition-colors text-indigo-700 flex items-center gap-0.5"
                                title="View uploaded screenshot"
                              >
                                <Eye className="w-3 h-3 text-indigo-600" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5">
                      {sRecords.some(r => r.status === 'pending_verification') ? (
                        <div className="space-y-2">
                          {sRecords.filter(r => r.status === 'pending_verification').map(p => (
                            <div key={p.id} className="p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-extrabold text-amber-900">{p.month} (₹{p.amount})</span>
                                <span className="text-[9px] font-mono text-amber-700 bg-amber-200/80 px-1.5 py-0.5 rounded">
                                  {p.transactionRef || 'Pending'}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {p.screenshotUrl && (
                                  <button
                                    onClick={() => openScreenshotModal(p, student)}
                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                    title="View Uploaded Payment Receipt"
                                  >
                                    <Eye className="w-3 h-3" /> View Screenshot
                                  </button>
                                )}
                                <button
                                  onClick={() => handleVerifyPayment(p.id, 'paid')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Approve
                                </button>
                                <button
                                  onClick={() => handleVerifyPayment(p.id, 'unpaid')}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                  title="Decline Payment"
                                >
                                  <XCircle className="w-3 h-3" /> Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>
                          {totalDue === 0 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Up to Date
                            </span>
                          ) : (
                            <span className="text-red-600 font-bold">₹{totalDue.toLocaleString()} Due</span>
                          )}

                          {/* Quick links for any uploaded screenshots in history */}
                          {sRecords.some(r => r.screenshotUrl) && (
                            <div className="mt-1.5">
                              <span className="text-[10px] text-slate-400 font-medium block mb-0.5">Uploaded Receipts:</span>
                              <div className="flex flex-wrap gap-1">
                                {sRecords.filter(r => r.screenshotUrl).map(sr => (
                                  <button
                                    key={sr.id}
                                    onClick={() => openScreenshotModal(sr, student)}
                                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[10px] rounded-md transition-colors inline-flex items-center gap-1"
                                    title={`View ${sr.month} receipt`}
                                  >
                                    <Eye className="w-2.5 h-2.5" /> {sr.month.split(' ')[0]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      {totalDue > 0 ? (
                        <button
                          onClick={() => handleSendReminder(student, totalDue)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 ml-auto"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Send Reminder
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">No Due</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
                    <td className="p-3.5 text-right">
                      <div className="flex flex-col gap-1.5 items-end">
                        {/* Always-visible: Mark Paid Manually (Cash) */}
                        <button
                          onClick={() => handleMarkPaidManually(student)}
                          title="Mark this month's fee as paid via cash"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid (Cash)
                        </button>

                        {/* Conditional: Send WhatsApp reminder (only when due) */}
                        {totalDue > 0 && (
                          <button
                            onClick={() => handleSendReminder(student, totalDue)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Send Reminder
                          </button>
                        )}
                      </div>
                    </td>
      {/* Screenshot Viewer Modal */}
      {screenshotModalOpen && selectedModalRecord && selectedModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 border border-slate-200 relative max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" /> Payment Proof Screenshot
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Student: <strong className="text-slate-800">{selectedModalStudent.name}</strong> ({selectedModalStudent.id}) • Month: <strong className="text-slate-800">{selectedModalRecord.month}</strong> (₹{selectedModalRecord.amount})
                </p>
              </div>
              <button
                onClick={() => {
                  setScreenshotModalOpen(false);
                  setSelectedModalRecord(null);
                  setSelectedModalStudent(null);
                }}
                className="w-8 h-8 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto rounded-2xl bg-slate-950 p-2 flex items-center justify-center min-h-[300px]">
              {selectedModalRecord.screenshotUrl ? (
                selectedModalRecord.screenshotUrl.startsWith('chunked:') ? (
                  <ChunkedImage fileId={selectedModalRecord.screenshotUrl.split(':')[1]} className="max-w-full max-h-[60vh] object-contain rounded-xl" alt="Payment Receipt" />
                ) : (
                  <img src={selectedModalRecord.screenshotUrl} alt="Payment Receipt" className="max-w-full max-h-[60vh] object-contain rounded-xl" />
                )
              ) : (
                <p className="text-slate-400 font-medium text-sm">No screenshot uploaded for this transaction.</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Txn Ref:</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                  {selectedModalRecord.transactionRef || 'N/A'}
                </span>
                <span className={`px-2 py-0.5 font-bold rounded text-[10px] ${
                  selectedModalRecord.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                  selectedModalRecord.status === 'pending_verification' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedModalRecord.status === 'paid' ? 'Paid / Approved' : selectedModalRecord.status === 'pending_verification' ? 'Pending Approval' : 'Unpaid'}
                </span>
              </div>

              {selectedModalRecord.status === 'pending_verification' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleVerifyPayment(selectedModalRecord.id, 'paid');
                      setScreenshotModalOpen(false);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Payment
                  </button>
                  <button
                    onClick={() => {
                      handleVerifyPayment(selectedModalRecord.id, 'unpaid');
                      setScreenshotModalOpen(false);
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <XCircle className="w-4 h-4" /> Decline
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
