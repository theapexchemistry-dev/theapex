import React, { useState } from 'react';
import { StorageService } from '../../lib/storage';
import { Batch } from '../../types';
import { Layers, Plus, Calendar, Clock, Trash2, Users, Edit2, TrendingUp } from 'lucide-react';

interface AdminBatchesProps {
  isModerator?: boolean;
}

export const AdminBatches: React.FC<AdminBatchesProps> = ({ isModerator = false }) => {
  const [batches, setBatches] = useState<Batch[]>(() => StorageService.getBatches());
  const students = StorageService.getStudents();

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [className, setClassName] = useState('Class 11');
  const [time, setTime] = useState('04:00 PM - 05:30 PM');
  const [fees, setFees] = useState(2500);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const refreshData = () => {
    setBatches(StorageService.getBatches());
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleEditBatch = (batch: Batch) => {
    setEditingBatchId(batch.id);
    setTitle(batch.title);
    setClassName(batch.className);
    setTime(batch.time);
    setFees(batch.fees);
    setSelectedDays(batch.days);
  };

  const handlePromoteBatch = (batch: Batch) => {
    let nextClass = batch.className;
    if (batch.className.includes('9')) nextClass = 'Class 10';
    else if (batch.className.includes('10')) nextClass = 'Class 11';
    else if (batch.className.includes('11')) nextClass = 'Class 12';
    else if (batch.className.includes('12')) nextClass = 'Repeater';
    else return;

    const newTitle = batch.title.replace(batch.className, nextClass);

    StorageService.updateBatch(batch.id, {
      className: nextClass,
      title: newTitle !== batch.title ? newTitle : `${nextClass} - ${batch.title}`
    });

    const allStudents = StorageService.getStudents();
    const updatedStudents = allStudents.map(s => {
      if (s.batchId === batch.id) {
        return { ...s, className: nextClass };
      }
      return s;
    });
    StorageService.saveStudents(updatedStudents);
    refreshData();
  };

  const cancelEdit = () => {
    setEditingBatchId(null);
    setTitle('');
    setClassName('Class 11');
    setTime('04:00 PM - 05:30 PM');
    setFees(2500);
    setSelectedDays(['Mon', 'Wed', 'Fri']);
  };

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedDays.length === 0) return;

    if (editingBatchId) {
      StorageService.updateBatch(editingBatchId, {
        title,
        className,
        time,
        days: selectedDays,
        fees: Number(fees)
      });
      cancelEdit();
    } else {
      StorageService.addBatch({
        title,
        className,
        time,
        days: selectedDays,
        fees: Number(fees)
      });
      setTitle('');
    }

    refreshData();
  };

  const handleDeleteBatch = (id: string) => {
    StorageService.deleteBatch(id);
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Batch Management</h2>
        <p className="text-sm text-slate-500">Create class batches and schedule weekly class days for the student calendar.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Create Batch Form */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Plus className="w-5 h-5 text-indigo-600" /> Create New Batch
          </h3>

          <form onSubmit={handleCreateBatch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Class 11 Organic Mastery JEE 2026"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class Level</label>
                <select
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="Class 9">Class 9</option>
                  <option value="Class 10">Class 10</option>
                  <option value="Class 11">Class 11</option>
                  <option value="Class 12">Class 12</option>
                </select>
              </div>

              {!isModerator && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Fees (₹)</label>
                  <input
                    type="number"
                    required
                    value={fees}
                    onChange={e => setFees(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class Timing *</label>
              <input
                type="text"
                required
                placeholder="e.g. 05:00 PM - 06:30 PM"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            {/* Select Days in a Week */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Class Days in a Week (Highlights on Student Calendar) *
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {weekDays.map(day => {
                  const active = selectedDays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        active
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              {editingBatchId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-xl transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
              >
                {editingBatchId ? 'Update Batch' : 'Save & Schedule Batch'}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Batches List */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Active Batches ({batches.length})</h3>

          <div className="grid gap-4">
            {batches.map(b => {
              const studentCount = students.filter(s => s.batchId === b.id).length;
              return (
                <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">
                        {b.className}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-1">{b.title}</h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePromoteBatch(b)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-lg text-xs transition-colors flex items-center gap-1 border border-indigo-200"
                        title="Promote batch to next class"
                      >
                        <TrendingUp className="w-3.5 h-3.5" /> Promote
                      </button>
                      <button
                        onClick={() => handleEditBatch(b)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Edit Batch"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(b.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {b.time}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" /> {studentCount} Enrolled
                    </div>
                    {!isModerator && <div className="font-bold text-indigo-600">₹{b.fees.toLocaleString()} / mo</div>}
                  </div>

                  {/* Scheduled Days Badges */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">Schedule:</span>
                    <div className="flex gap-1">
                      {b.days.map(d => (
                        <span key={d} className="px-2 py-0.5 bg-slate-900 text-indigo-300 font-bold text-[10px] rounded-md">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
