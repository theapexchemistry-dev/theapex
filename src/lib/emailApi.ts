import { StorageService } from './storage';

export interface EmailAttachment {
  filename: string;
  content: string;
  mimeType: string;
}

export interface EmailConfig {
  gmailUser?: string;
  gmailAppPassword?: string;
  senderName?: string;
}

export interface SendNotePayload {
  to: string[];
  subject: string;
  bodyHtml: string;
  attachment?: EmailAttachment;
  config?: EmailConfig;
}

export interface SendNoteResult {
  success: boolean;
  sentCount: number;
  failedEmails: string[];
  error?: string;
}

export const sendNoteEmails = async (payload: SendNotePayload): Promise<SendNoteResult> => {
  try {
    const savedConfig = StorageService.getEmailConfig();
    const mergedConfig: EmailConfig = {
      gmailUser: payload.config?.gmailUser || savedConfig.gmailUser,
      gmailAppPassword: payload.config?.gmailAppPassword || savedConfig.gmailAppPassword,
      senderName: payload.config?.senderName || savedConfig.senderName
    };

    const response = await fetch('/api/send-note-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        config: mergedConfig
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        sentCount: 0,
        failedEmails: payload.to,
        error: data.error || `Server returned HTTP ${response.status}`
      };
    }

    return {
      success: data.success ?? false,
      sentCount: data.sentCount ?? 0,
      failedEmails: data.failedEmails ?? [],
      error: data.error
    };
  } catch (err: any) {
    return {
      success: false,
      sentCount: 0,
      failedEmails: payload.to,
      error: err.message || 'Network error occurred while contacting email server.'
    };
  }
};

export const sendGeneralEmail = async (payload: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  config?: EmailConfig;
}): Promise<{ success: boolean; sentCount?: number; failedEmails?: string[]; error?: string }> => {
  try {
    const savedConfig = StorageService.getEmailConfig();
    const mergedConfig: EmailConfig = {
      gmailUser: payload.config?.gmailUser || savedConfig.gmailUser,
      gmailAppPassword: payload.config?.gmailAppPassword || savedConfig.gmailAppPassword,
      senderName: payload.config?.senderName || savedConfig.senderName
    };

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        config: mergedConfig
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
};

export const testEmailConnection = async (
  testEmail: string,
  customConfig?: EmailConfig
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const savedConfig = StorageService.getEmailConfig();
    const mergedConfig: EmailConfig = {
      gmailUser: customConfig?.gmailUser || savedConfig.gmailUser,
      gmailAppPassword: customConfig?.gmailAppPassword || savedConfig.gmailAppPassword,
      senderName: customConfig?.senderName || savedConfig.senderName
    };

    const response = await fetch('/api/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testEmail,
        config: mergedConfig
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Server verification failed (HTTP ${response.status})`
      };
    }

    return {
      success: true,
      message: data.message || 'Email service verification succeeded!'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to connect to email verification endpoint.'
    };
  }
};
