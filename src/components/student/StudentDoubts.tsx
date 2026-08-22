import React, { useState, useEffect, useRef } from 'react';
import { Student, Doubt } from '../../types';
import { StorageService } from '../../lib/storage';
import {
  HelpCircle, Send, Upload, Image as ImageIcon, CheckCircle2, Clock, Eye, XCircle,
  Bot, Sparkles, Loader2, AlertTriangle, MessageCircle, RefreshCw
} from 'lucide-react';
import { uploadFileChunks } from '../../lib/fileChunks';
import { ChunkedImage } from '../ChunkedImage';
import { askAiAssistant, askAiFollowUp, type AiAnswerResult } from '../../lib/aiAssistant';
import { subscribeToDoubts } from '../../lib/firebaseSync';

interface StudentDoubtsProps { student: Student; }

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  confidence?: AiAnswerResult['confidence'];
  followUp?: string;
  needsFaculty?: boolean;
  timestamp: string;
}

export const StudentDoubts: React.FC<StudentDoubtsProps> = ({ student }) => {
  const [doubts, setDoubts] = useState<Doubt[]>(() =>
    StorageService.getDoubts().filter(d => d.studentId && d.studentId.toLowerCase() === student.id.toLowerCase())
  );
  const [question, setQuestion] = useState('');
  const [subject, setSubject] = useState('Physical Chemistry');
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [submittedMsg, setSubmittedMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [lastAiResult, setLastAiResult] = useState<AiAnswerResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);

  const refreshDoubts = () => {
    if (!mountedRef.current) return;
    setDoubts(StorageService.getDoubts().filter(d => d.studentId && d.studentId.toLowerCase() === student.id.toLowerCase()));
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshDoubts();
      setSyncError(null);
    } catch (err: any) {
      setSyncError(err.message || 'Failed to sync with server.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    refreshDoubts();
    
    // Subscribe to real-time updates directly via Firestore
    const unsub = subscribeToDoubts(
      (allDoubts) => {
        if (!mountedRef.current) return;
        setDoubts((allDoubts as Doubt[]).filter(d => d.studentId && d.studentId.toLowerCase() === student.id.toLowerCase()));
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
  }, [student.id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, aiThinking]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageName(file.name);
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
        setImageUrl(base64Data);
      } catch (err) {
        console.error('Error compressing image:', err);
        alert('Failed to process image. Please try again.');
      }
    }
  };

  const handleAskAi = async () => {
    if (!question.trim() || aiThinking) return;
    setAiError(null);
    setAiThinking(true);

    const userMsg: ChatMessage = {
      role: 'user',
      text: question.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(prev => [...prev, userMsg]);

    try {
      const result = await askAiAssistant(question.trim(), subject, student.className);
      setLastAiResult(result);
      const aiMsg: ChatMessage = {
        role: 'ai',
        text: result.answer,
        confidence: result.confidence,
        followUp: result.followUpQuestion,
        needsFaculty: result.needsFaculty,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('AI assistant error:', err);
      setAiError(err?.message || 'AI could not be reached. You can still submit your doubt directly to faculty.');
    } finally {
      setAiThinking(false);
    }
  };

  const handleAskFollowUp = async () => {
    if (!followUpInput.trim() || aiThinking) return;
    setAiError(null);
    setAiThinking(true);

    const userMsg: ChatMessage = {
      role: 'user',
      text: followUpInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(prev => [...prev, userMsg]);
    const newHistory = [...chatHistory, userMsg];

    try {
      const result = await askAiFollowUp(
        newHistory.map(m => ({ role: m.role === 'user' ? 'user' : 'ai', text: m.text })),
        followUpInput.trim(),
        subject,
        student.className
      );
      setLastAiResult(result);
      const aiMsg: ChatMessage = {
        role: 'ai',
        text: result.answer,
        confidence: result.confidence,
        followUp: result.followUpQuestion,
        needsFaculty: result.needsFaculty,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, aiMsg]);
      setFollowUpInput('');
    } catch (err: any) {
      console.error('AI follow-up error:', err);
      setAiError(err?.message || 'AI could not respond. Try submitting the doubt to faculty directly.');
    } finally {
      setAiThinking(false);
    }
  };

  const handleSubmitDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isSubmitting) return;

    setIsSubmitting(true);
    let finalImageUrl = imageUrl;

    if (imageUrl && !imageUrl.startsWith('chunked:')) {
      const fileId = `doubt-${Date.now()}`;
      await uploadFileChunks(fileId, imageUrl);
      finalImageUrl = `chunked:${fileId}`;
    }

    const aiAnswerText = lastAiResult?.answer;
    const escalated = !aiAnswerText || lastAiResult?.needsFaculty === true;

    StorageService.addDoubt({
      studentId: student.id,
      studentName: student.name,
      studentClass: student.className,
      batchId: student.batchId,
      batchTitle: student.batchTitle,
      question,
      subject,
      imageUrl: finalImageUrl || undefined,
      aiAnswer: aiAnswerText,
      aiConfidence: lastAiResult?.confidence,
      aiFollowUp: lastAiResult?.followUpQuestion,
      escalatedToFaculty: escalated
    });

    refreshDoubts();
    setQuestion('');
    setImageUrl('');
    setImageName('');
    setChatHistory([]);
    setLastAiResult(null);
    setFollowUpInput('');

    setSubmittedMsg(
      escalated
        ? '✓ Doubt submitted to Mr. Subhamoy Mondal. He will reply shortly.'
        : '✓ AI answer saved! The faculty has also been notified so they can review the AI response.'
    );
    setTimeout(() => setSubmittedMsg(''), 5000);
    setIsSubmitting(false);
  };

  const ConfidenceBadge = ({ c }: { c?: AiAnswerResult['confidence'] }) => {
    if (!c || c === 'unknown') return null;
    const map: Record<string, { bg: string; text: string; label: string }> = {
      high: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'High confidence' },
      medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium confidence' },
      low: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Low confidence — ask faculty' }
    };
    const v = map[c];
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${v.bg} ${v.text} mb-1.5`}>
        {v.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Ask Faculty a Doubt</h2>
        <p className="text-sm text-slate-500">
          Apex AI will try to answer your chemistry question instantly. If it can't fully resolve it, the doubt is automatically sent to Mr. Subhamoy Mondal.
        </p>
      </div>

      {submittedMsg && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-2xl animate-in fade-in">
          {submittedMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <HelpCircle className="w-5 h-5 text-indigo-600" /> Submit New Doubt
          </h3>

          <form onSubmit={handleSubmitDoubt} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Area *</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-semibold">
                <option value="Physical Chemistry">Physical Chemistry</option>
                <option value="Organic Chemistry">Organic Chemistry</option>
                <option value="Inorganic Chemistry">Inorganic Chemistry</option>
                <option value="General Science">General Science</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Question / Description *</label>
              <textarea rows={4} required
                placeholder="Type your chemistry question in detail or describe where you are stuck..."
                value={question} onChange={e => setQuestion(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none resize-none" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Picture / Diagram (Optional)</label>
              {imageUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                  <img src={imageUrl.startsWith('chunked:') ? undefined : imageUrl} alt="Preview" className="w-full max-h-48 object-cover" />
                  <button type="button" onClick={() => { setImageUrl(''); setImageName(''); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 backdrop-blur-sm">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl p-5 text-center transition-colors">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <div className="space-y-1">
                    <ImageIcon className="w-6 h-6 text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-800">Click or capture question picture</p>
                    <p className="text-[10px] text-slate-400">JPG, PNG up to 10MB</p>
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={handleAskAi} disabled={!question.trim() || aiThinking}
              className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5">
              {aiThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiThinking ? 'Apex AI is thinking...' : 'Ask Apex AI First'}
            </button>

            <button type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5">
              <Send className="w-4 h-4" />
              {lastAiResult && !lastAiResult.needsFaculty ? 'Save & Notify Faculty for Review' : 'Submit to Faculty'}
            </button>
          </form>

          {chatHistory.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> Apex AI Conversation
              </p>
              <div ref={chatScrollRef} className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {chatHistory.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-2.5 rounded-2xl text-[11px] leading-relaxed ${
                      m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      {m.role === 'ai' && <ConfidenceBadge c={m.confidence} />}
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      {m.followUp && (
                        <p className="mt-1.5 pt-1.5 border-t border-slate-200/60 text-slate-500 italic">
                          🤔 {m.followUp}
                        </p>
                      )}
                      {m.needsFaculty && (
                        <p className="mt-1.5 pt-1.5 border-t border-slate-200/60 text-rose-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> AI suggests asking faculty for this part.
                        </p>
                      )}
                      <p className={`text-[9px] mt-1 ${m.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {m.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
                {aiThinking && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 p-2.5 rounded-2xl rounded-bl-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 flex gap-1.5">
                <input type="text" value={followUpInput} onChange={e => setFollowUpInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAskFollowUp(); } }}
                  placeholder="Ask a follow-up..." disabled={aiThinking}
                  className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
                <button type="button" onClick={handleAskFollowUp} disabled={!followUpInput.trim() || aiThinking}
                  className="px-3 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-xl">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {aiError && (
            <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-xl">
              {aiError}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">My Submitted Doubts ({doubts.length})</h3>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Live sync active
              </span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                title="Force-fetch latest doubts from server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {syncError && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 font-semibold text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}

          <div className="space-y-3">
            {doubts.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
                You haven't asked any doubts yet.
              </div>
            ) : (
              doubts.map(d => (
                <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200 uppercase">
                      {d.subject}
                    </span>

                    {d.status === 'pending' && (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending Faculty Reply
                      </span>
                    )}
                    {d.status === 'ai_answered' && (
                      <span className="px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                        <Bot className="w-3 h-3" /> AI Answered
                      </span>
                    )}
                    {d.status === 'escalated' && (
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Needs Faculty Review
                      </span>
                    )}
                    {d.status === 'answered' && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Faculty Answered
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-800">{d.question}</p>

                  {d.imageUrl && (
                    <div className="pt-2 relative group">
                      <div className="absolute top-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button type="button" onClick={() => { setSelectedImage(d.imageUrl!); setImageModalOpen(true); }}
                          className="bg-black/60 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold hover:bg-black/80 backdrop-blur-sm">
                          <Eye className="w-3.5 h-3.5" /> View Full
                        </button>
                      </div>
                      {d.imageUrl.startsWith('chunked:') ? (
                        <ChunkedImage fileId={d.imageUrl.split(':')[1]} className="w-full max-h-48 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer" />
                      ) : (
                        <img src={d.imageUrl} alt="Question Attachment" className="w-full max-h-48 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer" />
                      )}
                    </div>
                  )}

                  {d.aiAnswer && (
                    <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 rounded-xl border border-violet-200 space-y-1 text-xs">
                      <p className="text-violet-700 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                        <Bot className="w-3.5 h-3.5" /> Apex AI Instant Answer
                        {d.aiConfidence && d.aiConfidence !== 'unknown' && (
                          <span className="ml-1 px-1.5 py-0.5 bg-white/60 rounded-full text-[9px] normal-case tracking-normal">
                            {d.aiConfidence} confidence
                          </span>
                        )}
                      </p>
                      <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{d.aiAnswer}</p>
                      {d.aiFollowUp && (
                        <p className="text-slate-500 italic pt-1 border-t border-violet-100">
                          🤔 {d.aiFollowUp}
                        </p>
                      )}
                      {d.aiAnsweredAt && (
                        <span className="text-[10px] text-slate-400 font-mono block pt-1">
                          AI answered at: {d.aiAnsweredAt}
                        </span>
                      )}
                    </div>
                  )}

                  {d.answerText && (
                    <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <p className="text-amber-300 font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider">
                        <MessageCircle className="w-3.5 h-3.5" /> Faculty Solution • Mr. Subhamoy Mondal
                      </p>
                      <p className="text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">{d.answerText}</p>
                      {d.answerImageUrl && (
                        <div className="pt-1">
                          <p className="text-[10px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                            <span>Attached Solution Picture:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedImage(d.answerImageUrl!);
                                setImageModalOpen(true);
                              }}
                              className="text-amber-300 hover:text-amber-400 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded"
                            >
                              <Eye className="w-3 h-3" /> View Full
                            </button>
                          </p>
                          {d.answerImageUrl.startsWith('chunked:') ? (
                            <ChunkedImage
                              fileId={d.answerImageUrl.split(':')[1]}
                              className="w-full max-h-48 object-cover rounded-xl border border-slate-700 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => {
                                setSelectedImage(d.answerImageUrl!);
                                setImageModalOpen(true);
                              }}
                            />
                          ) : (
                            <img
                              src={d.answerImageUrl}
                              alt="Solution Attachment"
                              className="w-full max-h-48 object-cover rounded-xl border border-slate-700 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => {
                                setSelectedImage(d.answerImageUrl!);
                                setImageModalOpen(true);
                              }}
                            />
                          )}
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono block pt-1">{d.answeredAt}</span>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                    Asked on: {d.createdAt}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {imageModalOpen && selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-2 border border-slate-200 relative max-h-[95vh] overflow-y-auto">
            <button onClick={() => { setImageModalOpen(false); setSelectedImage(''); }}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <div className="rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[300px]">
              {selectedImage.startsWith('chunked:') ? (
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
