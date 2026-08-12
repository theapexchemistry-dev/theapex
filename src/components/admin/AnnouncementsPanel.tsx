import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { Batch, Announcement, Student } from '../../types';
import { Megaphone, Send, Users, Mail, MessageCircle, Clock } from 'lucide-react';

export const AnnouncementsPanel: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>(() => StorageService.getBatches());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => StorageService.getAnnouncements());
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<string>('all');
  const [sendMethod, setSendMethod] = useState<'portal' | 'email' | 'whatsapp'>('portal');
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSendAnnouncement = async () => {
    if (!title || !message) {
      alert('Please enter both a title and a message.');
      return;
    }
    setIsSending(true);

    const newAnnouncement: Announcement = {
      id: 'ann-' + Date.now().toString(36),
      title,
      message,
      targetAudience,
      createdAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      sentVia: sendMethod
    };

    // 1. Save to general announcements list
    StorageService.addAnnouncement(newAnnouncement);

    // 2. Create notifications for students
    const allStudents = StorageService.getStudents();
    const targetStudents = targetAudience === 'all' 
      ? allStudents 
      : allStudents.filter(s => s.batchId === targetAudience);

    targetStudents.forEach(student => {
      StorageService.addNotification({
        id: 'n-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        userId: student.id,
        title: `Announcement: ${title}`,
        message: message,
        type: 'announcement',
        timestamp: 'Just now',
        read: false
      });
    });

    // Here is where you would later trigger a Firebase Cloud Function 
    // to actually send the WhatsApp or Email if sendMethod !== 'portal'

    // Update local state
    setAnnouncements([newAnnouncement, ...announcements]);
    setTitle('');
    setMessage('');
    setSuccessMsg(`Announcement sent successfully via ${sendMethod} to ${targetStudents.length} students!`);
    
    setTimeout(() => setSuccessMsg(''), 4000);
    setIsSending(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Announcements & Broadcasts</h2>
          <p className="text-sm text-slate-500">Send updates to all students or specific batches.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Compose Message Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Megaphone className="w-5 h-5 text-indigo-600" /> Compose New Announcement
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Tomorrow's Class Cancelled"
                className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
                className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Target Audience</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Students</option>
                  {batches.map(batch => (
                    <option key={batch.id} value={batch.id}>{batch.name} Batch</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Send Via</label>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setSendMethod('portal')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${sendMethod === 'portal' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <Users className="w-3.5 h-3.5" /> Portal
                  </button>
                  <button
                    onClick={() => setSendMethod('email')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${sendMethod === 'email' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                  <button
                    onClick={() => setSendMethod('whatsapp')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${sendMethod === 'whatsapp' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                </div>
              </div>
            </div>

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold p-3 rounded-xl">
                {successMsg}
              </div>
            )}

            <button
              onClick={handleSendAnnouncement}
              disabled={isSending}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> {isSending ? 'Sending...' : 'Send Announcement'}
            </button>
          </div>
        </div>

        {/* History Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-slate-900 mb-4">Recent Announcements</h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Megaphone className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No announcements yet</p>
              </div>
            ) : (
              announcements.map(ann => (
                <div key={ann.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-bold text-slate-900">{ann.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ann.sentVia === 'email' ? 'bg-blue-100 text-blue-700' :
                      ann.sentVia === 'whatsapp' ? 'bg-green-100 text-green-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {ann.sentVia}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{ann.message}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500">
                      To: {ann.targetAudience === 'all' ? 'All Students' : batches.find(b => b.id === ann.targetAudience)?.name || 'Batch'}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {ann.createdAt}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
