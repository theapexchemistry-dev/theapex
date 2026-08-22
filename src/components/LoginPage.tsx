import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, UserCheck, Lock, User, LogIn, ArrowLeft, Sparkles, Key, CheckCircle2, HelpCircle, XCircle, Mail, AlertCircle } from 'lucide-react';
import { Role, Student } from '../types';
import { StorageService } from '../lib/storage';
import { auth, signInWithEmailAndPassword, sendPasswordResetEmail, db, collection, getDocs } from '../lib/firebase';
import { Logo } from './Logo';

interface LoginPageProps {
  onLoginSuccess: (role: Role, student?: Student) => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password State for Admin
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  // Create Account State for Student
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    className: 'Class 11'
  });
  const [createSuccess, setCreateSuccess] = useState('');
  const [generatedId, setGeneratedId] = useState('');
  const [generatedPass, setGeneratedPass] = useState('');

  const handleOpenCreateModal = () => {
    setCreateData({ firstName: '', lastName: '', phone: '', email: '', className: 'Class 11' });
    setCreateSuccess('');
    setGeneratedId('');
    setGeneratedPass('');
    setShowCreateModal(true);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id: newId, pass: newPass } = StorageService.generateStudentCredentials();

      const newStudent: Student = {
        id: newId,
        password: newPass,
        name: `${createData.firstName} ${createData.lastName}`.trim(),
        phone: createData.phone,
        email: createData.email,
        className: createData.className,
        batchId: 'PENDING_BATCH', // placeholder until assigned
        batchTitle: 'Unassigned',
        fees: 0,
        joiningDate: new Date().toISOString(),
        status: 'pending'
      };

      // Ensure we push it to storage and firestore
      const currentStudents = StorageService.getStudents();
      StorageService.saveStudents([newStudent, ...currentStudents]);
      
      setGeneratedId(newId);
      setGeneratedPass(newPass);
      setCreateSuccess('Account creation request sent to Mr. Subhamoy Mondal. Come back in 24 hours. Note these credentials:');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleOpenForgotModal = () => {
    setResetEmail(username.includes('@') ? username.trim() : 'theapexchemistry@gmail.com');
    setResetMessage('');
    setResetError('');
    setShowForgotModal(true);
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');

    const targetEmail = resetEmail.trim();
    if (!targetEmail) {
      setResetError('Please enter a valid Admin email address.');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetMessage(`Password reset link successfully sent to ${targetEmail}. Please check your email inbox and spam folder.`);
    } catch (err: any) {
      console.warn('Firebase reset password note:', err);
      // Provide clean clear message
      setResetMessage(`Password reset instruction initiated for ${targetEmail}. If this email is registered in Firebase Auth, you will receive a reset link shortly.`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

        if (activeTab === 'admin') {
      const inputUser = username.trim();
      const inputPass = password.trim();

      if (!inputUser || !inputPass) {
        setError('Please enter Admin Email / Username and Password.');
        return;
      }

      // --- HARDENED ADMIN CREDENTIALS CHECK ---
      const ADMIN_EMAIL = 'theapexchemistry@gmail.com';
      const ADMIN_PASSWORD = 'subha1122';

      // Step 1: Strict match on the exact allowed credentials
      if (
        inputUser.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
        inputPass !== ADMIN_PASSWORD
      ) {
        setError('Invalid Admin credentials. Access denied.');
        return;
      }

      // Step 2: Verify with Firebase Auth (optional layer of security)
      setLoading(true);
      try {
        await signInWithEmailAndPassword(auth, inputUser, inputPass);
        onLoginSuccess('admin');
      } catch (err: any) {
        // Credentials matched our hardcoded check, but Firebase rejected them.
        // Show an error instead of silently logging in.
        console.warn('Firebase admin sign-in failed:', err?.code || err?.message);
        setError('Authentication failed. Please check your credentials and try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // ---------------- STUDENT LOGIN ----------------
      const inputId = username.trim().toLowerCase();

      // --- Suspension check (local): blocked if admin deleted this student ---
      const deletedIds = StorageService.getDeletedStudentIds();
      if (deletedIds.some(id => id.toLowerCase() === inputId)) {
        setError('Your account has been suspended. Please contact administration.');
        return;
      }

      const students = StorageService.getStudents();
      const match = students.find(
        s => s.id.toLowerCase() === inputId &&
             (s.password === password || (!s.password && password === 'student123'))
      );

      if (match) {
        if (match.status === 'pending') {
          setError('Account creation request sent to Mr. Subhamoy Mondal, come back in 24 hours.');
          return;
        }
        onLoginSuccess('student', match);
      } else {
        // Fallback: query Firestore directly. On a fresh/other device the
        // newly-created student may not have synced into localStorage yet,
        // so we verify credentials against the live Firestore collection.
        setLoading(true);
        try {
          // --- Authoritative suspension check from Firestore ---
          // Covers the case where this device's local deletedStudentIds list
          // is stale/empty (e.g. brand new browser) and the admin already
          // deleted this student on another device.
          try {
            const settingsSnap = await getDocs(collection(db, 'siteSettings'));
            let firestoreDeletedIds: string[] = [];
            settingsSnap.forEach(d => {
              const data = d.data();
              if (d.id === 'deletedStudentIds' && Array.isArray(data.ids)) {
                firestoreDeletedIds = data.ids as string[];
              }
            });
            if (firestoreDeletedIds.some(id => id.toLowerCase() === inputId)) {
              setError('Your account has been suspended. Please contact administration.');
              return;
            }
          } catch (settingsErr) {
            // If we can't reach siteSettings, continue to student lookup
            console.debug('Could not verify suspension status from Firestore:', settingsErr);
          }

          const snap = await getDocs(collection(db, 'students'));
          let firestoreMatch: Student | null = null;
          snap.forEach(d => {
            const s = d.data() as Student;
            if (!firestoreMatch &&
                s.id &&
                s.id.toLowerCase() === inputId &&
                (s.password === password || (!s.password && password === 'student123'))) {
              firestoreMatch = s;
            }
          });

          if (firestoreMatch) {
            if ((firestoreMatch as Student).status === 'pending') {
              setError('Account creation request sent to Mr. Subhamoy Mondal, come back in 24 hours.');
              return;
            }
            // Persist to localStorage so future logins on this device are instant
            const existing = StorageService.getStudents();
            if (!existing.some(s => s.id === firestoreMatch!.id)) {
              StorageService.saveStudents([firestoreMatch!, ...existing]);
            }
            onLoginSuccess('student', firestoreMatch as Student);
          } else {
            setError('Invalid Student ID or Password! Default password for new students is "student123".');
          }
        } catch (err) {
          console.error('Firestore student login fallback failed:', err);
          setError('Invalid Student ID or Password! Default password for new students is "student123".');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Animated Ambient Background Glow Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 30, 0],
          y: [0, -20, 0]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.25, 0.45, 0.25],
          x: [0, -40, 0],
          y: [0, 30, 0]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"
      />

      {/* Floating Decorative Elements */}
      <motion.div
        animate={{ y: [-10, 10, -10], rotate: [0, 10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-12 left-[10%] text-amber-400/20 hidden lg:block pointer-events-none"
      >
        <Sparkles className="w-12 h-12" />
      </motion.div>
      <motion.div
        animate={{ y: [10, -10, 10], rotate: [0, -12, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-16 left-[15%] text-emerald-400/20 hidden lg:block pointer-events-none"
      >
        <Key className="w-10 h-10" />
      </motion.div>

      {/* Main Animated Login Container Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200/80 relative overflow-hidden z-10"
      >
        {/* Header with New Apex Logo */}
        <div className="bg-[#0B132B] text-white p-6 relative overflow-hidden border-b border-slate-800">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="absolute top-4 right-4 z-10"
          >
            <button
              onClick={onBack}
              className="text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700/80 shadow-sm hover:scale-105"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </motion.div>

          <div className="pt-2 pb-1">
            <Logo size="lg" variant="dark" />
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-slate-300 mt-3 flex items-center gap-1.5 font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            Concept Clarity • NCERT • JEE • NEET • Portal Access
          </motion.p>
        </div>

        {/* Animated Role Toggle Selector */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 p-1.5 gap-1 relative">
          <button
            onClick={() => { setActiveTab('admin'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-colors relative z-10 ${
              activeTab === 'admin' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Admin Login
            {activeTab === 'admin' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-white rounded-xl shadow-md -z-10 border border-slate-200"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('student'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-colors relative z-10 ${
              activeTab === 'student' ? 'text-indigo-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Student Login
            {activeTab === 'student' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-white rounded-xl shadow-md -z-10 border border-indigo-200/80"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        </div>

        {/* Form Body with Smooth Transition */}
        <div className="p-6 space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.form
              key={activeTab}
              initial={{ opacity: 0, x: activeTab === 'admin' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === 'admin' ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleLoginSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
                  {activeTab === 'student' ? 'Student ID (e.g. APEX2026101)' : 'Admin Email / Username'}
                </label>
                <div className="relative group">
                  <User className="w-4 h-4 text-slate-400 group-focus-within:text-amber-500 absolute left-3.5 top-3.5 transition-colors" />
                  <input
                    type="text"
                    required
                    placeholder={activeTab === 'student' ? 'APEX2026101' : 'theapexchemistry@gmail.com'}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-slate-50/50 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  {activeTab === 'admin' && (
                    <button
                      type="button"
                      onClick={handleOpenForgotModal}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3 text-indigo-500" /> Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-amber-500 absolute left-3.5 top-3.5 transition-colors" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-slate-50/50 focus:bg-white transition-all shadow-sm"
                  />
                </div>
                {activeTab === 'student' && (
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    New students can use default password: <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-bold">student123</code>
                  </p>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className={`w-full py-3.5 font-extrabold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 tracking-wider uppercase ${
                  activeTab === 'admin'
                    ? 'bg-[#0B132B] hover:bg-slate-900 text-amber-400 shadow-slate-900/20 border border-amber-400/30'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                }`}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {loading ? 'Authenticating...' : activeTab === 'admin' ? 'Login as Admin' : 'Login as Student'}
              </motion.button>
              
              {activeTab === 'student' && (
                <div className="text-center pt-2">
                  <p className="text-xs text-slate-600 font-medium mb-2">Don't have an account?</p>
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Create an Account
                  </button>
                </div>
              )}

              <div className="pt-2 text-center border-t border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500">
                  Faculty: <span className="text-slate-800 font-bold">Mr. Subhamoy Mondal</span>
                </p>
                <p className="text-[10px] text-amber-600 font-bold mt-0.5 uppercase tracking-wider">
                  The Apex World • Chemistry Portal
                </p>
              </div>
            </motion.form>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden relative p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <Key className="w-5 h-5" />
                  </div>
                  Reset Admin Password
                </div>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Enter your registered admin email address below. We will send you a password reset link directly via Firebase Authentication.
              </p>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{resetMessage}</span>
                </div>
              )}

              <form onSubmit={handleSendResetEmail} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Registered Admin Email
                  </label>
                  <div className="relative group">
                    <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-amber-500 absolute left-3.5 top-3.5 transition-colors" />
                    <input
                      type="email"
                      required
                      placeholder="theapexchemistry@gmail.com"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-3 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-slate-50/50 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-3 text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-3 text-xs font-extrabold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    {resetLoading ? (
                      <div className="w-4 h-4 border-2 border-amber-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    {resetLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Account Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden relative p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                  <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  Create an Account
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {createSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-bold flex flex-col gap-2 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <span>{createSuccess}</span>
                  </div>
                  <div className="bg-slate-100 p-4 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Login Credentials</div>
                    <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500">Student ID:</span>
                      <span className="text-sm font-bold text-slate-900">{generatedId}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500">Password:</span>
                      <span className="text-sm font-bold text-slate-900">{generatedPass}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-full py-3 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateAccount} className="space-y-4 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">First Name</label>
                      <input
                        type="text"
                        required
                        value={createData.firstName}
                        onChange={e => setCreateData({...createData, firstName: e.target.value})}
                        className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Last Name</label>
                      <input
                        type="text"
                        required
                        value={createData.lastName}
                        onChange={e => setCreateData({...createData, lastName: e.target.value})}
                        className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={createData.phone}
                      onChange={e => setCreateData({...createData, phone: e.target.value})}
                      className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Email ID</label>
                    <input
                      type="email"
                      required
                      value={createData.email}
                      onChange={e => setCreateData({...createData, email: e.target.value})}
                      className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Class</label>
                    <select
                      value={createData.className}
                      onChange={e => setCreateData({...createData, className: e.target.value})}
                      className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all"
                    >
                      <option value="Class 9">Class 9</option>
                      <option value="Class 10">Class 10</option>
                      <option value="Class 11">Class 11</option>
                      <option value="Class 12">Class 12</option>
                      <option value="Repeater">Repeater</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-3 text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
