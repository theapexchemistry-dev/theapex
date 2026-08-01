import React, { useState } from 'react';
import { StorageService } from '../../lib/storage';
import { Batch } from '../../types';
import {
  Mail,
  Send,
  CheckCircle2,
  FileText,
  SendHorizontal,
  History,
  Clock,
  Trash2,
  Server,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { sendNoteEmails } from '../../lib/emailApi';

export const AdminNotes: React.FC = () => {
  const [batches] = useState<Batch[]>(() => StorageService.getBatches());
  const [notes, setNotes] = useState<any[]>(() => StorageService.getNotes());
  const refreshNotes = () => setNotes(StorageService.getNotes());

  const handleDeleteNote = (id: string, noteTitle: string) => {
    if (window.confirm(`Are you sure you want to delete "${noteTitle}"?`)) {
      StorageService.deleteNote(id);
      refreshNotes();
    }
  };

  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
  const [filterBatchId, setFilterBatchId] = useState<string>('ALL');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Physical Chemistry');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const MAX_SIZE_MB = 25;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`File size exceeds the ${MAX_SIZE_MB}MB limit. Please select a smaller file.`);
        e.target.value = '';
        return;
      }
      setFileName(file.name);
      setSelectedFile(file);
    }
  };

  const handleSendNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedBatchId) return;

    setIsSending(true);
    setEmailStatusMsg({ type: 'info', text: 'Preparing to send emails...' });

    const students = StorageService.getStudents().filter(
      s => s.batchId === selectedBatchId && s.email && s.email.trim() !== ''
    );
    const targetBatch = batches.find(b => b.id === selectedBatchId);
    const batchName = targetBatch ? targetBatch.title : 'Selected Batch';

    if (students.length === 0) {
      setEmailStatusMsg({
        type: 'error',
        text: `No students with valid email addresses found in ${batchName}.`
      });
      setIsSending(false);
      return;
    }

    const effectiveFileName =
      fileName || selectedFile?.name || `${title.replace(/\s+/g, '_')}_Notes.pdf`;

    try {
      let attachment:
        | { filename: string; content: string; mimeType: string }
        | undefined = undefined;

      if (selectedFile) {
        setEmailStatusMsg({ type: 'info', text: 'Preparing file attachment...' });
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
        attachment = {
          filename: effectiveFileName,
          content: base64Data,
          mimeType: selectedFile.type || 'application/octet-stream'
        };
      }

      setEmailStatusMsg({
        type: 'info',
        text: `Dispatching emails to ${students.length} student(s) in ${batchName}...`
      });

      const emailSubject = `[The Apex Chemistry] Study Note: ${title}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background-color: #0b132b; padding: 20px; border-radius: 8px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; color: #facc15; font-size: 22px;">The Apex Chemistry</h2>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #cbd5e1;">Mr. Subhamoy Mondal • Chemistry Tuition</p>
          </div>
          <div style="padding: 20px 0;">
            <h3 style="color: #1e293b; font-size: 18px; margin-top: 0;">New Study Material Released</h3>
            <p style="color: #475569; font-size: 14px;">Dear Student,</p>
            <p style="color: #475569; font-size: 14px;">Mr. Subhamoy Mondal has sent a new study material for your batch <strong>(${batchName})</strong>:</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 15px; margin: 15px 0; border-radius: 4px;">
              <p style="margin: 0; font-weight: bold; font-size: 16px; color: #1e293b;">${title}</p>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">Subject / Topic: <strong>${subject}</strong></p>
              ${description ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #334155;"><strong>Details:</strong> ${description}</p>` : ''}
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #4338ca; font-weight: bold;">📎 Attached Document: ${effectiveFileName}</p>
            </div>
            <p style="color: #475569; font-size: 14px;">Please check the file attachment directly in this email to download and view your study notes.</p>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #94a3b8; text-align: center;">
            <p style="margin: 0;">The Apex Chemistry • Quality Chemistry Coaching for JEE / NEET / CBSE</p>
          </div>
        </div>
      `;

      const result = await sendNoteEmails({
        to: students.map(s => s.email),
        subject: emailSubject,
        bodyHtml: emailBody,
        attachment
      });

      if (result.success && result.sentCount > 0) {
        StorageService.addNote({
          title,
          subject,
          description,
          batchId: selectedBatchId,
          batchTitle: batchName,
          fileName: effectiveFileName,
          fileSize: selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : undefined,
          recipientCount: result.sentCount
        });

        refreshNotes();

        setEmailStatusMsg({
          type: 'success',
          text: `Successfully sent note "${title}" to ${result.sentCount} student(s) in ${batchName}!${
            result.failedEmails.length > 0
              ? ` (${result.failedEmails.length} failed: ${result.failedEmails.join(', ')})`
              : ''
          }`
        });

        setTitle('');
        setDescription('');
        setFileName('');
        setSelectedFile(null);
      } else {
        setEmailStatusMsg({
          type: 'error',
          text: result.error || 'Failed to send emails. Please check that the Gmail service is configured in Vercel.'
        });
      }
    } catch (err: any) {
      console.error('Error sending note emails:', err);
      setEmailStatusMsg({
        type: 'error',
        text: err.message || 'Error occurred while sending note emails.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const filteredNotes = notes.filter(n => filterBatchId === 'ALL' || n.batchId === filterBatchId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Email Study Notes directly to Students
          </h2>
          <p className="text-sm text-slate-500">
            Dispatch handwritten notes, chapter guides, and formula sheets directly to students'
            registered email inboxes via Gmail.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 px-3 py-2 rounded-xl text-xs font-semibold shrink-0">
          <Server className="w-4 h-4 text-emerald-600" /> Server Email Service Active
        </div>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-2xl border bg-blue-50 border-blue-200 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-700">
          <Server className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-blue-900">Server-based email sending</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Emails are sent through a secure serverless function using your Gmail account. Requires
            <code className="mx-1 px-1.5 py-0.5 bg-blue-100 rounded text-[10px] font-mono">GMAIL_USER</code>
            and
            <code className="mx-1 px-1.5 py-0.5 bg-blue-100 rounded text-[10px] font-mono">GMAIL_APP_PASSWORD</code>
            environment variables in Vercel. No popup or Google sign-in required.
          </p>
        </div>
      </div>

      {emailStatusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            emailStatusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : emailStatusMsg.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {emailStatusMsg.type === 'info' ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : emailStatusMsg.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{emailStatusMsg.text}</span>
          </div>
          <button
            onClick={() => setEmailStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2 shrink-0"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Send Notes Form */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <SendHorizontal className="w-5 h-5 text-indigo-600" /> Email Note to Batch Students
          </h3>

          <form onSubmit={handleSendNoteSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Batch *</label>
              <select
                required
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.className})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Domain *</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="Physical Chemistry">Physical Chemistry</option>
                <option value="Organic Chemistry">Organic Chemistry</option>
                <option value="Inorganic Chemistry">Inorganic Chemistry</option>
                <option value="General Chemistry Foundation">General Chemistry Foundation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note Title / Chapter Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Chemical Bonding Master Notes & PYQs"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Key Notes Summary</label>
              <textarea
                rows={3}
                placeholder="e.g. VSEPR theory, Hybridization shortcuts, solved PYQs and homework assignment topics."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select / Reference Note File (Optional)</label>
              <div className="relative border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl p-5 text-center transition-colors">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="space-y-1">
                  <FileText className="w-7 h-7 text-indigo-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">
                    {fileName ? fileName : 'Click to select note document file'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Dispatches email notification directly to students</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className={`w-full py-3.5 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                isSending
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              }`}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSending ? 'Dispatching Emails...' : 'Send Notes directly to Students via Email'}</span>
            </button>
          </form>
        </div>

        {/* Email Dispatches Log */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" /> Dispatched Email Notes Log
            </h3>
            <select
              value={filterBatchId}
              onChange={e => setFilterBatchId(e.target.value)}
              className="w-full sm:w-auto text-xs px-3 py-2 sm:py-1.5 border border-slate-300 rounded-xl outline-none"
            >
              <option value="ALL">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs space-y-1">
                <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">No email notes dispatched yet.</p>
                <p className="text-[11px]">Notes sent via the form will be directly emailed to student inboxes.</p>
              </div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {note.subject}
                        </span>
                        {note.recipientCount !== undefined && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Emailed to {note.recipientCount} student(s)
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {note.createdAt}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-1.5 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        {note.title}
                      </h4>

                      {note.description && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {note.description}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span
                          className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[200px]"
                          title={note.fileName}
                        >
                          Document: <strong className="text-slate-900 font-mono">{note.fileName}</strong>
                        </span>
                        <span>
                          Batch: <strong className="text-slate-800">{note.batchTitle}</strong>
                        </span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          ✉️ Sent directly to student email inboxes
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteNote(note.id, note.title)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shrink-0 border border-transparent hover:border-red-200"
                    title="Delete Note Log Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
