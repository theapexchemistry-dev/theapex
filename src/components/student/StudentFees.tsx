// src/components/student/StudentFees.tsx
import React, { useState, useEffect } from 'react';
import { Student, FeeRecord } from '../../types';
import { StorageService } from '../../lib/storage';
import { PayFeesModal } from '../PayFeesModal';
import { IndianRupee, CheckCircle2, Clock, AlertCircle, QrCode, Download, FileText } from 'lucide-react';
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Fee Payment Ledger</h2>
          <p className="text-sm text-s
