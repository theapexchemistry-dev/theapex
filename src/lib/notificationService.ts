import { Student } from '../types';
import { StorageService } from './storage';

export interface DispatchNotificationResult {
  email: { sent: boolean; error: string | null };
  whatsapp: { sent: boolean; error: string | null };
}

/**
 * Automatically dispatches credentials to student via Email and WhatsApp API.
 */
export async function autoDispatchCredentials(
  student: Student,
  options?: {
    batchTitle?: string;
    openWhatsAppFallback?: boolean;
  }
): Promise<DispatchNotificationResult> {
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://theapexchemistry.web.app';
  const emailConfig = StorageService.getEmailConfig();
  
  const payload = {
    studentId: student.id,
    password: student.password || 'apex123',
    name: student.name,
    phone: student.phone,
    email: student.email || '',
    className: student.className,
    batchTitle: options?.batchTitle || student.batchTitle || 'Regular Chemistry Batch',
    portalUrl: currentUrl,
    config: emailConfig?.gmailAppPassword ? emailConfig : undefined
  };

  let serverResult: DispatchNotificationResult = {
    email: { sent: false, error: null },
    whatsapp: { sent: false, error: null }
  };

  // 1. Call server auto-dispatch endpoint
  try {
    const res = await fetch('/api/notify/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const resText = await res.text().catch(() => '');
      try {
        const data = resText ? JSON.parse(resText) : {};
        if (data.results) {
          serverResult = data.results;
        }
      } catch {}
    }
  } catch (err: any) {
    console.warn('[Auto-Dispatch] Backend notification request error:', err);
    serverResult.email.error = err.message || 'Server notification endpoint unavailable';
  }

  // 2. Optional direct WhatsApp fallback when explicitly requested
  const cleanPhone = (student.phone || '').replace(/\D/g, '');
  if (cleanPhone && options?.openWhatsAppFallback === true && !serverResult.whatsapp.sent) {
    const waPhone = cleanPhone.startsWith('91') && cleanPhone.length > 10 ? cleanPhone : `91${cleanPhone}`;
    const shareMessage = `🎓 *Welcome to The Apex Chemistry!*
Dear *${student.name}*,
Your enrollment for *${student.className}* (${options?.batchTitle || student.batchTitle || 'Regular Batch'}) has been approved.

Here are your portal login credentials:
📌 *Student ID:* ${student.id}
🔑 *Password:* ${student.password || 'apex123'}
🌐 *Portal Link:* ${currentUrl}

Please log in to attend live classes, access handwritten notes, view tests, and resolve doubts with Mr. Subhamoy Mondal.

*The Apex Chemistry*`;

    try {
      const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(shareMessage)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      serverResult.whatsapp.sent = true;
    } catch (e: any) {
      serverResult.whatsapp.error = e.message;
    }
  }

  return serverResult;
}

