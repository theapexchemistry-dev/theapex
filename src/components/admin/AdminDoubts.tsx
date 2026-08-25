import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../../lib/storage';
import { Doubt, Batch } from '../../types';
import { HelpCircle, CheckCircle2, Clock, MessageSquare, Send, Image as ImageIcon, Eye, XCircle, Bot, AlertTriangle, Loader2, RefreshCw, Trash2, ShieldAlert, AlertCircle } from 'lucide-react';
import { ChunkedImage } from '../ChunkedImage';
import { uploadFileChunks } from '../../lib/fileChunks';
import { subscribeToDoubts } from '../../lib/firebaseSync';

export const AdminDoubts: React.FC = () => {
  const [batches] = useState<Batch[]>(() => StorageService.getBatches());
  const [doubts, setDoubts] = useState<Doubt[]>(() => StorageService.getDoubts());

  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');
  // ─── PATCH A: filterStatus type extended with AI_ANSWERED + ESCALATED ───
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ANSWERED' | 'AI_ANSWERED' | 'ESCALATED'>('ALL');
  // ─── /PATCH A ──────────────────────────────────────────────────────────

  const [activeDoubt, setActiveDoubt] = useState<Doubt | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerImageUrl, setAnswerImageUrl] = useState('');
  const [answerImageName, setAnswerImageName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [doubtToDelete, setDoubtToDelete] = useState<Doubt | null>(null);
  const [isDeletingDoubt, setIsDeletingDoubt] = useState(false);

  const mountedRef = useRef(true);

  const refreshDoubts = () => {
    if (!mountedRef.current) return;
    setDoubts(StorageService.getDoubts());
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshDoubts();
      setSyncError(null);
    } catch (err: any) {
      setSyncError(err.message || 'Failed to sync with server.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 600); // Visual feedback
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Subscribe to real-time updates directly via Firestore
    const unsub = subscribeToDoubts(
      (allDoubts) => {
        if (!mountedRef.current) return;
        setDoubts(allDoubts as Doubt[]);
        setSyncError(null);
      },
      (err) => {
        if (!mountedRef.current) return;
        setSyncError(err.message || 'Live sync disconnected. Using local data.');
        refreshDoubts();
      }
    );
    
    const handleUpdate = () => refreshDoubts();
    window.addEventListener('apex_storage_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      mountedRef.current = false;
      unsub();
      window.removeEventListener('apex_storage_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAnswerImageName(file.name);
      try {
        const { default: imageCompression } = await import('browser-image-compression');
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(compressedFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
        setAnswerImageUrl(base64Data);
      } catch (err) {
        console.error('Error compressing image:', err);
        alert('Failed to process image. Please try again.');
      }
    }
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoubt || !answerText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let finalAnswerImageUrl = answerImageUrl;

      if (answerImageUrl && !answerImageUrl.startsWith('chunked:') && !answerImageUrl.startsWith('http')) {
        const fileId = `answer-${Date.now()}`;
        await uploadFileChunks(fileId, answerImageUrl);
        finalAnswerImageUrl = `chunked:${fileId}`;
      }

      StorageService.answerDoubt(activeDoubt.id, answerText, finalAnswerImageUrl || undefined);
      refreshDoubts();
      setActiveDoubt(null);
      setAnswerText('');
      setAnswerImageUrl('');
      setAnswerImageName('');
    } catch (err) {
      console.error('Error submitting faculty answer:', err);
      alert('Failed to send answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!doubtToDelete) return;
    setIsDeletingDoubt(true);
    try {
      await StorageService.deleteDoubt(doubtToDelete.id);
      if (activeDoubt?.id === doubtToDelete.id) {
        setActiveDoubt(null);
        setAnswerText('');
        setAnswerImageUrl('');
        setAnswerImageName('');
      }
      refreshDoubts();
      setDoubtToDelete(null);
    } catch (err) {
      console.error('Error deleting doubt:', err);
      alert('Failed to delete doubt. Please try again.');
    } finally {
      setIsDeletingDoubt(false);
    }
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

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
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

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto flex justify-center items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
            title="Force-fetch latest doubts from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 font-semibold text-xs rounded-2xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-4 px-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Live sync active
        </span>
        <span>{filteredDoubts.length} record{filteredDoubts.length !== 1 ? 's' : ''} shown</span>
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
                  setAnswerImageUrl(d.answerImageUrl || '');
                  setAnswerImageName(d.answerImageUrl ? 'Attached image' : '');
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
                  <div className="flex items-center gap-3">
                    <span>{d.createdAt}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDoubtToDelete(d);
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                      title="Permanently delete doubt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Attach Faculty Explanation Picture (Optional)</label>
                {answerImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    {answerImageUrl.startsWith('chunked:') ? (
                      <ChunkedImage fileId={answerImageUrl.split(':')[1]} className="w-full max-h-48 object-cover cursor-pointer" onClick={() => { setSelectedImage(answerImageUrl); setImageModalOpen(true); }} />
                    ) : (
                      <img src={answerImageUrl} alt="Faculty Preview" className="w-full max-h-48 object-cover cursor-pointer" onClick={() => { setSelectedImage(answerImageUrl); setImageModalOpen(true); }} />
                    )}
                    <button type="button" onClick={() => { setAnswerImageUrl(''); setAnswerImageName(''); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 backdrop-blur-sm">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-xl p-4 text-center transition-colors">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <div className="space-y-1">
                      <ImageIcon className="w-5 h-5 text-indigo-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">Click or capture solution picture</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSubmitting ? 'Uploading image...' : 'Send Solution & Notify Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setDoubtToDelete(activeDoubt)}
                  disabled={isSubmitting}
                  className="py-3 px-4 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5"
                  title="Permanently delete this doubt"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Delete Doubt Confirmation Modal */}
      {doubtToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Delete Doubt Permanently?</h3>
                <p className="text-xs text-slate-500">Confirm permanent deletion from database and student panel.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 pb-1.5 border-b border-slate-200/60">
                <span className="font-bold text-slate-800">{doubtToDelete.studentName}</span>
                <span className="text-[11px] font-mono text-slate-500">{doubtToDelete.studentClass} • {doubtToDelete.subject}</span>
              </div>
              <p className="text-slate-700 font-medium line-clamp-3 italic">
                "{doubtToDelete.question}"
              </p>
              <div className="pt-1 text-[11px] text-slate-400 font-mono flex justify-between">
                <span>Batch: {doubtToDelete.batchTitle}</span>
                <span>{doubtToDelete.createdAt}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                This doubt will be <strong>permanently removed</strong> from the Firestore database and will disappear from this student's doubt portal immediately.
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDoubtToDelete(null)}
                disabled={isDeletingDoubt}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingDoubt}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingDoubt ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
