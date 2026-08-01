import React, { useState, useEffect } from 'react';
import { Role, Student } from './types';
import { Navbar } from './components/Navbar';
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
import { StudentDashboard } from './components/student/StudentDashboard';
import { StudentFees } from './components/student/StudentFees';
import { StudentNotes } from './components/student/StudentNotes';
import { StudentTests } from './components/student/StudentTests';
import { StudentDoubts } from './components/student/StudentDoubts';
import { StudentProfile } from './components/student/StudentProfile';
import { StudentHelp } from './components/student/StudentHelp';
import { StorageService } from './lib/storage';
import { runMonthlyFeeReminderTask } from './lib/scheduledTasks';

export default function App() {
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

  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedRole = localStorage.getItem('apex_session_role');
    const savedTab = localStorage.getItem('apex_session_tab');
    if (savedRole && savedRole !== 'guest') {
      return savedTab || 'dashboard';
    }
    return 'home';
  });

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
      setActiveTab('dashboard');
      localStorage.setItem('apex_session_tab', 'dashboard');
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        role={role}
        currentStudent={currentStudent}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLoginClick={() => setActiveTab('login')}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {role === 'guest' ? (
          activeTab === 'login' ? (
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onBack={() => setActiveTab('home')}
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
                className="mb-6 flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-fit"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </button>
            )}
            
            {role === 'admin' && (
              <>
                {activeTab === 'dashboard' && (
                  <AdminDashboard
                    onTabChange={setActiveTab}
                    onAddStudent={() => setActiveTab('students')}
                    onAddBatch={() => setActiveTab('batches')}
                    onUploadNotes={() => setActiveTab('notes')}
                  />
                )}
                {activeTab === 'students' && <AdminStudents />}
                {activeTab === 'batches' && <AdminBatches />}
                {activeTab === 'fees' && <AdminFees />}
                {activeTab === 'notes' && <AdminNotes />}
                {activeTab === 'doubts' && <AdminDoubts />}
                {activeTab === 'tests' && <AdminTests />}
                {activeTab === 'settings' && <AdminSettings />}
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
                {activeTab === 'profile' && <StudentProfile student={currentStudent} />}
                {activeTab === 'help' && <StudentHelp student={currentStudent} />}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
