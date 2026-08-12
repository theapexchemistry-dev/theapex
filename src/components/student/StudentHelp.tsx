import React, { useState } from 'react';
import { Student } from '../../types';
import { MessageSquare, Phone, Send, CheckCircle2, HelpCircle } from 'lucide-react';
import { StorageService } from '../../lib/storage';

interface StudentHelpProps {
  student: Student;
}

export const StudentHelp: React.FC<StudentHelpProps> = ({ student }) => {
  const [issueType, setIssueType] = useState('Fee Payment Issue');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    StorageService.saveSupportRequest({
      id: `SR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      studentId: student.id,
      studentName: student.name,
      studentClass: student.className,
      issueType,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setMessage('');
  };

  const handleWhatsAppHelp = () => {
    const text = `Hello Mr. Subhamoy Mondal Sir,
I am ${student.name} (ID: ${student.id}, ${student.className}).
I need assistance regarding my portal account / class schedule.`;
    window.open(`https://wa.me/919051818629?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Help & Student Support Desk</h2>
        <p className="text-sm text-slate-500">Connect directly with Mr. Subhamoy Mondal to resolve any technical, batch, or fee query.</p>
      </div>

      {sent && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-2xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Support request sent! Admin will get back to you shortly.
        </div>
      )}

      {/* Direct Contact Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-emerald-600 text-white p-6 rounded-2xl shadow-lg space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-extrabold">Instant WhatsApp Support</h3>
          <p className="text-xs text-emerald-100">Connect directly with Mr. Subhamoy Mondal on WhatsApp for quick help.</p>
          <button
            onClick={handleWhatsAppHelp}
            className="w-full py-2.5 bg-white text-emerald-800 font-extrabold text-xs rounded-xl shadow-md transition-all hover:bg-emerald-50"
          >
            Chat on WhatsApp
          </button>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-3 border border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <Phone className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-extrabold">Institute Helpline</h3>
          <p className="text-xs text-slate-300">Call during working hours: 10:00 AM – 08:00 PM</p>
          <a
            href="tel:+919051818629"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all block text-center"
          >
            Call Institute Helpline
          </a>
        </div>
      </div>

      {/* Ticket Submission Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
          <HelpCircle className="w-5 h-5 text-indigo-600" /> Submit Support Query Ticket
        </h3>

        <form onSubmit={handleSendIssue} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Topic / Category *</label>
            <select
              value={issueType}
              onChange={e => setIssueType(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-semibold"
            >
              <option value="Fee Payment Issue">Fee Payment & Receipt Issue</option>
              <option value="Batch Timing Change">Batch Timing & Schedule Inquiry</option>
              <option value="Notes Download Issue">Notes or Study Material Access</option>
              <option value="Test Score Discrepancy">Test Score or Rank Inquiry</option>
              <option value="General Question">General Administrative Inquiry</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Describe Your Issue in Detail *</label>
            <textarea
              rows={4}
              required
              placeholder="Explain what problem you are encountering..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Send Ticket to Faculty
          </button>
        </form>
      </div>
    </div>
  );
};
