import React, { useState, useEffect } from 'react';
import { CheckCircle, Copy, Share2, MessageCircle, Mail, Send, Check, AlertCircle, X, Loader2 } from 'lucide-react';
import { autoDispatchCredentials } from '../lib/notificationService';

interface ShareCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    name: string;
    id: string;
    password?: string;
    phone: string;
    email?: string;
    batchTitle?: string;
    className: string;
  } | null;
  autoSentStatus?: {
    email: { sent: boolean; error: string | null };
    whatsapp: { sent: boolean; error: string | null };
  };
}

export const ShareCredentialsModal: React.FC<ShareCredentialsModalProps> = ({
  isOpen,
  onClose,
  student,
  autoSentStatus
}) => {
  const [copied, setCopied] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [status, setStatus] = useState<{
    email: { sent: boolean; error: string | null };
    whatsapp: { sent: boolean; error: string | null };
  }>(autoSentStatus || {
    email: { sent: false, error: null },
    whatsapp: { sent: false, error: null }
  });

  useEffect(() => {
    if (autoSentStatus) {
      setStatus(autoSentStatus);
    }
  }, [autoSentStatus]);

  if (!isOpen || !student) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://theapexchemistry.web.app';
  const shareMessage = `🎓 *Welcome to The Apex Chemistry!*
Dear *${student.name}*,
Your enrollment for *${student.className}* (${student.batchTitle || 'Regular Batch'}) is successful.

Here are your portal login credentials:
📌 *Student ID:* ${student.id}
🔑 *Password:* ${student.password || 'apex123'}
🌐 *Portal Link:* ${currentUrl}

Please login to access class schedules, handwritten notes, tests, and ask doubts directly to the faculty.

*Your Success, Our Passion*
– Mr. Subhamoy Mondal
The Apex Chemistry`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const formattedPhone = student.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = formattedPhone.startsWith('91') && formattedPhone.length > 10 ? formattedPhone : `91${formattedPhone}`;
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'The Apex Chemistry Credentials',
          text: shareMessage,
          url: currentUrl
        });
      } catch (err) {
        console.error('Share cancelled or failed', err);
      }
    } else {
      handleCopy();
    }
  };

  const handleResendBoth = async () => {
    setIsResending(true);
    try {
      const res = await autoDispatchCredentials(student as any, {
        batchTitle: student.batchTitle,
        openWhatsAppFallback: true
      });
      setStatus(res);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-emerald-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="text-center mb-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Account Approved & Activated!</h3>
          <p className="text-xs text-slate-500 mt-1">
            Credentials auto-generated for <span className="font-bold text-indigo-600">{student.name}</span>
          </p>
        </div>

        {/* Automatic Delivery Status Banner */}
        <div className="space-y-2 mb-4">
          {student.email && (
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
              status.email.sent
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-2 font-medium truncate">
                <Mail className={`w-4 h-4 shrink-0 ${status.email.sent ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="truncate">Email: <strong>{student.email}</strong></span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                status.email.sent
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {status.email.sent ? 'Sent ✓' : 'Dispatched'}
              </span>
            </div>
          )}

          <div className="p-2.5 rounded-xl border bg-emerald-50/70 border-emerald-200 text-emerald-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium truncate">
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">WhatsApp: <strong>+91 {student.phone}</strong></span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 shrink-0">
              Auto Sent ✓
            </span>
          </div>
        </div>

        {/* Credentials Display Box */}
        <div className="bg-slate-950 text-white rounded-2xl p-4 mb-4 border border-slate-800 space-y-2.5 font-mono text-xs shadow-md">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400 font-sans font-medium">Student ID</span>
            <span className="text-indigo-400 font-bold text-sm tracking-wide">{student.id}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400 font-sans font-medium">Password</span>
            <span className="text-emerald-400 font-bold text-sm tracking-wide">{student.password}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-sans font-medium">Mobile Number</span>
            <span className="text-slate-200 font-semibold">{student.phone}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleWhatsAppShare}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01]"
          >
            <MessageCircle className="w-4 h-4" />
            Open WhatsApp Chat
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              {copied ? 'Copied!' : 'Copy Credentials'}
            </button>

            <button
              onClick={handleResendBoth}
              disabled={isResending}
              className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors shadow-sm disabled:opacity-60"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Resending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Resend Both</span>
                </>
              )}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 text-center block transition-colors"
        >
          Done & Close
        </button>
      </div>
    </div>
  );
};
