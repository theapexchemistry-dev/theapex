import React, { useState, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import {
  Database,
  AlertTriangle,
  Key,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  Bell,
  BellRing,
  FileJson,
  FileSpreadsheet,
  FileUp,
  CloudDownload,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { db, collection, getDocs, deleteDoc, doc } from '../../lib/firebase';
import apexLogoFallback from '../../assets/images/apex_logo_1784882809915.jpg';

import {
  exportFullBackup,
  exportCollectionAsCsv,
  readBackupFile,
  restoreBackup,
  restoreFromCloud
} from '../../lib/backup';

import {
  enablePushNotifications,
  disablePushNotifications,
  getPushPermissionState,
  type PushPermissionState
} from '../../lib/pushNotifications';

export const AdminSettings: React.FC = () => {
  const [wiping, setWiping] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [siteName, setSiteName] = useState(() => StorageService.getSiteName());
  const [tagline, setTagline] = useState(() => StorageService.getTagline());
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(() => StorageService.getSiteLogo());

  const [pushState, setPushState] = useState<PushPermissionState>('default');
  const [pushBusy, setPushBusy] = useState(false);

  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [cloudRestoreBusy, setCloudRestoreBusy] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getPushPermissionState().then(setPushState);
  }, []);

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    setStatusMsg('');
    try {
      await StorageService.saveSiteName(siteName.trim() || 'THE APEX WORLD');
      await StorageService.saveTagline(tagline.trim() || 'Empowering Minds, Enriching Futures');
      setStatusMsg('✓ Website name and tagline updated and synced to the cloud!');
    } catch (err: any) {
      setStatusMsg('Failed to save branding: ' + (err?.message || 'Unknown error'));
    } finally {
      setBrandingSaving(false);
      setTimeout(() => setStatusMsg(''), 6000);
    }
  };

  const resizeImage = (file: File, maxW: number, maxH: number, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height) {
            if (width > maxW) { height = (height * maxW) / width; width = maxW; }
          } else {
            if (height > maxH) { width = (width * maxH) / height; height = maxH; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMsg('Please select a valid image file (PNG, JPG, etc.).');
      return;
    }
    setLogoUploading(true);
    setStatusMsg('');
    try {
      const dataUrl = await resizeImage(file, 300, 300, 0.8);
      const result = await StorageService.saveSiteLogo(dataUrl);
      if (result.success) {
        setLogoPreview(dataUrl);
        setStatusMsg('✓ Website logo updated and synced to the cloud database successfully! It will appear on all devices.');
      } else {
        setLogoPreview(dataUrl);
        setStatusMsg('⚠ Logo saved on this device but cloud sync failed: ' + (result.error || 'Unknown error') + '. Check your internet connection and try again.');
      }
    } catch (err: any) {
      setStatusMsg('Failed to update logo: ' + (err?.message || 'Unknown error'));
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleLogoReset = () => {
    StorageService.clearSiteLogo();
    setLogoPreview(null);
    setStatusMsg('Logo reset to the default Apex World logo.');
  };

  const handleWipeDatabase = async () => {
    if (!window.confirm("WARNING: This will permanently delete ALL data (Students, Batches, Fees, Notes, etc.) from both your local device and the Firebase cloud database. Are you absolutely sure?")) {
      return;
    }
    setWiping(true);
    setStatusMsg('Wiping database...');
    try {
      const collections = ['students', 'batches', 'feeRecords', 'notes', 'doubts', 'tests', 'notifications'];
      for (const collName of collections) {
        const colRef = collection(db, collName);
        const snap = await getDocs(colRef);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, collName, d.id));
        }
      }
      StorageService.saveStudents([]);
      StorageService.saveBatches([]);
      StorageService.saveFeeRecords([]);
      StorageService.saveNotes([]);
      StorageService.saveDoubts([]);
      StorageService.saveTests([]);
      StorageService.saveNotifications([]);
      localStorage.removeItem('apex_db_initialized');
      setStatusMsg('Database wiped completely. Please refresh the page.');
    } catch (err: any) {
      console.error("Wipe failed:", err);
      setStatusMsg('Error wiping database: ' + err.message);
    } finally {
      setWiping(false);
    }
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setStatusMsg('');
    try {
      const result = await enablePushNotifications('admin');
      if (result.success) {
        setPushState('granted');
        setStatusMsg('✓ Push notifications ENABLED for this admin device. Test pushes will arrive even when the app is closed.');
      } else {
        setStatusMsg('Failed to enable push: ' + (result.error || 'Unknown error'));
      }
    } finally {
      setPushBusy(false);
      setTimeout(() => setStatusMsg(''), 6000);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      await disablePushNotifications('admin');
      setPushState('default');
      setStatusMsg('Push notifications disabled for this device.');
    } finally {
      setPushBusy(false);
      setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  const handleExportJson = () => {
    setBackupBusy(true);
    try {
      const result = exportFullBackup('Admin');
      setStatusMsg(`✓ Backup exported: ${result.filename} (${result.size}). Save this file somewhere safe — it contains every student, fee, note, doubt, and test.`);
    } catch (e: any) {
      setStatusMsg('Backup failed: ' + e.message);
    } finally {
      setBackupBusy(false);
      setTimeout(() => setStatusMsg(''), 8000);
    }
  };

  const handleExportCsv = (which: 'students' | 'feeRecords' | 'doubts' | 'tests') => {
    try {
      exportCollectionAsCsv(which);
      setStatusMsg(`✓ ${which} exported as CSV. Check your Downloads folder.`);
    } catch (e: any) {
      setStatusMsg('CSV export failed: ' + e.message);
    } finally {
      setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreBusy(true);
    setStatusMsg('Restoring from backup file...');
    try {
      const backup = await readBackupFile(file);
      if (!window.confirm(
        `This will OVERWRITE all current local data with the backup from ${backup.__meta.exportedAt}.\n\n` +
        `Backup contains:\n` +
        `• ${backup.__meta.recordCounts.students || 0} students\n` +
        `• ${backup.__meta.recordCounts.batches || 0} batches\n` +
        `• ${backup.__meta.recordCounts.feeRecords || 0} fee records\n` +
        `• ${backup.__meta.recordCounts.notes || 0} notes\n` +
        `• ${backup.__meta.recordCounts.doubts || 0} doubts\n` +
        `• ${backup.__meta.recordCounts.tests || 0} tests\n\n` +
        `Continue?`
      )) {
        setRestoreBusy(false);
        e.target.value = '';
        return;
      }
      await restoreBackup(backup, { syncToCloud: true });
      setStatusMsg('✓ Backup restored successfully and synced to the cloud. Please refresh the page.');
    } catch (err: any) {
      setStatusMsg('Restore failed: ' + err.message);
    } finally {
      setRestoreBusy(false);
      e.target.value = '';
      setTimeout(() => setStatusMsg(''), 8000);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!window.confirm('Pull a fresh snapshot from the cloud? This will OVERWRITE the current local data with whatever is currently in Firestore.')) return;
    setCloudRestoreBusy(true);
    setStatusMsg('Pulling data from cloud Firestore...');
    try {
      const result = await restoreFromCloud();
      const summary = Object.entries(result.counts).map(([k, v]) => `${k}: ${v}`).join(', ');
      setStatusMsg('✓ Cloud restore complete. ' + summary + '. Please refresh the page.');
    } catch (e: any) {
      setStatusMsg('Cloud restore failed: ' + e.message);
    } finally {
      setCloudRestoreBusy(false);
      setTimeout(() => setStatusMsg(''), 8000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Database & Branding Settings</h2>
        <p className="text-sm text-slate-500">Manage push notifications, backups, data sync, cloud database, and website logo.</p>
      </div>

      {statusMsg && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-xs rounded-2xl animate-in fade-in">
          {statusMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">

        {/* Push Notifications Card */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <BellRing className="w-5 h-5 text-rose-500" /> Push Notifications
          </h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Enable push notifications on this device so that new doubts, fee payments, notes, and test results arrive in your phone's notification bar — even when the app is closed.
          </p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            {pushState === 'granted' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : pushState === 'denied' ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <Bell className="w-5 h-5 text-slate-400" />
            )}
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-800">
                Status: {pushState === 'granted' ? 'Enabled' : pushState === 'denied' ? 'Blocked' : pushState === 'unsupported' ? 'Unsupported' : 'Not enabled'}
              </p>
              <p className="text-[10px] text-slate-500">
                {pushState === 'denied'
                  ? 'Permission blocked. Reset it in your browser site settings → Notifications.'
                  : pushState === 'granted'
                  ? 'This device will receive push notifications from THE APEX WORLD.'
                  : 'Click "Enable" to allow notifications.'}
              </p>
            </div>
          </div>
          {pushState === 'granted' ? (
            <button onClick={handleDisablePush} disabled={pushBusy}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2">
              {pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
              Disable Push on this device
            </button>
          ) : (
            <button onClick={handleEnablePush} disabled={pushBusy || pushState === 'denied' || pushState === 'unsupported'}
              className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
              {pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Enable Push Notifications
            </button>
          )}
        </div>

        {/* Backup & Export Card */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Database className="w-5 h-5 text-indigo-500" /> Backup & Export
          </h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Download a complete JSON backup of all your data (students, fees, notes, doubts, tests, notifications). Useful before factory reset or for migrating to a new device.
          </p>
          <button onClick={handleExportJson} disabled={backupBusy}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
            {backupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
            Download Full Backup (JSON)
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleExportCsv('students')} className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Students CSV
            </button>
            <button onClick={() => handleExportCsv('feeRecords')} className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Fees CSV
            </button>
            <button onClick={() => handleExportCsv('doubts')} className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Doubts CSV
            </button>
            <button onClick={() => handleExportCsv('tests')} className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Tests CSV
            </button>
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Restore / Import</p>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleRestoreFile} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={restoreBusy}
              className="w-full py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 border border-amber-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2">
              {restoreBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Restore from JSON File
            </button>
            <button onClick={handleRestoreFromCloud} disabled={cloudRestoreBusy}
              className="w-full py-2 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 text-sky-700 border border-sky-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2">
              {cloudRestoreBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              Pull Fresh Snapshot from Cloud
            </button>
          </div>
        </div>

        {/* Website Logo Upload */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <ImageIcon className="w-5 h-5 text-amber-500" /> Website Logo
          </h3>
          <p className="text-xs text-slate-600 font-medium">
            Upload a new logo for the portal. It will appear instantly in the navbar, login page, and landing page. The image is auto-resized to 300×300 px for fast loading.
          </p>
          <div className="flex items-center gap-5">
            <div className="shrink-0">
              <img src={logoPreview || apexLogoFallback} alt="Current logo preview" className="w-20 h-20 rounded-full object-cover border-2 border-amber-400/90 shadow-md bg-white p-0.5" />
            </div>
            <div className="flex-1 space-y-2">
              <label className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                {logoUploading ? 'Uploading...' : 'Upload New Logo'}
                <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={logoUploading} className="hidden" />
              </label>
              {logoPreview && (
                <button onClick={handleLogoReset} className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Website Name & Tagline */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Key className="w-5 h-5 text-indigo-500" /> Website Name & Tagline
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Website Name</label>
              <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="THE APEX WORLD"
                className="w-full px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tagline</label>
              <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Empowering Minds, Enriching Futures"
                className="w-full px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none" />
            </div>
            <button onClick={handleSaveBranding} disabled={brandingSaving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
              {brandingSaving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </div>

        {/* Wipe Database Action */}
        <div className="lg:col-span-12 bg-white p-6 rounded-2xl border border-red-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-red-700 flex items-center gap-2 pb-2 border-b border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-600" /> Danger Zone: Factory Reset
          </h3>
          <p className="text-xs text-slate-600 font-medium">
            This action will permanently delete all records, users, batches, tests, and fees from both this device and the Cloud Firestore database. It cannot be undone.
          </p>
          <button onClick={handleWipeDatabase} disabled={wiping}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
            {wiping ? 'Wiping Database...' : 'Start from Zero (Wipe Database)'}
          </button>
        </div>
      </div>
    </div>
  );
};
