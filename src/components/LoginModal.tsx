import React, { useState } from 'react';
import { School, UserRole, UserSession } from '../types';
import { CLASSES } from '../mockData';
import { ShieldCheck, GraduationCap, UserCheck, Key, Lock, AlertCircle, ArrowRight, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { verifySchoolLoginInFirestore, verifyTeacherLoginInFirestore, verifyStudentLoginInFirestore, ensureUserProfileInFirestore } from '../lib/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  onLoginSuccess: (session: UserSession) => void;
  initialRole?: UserRole;
  selectedSchoolId?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  schools,
  onLoginSuccess,
  initialRole = 'SCHOOL_ADMIN',
  selectedSchoolId
}) => {
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);
  const [schoolId, setSchoolId] = useState<string>(selectedSchoolId || schools[0]?.schoolId || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form Fields
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [versionKeyInput, setVersionKeyInput] = useState('');
  const [schoolAdminId, setSchoolAdminId] = useState('');
  const [phone, setPhone] = useState('');
  const [studentClass, setStudentClass] = useState('Class I');
  const [rollNumber, setRollNumber] = useState('');

  if (!isOpen) return null;

  const currentSchool = schools.find(s => s.schoolId === schoolId) || schools[0];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (activeRole === 'SUPER_ADMIN') {
      const trimmedKey = adminKeyInput.trim();
      if (trimmedKey === '786' || trimmedKey === 'admin123' || trimmedKey === 'admin' || trimmedKey === 'schar') {
        const session: UserSession = {
          role: 'SUPER_ADMIN',
          username: 'schar',
          name: 'সুপার এডমিনিস্ট্রেটর'
        };
        ensureUserProfileInFirestore(session).catch(() => {});
        onLoginSuccess(session);
      } else {
        setErrorMsg('ভুল পাসওয়ার্ড! সঠিক সুপার এডমিন পাসওয়ার্ড দিন।');
      }
    } else if (activeRole === 'SCHOOL_ADMIN') {
      const cleanAdminId = schoolAdminId.trim();
      const cleanKey = adminKeyInput.trim();

      if (!cleanAdminId) {
        setErrorMsg('অনুগ্রহ করে এডমিন ইউজার আইডি (Admin ID) প্রদান করুন।');
        return;
      }
      if (!cleanKey) {
        setErrorMsg('অনুগ্রহ করে এডমিন পাসওয়ার্ড / পিন প্রদান করুন।');
        return;
      }

      setIsVerifying(true);
      try {
        const result = await verifySchoolLoginInFirestore(
          schoolId,
          cleanKey,
          '',
          currentSchool,
          cleanAdminId
        );

        if (result.success && result.school) {
          const session: UserSession = {
            role: 'SCHOOL_ADMIN',
            schoolId: result.school.schoolId,
            schoolName: result.school.name,
            username: cleanAdminId || result.school.adminId || `admin_${result.school.schoolId}`,
            name: `${result.school.name} - এডমিন`
          };
          ensureUserProfileInFirestore(session).catch(() => {});
          onLoginSuccess(session);
        } else {
          setErrorMsg(result.message || 'ভুল পিন/পাসওয়ার্ড! সঠিক পিন প্রদান করুন।');
        }
      } catch (err) {
        setErrorMsg('লগইন করতে সমস্যা হয়েছে! পুনরায় চেষ্টা করুন।');
      } finally {
        setIsVerifying(false);
      }
    } else if (activeRole === 'TEACHER') {
      const teacherInput = phone.trim();
      if (!teacherInput) {
        setErrorMsg('অনুগ্রহ করে শিক্ষক আইডি বা মোবাইল নম্বর প্রদান করুন।');
        return;
      }
      setIsVerifying(true);
      try {
        const result = await verifyTeacherLoginInFirestore(
          currentSchool.schoolId,
          teacherInput,
          phone.trim(),
          currentSchool
        );
        if (result.success && result.teacher) {
          const session: UserSession = {
            role: 'TEACHER',
            schoolId: currentSchool.schoolId,
            schoolName: currentSchool.name,
            username: result.teacher.teacherId || result.teacher.phone || result.teacher.id,
            name: result.teacher.name || 'সহকারী শিক্ষক',
            phone: result.teacher.phone
          };
          ensureUserProfileInFirestore(session).catch(() => {});
          onLoginSuccess(session);
        } else {
          setErrorMsg(result.message || 'শিক্ষক লগইন ব্যর্থ হয়েছে!');
        }
      } catch {
        setErrorMsg('শিক্ষক লগইন যাচাইকরণে সমস্যা হয়েছে!');
      } finally {
        setIsVerifying(false);
      }
    } else if (activeRole === 'STUDENT' || activeRole === 'PARENT') {
      if (!rollNumber.trim()) {
        setErrorMsg('অনুগ্রহ করে রোল নম্বর প্রদান করুন।');
        return;
      }
      setIsVerifying(true);
      try {
        const result = await verifyStudentLoginInFirestore(
          currentSchool.schoolId,
          studentClass,
          rollNumber.trim(),
          phone.trim(),
          currentSchool
        );
        if (result.success && result.student) {
          const session: UserSession = {
            role: activeRole,
            schoolId: currentSchool.schoolId,
            schoolName: currentSchool.name,
            username: result.student.studentId || `student_${studentClass}_${result.student.roll}`,
            name: result.student.name,
            studentClass: result.student.class,
            studentRoll: Number(result.student.roll),
            phone: result.student.phone
          };
          ensureUserProfileInFirestore(session).catch(() => {});
          onLoginSuccess(session);
        } else {
          setErrorMsg(result.message || 'শিক্ষার্থী তথ্য পাওয়া যায়নি!');
        }
      } catch {
        setErrorMsg('শিক্ষার্থী যাচাইকরণে সমস্যা হয়েছে!');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleQuickDemoLogin = (role: UserRole) => {
    if (role === 'SUPER_ADMIN') {
      onLoginSuccess({
        role: 'SUPER_ADMIN',
        username: 'superadmin',
        name: 'সুপার এডমিনিস্ট্রেটর'
      });
    } else {
      const sch = schools.find(s => s.schoolId === schoolId) || schools[0];
      onLoginSuccess({
        role: role,
        schoolId: sch.schoolId,
        schoolName: sch.name,
        username: `${role.toLowerCase()}_demo`,
        name: role === 'SCHOOL_ADMIN' ? `${sch.name} (এডমিন)` : role === 'TEACHER' ? 'শিক্ষক' : 'শিক্ষার্থী',
        studentClass: 'Class I',
        studentRoll: 1
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative text-slate-100">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">লগইন পোর্টাল</h3>
          <p className="text-xs text-slate-400">সহজ ও সুরক্ষিত উপায়ে আপনার একাউন্টে প্রবেশ করুন</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800">
          {[
            { id: 'SCHOOL_ADMIN', label: 'এডমিন', icon: ShieldCheck },
            { id: 'SUPER_ADMIN', label: 'সুপার', icon: Key },
            { id: 'TEACHER', label: 'শিক্ষক', icon: UserCheck },
            { id: 'STUDENT', label: 'ছাত্র/অভিভাবক', icon: GraduationCap },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeRole === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveRole(tab.id as UserRole);
                  setErrorMsg(null);
                }}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl font-bold transition-all cursor-pointer ${
                  active 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* School Selector (For Non Super Admin) */}
          {activeRole !== 'SUPER_ADMIN' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                বিদ্যালয় নির্বাচন করুন
              </label>
              <select
                value={schoolId}
                onChange={e => {
                  setSchoolId(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                {schools.map(s => (
                  <option key={s.schoolId} value={s.schoolId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* School Admin PIN & ID Fields */}
          {activeRole === 'SCHOOL_ADMIN' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  বিদ্যালয় এডমিন আইডি (Admin ID)
                </label>
                <input
                  type="text"
                  value={schoolAdminId}
                  onChange={e => setSchoolAdminId(e.target.value)}
                  placeholder="এডমিন ইউজার আইডি লিখুন"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  এডমিন পিন (PIN / Password)
                </label>
                <input
                  type="password"
                  value={adminKeyInput}
                  onChange={e => setAdminKeyInput(e.target.value)}
                  placeholder="এডমিন পাসওয়ার্ড বা পিন লিখুন"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* Super Admin Password Field */}
          {activeRole === 'SUPER_ADMIN' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                সুপার এডমিন পাসওয়ার্ড
              </label>
              <input
                type="password"
                value={adminKeyInput}
                onChange={e => setAdminKeyInput(e.target.value)}
                placeholder="সুপার এডমিন পাসওয়ার্ড লিখুন"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
              />
            </div>
          )}

          {/* Teacher Login Phone / PIN Field */}
          {activeRole === 'TEACHER' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                শিক্ষকের আইডি / মোবাইল নম্বর
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="শিক্ষক আইডি বা মোবাইল নম্বর লিখুন"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          )}

          {/* Student / Parent Portal Fields */}
          {(activeRole === 'STUDENT' || activeRole === 'PARENT') && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">শ্রেণী</label>
                  <select
                    value={studentClass}
                    onChange={e => setStudentClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    {(currentSchool?.classConfig?.length ? currentSchool.classConfig.map(c => c.name) : CLASSES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">রোল নম্বর</label>
                  <input
                    type="number"
                    value={rollNumber}
                    onChange={e => setRollNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">মোবাইল নম্বর / পিন</label>
                <input
                  type="password"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold rounded-2xl text-xs transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span>যাচাই করা হচ্ছে...</span>
              </>
            ) : (
              <>
                <span>প্রবেশ করুন</span> <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Shortcut */}
        <div className="pt-2 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => handleQuickDemoLogin(activeRole)}
            className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 text-indigo-300 border border-slate-700/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>⚡ ১-ক্লিকে টেস্ট ডেমো প্রবেশ</span>
          </button>
        </div>

      </div>
    </div>
  );
};
