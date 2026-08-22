import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { fetchDataFromFirestore } from '../../lib/firebaseSync';
import { Student, Batch } from '../../types';
import { ShareCredentialsModal } from '../ShareCredentialsModal';
import { autoDispatchCredentials, DispatchNotificationResult } from '../../lib/notificationService';
import {
  UserPlus,
  Search,
  Plus,
  Trash2,
  Phone,
  Layers,
  Share2,
  Check,
  X,
  Edit2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
  Mail
} from 'lucide-react';

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(() => StorageService.getStudents());
  const [batches, setBatches] = useState<Batch[]>(() => StorageService.getBatches());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [activeStudentTab, setActiveStudentTab] = useState<'all' | 'pending'>('all');

  // Create Student Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('Class 11');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentFees, setStudentFees] = useState(2500);

  // Batch search inside student modal
  const [batchSearchInModal, setBatchSearchInModal] = useState('');

  // Inline "Create Batch" state right inside the Student creation modal!
  const [showInlineBatchCreate, setShowInlineBatchCreate] = useState(false);
  const [inlineBatchTitle, setInlineBatchTitle] = useState('');
  const [inlineBatchTime, setInlineBatchTime] = useState('04:00 PM - 05:30 PM');
  const [inlineBatchDays, setInlineBatchDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [inlineBatchFees, setInlineBatchFees] = useState(2500);

  // Created student credential share modal state
  const [createdStudentForShare, setCreatedStudentForShare] = useState<Student | null>(null);
  const [autoSentStatus, setAutoSentStatus] = useState<DispatchNotificationResult | undefined>(undefined);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [approvingStudentId, setApprovingStudentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refreshData = () => {
    setStudents(StorageService.getStudents());
    setBatches(StorageService.getBatches());
  };

  useEffect(() => {
    const handleUpdate = () => {
      refreshData();
    };
    window.addEventListener('apex_storage_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('apex_storage_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchDataFromFirestore();
      refreshData();
    } catch (e) {
      console.error('Failed to sync students from cloud:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter batches in modal
  const filteredBatchesInModal = batches.filter(
    b =>
      b.title.toLowerCase().includes(batchSearchInModal.toLowerCase()) ||
      b.className.toLowerCase().includes(batchSearchInModal.toLowerCase())
  );

  // Handle inline batch creation
  const handleCreateInlineBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineBatchTitle.trim()) return;

    const newBatch = StorageService.addBatch({
      title: inlineBatchTitle,
      className: studentClass,
      time: inlineBatchTime,
      days: inlineBatchDays,
      fees: inlineBatchFees
    });

    refreshData();
    setSelectedBatchId(newBatch.id);
    setStudentFees(newBatch.fees);
    setShowInlineBatchCreate(false);
    setInlineBatchTitle('');
  };

  // Handle Create Student submission
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !selectedBatchId) return;

    if (editingStudentId) {
      const selectedBatch = batches.find(b => b.id === selectedBatchId);
      const isActivating = selectedBatchId && selectedBatchId !== 'PENDING_BATCH';

      const updateData: Partial<Student> = {
        name: studentName,
        className: studentClass,
        batchId: selectedBatchId,
        batchTitle: selectedBatch ? selectedBatch.title : undefined,
        phone: studentPhone || '9876543210',
        email: studentEmail.trim() || undefined,
        fees: Number(studentFees)
      };

      // If they were assigned a real batch, mark them active
      if (isActivating) {
        updateData.status = 'active';
      }

      StorageService.updateStudent(editingStudentId, updateData);
      refreshData();
      setIsCreateModalOpen(false);

      const targetStudent = StorageService.getStudents().find(s => s.id === editingStudentId);
      setEditingStudentId(null);
      // Reset Form
      setStudentName('');
      setStudentPhone('');
      setStudentEmail('');

      // If this was an approval of a student, trigger auto dispatch to WhatsApp and Email!
      if (targetStudent && isActivating) {
        setCreatedStudentForShare(targetStudent);
        setIsShareModalOpen(true);
        const autoResult = await autoDispatchCredentials(targetStudent, {
          batchTitle: selectedBatch ? selectedBatch.title : targetStudent.batchTitle
        });
        setAutoSentStatus(autoResult);
        setToastMessage(`Credentials automatically sent to ${targetStudent.name} on WhatsApp & Email!`);
        setTimeout(() => setToastMessage(null), 5000);
      }
      return;
    }

    const newStudent = StorageService.addStudent({
      name: studentName,
      className: studentClass,
      batchId: selectedBatchId,
      phone: studentPhone || '9876543210',
      email: studentEmail.trim() || undefined,
      fees: Number(studentFees),
      status: 'active'
    });

    refreshData();
    setIsCreateModalOpen(false);

    // Reset Form
    setStudentName('');
    setStudentPhone('');
    setStudentEmail('');

    // Open Share Modal & Auto-Dispatch
    setCreatedStudentForShare(newStudent);
    setIsShareModalOpen(true);
    const autoResult = await autoDispatchCredentials(newStudent, {
      batchTitle: batches.find(b => b.id === selectedBatchId)?.title || newStudent.batchTitle
    });
    setAutoSentStatus(autoResult);
    setToastMessage(`Account created & credentials automatically sent to ${newStudent.name}!`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // 1-Click Quick Accept / Batch Approval
  const handleQuickApprove = async (student: Student, batchId?: string) => {
    setApprovingStudentId(student.id);
    try {
      const targetBatchId = batchId || (batches.length > 0 ? batches[0].id : 'BATCH_DEFAULT');
      const targetBatch = batches.find(b => b.id === targetBatchId);
      const assignedFees = targetBatch ? targetBatch.fees : (student.fees > 0 ? student.fees : 2500);

      StorageService.updateStudent(student.id, {
        batchId: targetBatchId,
        batchTitle: targetBatch ? targetBatch.title : 'Chemistry Batch',
        fees: assignedFees,
        status: 'active'
      });

      refreshData();

      const updatedStudent = StorageService.getStudents().find(s => s.id === student.id) || {
        ...student,
        batchId: targetBatchId,
        batchTitle: targetBatch ? targetBatch.title : 'Chemistry Batch',
        fees: assignedFees,
        status: 'active' as const
      };

      setCreatedStudentForShare(updatedStudent);
      setIsShareModalOpen(true);

      const res = await autoDispatchCredentials(updatedStudent, {
        batchTitle: targetBatch ? targetBatch.title : updatedStudent.batchTitle
      });
      setAutoSentStatus(res);
      setToastMessage(`✓ ${student.name} approved! Credentials dispatched to WhatsApp (+91 ${student.phone}) and Email.`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Quick approve failed:', err);
    } finally {
      setApprovingStudentId(null);
    }
  };

  const openEditModal = (student: Student) => {
    setEditingStudentId(student.id);
    setStudentName(student.name);
    setStudentClass(student.className);
    
    // If pending, default to the first real batch if available
    let bId = student.batchId;
    if (bId === 'PENDING_BATCH' && batches.length > 0) {
      bId = batches[0].id;
      setStudentFees(batches[0].fees);
    } else {
      setStudentFees(student.fees);
    }
    
    setSelectedBatchId(bId);
    setStudentPhone(student.phone);
    setStudentEmail(student.email || '');
    setIsCreateModalOpen(true);
  };

  const handleDeleteStudent = (id: string) => {
    StorageService.deleteStudent(id);
    refreshData();
  };

  // Pending count
  const pendingCount = students.filter(s => s.status === 'pending' || s.batchId === 'PENDING_BATCH').length;

  // Main list filters
  const filteredStudents = students.filter(s => {
    const isPending = s.status === 'pending' || s.batchId === 'PENDING_BATCH';
    const matchesTab = activeStudentTab === 'all' || (activeStudentTab === 'pending' && isPending);
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm);
    const matchesBatch = selectedBatchFilter === 'ALL' || s.batchId === selectedBatchFilter;
    return matchesTab && matchesSearch && matchesBatch;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white border border-emerald-500/50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs font-semibold leading-snug">
            {toastMessage}
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Student Directory</h2>
          <p className="text-sm text-slate-500">Manage student accounts, enrollment, and credential distribution.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
            title="Fetch latest student registrations from Cloud Firestore"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Sync Cloud'}
          </button>
          <button
            onClick={() => {
              setIsCreateModalOpen(true);
              if (batches.length > 0 && !selectedBatchId) {
                setSelectedBatchId(batches[0].id);
                setStudentFees(batches[0].fees);
              }
            }}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5 stroke-[2.5]" /> Register New Student
          </button>
        </div>
      </div>

      {/* Tabs for All vs Pending Batch Assignment */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveStudentTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeStudentTab === 'all'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Students ({students.length})
        </button>
        <button
          onClick={() => setActiveStudentTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeStudentTab === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <span>Pending Batch Assignment</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-mono">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search student by name, ID, or phone number..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="w-full md:w-64 mt-3 sm:mt-0">
          <select
            value={selectedBatchFilter}
            onChange={e => setSelectedBatchFilter(e.target.value)}
            className="w-full py-2.5 sm:py-2 px-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="ALL">All Batches ({students.length} students)</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.className})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-3.5">Student ID & Name</th>
                <th className="p-3.5">Class & Batch</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">Monthly Fee</th>
                <th className="p-3.5">Joining Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-indigo-400 flex items-center justify-center font-black text-xs">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900">{student.name}</span>
                          <span className="block text-[11px] font-mono text-indigo-600 font-bold">{student.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{student.className}</span>
                        {student.status === 'pending' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">Pending</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{student.batchTitle}</p>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {student.phone}
                      </div>
                    </td>
                    <td className="p-3.5 font-extrabold text-indigo-600">₹{student.fees.toLocaleString()}</td>
                    <td className="p-3.5 text-slate-500 font-mono">
                      <div className="flex items-center gap-2">
                        <span>{student.joiningDate}</span>
                        {(student.status === 'pending' || student.batchId === 'PENDING_BATCH') && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleQuickApprove(student)}
                              disabled={approvingStudentId === student.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-[10px] tracking-wider uppercase shadow-sm transition-all flex items-center gap-1 disabled:opacity-60"
                              title="Accept and automatically send credentials to student's WhatsApp and Email"
                            >
                              {approvingStudentId === student.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Accepting...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Accept & Send</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => openEditModal(student)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[10px] tracking-wider uppercase shadow-sm transition-all"
                              title="Assign custom batch before approval"
                            >
                              Edit Batch
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setCreatedStudentForShare(student);
                          setIsShareModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold rounded-lg transition-colors flex items-center gap-1 inline-flex"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share ID
                      </button>
                      <button
                        onClick={() => openEditModal(student)}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors inline-block"
                        title="Edit Student"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors inline-block"
                        title="Delete Student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STUDENT MODAL with search batch & inline batch creation! */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-amber-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingStudentId(null);
                setStudentName('');
                setStudentPhone('');
                setStudentEmail('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-900">{editingStudentId ? 'Edit Student' : 'Create New Student'}</h3>
              <p className="text-xs text-slate-500">{editingStudentId ? 'Update student details.' : 'Fill student details. ID & Password will be auto-generated.'}</p>
            </div>

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Kumar"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class</label>
                  <select
                    value={studentClass}
                    onChange={e => setStudentClass(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={studentPhone}
                    onChange={e => setStudentPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional, for Calendar Sync)</label>
                  <input
                    type="email"
                    placeholder="e.g. student@example.com"
                    value={studentEmail}
                    onChange={e => setStudentEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* BATCH SELECTION with SEARCH & INLINE CREATE BATCH FEATURE */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">Select Batch *</label>
                  <button
                    type="button"
                    onClick={() => setShowInlineBatchCreate(!showInlineBatchCreate)}
                    className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Batch not available? Create a Batch
                  </button>
                </div>

                {/* Inline Batch Creation Form */}
                {showInlineBatchCreate ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-3 mb-2 animate-in fade-in">
                    <h4 className="text-xs font-bold text-amber-900">Create New Batch in Place</h4>
                    <input
                      type="text"
                      placeholder="Batch Title e.g. Class 11 Organic JEE"
                      value={inlineBatchTitle}
                      onChange={e => setInlineBatchTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-xl outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Timing e.g. 05:00 PM - 06:30 PM"
                        value={inlineBatchTime}
                        onChange={e => setInlineBatchTime(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg"
                      />
                      <input
                        type="number"
                        placeholder="Monthly Fee ₹"
                        value={inlineBatchFees}
                        onChange={e => setInlineBatchFees(Number(e.target.value))}
                        className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInlineBatchCreate(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateInlineBatch}
                        className="px-3 py-1 text-xs font-bold bg-amber-500 text-slate-950 rounded-lg shadow-sm"
                      >
                        Save & Select Batch
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Batch Search Box */}
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search batch by name or class..."
                        value={batchSearchInModal}
                        onChange={e => setBatchSearchInModal(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>

                    <select
                      required
                      value={selectedBatchId}
                      onChange={e => {
                        setSelectedBatchId(e.target.value);
                        const b = batches.find(x => x.id === e.target.value);
                        if (b) setStudentFees(b.fees);
                      }}
                      className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      {filteredBatchesInModal.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.className}) • ₹{b.fees}/mo
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Fees Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={studentFees}
                  onChange={e => setStudentFees(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
              >
                {editingStudentId ? 'Update Student Details' : 'Generate Student ID & Save'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREDENTIAL SHARE MODAL */}
      <ShareCredentialsModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setAutoSentStatus(undefined);
        }}
        student={createdStudentForShare}
        autoSentStatus={autoSentStatus}
      />
    </div>
  );
};
