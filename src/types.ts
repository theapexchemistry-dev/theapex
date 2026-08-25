export type Role = 'guest' | 'admin' | 'student' | 'moderator';

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
  board?: string; // e.g. "CBSE", "ICSE", "ISC", "State Board"
  batchId: string;
  batchTitle?: string;
  phone: string;
  email?: string; // email for calendar reminders
  fees: number; // monthly fee amount
  joiningDate: string;
  avatarUrl?: string;
  status?: 'active' | 'pending';
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
  answerImageUrl?: string;
  answeredAt?: string;
  aiAnswer?: string;
  aiConfidence?: 'high' | 'medium' | 'low' | 'unknown';
  aiFollowUp?: string;
  aiAnsweredAt?: string;
  escalatedToFaculty?: boolean;
  createdAt: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[]; // [Option A, Option B, Option C, Option D]
  correctOption: number; // 0=A, 1=B, 2=C, 3=D
  explanation?: string;
  marks?: number;
  negativeMarks?: number;
}

export interface StudentSubmission {
  studentId: string;
  studentName: string;
  submittedAt: string;
  timeSpentSeconds?: number;
  answers: Record<string, number>; // questionId -> selectedOption index (0, 1, 2, 3) or -1
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number;
  rank?: number;
  autoSubmitted?: boolean;
  autoSubmittedReason?: string;
}

export interface TestResult {
  studentId: string;
  studentName: string;
  marksObtained: number;
  rank?: number;
  correctCount?: number;
  wrongCount?: number;
  unansweredCount?: number;
  timeSpentSeconds?: number;
  submittedAt?: string;
  submission?: StudentSubmission;
}

export interface Test {
  id: string;
  title: string; // e.g. "Chemical Bonding & Molecular Structure Test 1"
  topic?: string;
  className?: string;
  batchId: string;
  batchTitle?: string;
  totalMarks: number;
  durationMinutes: number; // e.g. 10, 15, 20, 30, 45, 60, 90, 120
  marksPerQuestion?: number;
  negativeMarksPerQuestion?: number;
  date: string; // YYYY-MM-DD
  scheduledStartTime?: string; // ISO or YYYY-MM-DDTHH:mm
  expiryDateTime?: string; // ISO or YYYY-MM-DDTHH:mm (Test window closing deadline)
  status?: 'scheduled' | 'live' | 'completed';
  testType?: 'live' | 'offline_marks';
  questions?: Question[];
  submissions?: Record<string, StudentSubmission>; // studentId -> submission
  results: TestResult[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'doubt' | 'fee_reminder' | 'note' | 'test' | 'payment_received' | 'announcement' | 'support_request' | 'student' | 'student_registration';
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

export interface Announcement {
  id: string;
  type: 'Reminder' | 'Notice' | 'Tests';
  title: string;
  message: string;
  targetAudience: 'all' | string; // 'all' or batchId
  createdAt: string;
  imageUrl?: string;
  reactions?: Record<string, number>; // emoji -> count
  userReactions?: Record<string, string>; // studentId -> emoji
}

