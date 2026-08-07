// src/lib/backup.ts
import { StorageService } from './storage';
import { syncDocToFirestore } from './firebaseSync';
import { db, collection, getDocs } from './firebase';

export interface ApexBackup {
  __meta: {
    app: 'THE APEX WORLD';
    version: 1;
    exportedAt: string;
    exportedBy: string;
    recordCounts: Record<string, number>;
  };
  batches: any[];
  students: any[];
  feeRecords: any[];
  notes: any[];
  doubts: any[];
  tests: any[];
  notifications: any[];
  branding: { siteName: string; tagline: string; siteLogo: string; };
  deletedStudentIds: string[];
}

export function buildBackup(exportedBy = 'Admin'): ApexBackup {
  const batches = StorageService.getBatches();
  const students = StorageService.getStudents();
  const feeRecords = StorageService.getFeeRecords();
  const notes = StorageService.getNotes();
  const doubts = StorageService.getDoubts();
  const tests = StorageService.getTests();
  const notifications = StorageService.getNotifications();
  const deletedStudentIds = StorageService.getDeletedStudentIds();

  return {
    __meta: {
      app: 'THE APEX WORLD',
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy,
      recordCounts: {
        batches: batches.length,
        students: students.length,
        feeRecords: feeRecords.length,
        notes: notes.length,
        doubts: doubts.length,
        tests: tests.length,
        notifications: notifications.length
      }
    },
    batches, students, feeRecords, notes, doubts, tests, notifications,
    branding: {
      siteName: StorageService.getSiteName(),
      tagline: StorageService.getTagline(),
      siteLogo: StorageService.getSiteLogo()
    },
    deletedStudentIds
  };
}

export function downloadJson(filename: string, data: any): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function defaultBackupFilename(prefix = 'apex-backup'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${prefix}-${stamp}.json`;
}

export function exportFullBackup(exportedBy = 'Admin'): { filename: string; size: string } {
  const backup = buildBackup(exportedBy);
  const filename = defaultBackupFilename();
  downloadJson(filename, backup);
  const sizeBytes = new Blob([JSON.stringify(backup)]).size;
  const sizeKb = (sizeBytes / 1024).toFixed(1);
  return { filename, size: `${sizeKb} KB` };
}

export function exportCollectionAsCsv(collectionName: 'students' | 'feeRecords' | 'doubts' | 'tests'): void {
  let rows: any[] = [];
  let headers: string[] = [];
  let filePrefix = collectionName;

  switch (collectionName) {
    case 'students':
      rows = StorageService.getStudents();
      headers = ['id', 'name', 'className', 'batchTitle', 'phone', 'email', 'fees', 'joiningDate'];
      break;
    case 'feeRecords':
      rows = StorageService.getFeeRecords();
      headers = ['id', 'studentId', 'studentName', 'batchId', 'month', 'amount', 'status', 'paidDate', 'transactionRef'];
      break;
    case 'doubts':
      rows = StorageService.getDoubts();
      headers = ['id', 'studentId', 'studentName', 'subject', 'question', 'status', 'createdAt', 'answeredAt'];
      break;
    case 'tests':
      rows = StorageService.getTests();
      headers = ['id', 'title', 'batchTitle', 'totalMarks', 'date', 'createdAt'];
      break;
  }

  const escapeCell = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filePrefix}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function restoreBackup(backup: ApexBackup, options: { syncToCloud?: boolean } = {}): Promise<void> {
  const { syncToCloud = true } = options;
  if (!backup || backup.__meta?.app !== 'THE APEX WORLD') {
    throw new Error('Invalid backup file: missing THE APEX WORLD meta header.');
  }

  StorageService.saveBatches(backup.batches || []);
  StorageService.saveStudents(backup.students || []);
  StorageService.saveFeeRecords(backup.feeRecords || []);
  StorageService.saveNotes(backup.notes || []);
  StorageService.saveDoubts(backup.doubts || []);
  StorageService.saveTests(backup.tests || []);
  StorageService.saveNotifications(backup.notifications || []);

  if (backup.branding) {
    if (backup.branding.siteName) await StorageService.saveSiteName(backup.branding.siteName);
    if (backup.branding.tagline) await StorageService.saveTagline(backup.branding.tagline);
    if (backup.branding.siteLogo) await StorageService.saveSiteLogo(backup.branding.siteLogo);
  }

  if (backup.deletedStudentIds?.length) {
    localStorage.setItem('apex_deleted_student_ids', JSON.stringify(backup.deletedStudentIds));
    if (syncToCloud) {
      await syncDocToFirestore('siteSettings', 'deletedStudentIds', {
        id: 'deletedStudentIds',
        ids: backup.deletedStudentIds,
        updatedAt: new Date().toISOString()
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_storage_updated'));
  }
}

export function readBackupFile(file: File): Promise<ApexBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.__meta?.app !== 'THE APEX WORLD') {
          reject(new Error('This file is not a valid Apex backup.'));
          return;
        }
        resolve(parsed as ApexBackup);
      } catch (e: any) {
        reject(new Error('Could not parse JSON: ' + e.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

export async function restoreFromCloud(): Promise<{ counts: Record<string, number> }> {
  const collectionsToPull = [
    { key: 'batches', localKey: 'apex_batches_v2' },
    { key: 'students', localKey: 'apex_students_v2' },
    { key: 'feeRecords', localKey: 'apex_fees_v2' },
    { key: 'notes', localKey: 'apex_notes_v2' },
    { key: 'doubts', localKey: 'apex_doubts_v2' },
    { key: 'tests', localKey: 'apex_tests_v2' },
    { key: 'notifications', localKey: 'apex_notifications_v2' }
  ];

  const counts: Record<string, number> = {};
  for (const { key, localKey } of collectionsToPull) {
    const snap = await getDocs(collection(db, key));
    const items = snap.docs.map((d) => d.data());
    localStorage.setItem(localKey, JSON.stringify(items));
    counts[key] = items.length;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_storage_updated'));
  }

  return { counts };
}
