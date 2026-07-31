import React, { useState } from 'react';
import { StorageService } from '../../lib/storage';
import { Database, AlertTriangle, Key, Link, Image as ImageIcon, Upload, RotateCcw } from 'lucide-react';
import { db, collection, getDocs, deleteDoc, doc } from '../../lib/firebase';

export const AdminSettings: React.FC = () => {
  const [wiping, setWiping] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  // Branding state
  const [siteName, setSiteName] = useState(() => StorageService.getSiteName());
  const [tagline, setTagline] = useState(() => StorageService.getTagline());
  const [brandingSaving, setBrandingSaving] = useState(false);

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

          {/* Website Name & Tagline */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Key className="w-5 h-5 text-indigo-500" /> Website Name & Tagline
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Website Name
              </label>
              <input
                type="text"
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
                placeholder="THE APEX WORLD"
                className="w-full px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                placeholder="Empowering Minds, Enriching Futures"
                className="w-full px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
              />
            </div>

            <button
              onClick={handleSaveBranding}
              disabled={brandingSaving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {brandingSaving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </div>
  // Logo state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(() => StorageService.getSiteLogo());

  // Resize an image file to a max dimension and return a compressed JPEG data URL.
  // Keeps the stored logo small (well under Firestore's 1MB doc limit).
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
      // Compress aggressively: 300x300, quality 0.8 → ~20-40KB base64 (well under Firestore's 1MB limit)
      const dataUrl = await resizeImage(file, 300, 300, 0.8);
      const result = await StorageService.saveSiteLogo(dataUrl);
      if (result.success) {
        setLogoPreview(dataUrl);
        setStatusMsg('✓ Website logo updated and synced to the cloud database successfully! It will appear on all devices.');
      } else {
        // Saved locally but Firestore sync failed
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Database & Branding Settings</h2>
        <p className="text-sm text-slate-500">Manage your data sync, cloud database, and website logo.</p>
      </div>

      {statusMsg && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-xs rounded-2xl animate-in fade-in">
          {statusMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Website Branding / Logo Upload */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <ImageIcon className="w-5 h-5 text-amber-500" /> Website Logo
          </h3>

          <p className="text-xs text-slate-600 font-medium">
            Upload a new logo for the portal. It will appear instantly in the navbar, login page, and landing page. The image is auto-resized to 400×400 px for fast loading.
          </p>

          <div className="flex items-center gap-5">
            {/* Preview */}
            <div className="shrink-0">
              <img
                src={logoPreview || (apexLogoFallback)}
                alt="Current logo preview"
                className="w-20 h-20 rounded-full object-cover border-2 border-amber-400/90 shadow-md bg-white p-0.5"
              />
            </div>

            {/* Actions */}
            <div className="flex-1 space-y-2">
              <label className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                {logoUploading ? 'Uploading...' : 'Upload New Logo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                  className="hidden"
                />
              </label>

              {logoPreview && (
                <button
                  onClick={handleLogoReset}
                  className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Wipe Database Action */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-red-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-red-700 flex items-center gap-2 pb-2 border-b border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-600" /> Danger Zone: Factory Reset
          </h3>

          <p className="text-xs text-slate-600 font-medium">
            This action will permanently delete all records, users, batches, tests, and fees from both this device and the Cloud Firestore database. It cannot be undone.
          </p>

          <button
            onClick={handleWipeDatabase}
            disabled={wiping}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {wiping ? 'Wiping Database...' : 'Start from Zero (Wipe Database)'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Default logo fallback used by the preview when no custom logo is set.
// We import it lazily to avoid changing the existing asset import flow.
import apexLogoFallback from '../../assets/images/apex_logo_1784882809915.jpg';
