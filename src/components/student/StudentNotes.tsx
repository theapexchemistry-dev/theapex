import React, { useState, useEffect } from 'react';
import { Student, Note } from '../../types';
import { Mail, Search, CheckCircle2, History, FileText, Clock } from 'lucide-react';
import { StorageService } from '../../lib/storage';

interface StudentNotesProps {
  student: Student;
}

export const StudentNotes: React.FC<StudentNotesProps> = ({ student }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState<Note[]>(() => StorageService.getNotes());

  useEffect(() => {
    const refresh = () => setNotes(StorageService.getNotes());
    window.addEventListener('apex_storage_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('apex_storage_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const studentNotes = notes.filter(note => note.batchId === student.batchId);

  const filteredNotes = studentNotes.filter(
    n => n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
         n.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
         (n.fileName && n.fileName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Class Study Notes Log</h2>
          <p className="text-sm text-slate-500">Handwritten notes, chapter guides, and PDFs are sent directly to your email inbox by Mr. Subhamoy Mondal.</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search documents or topics..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </div>

      {/* Direct Email Delivery Notice */}
      <div className="bg-indigo-50/80 border border-indigo-100 p-5 rounded-2xl flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold shadow-md shadow-indigo-600/20">
          <Mail className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
            Direct Email Inbox Delivery <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </h4>
          <p className="text-xs text-indigo-900/80 mt-1 leading-relaxed">
            All study material attachments are emailed directly to your registered email address: <strong className="font-bold text-indigo-950">{student.email || 'your email'}</strong>. Check your Gmail inbox to download and access the attached PDF documents.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-800 shadow-sm">
            <History className="w-3.5 h-3.5 text-indigo-600" />
            {studentNotes.length} Document Dispatch{studentNotes.length !== 1 ? 'es' : ''} sent to your batch
          </div>
        </div>
      </div>

      {/* Notes Logs Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredNotes.length === 0 ? (
          <div className="md:col-span-2 bg-white p-10 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs space-y-2">
            <Mail className="w-8 h-8 mx-auto text-indigo-400" />
            <p className="font-semibold text-slate-700 text-sm">Check Your Email Inbox</p>
            <p className="text-slate-500 max-w-md mx-auto">
              New study notes and chapter worksheets are sent directly to <strong>{student.email || 'your registered email'}</strong>. No study materials have been dispatched for your batch yet.
            </p>
          </div>
        ) : (
          filteredNotes.map(note => (
            <div key={note.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-indigo-400 transition-all flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200 uppercase">
                    {note.subject}
                  </span>
                  <span className="text-[10px] font-mono font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {note.createdAt}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                    {note.title}
                  </h4>
                  {note.description && (
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {note.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <span className="text-slate-400 font-normal">Document:</span>
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {note.fileName}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  ✉️ Delivered to your email inbox
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

