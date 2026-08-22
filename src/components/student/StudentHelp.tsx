import React, { useState, useEffect, useRef } from 'react';
import { Student, SupportRequest } from '../../types';
import { MessageSquare, Phone, Send, CheckCircle2, HelpCircle, Trash2, Clock } from 'lucide-react';
import { StorageService } from '../../lib/storage';
import { subscribeToSupportRequests } from '../../lib/firebaseSync';

interface StudentHelpProps {
  student: Student;
}

export const StudentHelp: React.FC<StudentHelpProps> = ({ student }) => {
  const [issueType, setIssueType] = useState('Fee Payment Issue');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [myTickets, setMyTickets] = useState<SupportRequest[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsub = subscribeToSupportRequests((allRequests) => {
      if (!mountedRef.current) return;
      const my = (allRequests as SupportRequest[]).filter(r => r.studentId === student.id);
      my.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyTickets(my);
    }, (err) => {
      if (!mountedRef.current) return;
      const my = StorageService.getSupportRequests().filter(r => r.studentId === student.id);
      my.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyTickets(my);
    });

    const onStorageUpdate = () => {
      if (!mountedRef.current) return;
      const my = StorageService.getSupportRequests().filter(r => r.studentId === student.id);
      my.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyTickets(my);
    };
    window.addEventListener('apex_storage_updated', onStorageUpdate);
    window.addEventListener('storage', onStorageUpdate);

    return () => {
      mountedRef.current = false;
      unsub();
      window.removeEventListener('apex_storage_updated', onStorageUpdate);
      window.removeEventListener('storage', onStorageUpdate);
    };
  }, [student.id]);

  const handleClearAllMyTickets = () => {
    if (confirm('Are you sure you want to delete all your past support tickets?')) {
      myTickets.forEach(req => StorageService.deleteSupportRequest(req.id));
    }
  };

  const handleDeleteTicket = (id: string) => {
    if (confirm('Are you sure you want to delete this support ticket?')) {
      StorageService.deleteSupportRequest(id);
    }
  };

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

    StorageService.addNotification({
      title: 'New Support Ticket',
      message: `${student.name} (${student.className}) reported a ${issueType}.`,
      type: 'support_request',
      targetRole: 'admin',
      read: false
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

      {/* Past Tickets List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" /> My Past Tickets
          </h3>
          {myTickets.length > 0 && (
            <button
              onClick={handleClearAllMyTickets}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg transition-colors"
              title="Delete all my past tickets"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
        
        {myTickets.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            You have no past support tickets.
          </div>
        ) : (
          <div className="space-y-4">
            {myTickets.map(req => (
              <div key={req.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative group">
                <button
                  onClick={() => handleDeleteTicket(req.id)}
                  className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete ticket globally"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${req.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {req.status}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{req.issueType}</h4>
                  <p className="text-sm text-slate-700 mt-1">{req.message}</p>
                </div>
                {req.status === 'resolved' && req.resolvedAt && (
                  <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 pt-2 border-t border-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolved on {new Date(req.resolvedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
