// src/components/student/StudentFees.tsx
import React, { useState, useEffect } from 'react';
import { Student, FeeRecord } from '../../types';
import { StorageService } from '../../lib/storage';
import { PayFeesModal } from '../PayFeesModal';
import { CheckCircle2, Clock, AlertCircle, QrCode, Download } from 'lucide-react';
import { generateFeeReceiptPDF } from '../../lib/pdfGenerator';

interface StudentFeesProps {
  student: Student;
}

export const StudentFees: React.FC<StudentFeesProps> = ({ student }) => {
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() =>
    StorageService.getFeeRecords().filter(f => f.studentId === student.id)
  );

  const [selectedFeeForPay, setSelectedFeeForPay] = useState<FeeRecord | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const refreshFees = () => {
    setFeeRecords(StorageService.getFeeRecords().filter(f => f.studentId === student.id));
  };

  // FIX: Listen for storage updates so the student's fee table refreshes
  // instantly when the admin marks a payment as paid/declined on another
  // device (via Firestore sync). Without this, the student had to log out
  // and log back in to see status changes.
  useEffect(() => {
    window.addEventListener('apex_storage_updated', refreshFees);
    window.addEventListener('storage', refreshFees);
    return () => {
      window.removeEventListener('apex_storage_updated', refreshFees);
      window.removeEventListener('storage', refreshFees);
    };
  }, []);

  const handlePayClick = (record: FeeRecord) => {
    setSelectedFeeForPay(record);
    setIsPayModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Fee Payment Ledger</h2>
          <p className="text-sm text-slate-500">Track month-by-month fee payments and clear unpaid dues via UPI QR Code.</p>
        </div>
        <button
          onClick={() => generateFeeReceiptPDF(student, feeRecords)}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto hover:scale-[1.02]"
        >
          <Download className="w-4 h-4 text-amber-400" /> Download Fee Statement PDF
        </button>
      </div>

      {/* Month-by-month table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-4">Academic Month</th>
                <th className="p-4">Fee Amount</th>
                <th className="p-4">Payment Status</th>
                <th className="p-4">Paid Date / Ref</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {feeRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No fee records generated yet.
                  </td>
                </tr>
              ) : (
                feeRecords.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900 text-sm">{record.month}</td>
                    <td className="p-4 font-extrabold text-indigo-600 text-sm">₹{record.amount.toLocaleString()}</td>
                    <td className="p-4">
                      {record.status === 'paid' ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                        </span>
                      ) : record.status === 'pending_verification' ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full font-bold text-xs inline-flex items-center gap-1 animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Admin Verification
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-bold text-xs inline-flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Unpaid
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-500 text-xs">
                      {record.paidDate || record.transactionRef || '—'}
                    </td>
                    <td className="p-4 text-right">
                      {record.status === 'unpaid' ? (
                        <button
                          onClick={() => handlePayClick(record)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 ml-auto hover:scale-[1.02]"
                        >
                          <QrCode className="w-4 h-4" /> Pay Fees via UPI
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => generateFeeReceiptPDF(student, feeRecords, record)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 border border-indigo-200 shadow-sm"
                            title="Download PDF Receipt for this month"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-600" /> Receipt PDF
                          </button>
                          {record.status === 'pending_verification' && (
                            <button
                              onClick={() => handlePayClick(record)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                            >
                              View Payment
                            </button>
                          )}
                          {record.status === 'paid' && (
                            <span className="text-emerald-600 font-bold text-xs pl-1">✓ Cleared</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPI QR PAYMENT MODAL WITH 2 MINUTE TIMER & EXACT AMOUNT DISPLAY */}
      <PayFeesModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        feeRecord={selectedFeeForPay}
        onSuccess={refreshFees}
      />
    </div>
  );
};
