import React, { useState, useEffect } from 'react';
import { Role, Student } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ArrowLeft } from 'lucide-react';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminStudents } from './components/admin/AdminStudents';
import { AdminBatches } from './components/admin/AdminBatches';
import { AdminFees } from './components/admin/AdminFees';
import { AdminNotes } from './components/admin/AdminNotes';
import { AdminDoubts } from './components/admin/AdminDoubts';
import { AdminTests } from './components/admin/AdminTests';
import { AdminSettings } from './components/admin/AdminSettings';
import { AdminSupport } from './components/admin/AdminSupport';
import { StudentDashboard } from './components/student/StudentDashboard';
import { StudentFees } from './components/student/StudentFees';
import { StudentNotes } from './components/student/StudentNotes';
import { StudentTests } from './components/student/StudentTests';
import { StudentDoubts } from './components/student/StudentDoubts';
import { StudentProfile } from './components/student/StudentProfile';
import { StudentHelp } from './components/student/StudentHelp';
import { StorageService } from './lib/storage';
import { runMonthlyFeeReminderTask } from './lib/scheduledTasks';
import { AdminVideoCall } from './components/admin/AdminVideoCall';
import { StudentVideoCall } from './components/student/StudentVideoCall';
import { NotificationPermissionBanner } from './components/NotificationPermissionBanner';

export default function App() {
  const MODERATOR_IDS = ['APEX2026101', 'APEX2026102'];

  const [role, setRole] = useState<Role>(() => {
    return (localStorage.getItem('apex_session_role') as Role) || 'guest';
  });

  const [currentStudent, setCurrentStudent] = useState<Student | null>(() => {
    try {
      const saved = localStorage.getItem('apex_session_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isModeratorAccount = currentStudent && MODERATOR_IDS.includes(currentStudent.id.toUpperCase());

  const handleRoleToggle = () => {
    if (!isModeratorAccount) return;
    const newRole = role === 'moderator' ? 'student' : 'moderator';
    setRole(newRole);
    localStorage.setItem('apex_session_role', newRole);
    setActiveTab('dashboard');
  };

  // Check for testId query parameter on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testId = params.get('testId');
    if (testId) {
      localStorage.setItem('apex_pending_test_id', testId);
      const savedRole = localStorage.getItem('apex_session_role');
      if (savedRole === 'student') {
        setActiveTab('tests');
      }
    }
  }, []);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTabState] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      if (hash === 'home' && typeof window !== 'undefined' && window.innerWidth < 768) {
        return 'login';
      }
      return hash;
    }
    
    const savedRole = localStorage.getItem('apex_session_role');
    const savedTab = localStorage.getItem('apex_session_tab');
    const pendingTestId = localStorage.getItem('apex_pending_test_id');
    if (savedRole === 'student' && pendingTestId) {
      return 'tests';
    }
    if (savedRole && savedRole !== 'guest') {
      return savedTab || 'dashboard';
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'login';
    }
    return 'home';
  });

  const setActiveTab = (tab: string) => {
    if (isMobile && tab === 'home' && role === 'guest') {
      window.location.hash = 'login';
    } else {
      window.location.hash = tab;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        if (hash === 'home' && isMobile && role === 'guest') {
          setActiveTabState('login');
          window.location.hash = 'login';
        } else {
          setActiveTabState(hash);
        }
      } else {
        const savedRole = localStorage.getItem('apex_session_role');
        if (savedRole && savedRole !== 'guest') {
          setActiveTabState('dashboard');
        } else {
          setActiveTabState(isMobile ? 'login' : 'home');
        }
      }
    };
    
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${activeTab}`);
    } else {
      handleHashChange();
    }
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isMobile, role]);

  // Sync tab changes to storage
  useEffect(() => {
    if (role !== 'guest') {
      localStorage.setItem('apex_session_tab', activeTab);
    }
  }, [activeTab, role]);

  // Scheduled Task: Automatically run 5th-day monthly fee reminder on app initialization
  useEffect(() => {
    runMonthlyFeeReminderTask().catch((e) => console.warn('Monthly fee reminder task failed:', e));
  }, []);

  // Handle Login
  const handleLoginSuccess = (userRole: Role, studentObj?: Student) => {
    setRole(userRole);
    localStorage.setItem('apex_session_role', userRole);
    if (userRole === 'student' && studentObj) {
      setCurrentStudent(studentObj);
      localStorage.setItem('apex_session_student', JSON.stringify(studentObj));
      const pendingTestId = localStorage.getItem('apex_pending_test_id');
      const targetTab = pendingTestId ? 'tests' : 'dashboard';
      setActiveTab(targetTab);
      localStorage.setItem('apex_session_tab', targetTab);
    } else if (userRole === 'admin') {
      setCurrentStudent(null);
      localStorage.removeItem('apex_session_student');
      setActiveTab('dashboard');
      localStorage.setItem('apex_session_tab', 'dashboard');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setRole('guest');
    setCurrentStudent(null);
    setActiveTab('home');
    localStorage.removeItem('apex_session_role');
    localStorage.removeItem('apex_session_student');
    localStorage.removeItem('apex_session_tab');
  };

  // ---------------------------------------------------------------------
  // Auto-logout for suspended (deleted) students.
  //
  // When an admin deletes a student, the student's ID is added to the
  // `apex_deleted_student_ids` localStorage list (kept in sync across
  // devices via the Firestore `siteSettings/deletedStudentIds` document
  // and the onSnapshot listener in firebaseSync.ts). Every time that
  // sync fires — or any other storage update happens — we re-check
  // whether the currently-logged-in student has been suspended. If so,
  // we forcibly log them out and show a suspension message.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (role !== 'student' || !currentStudent) return;
    const studentId = currentStudent.id;

    const checkSuspended = () => {
      try {
        const deletedIds = StorageService.getDeletedStudentIds();
        const isSuspended = deletedIds.some(
          id => id.toLowerCase() === studentId.toLowerCase()
        );
        if (isSuspended) {
          // Force logout
          setRole('guest');
          setCurrentStudent(null);
          setActiveTab('home');
          localStorage.removeItem('apex_session_role');
          localStorage.removeItem('apex_session_student');
          localStorage.removeItem('apex_session_tab');
          alert('Your account has been suspended. Please contact administration.');
        }
      } catch (e) {
        // ignore — never break the app over a suspension check
      }
    };

    // Check immediately (covers the case where they were deleted before
    // this browser session re-opened, but the session was still cached).
    checkSuspended();

    // Re-check whenever storage updates arrive from Firestore sync.
    window.addEventListener('apex_storage_updated', checkSuspended);
    window.addEventListener('storage', checkSuspended);

    return () => {
      window.removeEventListener('apex_storage_updated', checkSuspended);
      window.removeEventListener('storage', checkSuspended);
    };
  }, [role, currentStudent]);

  return (
    <div className="min-h-screen overflow-x-hidden transition-colors duration-200 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950 bg-slate-50 text-slate-900">
      {/* Permission request banner for phone/website popup notifications */}
      <NotificationPermissionBanner role={role} currentStudent={currentStudent} />

      {/* Top Navbar */}
      {!(role === 'guest' && isMobile) && (
        <Navbar
          role={role}
          currentStudent={currentStudent}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLoginClick={() => setActiveTab('login')}
          onLogout={handleLogout}
          isModerator={isModeratorAccount || false}
          onToggleRole={handleRoleToggle}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {role === 'guest' ? (
          (activeTab === 'login' || isMobile) ? (
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onBack={() => {
                if (!isMobile) {
                  setActiveTab('home');
                }
              }}
            />
          ) : (
            <LandingPage
              onLoginClick={() => setActiveTab('login')}
              onExploreCourses={() => setActiveTab('login')}
            />
          )
        ) : (
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8">
            {activeTab !== 'dashboard' && (
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className="mb-6 flex items-center gap-1.5 text-sm font-bold transition-colors px-4 py-2 rounded-xl border shadow-sm w-fit bg-white border-slate-200 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </button>
            )}
            
            {(role === 'admin' || role === 'moderator') && (
              <>
                {activeTab === 'dashboard' && (
                  <AdminDashboard
                    onTabChange={setActiveTab}
                    onAddStudent={() => setActiveTab('students')}
                    onAddBatch={() => setActiveTab('batches')}
                    onUploadNotes={() => setActiveTab('notes')}
                    isModerator={role === 'moderator'}
                    moderatorName={currentStudent?.name}
                  />
                )}
                {activeTab === 'students' && <AdminStudents isModerator={role === 'moderator'} />}
                {activeTab === 'batches' && <AdminBatches isModerator={role === 'moderator'} />}
                {activeTab === 'fees' && role === 'admin' && <AdminFees />}
                {activeTab === 'notes' && <AdminNotes />}
                {activeTab === 'doubts' && <AdminDoubts />}
                {activeTab === 'tests' && <AdminTests />}
                {(activeTab === 'videocall' || activeTab === 'live') && <AdminVideoCall />}
                {activeTab === 'settings' && <AdminSettings isModerator={role === 'moderator'} />}
                {activeTab === 'support' && <AdminSupport />}
              </>
            )}
            {role === 'student' && currentStudent && (
              <>
                {activeTab === 'dashboard' && (
                  <StudentDashboard
                    student={currentStudent}
                    onNavigate={setActiveTab}
                    onPayFees={() => setActiveTab('fees')}
                  />
                )}
                {activeTab === 'fees' && <StudentFees student={currentStudent} />}
                {activeTab === 'notes' && <StudentNotes student={currentStudent} />}
                {activeTab === 'tests' && <StudentTests student={currentStudent} />}
                {activeTab === 'doubts' && <StudentDoubts student={currentStudent} />}
                {(activeTab === 'videocall' || activeTab === 'live') && <StudentVideoCall student={currentStudent} />}
                {activeTab === 'profile' && <StudentProfile student={currentStudent} />}
                {activeTab === 'help' && <StudentHelp student={currentStudent} />}
              </>
            )}
          </div>
        )}
      </main>

      {/* Global Footer */}
      {!(role === 'guest' && isMobile) && <Footer />}
    </div>
  );
}
