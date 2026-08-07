import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { Doubt, Batch } from '../../types';
import { HelpCircle, CheckCircle2, Clock, MessageSquare, Send, Image as ImageIcon, Eye, XCircle, Bot, AlertTriangle } from 'lucide-react';
import { ChunkedImage } from '../ChunkedImage';

export const AdminDoubts: React.FC = () => {
  const [batches] = useState<Batch[]>(() => StorageService.getBatches());
  const [doubts, setDoubts] = useState<Doubt[]>(() => StorageService.getDoubts());

  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');
  // ─── PATCH A: filterStatus type extended with AI_ANSWERED + ESCALATED ───
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ANSWERED' | 'AI_ANSWERED' | 'ESCALATED'>('ALL');
  // ─── /PATCH A ──────────────────────────────────────────────────────────

  const [activeDoubt, setActiveDoubt] = useState<Doubt | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  const refreshDoubts = () => {
    setDoubts(StorageService.getDoubts());
  };

  useEffect(() => {
    const handleUpdate = () => refreshDoubts();
    window.addEventListener('apex_storage_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('apex_storage_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoubt || !answerText.trim()) return;

    StorageService.answerDoubt(activeDoubt.id, answerText);
    refreshDoubts();
    setActiveDoubt(null);
    setAnswerText('');
  };

  const handleDeleteDoubt = () => {
    if (!activeDoubt) return;
    StorageService.deleteDoubt(activeDoubt.id);
    refreshDoubts();
    setActiveDoubt(null);
    setAnswerText('');
  };

  // ─── PATCH B: filter matcher extended with AI_ANSWERED + ESCALATED ──────
  const filteredDoubts = doubts.filter(d => {
    const matchesBatch = selectedBatchId === 'ALL' || d.batchId === selectedBatchId;
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'PENDING' && d.status === 'pending') ||
      (filterStatus === 'ANSWERED' && d.status === 'answered') ||
      (filterStatus === 'AI_ANSWERED' && d.status === 'ai_answered') ||
      (filterStatus === 'ESCALATED' && d.status === 'escalated');
    return matchesBatch && matchesStatus;
  });
  // ─── /PATCH B ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Student Doubts Portal</h2>
          <p className="text-sm text-slate-500">Review chemistry questions and image attachments submitted by students.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {/* BATCH SELECTOR DROPDOWN */}
          <select
            value={selectedBatchId}
            onChange={e => setSelectedBatchId(e.target.value)}
            className="w-full sm:w-auto text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="ALL">All Batches Dropdown</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.className})
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="w-full sm:w-auto text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-600"
          >
            {/* ─── PATCH C: extra filter options for AI + Escalated ─── */}
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Only</option>
            <option value="AI_ANSWERED">AI Answered (needs review)</option>
            <option value="ESCALATED">Escalated to Faculty</option>
            <option value="ANSWERED">Answered by Faculty</option>
            {/* ─── /PATCH C ─── */}
          </select>
        </div>
      </div>

      {/* Doubts List Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className={`space-y-3 ${activeDoubt ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {filteredDoubts.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No student doubts found for the selected batch.
            </div>
          ) : (
            filteredDoubts.map(d => (
              <div
                key={d.id}
                onClick={() => {
                  setActiveDoubt(d);
                  setAnswerText(d.answerText || '');
                }}
                className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                  activeDoubt?.id === d.id
                    ? 'border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      {d.subject}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{d.studentName}</span>
                    <span className="text-[11px] text-slate-400">({d.studentClass})</span>
                  </div>

                  {/* ─── PATCH D: status badge now handles 4 statuses ─── */}
                  {d.status === 'pending' && (
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                  {d.status === 'ai_answered' && (
                    <span className="px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                      <Bot className="w-3 h-3" /> AI Answered
                    </span>
                  )}
                  {d.status === 'escalated' && (
                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Needs Faculty
                    </span>
                  )}
                  {d.status === 'answered' && (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Answered
                    </span>
                  )}
                  {/* ─── /PATCH D ─── */}
                </div>

                <p className="text-sm font-semibold text-slate-800 leading-snug mb-2">{d.question}</p>

                {d.imageUrl && (
                  <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600 text-xs font-medium">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Image attachment included
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
                  <span>Batch: {d.batchTitle}</span>
                  <span>{d.createdAt}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Answer Drawer Panel */}
        {activeDoubt && (
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-indigo-200 shadow-xl space-y-4 sticky top-20">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Resolve Student Doubt</h3>
              <button
                onClick={() => setActiveDoubt(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <p className="font-bold text-slate-900">{activeDoubt.studentName} ({activeDoubt.studentClass})</p>
              <p className="text-slate-700 leading-relaxed font-medium">{activeDoubt.question}</p>

              {activeDoubt.imageUrl && (
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-slate-500 mb-1 flex items-center justify-between">
                    <span>Attached Picture:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(activeDoubt.imageUrl!);
                        setImageModalOpen(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded"
                    >
                      <Eye className="w-3 h-3" /> View Full
                    </button>
                  </p>
                  {activeDoubt.imageUrl.startsWith('blob:') ? (
                    <div className="p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 text-xs font-medium text-center">
                      This image was uploaded using an older, unsupported format and cannot be displayed. Please ask the student to re-upload.
                    </div>
                  ) : activeDoubt.imageUrl.startsWith('chunked:') ? (
                    <ChunkedImage
                      fileId={activeDoubt.imageUrl.split(':')[1]}
                      className="w-full max-h-48 object-cover rounded-xl border border-slate-300 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <img
                      src={activeDoubt.imageUrl}
                      alt="Student Attachment"
                      className="w-full max-h-48 object-cover rounded-xl border border-slate-300 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}
                </div>
              )}
            </div>

            {/* ─── PATCH E: Apex AI's auto-answer panel — review before sending yours ─── */}
            {activeDoubt.aiAnswer && (
              <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 rounded-xl border border-violet-200 space-y-1 text-xs">
                <p className="text-violet-700 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Bot className="w-3.5 h-3.5" /> Apex AI's Answer (review before sending yours)
                  {activeDoubt.escalatedToFaculty && (
                    <span className="ml-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] normal-case tracking-normal">
                      AI escalated
                    </span>
                  )}
                </p>
                <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{activeDoubt.aiAnswer}</p>
                {activeDoubt.aiFollowUp && (
                  <p className="text-slate-500 italic pt-1 border-t border-violet-100">
                    {activeDoubt.aiFollowUp}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-mono pt-1">
                  AI confidence: {activeDoubt.aiConfidence || 'unknown'} • answered at {activeDoubt.aiAnsweredAt || '—'}
                </p>
              </div>
            )}
            {/* ─── /PATCH E ─── */}

            <form onSubmit={handleAnswerSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Faculty Answer / Explanation *
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Provide step-by-step reaction mechanism or concept clarification..."
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Send Solution & Notify Student
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDoubt}
                  className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-extrabold text-xs rounded-xl transition-all"
                >
                  Delete
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Image Viewer Modal */}
      {imageModalOpen && selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-2 border border-slate-200 relative max-h-[95vh] overflow-y-auto">
            <button
              onClick={() => {
                setImageModalOpen(false);
                setSelectedImage('');
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <div className="rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[300px]">
              {selectedImage.startsWith('blob:') ? (
                <div className="p-6 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 text-sm font-medium text-center max-w-sm mx-auto">
                  This image was uploaded using an older format and cannot be displayed.
                </div>
              ) : selectedImage.startsWith('chunked:') ? (
                <ChunkedImage fileId={selectedImage.split(':')[1]} className="max-w-full h-auto object-contain" />
              ) : (
                <img src={selectedImage} alt="Doubt Attachment" className="max-w-full h-auto object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
