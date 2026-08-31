import React, { useState, useEffect } from 'react';
import { School, UserRole, UserSession } from './types';
import { INITIAL_SCHOOLS, ensureSanitizedSchools } from './mockData';
import { LandingPage } from './components/LandingPage';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SchoolDashboard } from './components/SchoolDashboard';
import { LoginModal } from './components/LoginModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { subscribeSchools, saveSchoolToFirestore, initFirebaseAuth, ensureUserProfileInFirestore } from './lib/firebase';

export default function App() {
  const [schools, setSchools] = useState<School[]>(INITIAL_SCHOOLS);

  // Authentication & Session State initialized to null/landing on app launch
  const [session, setSession] = useState<UserSession | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [currentView, setCurrentView] = useState<'landing' | 'super_admin' | 'school_dashboard'>('landing');

  // URL Parameters for Direct School Login Linking
  const urlParams = new URLSearchParams(window.location.search);
  const urlSchoolId = urlParams.get('schoolId') || urlParams.get('school') || undefined;

  // Login Modal State (Optional)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginPresetRole, setLoginPresetRole] = useState<UserRole>('SCHOOL_ADMIN');
  const [loginPresetSchoolId, setLoginPresetSchoolId] = useState<string | undefined>(urlSchoolId);

  useEffect(() => {
    // Initialize Firebase Auth session so request.auth != null is satisfied
    const unsubAuth = initFirebaseAuth((user) => {
      if (user) {
        if (session) {
          ensureUserProfileInFirestore(session).catch(() => {});
        } else if (selectedSchool) {
          ensureUserProfileInFirestore({
            role: 'SCHOOL_ADMIN',
            schoolId: selectedSchool.schoolId,
            schoolName: selectedSchool.name
          }).catch(() => {});
        }
      }
    });

    const saved = localStorage.getItem('school_hub_schools');
    let initialList = INITIAL_SCHOOLS;
    if (saved) {
      try {
        const parsed: School[] = JSON.parse(saved);
        initialList = ensureSanitizedSchools(parsed);
      } catch {
        initialList = ensureSanitizedSchools(INITIAL_SCHOOLS);
      }
    } else {
      initialList = ensureSanitizedSchools(INITIAL_SCHOOLS);
    }
    setSchools(initialList);

    // Always start at landing on page load / launch so users log in to their respective portals
    setCurrentView('landing');
    localStorage.setItem('school_hub_current_view', 'landing');

    return () => {
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Subscribe to Firestore for real-time school list & usage stats updates (only on landing or super_admin views)
  useEffect(() => {
    if (currentView === 'school_dashboard') {
      return; // dashboard-এ থাকলে global schools listener দরকার নেই
    }

    const handleLocalUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        const sanitized = ensureSanitizedSchools(e.detail);
        setSchools(sanitized);
        if (selectedSchool) {
          const freshSelected = sanitized.find(s => s.schoolId === selectedSchool.schoolId);
          if (freshSelected) setSelectedSchool(freshSelected);
        }
      }
    };
    window.addEventListener('school_hub_schools_local_updated', handleLocalUpdate);

    const unsubscribe = subscribeSchools((remoteSchools) => {
      if (remoteSchools && remoteSchools.length > 0) {
        const sanitized = ensureSanitizedSchools(remoteSchools);
        setSchools(sanitized);
        localStorage.setItem('school_hub_schools', JSON.stringify(sanitized));

        if (selectedSchool) {
          const freshSelected = sanitized.find(s => s.schoolId === selectedSchool.schoolId);
          if (freshSelected) {
            setSelectedSchool(freshSelected);
          }
        }
      }
    });

    return () => {
      window.removeEventListener('school_hub_schools_local_updated', handleLocalUpdate);
      unsubscribe();
    };
  }, [currentView, selectedSchool?.schoolId]);

  const handleUpdateSchools = (updatedList: School[]) => {
    const sanitized = ensureSanitizedSchools(updatedList);
    setSchools(sanitized);
    localStorage.setItem('school_hub_schools', JSON.stringify(sanitized));

    // Save each updated school to Firestore
    sanitized.forEach(s => saveSchoolToFirestore(s));

    if (selectedSchool) {
      const found = updatedList.find(s => s.schoolId === selectedSchool.schoolId);
      if (found) {
        setSelectedSchool(found);
      }
    }
  };

  const handleOpenLogin = (role: UserRole = 'SCHOOL_ADMIN', schoolId?: string) => {
    setLoginPresetRole(role);
    setLoginPresetSchoolId(schoolId);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('school_hub_session', JSON.stringify(newSession));
    setIsLoginModalOpen(false);

    // Route based on role
    if (newSession.role === 'SUPER_ADMIN') {
      setCurrentView('super_admin');
      localStorage.setItem('school_hub_current_view', 'super_admin');
    } else if (newSession.schoolId) {
      const targetSchool = schools.find(s => s.schoolId === newSession.schoolId) || schools[0];
      setSelectedSchool(targetSchool);
      setCurrentView('school_dashboard');
      localStorage.setItem('school_hub_selected_school_id', targetSchool.schoolId);
      localStorage.setItem('school_hub_current_view', 'school_dashboard');
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('school_hub_session');
    localStorage.removeItem('school_hub_selected_school_id');
    localStorage.setItem('school_hub_current_view', 'landing');
    setCurrentView('landing');
    setSelectedSchool(null);
    setIsLoginModalOpen(false);
  };

  const handleSelectSchool = (school: School) => {
    // If a teacher or student is logged in, restrict them strictly to their assigned school
    if (session && session.role !== 'SUPER_ADMIN' && session.schoolId && session.schoolId !== school.schoolId) {
      alert(`আপনার অ্যাকাউন্টটি শুধুমাত্র "${session.schoolName || session.schoolId}" এর সাথে সংযুক্ত। আপনি অন্য কোনো বিদ্যালয়ের তথ্য দেখতে পারবেন না।`);
      const mySchool = schools.find(s => s.schoolId === session.schoolId) || school;
      setSelectedSchool(mySchool);
      setCurrentView('school_dashboard');
      return;
    }
    setSelectedSchool(school);
    setCurrentView('school_dashboard');
    localStorage.setItem('school_hub_selected_school_id', school.schoolId);
    localStorage.setItem('school_hub_current_view', 'school_dashboard');
  };

  const handleOpenSuperAdmin = () => {
    if (session && session.role !== 'SUPER_ADMIN') {
      alert('সুপার এডমিন প্যানেলে প্রবেশের অনুমতি আপনার নেই!');
      return;
    }
    setCurrentView('super_admin');
    localStorage.setItem('school_hub_current_view', 'super_admin');
  };

  const handleBackToLanding = () => {
    // If a teacher or student clicks back, perform clean logout so they cannot navigate around unauthorized
    if (session && (session.role === 'TEACHER' || session.role === 'STUDENT' || session.role === 'PARENT')) {
      handleLogout();
      return;
    }
    setCurrentView('landing');
    localStorage.setItem('school_hub_current_view', 'landing');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-900 font-sans text-slate-100">
        {currentView === 'super_admin' && session?.role === 'SUPER_ADMIN' ? (
          <SuperAdminDashboard
            schools={schools}
            onUpdateSchools={handleUpdateSchools}
            onBackToLanding={handleBackToLanding}
            onSelectSchool={handleSelectSchool}
            session={session}
            onLogout={handleLogout}
          />
        ) : currentView === 'school_dashboard' && selectedSchool ? (
          <SchoolDashboard
            school={selectedSchool}
            onBackToLanding={handleBackToLanding}
            onUpdateSchoolInfo={handleUpdateSchools ? (updated) => {
              const updatedList = schools.map(s => s.schoolId === updated.schoolId ? updated : s);
              handleUpdateSchools(updatedList);
            } : () => {}}
            session={session}
            onLogout={handleLogout}
          />
        ) : (
          <LandingPage
            schools={schools}
            onSelectSchool={handleSelectSchool}
            onOpenSuperAdmin={handleOpenSuperAdmin}
            session={session}
            onOpenLogin={handleOpenLogin}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
          />
        )}

        {/* Login Modal */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          schools={schools}
          onLoginSuccess={handleLoginSuccess}
          initialRole={loginPresetRole}
          selectedSchoolId={loginPresetSchoolId}
        />
      </div>
    </ErrorBoundary>
  );
}
