// storage.ts — FIXED
// CRITICAL FIX: Fee records are now DEDUPED by (studentId + month).
// - getFeeRecords() always returns deduped records.
// - saveFeeRecords() dedupes before saving (so duplicates never get written).
// - addFeeRecord() now checks if a record for the same studentId+month
//   already exists — if so, it UPDATES it instead of creating a duplicate.
//   (Previously, "Mark Paid (Cash)" + Firestore sync could create two records
//   for the same month with different IDs, causing the duplicate badges and
//   inflated due amounts shown in the Fee Ledger.)
import { syncArrayToFirestore, syncDocToFirestore, deleteFromFirestore, dedupeFeeRecords } from './firebaseSync';
import {
  Batch,
  Student,
  FeeRecord,
  Note,
  Doubt,
  Test,
  TestResult,
  Question,
  StudentSubmission,
  NotificationItem,
  SupabaseConfig,
  SupportRequest,
  Announcement // <-- ADDED IMPORT HERE
} from '../types';
import {
  INITIAL_BATCHES,
  INITIAL_STUDENTS,
  INITIAL_FEES,
  INITIAL_NOTES,
  INITIAL_DOUBTS,
  INITIAL_TESTS,
  INITIAL_NOTIFICATIONS
} from '../data/mockData';

const KEYS = {
  BATCHES: 'apex_batches_v2',
  STUDENTS: 'apex_students_v2',
  FEES: 'apex_fees_v2',
  NOTES: 'apex_notes_v2',
  DOUBTS: 'apex_doubts_v2',
  TESTS: 'apex_tests_v2',
  NOTIFICATIONS: 'apex_notifications_v2',
  SUPPORT_REQUESTS: 'apex_support_requests_v2',
  ANNOUNCEMENTS: 'apex_announcements_v2', // <-- ADDED KEY HERE
  SUPABASE_CONFIG: 'apex_supabase_config_v2',
  SITE_LOGO: 'apex_site_logo',
  SITE_NAME: 'apex_site_name',
  TAGLINE: 'apex_tagline',
  DELETED_STUDENT_IDS: 'apex_deleted_student_ids',
  DELETED_TEST_IDS: 'apex_deleted_test_ids',
  DELETED_DOUBT_IDS: 'apex_deleted_doubt_ids',
  EMAIL_CONFIG: 'apex_email_config_v2'
};

function getItem<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error('Error reading localStorage', e);
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
}

export class StorageService {
  // -------- Config --------
  static getSupabaseConfig(): SupabaseConfig {
    const metaEnv = (import.meta as any).env || {};
    return getItem<SupabaseConfig>(KEYS.SUPABASE_CONFIG, {
      url: metaEnv.VITE_SUPABASE_URL || '',
      anonKey: metaEnv.VITE_SUPABASE_ANON_KEY || '',
      isConnected: false
    });
  }

  static saveSupabaseConfig(config: SupabaseConfig): void {
    setItem(KEYS.SUPABASE_CONFIG, config);
  }

  // -------- Website Branding (logo / name / tagline) — syncs to Firestore --------
  static getSiteLogo(): string {
    try {
      return localStorage.getItem(KEYS.SITE_LOGO) || '';
    } catch {
      return '';
    }
  }

  static async saveSiteLogo(base64DataUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      localStorage.setItem(KEYS.SITE_LOGO, base64DataUrl);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('apex_storage_updated'));
      }
      await syncDocToFirestore('siteSettings', 'logo', {
        id: 'logo',
        logoData: base64DataUrl,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (e: any) {
      console.error('Error saving site logo to Firestore:', e);
      return { success: false, error: e?.message || 'Unknown error' };
    }
  }

  static async clearSiteLogo(): Promise<void> {
    try {
      localStorage.removeItem(KEYS.SITE_LOGO);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('apex_storage_updated'));
      }
      await deleteFromFirestore('siteSettings', 'logo');
    } catch (e) {
      console.error('Error clearing site logo', e);
    }
  }

  static getSiteName(): string {
    try {
      return localStorage.getItem(KEYS.SITE_NAME) || 'THE APEX WORLD';
    } catch {
      return 'THE APEX WORLD';
    }
  }

  static async saveSiteName(name: string): Promise<void> {
    try {
      localStorage.setItem(KEYS.SITE_NAME, name);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('apex_storage_updated'));
      await syncDocToFirestore('siteSettings', 'branding', {
        id: 'branding',
        siteName: name,
        tagline: this.getTagline(),
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error saving site name', e);
    }
  }

  static getTagline(): string {
    try {
      return localStorage.getItem(KEYS.TAGLINE) || 'Empowering Minds, Enriching Futures';
    } catch {
      return 'Empowering Minds, Enriching Futures';
    }
  }

  static async saveTagline(tagline: string): Promise<void> {
    try {
      localStorage.setItem(KEYS.TAGLINE, tagline);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('apex_storage_updated'));
      await syncDocToFirestore('siteSettings', 'branding', {
        id: 'branding',
        siteName: this.getSiteName(),
        tagline: tagline,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error saving tagline', e);
    }
  }

  // -------- Email & SMTP Configuration --------
  static getEmailConfig(): { gmailUser: string; gmailAppPassword: string; senderName?: string } {
    try {
      const data = localStorage.getItem(KEYS.EMAIL_CONFIG);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    return {
      gmailUser: 'theapexchemistry@gmail.com',
      gmailAppPassword: '',
      senderName: 'The Apex Chemistry'
    };
  }

  static async saveEmailConfig(config: { gmailUser: string; gmailAppPassword: string; senderName?: string }): Promise<void> {
    try {
      const cleanConfig = {
        gmailUser: (config.gmailUser || '').trim(),
        gmailAppPassword: (config.gmailAppPassword || '').trim().replace(/\s+/g, ''),
        senderName: (config.senderName || 'The Apex Chemistry').trim()
      };
      localStorage.setItem(KEYS.EMAIL_CONFIG, JSON.stringify(cleanConfig));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('apex_storage_updated'));
      await syncDocToFirestore('siteSettings', 'emailConfig', {
        id: 'emailConfig',
        ...cleanConfig,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error saving email configuration:', e);
    }
  }

  static async clearEmailConfig(): Promise<void> {
    try {
      localStorage.removeItem(KEYS.EMAIL_CONFIG);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('apex_storage_updated'));
      await deleteFromFirestore('siteSettings', 'emailConfig');
    } catch (e) {
      console.error('Error clearing email configuration:', e);
    }
  }

  // -------- Deleted student IDs blacklist (prevents ID reuse after deletion) --------
  static getDeletedStudentIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.DELETED_STUDENT_IDS) || '[]');
    } catch {
      return [];
    }
  }

  static async addDeletedStudentId(id: string): Promise<void> {
    const deleted = this.getDeletedStudentIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(KEYS.DELETED_STUDENT_IDS, JSON.stringify(deleted));
      try {
        await syncDocToFirestore('siteSettings', 'deletedStudentIds', {
          id: 'deletedStudentIds',
          ids: deleted,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error syncing deleted student IDs:', e);
      }
    }
  }

  // -------- Deleted test IDs blacklist (prevents restoration from offline sync) --------
  static getDeletedTestIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.DELETED_TEST_IDS) || '[]');
    } catch {
      return [];
    }
  }

  static async addDeletedTestId(id: string): Promise<void> {
    const deleted = this.getDeletedTestIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(KEYS.DELETED_TEST_IDS, JSON.stringify(deleted));
      try {
        await syncDocToFirestore('siteSettings', 'deletedTestIds', {
          id: 'deletedTestIds',
          ids: deleted,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error syncing deleted test IDs:', e);
      }
    }
  }

  // -------- Deleted doubt IDs blacklist (prevents restoration from offline sync) --------
  static getDeletedDoubtIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.DELETED_DOUBT_IDS) || '[]');
    } catch {
      return [];
    }
  }

  static async addDeletedDoubtId(id: string): Promise<void> {
    const deleted = this.getDeletedDoubtIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(KEYS.DELETED_DOUBT_IDS, JSON.stringify(deleted));
      try {
        await syncDocToFirestore('siteSettings', 'deletedDoubtIds', {
          id: 'deletedDoubtIds',
          ids: deleted,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error syncing deleted doubt IDs:', e);
      }
    }
  }

  // -------- Batches --------
  static getBatches(): Batch[] {
    return getItem<Batch[]>(KEYS.BATCHES, INITIAL_BATCHES);
  }

  static saveBatches(batches: Batch[]): void {
    setItem(KEYS.BATCHES, batches);
    syncArrayToFirestore('batches', batches);
  }

  static addBatch(batchData: Omit<Batch, 'id' | 'createdAt'>): Batch {
    const batches = this.getBatches();
    const newBatch: Batch = {
      ...batchData,
      id: 'b-' + Date.now().toString(36),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newBatch, ...batches];
    this.saveBatches(updated);
    return newBatch;
  }

  static updateBatch(id: string, batchData: Partial<Omit<Batch, 'id' | 'createdAt'>>): Batch | null {
    const batches = this.getBatches();
    let updatedBatch: Batch | null = null;
    const updated = batches.map(b => {
      if (b.id === id) {
        updatedBatch = { ...b, ...batchData };
        return updatedBatch;
      }
      return b;
    });

    if (updatedBatch) {
      this.saveBatches(updated);
    }
    return updatedBatch;
  }

  static deleteBatch(id: string): void {
    deleteFromFirestore('batches', id);
    const batches = this.getBatches().filter(b => b.id !== id);
    this.saveBatches(batches);
  }

  // -------- Students --------
  static getStudents(): Student[] {
    const deletedIds = this.getDeletedStudentIds();
    const raw = getItem<Student[]>(KEYS.STUDENTS, INITIAL_STUDENTS);
    if (deletedIds.length > 0) {
      const filtered = raw.filter(s => s && s.id && !deletedIds.includes(s.id));
      if (filtered.length !== raw.length) {
        setItem(KEYS.STUDENTS, filtered);
      }
      return filtered;
    }
    return raw;
  }

  static saveStudents(students: Student[]): void {
    const deletedIds = this.getDeletedStudentIds();
    const cleanStudents = deletedIds.length > 0
      ? students.filter(s => s && s.id && !deletedIds.includes(s.id))
      : students;
    setItem(KEYS.STUDENTS, cleanStudents);
    syncArrayToFirestore('students', cleanStudents);
  }

  static generateStudentCredentials(): { id: string; pass: string } {
    const year = new Date().getFullYear();
    const existing = this.getStudents();

    const usedIds = new Set<string>();
    existing.forEach(s => usedIds.add(s.id));

    const deletedIds = this.getDeletedStudentIds();
    deletedIds.forEach(id => usedIds.add(id));

    let nextNum = 101;
    while (usedIds.has(`APEX${year}${nextNum}`)) {
      nextNum++;
    }
    const id = `APEX${year}${nextNum}`;

    const pass = 'apex' + Math.floor(1000 + Math.random() * 9000);
    return { id, pass };
  }

  static addStudent(studentData: Omit<Student, 'id' | 'password' | 'joiningDate'>): Student {
    const students = this.getStudents();
    const { id, pass } = this.generateStudentCredentials();
    const joiningDate = new Date().toISOString().split('T')[0];

    const batches = this.getBatches();
    const batch = batches.find(b => b.id === studentData.batchId);

    const newStudent: Student = {
      ...studentData,
      id,
      password: pass,
      joiningDate,
      batchTitle: batch ? batch.title : studentData.batchTitle
    };

    const updated = [newStudent, ...students];
    this.saveStudents(updated);
    syncDocToFirestore('students', newStudent.id, newStudent);

    const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this.addFeeRecord({
      studentId: newStudent.id,
      studentName: newStudent.name,
      batchId: newStudent.batchId,
      month: currentMonth,
      amount: newStudent.fees,
      status: 'unpaid'
    });

    return newStudent;
  }

  static updateStudent(id: string, studentData: Partial<Omit<Student, 'id' | 'password' | 'joiningDate'>>): void {
    const students = this.getStudents();
    const batches = this.getBatches();
    let updatedBatchTitle = studentData.batchTitle;

    if (studentData.batchId) {
      const batch = batches.find(b => b.id === studentData.batchId);
      if (batch) updatedBatchTitle = batch.title;
    }

    let updatedStudentObj: Student | null = null;
    const updated = students.map(s => {
      if (s.id === id) {
        updatedStudentObj = { ...s, ...studentData, batchTitle: updatedBatchTitle || s.batchTitle };
        return updatedStudentObj;
      }
      return s;
    });
    this.saveStudents(updated);

    if (updatedStudentObj) {
      syncDocToFirestore('students', id, updatedStudentObj);

      // If this student is now active with fees assigned, ensure they have a fee record for the current month
      const activeObj = updatedStudentObj as Student;
      if (activeObj.status === 'active' && activeObj.fees > 0 && activeObj.batchId !== 'PENDING_BATCH') {
        const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const allFees = this.getFeeRecords();
        const hasFee = allFees.some(f => f.studentId === id && f.month === currentMonth);
        if (!hasFee) {
          this.addFeeRecord({
            studentId: activeObj.id,
            studentName: activeObj.name,
            batchId: activeObj.batchId,
            month: currentMonth,
            amount: activeObj.fees,
            status: 'unpaid'
          });
        }
      }
    }
  }

  static deleteStudent(id: string): void {
    this.addDeletedStudentId(id);

    // 1. Delete student from Firestore
    deleteFromFirestore('students', id);

    // 2. Delete the student's fee records from Firestore & local
    const allFees = this.getFeeRecords();
    const studentFees = allFees.filter(f => f.studentId === id);
    studentFees.forEach(f => deleteFromFirestore('feeRecords', f.id));
    const remainingFees = allFees.filter(f => f.studentId !== id);
    this.saveFeeRecords(remainingFees);

    // 3. Delete any doubts from Firestore & local
    const allDoubts = this.getDoubts();
    const studentDoubts = allDoubts.filter(d => d.studentId === id);
    studentDoubts.forEach(d => deleteFromFirestore('doubts', d.id));
    const remainingDoubts = allDoubts.filter(d => d.studentId !== id);
    this.saveDoubts(remainingDoubts);

    // 4. Clean local storage students list
    const remainingStudents = this.getStudents().filter(s => s.id !== id);
    setItem(KEYS.STUDENTS, remainingStudents);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  // -------- Fees (DEDUPED) --------
  // FIX: getFeeRecords() now returns DEDUPED records — one per (studentId + month).
  // This eliminates the duplicate "Paid" + "Unpaid" badges for the same month
  // and fixes the inflated due-amount calculation.
  //
  // FIX 2: Also filters out fee records belonging to DELETED students.
  // When a student is deleted, their fee records are removed from localStorage
  // but can survive in Firestore. The Firestore listener pushes them back into
  // localStorage on every sync. Since the Fee Ledger tab only shows fees for
  // current students, these "ghost" fees were invisible but still counted in
  // the dashboard's pending total. This filter ensures they never affect the
  // pending count or any other fee calculation.
  static getFeeRecords(): FeeRecord[] {
    const raw = getItem<FeeRecord[]>(KEYS.FEES, INITIAL_FEES);
    const deduped = dedupeFeeRecords(raw);
    const deletedIds = this.getDeletedStudentIds();
    if (deletedIds.length === 0) return deduped;
    const deletedSet = new Set(deletedIds);
    return deduped.filter(f => !deletedSet.has(f.studentId));
  }

  static saveFeeRecords(fees: FeeRecord[]): void {
    // Dedupe BEFORE saving so duplicates never get persisted
    const clean = dedupeFeeRecords(fees);
    setItem(KEYS.FEES, clean);
    syncArrayToFirestore('feeRecords', clean);
  }

  // FIX: addFeeRecord() now checks if a record for the same (studentId + month)
  // already exists. If so, it UPDATES that record instead of creating a new
  // duplicate. This is the main source of duplicate badges.
  static addFeeRecord(feeData: Omit<FeeRecord, 'id'>): FeeRecord {
    const fees = this.getFeeRecords();

    // Check for an existing record for the same student + month
    const existingIdx = fees.findIndex(
      f => f.studentId === feeData.studentId && f.month === feeData.month
    );

    if (existingIdx >= 0) {
      // Update the existing record instead of creating a duplicate
      const existing = fees[existingIdx];
      const updatedRecord: FeeRecord = {
        ...existing,
        ...feeData,
        id: existing.id, // keep original ID
      };
      fees[existingIdx] = updatedRecord;
      this.saveFeeRecords(fees);
      return updatedRecord;
    }

    // No existing record — create a new one
    const newRecord: FeeRecord = {
      ...feeData,
      id: 'f-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
    };
    const updated = [newRecord, ...fees];
    this.saveFeeRecords(updated);
    return newRecord;
  }

  static updateFeeStatus(
    recordId: string,
    status: 'paid' | 'unpaid' | 'pending_verification',
    transactionRef?: string,
    screenshotUrl?: string
  ): void {
    const fees = this.getFeeRecords();
    const updated = fees.map(f => {
      if (f.id === recordId) {
        return {
          ...f,
          status,
          paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : f.paidDate,
          transactionRef: transactionRef || f.transactionRef,
          screenshotUrl: screenshotUrl || f.screenshotUrl
        };
      }
      return f;
    });
    this.saveFeeRecords(updated);
  }

  static deleteFeeRecord(id: string): void {
    deleteFromFirestore('feeRecords', id);
    const fees = this.getFeeRecords().filter(f => f.id !== id);
    this.saveFeeRecords(fees);
  }

  // ── ONE-TIME CLEANUP MIGRATION ──────────────────────────────────────────
  // Removes duplicate fee records that already exist in localStorage from
  // earlier (buggy) versions of the app. Idempotent — safe to call on every
  // boot. If duplicates are found, they are collapsed (best status wins) and
  // the cleaned list is written back to localStorage + pushed to Firestore.
  //
  // This is the "vaccine" that fixes the Fee Ledger for users who already
  // have corrupted data from the old dedupe-free code path.
  static cleanupDuplicateFeeRecords(): { removed: number; kept: number } {
    try {
      const raw = localStorage.getItem(KEYS.FEES);
      if (!raw) return { removed: 0, kept: 0 };
      let parsed: FeeRecord[];
      try {
        parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return { removed: 0, kept: 0 };
      } catch {
        return { removed: 0, kept: 0 };
      }

      const clean = dedupeFeeRecords(parsed);
      const removed = parsed.length - clean.length;
      if (removed > 0) {
        localStorage.setItem(KEYS.FEES, JSON.stringify(clean));
        try {
          syncArrayToFirestore('feeRecords', clean);
        } catch (e) {
          console.debug('cleanupDuplicateFeeRecords: Firestore sync skipped:', e);
        }
        console.warn(
          `[storage] Fee Ledger cleanup: removed ${removed} duplicate record(s), kept ${clean.length}.`
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('apex_storage_updated'));
        }
      }
      return { removed, kept: clean.length };
    } catch (e) {
      console.debug('cleanupDuplicateFeeRecords failed:', e);
      return { removed: 0, kept: 0 };
    }
  }

  // -------- Notes --------
  static getNotes(): Note[] {
    return getItem<Note[]>(KEYS.NOTES, INITIAL_NOTES);
  }

  static saveNotes(notes: Note[]): void {
    setItem(KEYS.NOTES, notes);
    syncArrayToFirestore('notes', notes);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  static addNote(noteData: Omit<Note, 'id' | 'createdAt'> & { id?: string }): Note {
    const notes = this.getNotes();
    const batches = this.getBatches();
    const batch = batches.find(b => b.id === noteData.batchId);

    const newNote: Note = {
      ...noteData,
      id: noteData.id || 'n-' + Date.now().toString(36),
      batchTitle: batch ? batch.title : noteData.batchTitle,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newNote, ...notes];
    this.saveNotes(updated);

    this.addNotification({
      title: 'New Study Material Notes Uploaded',
      message: `${newNote.title} has been added to batch ${newNote.batchTitle || ''}.`,
      type: 'note',
      timestamp: 'Just now',
      targetRole: 'student',
      read: false
    });

    return newNote;
  }

  static deleteNote(id: string): void {
    deleteFromFirestore('notes', id);
    const notes = this.getNotes().filter(n => n.id !== id);
    this.saveNotes(notes);
  }

  // -------- Doubts --------
  static getDoubts(): Doubt[] {
    return getItem<Doubt[]>(KEYS.DOUBTS, INITIAL_DOUBTS);
  }

  static saveDoubts(doubts: Doubt[]): void {
    setItem(KEYS.DOUBTS, doubts);
    syncArrayToFirestore('doubts', doubts);
  }

  static addDoubt(
    doubtData: Omit<Doubt, 'id' | 'status' | 'createdAt'> & {
      aiAnswer?: string;
      aiConfidence?: 'high' | 'medium' | 'low' | 'unknown';
      aiFollowUp?: string;
      escalatedToFaculty?: boolean;
    }
  ): Doubt {
    const doubts = this.getDoubts();
    const batches = this.getBatches();
    const batch = batches.find(b => b.id === doubtData.batchId);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let status: Doubt['status'] = 'pending';
    if (doubtData.aiAnswer) {
      status = doubtData.escalatedToFaculty ? 'escalated' : 'ai_answered';
    }

    const newDoubt: Doubt = {
      ...doubtData,
      id: 'd-' + Date.now().toString(36),
      batchTitle: batch ? batch.title : doubtData.batchTitle,
      status,
      createdAt: formattedDate,
      aiAnsweredAt: doubtData.aiAnswer ? formattedDate : undefined
    };

    const updated = [newDoubt, ...doubts];
    this.saveDoubts(updated);
    syncDocToFirestore('doubts', newDoubt.id, newDoubt);

    const escalationNote = newDoubt.escalatedToFaculty
      ? ' (AI could not fully resolve — needs faculty review)'
      : newDoubt.aiAnswer
      ? ' (AI answered — review recommended)'
      : '';

    this.addNotification({
      title: newDoubt.escalatedToFaculty
        ? '⚠ Student Doubt Needs Faculty Reply'
        : 'New Student Doubt Received',
      message: `${newDoubt.studentName} (${newDoubt.studentClass}) asked a question in ${newDoubt.subject}.${escalationNote}`,
      type: 'doubt',
      timestamp: 'Just now',
      targetRole: 'admin',
      read: false
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }

    return newDoubt;
  }

  static answerDoubt(id: string, answerText: string, answerImageUrl?: string): void {
    const doubts = this.getDoubts();
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let targetStudentId = '';
    let targetQuestion = '';
    let answeredDoubtDoc: Doubt | null = null;

    const updated = doubts.map(d => {
      if (d.id === id) {
        targetStudentId = d.studentId;
        targetQuestion = d.question;
        answeredDoubtDoc = {
          ...d,
          status: 'answered' as const,
          answerText,
          answerImageUrl,
          answeredAt: formattedDate
        };
        return answeredDoubtDoc;
      }
      return d;
    });

    this.saveDoubts(updated);

    if (answeredDoubtDoc) {
      syncDocToFirestore('doubts', answeredDoubtDoc.id, answeredDoubtDoc);
    }

    if (targetStudentId) {
      const questionSnippet = targetQuestion.length > 40 ? targetQuestion.substring(0, 40) + '...' : targetQuestion;
      this.addNotification({
        title: 'Faculty Answered Your Doubt!',
        message: `Mr. Subhamoy Mondal replied to your question: "${questionSnippet}"`,
        type: 'doubt',
        timestamp: 'Just now',
        targetRole: 'student',
        targetStudentId,
        read: false
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  static async deleteDoubt(id: string): Promise<void> {
    try {
      // 1. Blacklist the deleted doubt ID to prevent restoration from stale syncs
      await this.addDeletedDoubtId(id);
      // 2. Permanently delete from Firestore 'doubts' collection
      await deleteFromFirestore('doubts', id);
    } catch (e) {
      console.error('Error during remote doubt deletion:', e);
    }
    // 3. Remove from local storage
    const doubts = this.getDoubts().filter(d => d.id !== id);
    setItem(KEYS.DOUBTS, doubts);
    // 4. Dispatch global event so all components/tabs refresh immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  // -------- Tests & Automatic Rank Handler --------
  static getTests(): Test[] {
    return getItem<Test[]>(KEYS.TESTS, INITIAL_TESTS);
  }

  static saveTests(tests: Test[]): void {
    setItem(KEYS.TESTS, tests);
    syncArrayToFirestore('tests', tests);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  static getTestById(id: string): Test | undefined {
    return this.getTests().find(t => t.id === id);
  }

  static calculateRanks(results: TestResult[]): TestResult[] {
    const sorted = [...results].sort((a, b) => b.marksObtained - a.marksObtained);

    let currentRank = 1;
    return sorted.map((res, index) => {
      if (index > 0 && res.marksObtained < sorted[index - 1].marksObtained) {
        currentRank = index + 1;
      }
      return {
        ...res,
        rank: currentRank
      };
    });
  }

  static addTest(testData: Omit<Test, 'id' | 'createdAt' | 'results'> & { results?: TestResult[] }, results: TestResult[] = []): Test {
    const tests = this.getTests();
    const batches = this.getBatches();
    const batch = batches.find(b => b.id === testData.batchId);

    const initialResults = results && results.length > 0 ? results : (testData.results || []);
    const rankedResults = this.calculateRanks(initialResults);

    const newTest: Test = {
      ...testData,
      id: 't-' + Date.now().toString(36),
      batchTitle: batch ? batch.title : testData.batchTitle,
      durationMinutes: testData.durationMinutes || 20,
      totalMarks: testData.totalMarks || 100,
      status: testData.status || (testData.testType === 'live' ? 'live' : 'completed'),
      testType: testData.testType || 'live',
      questions: testData.questions || [],
      submissions: testData.submissions || {},
      results: rankedResults,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = [newTest, ...tests];
    this.saveTests(updated);
    syncDocToFirestore('tests', newTest.id, newTest);

    const isLive = newTest.testType === 'live';
    this.addNotification({
      title: isLive ? '🎯 New Live Chemistry Test Hosted!' : 'New Test Results Published',
      message: isLive
        ? `"${newTest.title}" (${newTest.durationMinutes} mins, ${newTest.totalMarks} Marks) is now hosted for ${newTest.batchTitle || 'your batch'}.`
        : `Scores and Ranks for "${newTest.title}" have been released by Admin!`,
      type: 'test',
      timestamp: 'Just now',
      targetRole: 'student',
      read: false
    });

    return newTest;
  }

  static updateTest(id: string, updates: Partial<Test>): void {
    const tests = this.getTests();
    let updatedDoc: Test | null = null;

    const updated = tests.map(t => {
      if (t.id === id) {
        let results = updates.results !== undefined ? updates.results : t.results;
        if (updates.results) {
          results = this.calculateRanks(results);
        }
        updatedDoc = { ...t, ...updates, results };
        return updatedDoc;
      }
      return t;
    });

    this.saveTests(updated);
    if (updatedDoc) {
      syncDocToFirestore('tests', id, updatedDoc);
    }
  }

  static async deleteTest(id: string): Promise<void> {
    try {
      // 1. Blacklist the deleted test ID to prevent restoration from stale syncs
      await this.addDeletedTestId(id);
      // 2. Permanently delete from Firestore 'tests' collection
      await deleteFromFirestore('tests', id);
    } catch (e) {
      console.error('Error during remote test deletion:', e);
    }
    // 3. Remove from local storage
    const tests = this.getTests().filter(t => t.id !== id);
    this.saveTests(tests);
    // 4. Dispatch global event so all components/tabs refresh immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  /**
   * Submits a student's live exam response, calculates scores, accuracy,
   * updates the class leaderboard and recalculates class ranks immediately.
   */
  static submitLiveTest(testId: string, submission: StudentSubmission): { test: Test; myResult: TestResult } {
    const tests = this.getTests();
    const testIndex = tests.findIndex(t => t.id === testId);
    if (testIndex === -1) {
      throw new Error(`Test with ID ${testId} not found.`);
    }

    const test = tests[testIndex];
    const submissions = { ...(test.submissions || {}) };
    submissions[submission.studentId] = submission;

    // Filter out previous result for this student if any
    const otherResults = (test.results || []).filter(r => r.studentId !== submission.studentId);

    const newResult: TestResult = {
      studentId: submission.studentId,
      studentName: submission.studentName,
      marksObtained: submission.score,
      correctCount: submission.correctCount,
      wrongCount: submission.wrongCount,
      unansweredCount: submission.unansweredCount,
      timeSpentSeconds: submission.timeSpentSeconds,
      submittedAt: submission.submittedAt,
      submission
    };

    const combinedResults = [...otherResults, newResult];
    const rankedResults = this.calculateRanks(combinedResults);

    // Update submission object with calculated rank
    const myRankedResult = rankedResults.find(r => r.studentId === submission.studentId) || newResult;
    submission.rank = myRankedResult.rank;
    submissions[submission.studentId] = submission;
    myRankedResult.submission = submission;

    const updatedTest: Test = {
      ...test,
      submissions,
      results: rankedResults
    };

    tests[testIndex] = updatedTest;
    this.saveTests(tests);
    syncDocToFirestore('tests', testId, updatedTest);

    // Add student notification
    this.addNotification({
      title: '🎯 Test Submitted Successfully!',
      message: `You scored ${submission.score}/${test.totalMarks} in "${test.title}". Your current Class Rank is #${myRankedResult.rank}!`,
      type: 'test',
      timestamp: 'Just now',
      targetRole: 'student',
      targetStudentId: submission.studentId,
      read: false
    });

    // Add admin notification
    this.addNotification({
      title: 'Student Test Submission',
      message: `${submission.studentName} submitted "${test.title}" (Score: ${submission.score}/${test.totalMarks}, Rank #${myRankedResult.rank}).`,
      type: 'test',
      timestamp: 'Just now',
      targetRole: 'admin',
      read: false
    });

    return { test: updatedTest, myResult: myRankedResult };
  }

  // -------- Notifications --------
  static getNotifications(): NotificationItem[] {
    return getItem<NotificationItem[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  }

  static saveNotifications(notifs: NotificationItem[]): void {
    setItem(KEYS.NOTIFICATIONS, notifs);
    syncArrayToFirestore('notifications', notifs);
  }

  static addNotification(
    notif: Omit<NotificationItem, 'id' | 'timestamp'> & { timestamp?: string }
  ): NotificationItem {
    const notifs = this.getNotifications();

    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const newNotif: NotificationItem = {
      ...notif,
      id: 'n-' + Date.now().toString(36),
      timestamp: notif.timestamp && notif.timestamp !== 'Just now' ? notif.timestamp : formattedTime
    };
    const updated = [newNotif, ...notifs];
    this.saveNotifications(updated);
    syncDocToFirestore('notifications', newNotif.id, newNotif);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }

    import('./pushNotifications')
      .then(({ enqueuePushNotification, triggerSystemNotification }) => {
        enqueuePushNotification({
          id: newNotif.id,
          title: newNotif.title,
          message: newNotif.message,
          type: newNotif.type,
          targetRole: newNotif.targetRole,
          targetStudentId: newNotif.targetStudentId
        });

        triggerSystemNotification(newNotif.title, newNotif.message, newNotif.id);
      })
      .catch((e) => console.warn('Push enqueue or trigger failed:', e));

    return newNotif;
  }

  static markSingleNotificationRead(id: string): void {
    const notifs = this.getNotifications();
    let changed = false;
    const updated = notifs.map(n => {
      if (n.id === id && !n.read) {
        changed = true;
        return { ...n, read: true };
      }
      return n;
    });
    if (changed) {
      this.saveNotifications(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('apex_storage_updated'));
      }
    }
  }

  static markNotificationsRead(role: 'admin' | 'student', studentId?: string): void {
    const notifs = this.getNotifications();
    let changed = false;
    const updated = notifs.map(n => {
      if (n.targetRole === role) {
        if (!studentId || !n.targetStudentId || n.targetStudentId.toLowerCase() === studentId.toLowerCase()) {
          if (!n.read) changed = true;
          return { ...n, read: true };
        }
      }
      return n;
    });
    if (changed) {
      this.saveNotifications(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('apex_storage_updated'));
      }
    }
  }

  static markAllNotificationsRead(ids?: string[]): void {
    const notifs = this.getNotifications();
    const idSet = ids && ids.length > 0 ? new Set(ids) : null;
    let changed = false;
    const updated = notifs.map(n => {
      if (idSet ? idSet.has(n.id) : true) {
        if (!n.read) changed = true;
        return { ...n, read: true };
      }
      return n;
    });
    if (changed) {
      this.saveNotifications(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('apex_storage_updated'));
      }
    }
  }

  // -------- Support Requests (Student Support Desk) --------
  // A student submits a ticket from StudentHelp.tsx → saveSupportRequest()
  // writes it to localStorage + Firestore → the admin's AdminSupport.tsx tab
  // receives it in real time via the onSnapshot('supportRequests') listener.
  static getSupportRequests(): SupportRequest[] {
    return getItem<SupportRequest[]>(KEYS.SUPPORT_REQUESTS, []);
  }

  static saveSupportRequest(request: SupportRequest): void {
    const requests = this.getSupportRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index >= 0) {
      requests[index] = request;
    } else {
      requests.unshift(request);
    }
    setItem(KEYS.SUPPORT_REQUESTS, requests);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('apex_storage_updated'));
    syncDocToFirestore('supportRequests', request.id, request);
  }

  static resolveSupportRequest(requestId: string): void {
    const requests = this.getSupportRequests();
    const request = requests.find(r => r.id === requestId);
    if (request) {
      request.status = 'resolved';
      request.resolvedAt = new Date().toISOString();
      setItem(KEYS.SUPPORT_REQUESTS, requests);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('apex_storage_updated'));
      syncDocToFirestore('supportRequests', requestId, request);
    }
  }

  static deleteSupportRequest(requestId: string): void {
    const requests = this.getSupportRequests();
    const updated = requests.filter(r => r.id !== requestId);
    setItem(KEYS.SUPPORT_REQUESTS, updated);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('apex_storage_updated'));
    deleteFromFirestore('supportRequests', requestId);
  }

  // -------- Announcements --------
  static getAnnouncements(): Announcement[] {
    return getItem<Announcement[]>(KEYS.ANNOUNCEMENTS, []);
  }

  static saveAnnouncements(announcements: Announcement[]): void {
    setItem(KEYS.ANNOUNCEMENTS, announcements);
    syncArrayToFirestore('announcements', announcements);
  }

  static addAnnouncement(announcement: Announcement): void {
    const current = this.getAnnouncements();
    const updated = [announcement, ...current];
    this.saveAnnouncements(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  static deleteAnnouncement(id: string): void {
    const current = this.getAnnouncements();
    const updated = current.filter(a => a.id !== id);
    this.saveAnnouncements(updated);
    deleteFromFirestore('announcements', id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }
}
