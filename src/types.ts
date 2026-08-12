export type Role = 'guest' | 'admin' | 'student';

export interface Batch {
  id: string;
  title: string; // e.g. "Class 11 Organic Mastery JEE 2026"
  className: string; // "Class 9", "Class 10", "Class 11", "Class 12"
  time: string; // e.g. "05:00 PM - 06:30 PM"
  days: string[]; // ["Mon", "Wed", "Fri"]
  fees: number; // e.g. 2500
  createdAt: string;
}

export interface Student {
  id: string; // Student ID e.g. APEX2026-101
  password?: string; // Student password (kept hidden in profile view)
  name: string;
  className: string; // "Class 9", "Class 10", "Class 11", "Class 12"
  batchId: string;
  batchTitle?: string;
  phone: string;
  email?: string; // email for calendar reminders
  fees: number; // monthly fee amount
  joiningDate: string;
  avatarUrl?: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  batchId: string;
  month: string; // e.g. "April 2026", "May 2026"
  amount: number;
  status: 'paid' | 'unpaid' | 'pending_verification';
  paidDate?: string;
  transactionRef?: string;
  screenshotUrl?: string;
}

export interface Note {
  id: string;
  title: string;
  subject: string; // e.g. "Physical Chemistry", "Organic Chemistry", "Inorganic Chemistry"
  batchId: string;
  batchTitle?: string;
  fileUrl?: string;
  fileName: string;
  fileSize: string;
  createdAt: string;
  description?: string;
  recipientCount?: number;
}

export interface Doubt {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  batchId: string;
  batchTitle?: string;
  question: string;
  subject: string;
  imageUrl?: string;
  status: 'pending' | 'answered' | 'ai_answered' | 'escalated';
  answerText?: string;
  answeredAt?: string;
  aiAnswer?: string;
  aiConfidence?: 'high' | 'medium' | 'low' | 'unknown';
  aiFollowUp?: string;
  aiAnsweredAt?: string;
  escalatedToFaculty?: boolean;
  createdAt: string;
}

export interface TestResult {
  studentId: string;
  studentName: string;
  marksObtained: number;
  rank?: number;
}

export interface Test {
  id: string;
  title: string; // e.g. "Chemical Bonding & Molecular Structure Test 1"
  batchId: string;
  batchTitle?: string;
  totalMarks: number;
  date: string; // YYYY-MM-DD
  results: TestResult[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'doubt' | 'fee_reminder' | 'note' | 'test' | 'payment_received';
  timestamp: string;
  targetRole: 'admin' | 'student';
  targetStudentId?: string;
  read: boolean;
}

export interface NoteEmailLog {
  id: string;
  title: string;
  subject: string;
  batchId: string;
  batchTitle: string;
  fileName: string;
  fileUrl?: string;
  description: string;
  sentAt: string;
  recipientCount: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}
export interface Meeting {
  id: string;
  roomName: string;
  batchId: string;
  batchName: string;
  status: 'active' | 'ended';
  startedAt: string;
  startedBy: string;
  endedAt?: string;
}

// ── Support Desk — tickets raised by students from the Help tab ─────────────
// A student submits a ticket from StudentHelp.tsx via
// StorageService.saveSupportRequest(...). It lands in the admin's
// AdminSupport.tsx tab ("Support Tickets") where the admin can mark it
// resolved. Tickets sync to the Firestore `supportRequests` collection so
// they appear on the admin's device in real time.
export interface SupportRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  issueType: string;
  message: string;
  status: 'pending' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}
