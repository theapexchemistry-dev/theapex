import { syncArrayToFirestore, syncDocToFirestore, deleteFromFirestore } from './firebaseSync';
import {
  Batch,
  Student,
  FeeRecord,
  Note,
  Doubt,
  Test,
  TestResult,
  NotificationItem,
  SupabaseConfig
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
  SUPABASE_CONFIG: 'apex_supabase_config_v2',
  SITE_LOGO: 'apex_site_logo',
  SITE_NAME: 'apex_site_name',
  TAGLINE: 'apex_tagline',
  DELETED_STUDENT_IDS: 'apex_deleted_student_ids'
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

  static updateBatch(id: string, batchData: Omit<Batch, 'id' | 'createdAt'>): Batch | null {
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
    return getItem<Student[]>(KEYS.STUDENTS, INITIAL_STUDENTS);
  }

  static saveStudents(students: Student[]): void {
    setItem(KEYS.STUDENTS, students);
    syncArrayToFirestore('students', students);
  }

  static generateStudentCredentials(): { id: string; pass: string } {
    const year = new Date().getFullYear();
    const existing = this.getStudents();

    // Build a set of all IDs ever used (current + deleted blacklist)
    const usedIds = new Set<string>();
    existing.forEach(s => usedIds.add(s.id));

    const deletedIds = this.getDeletedStudentIds();
    deletedIds.forEach(id => usedIds.add(id));

    // Find the next available number starting from 101
    let nextNum = 101;
    while (usedIds.has(`APEX${year}${nextNum}`)) {
      nextNum++;
    }
    const id = `APEX${year}${nextNum}`;

    // Random password — always different from any previous one
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

    // Initialize fee record for current month
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

    const updated = students.map(s => {
      if (s.id === id) {
        return { ...s, ...studentData, batchTitle: updatedBatchTitle || s.batchTitle };
      }
      return s;
    });
    this.saveStudents(updated);
  }

  static deleteStudent(id: string): void {
    // Blacklist the ID so it can NEVER be reused (fire-and-forget)
    this.addDeletedStudentId(id);

    // Also delete the student's fee records
    const allFees = this.getFeeRecords();
    const remainingFees = allFees.filter(f => f.studentId !== id);
    this.saveFeeRecords(remainingFees);

    deleteFromFirestore('students', id);
    const students = this.getStudents().filter(s => s.id !== id);
    this.saveStudents(students);
  }

  // -------- Fees --------
  static getFeeRecords(): FeeRecord[] {
    return getItem<FeeRecord[]>(KEYS.FEES, INITIAL_FEES);
  }

  static saveFeeRecords(fees: FeeRecord[]): void {
    setItem(KEYS.FEES, fees);
    syncArrayToFirestore('feeRecords', fees);
  }

  static addFeeRecord(feeData: Omit<FeeRecord, 'id'>): FeeRecord {
    const fees = this.getFeeRecords();
    const newRecord: FeeRecord = {
      ...feeData,
      id: 'f-' + Date.now().toString(36)
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

  // -------- Notes --------
  static getNotes(): Note[] {
    return getItem<Note[]>(KEYS.NOTES, INITIAL_NOTES);
  }

  static saveNotes(notes: Note[]): void {
    setItem(KEYS.NOTES, notes);
    syncArrayToFirestore('notes', notes);
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

    // Notify students
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

  static addDoubt(doubtData: Omit<Doubt, 'id' | 'status' | 'createdAt'>): Doubt {
    const doubts = this.getDoubts();
    const batches = this.getBatches();
    const batch = batches.find(b => b.id === doubtData.batchId);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newDoubt: Doubt = {
      ...doubtData,
      id: 'd-' + Date.now().toString(36),
      batchTitle: batch ? batch.title : doubtData.batchTitle,
      status: 'pending',
      createdAt: formattedDate
    };

    const updated = [newDoubt, ...doubts];
    this.saveDoubts(updated);
    syncDocToFirestore('doubts', newDoubt.id, newDoubt);

    // Trigger Admin notification when student posts a doubt
    this.addNotification({
      title: 'New Student Doubt Received',
      message: `${newDoubt.studentName} (${newDoubt.studentClass}) asked a question in ${newDoubt.subject}.`,
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

  static answerDoubt(id: string, answerText: string): void {
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

    // Send targeted notification to student
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

  static deleteDoubt(id: string): void {
    deleteFromFirestore('doubts', id);
    const doubts = this.getDoubts().filter(d => d.id !== id);
    this.saveDoubts(doubts);
  }

  // -------- Tests & Automatic Rank Handler --------
  static getTests(): Test[] {
    return getItem<Test[]>(KEYS.TESTS, INITIAL_TESTS);
  }

  static saveTests(tests: Test[]): void {
    setItem(KEYS.TESTS, tests);
    syncArrayToFirestore('tests', tests);
  }

  // Automatic Rank Calculation Helper
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

  static addTest(testData: Omit<Test, 'id' | 'createdAt' | 'results'>, results: TestResult[]): Test {
    const tests = this.getTests();
    const batches = this.getBatches();
    const batch = batches.find(b => b.id === testData.batchId);

    const rankedResults = this.calculateRanks(results);

    const newTest: Test = {
      ...testData,
      id: 't-' + Date.now().toString(36),
      batchTitle: batch ? batch.title : testData.batchTitle,
      results: rankedResults,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = [newTest, ...tests];
    this.saveTests(updated);

    // Notify students
    this.addNotification({
      title: 'New Test Results Published',
      message: `Scores and Ranks for "${newTest.title}" have been released by Admin!`,
      type: 'test',
      timestamp: 'Just now',
      targetRole: 'student',
      read: false
    });

    return newTest;
  }

  // -------- Notifications --------
  static getNotifications(): NotificationItem[] {
    return getItem<NotificationItem[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  }

  static saveNotifications(notifs: NotificationItem[]): void {
    setItem(KEYS.NOTIFICATIONS, notifs);
    syncArrayToFirestore('notifications', notifs);
  }

  static addNotification(notif: Omit<NotificationItem, 'id' | 'timestamp'> & { timestamp?: string }): NotificationItem {
    const notifs = this.getNotifications();

    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

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
}
