export interface EmailAttachment {
  filename: string;
  content: string;
  mimeType: string;
}

export interface SendNotePayload {
  to: string[];
  subject: string;
  bodyHtml: string;
  attachment?: EmailAttachment;
}

export interface SendNoteResult {
  success: boolean;
  sentCount: number;
  failedEmails: string[];
  error?: string;
}

export const sendNoteEmails = async (payload: SendNotePayload): Promise<SendNoteResult> => {
  try {
    const response = await fetch('/api/send-note-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, sentCount: 0, failedEmails: [], error: data.error || `HTTP ${response.status}` };
    }

    return {
      success: data.success ?? false,
      sentCount: data.sentCount ?? 0,
      failedEmails: data.failedEmails ?? [],
      error: data.error
    };
  } catch (err: any) {
    return { success: false, sentCount: 0, failedEmails: [], error: err.message || 'Network error.' };
  }
};
