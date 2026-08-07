// main.tsx (FIXED — no loading screen, app opens instantly)
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
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
import { loadInitialDataFromFirestore } from './lib/firebaseSync'; // 👈 ADD THIS

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

  // 👈 ADD THIS BLOCK — load Firestore data in the background (replaces the old loading screen)
  useEffect(() => {
    loadInitialDataFromFirestore().catch((e) =>
      console.warn('Background Firestore load failed:', e)
    );
  }, []);

  // ... rest of the file stays exactly the same ...
