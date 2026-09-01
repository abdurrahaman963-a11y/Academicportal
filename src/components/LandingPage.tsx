import React, { useState, useEffect } from 'react';
import { School, UserSession, UserRole } from '../types';
import { CLASSES } from '../mockData';
import { GraduationCap, ShieldCheck, UserCheck, Key, Lock, Building2, Loader2, AlertCircle, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { verifySchoolLoginInFirestore, verifyTeacherLoginInFirestore, verifyStudentLoginInFirestore, matchSchoolWithQuery, ensureUserProfileInFirestore } from '../lib/firebase';

interface LandingPageProps {
  schools: School[];
  onSelectSchool: (school: School) => void;
  onOpenSuperAdmin: () => void;
  session: UserSession | null;
  onOpenLogin?: (role?: UserRole, schoolId?: string) => void;
  onLoginSuccess?: (session: UserSession) => void;
  onLogout: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  schools,
  onSelectSchool,
  onOpenSuperAdmin,
  session,
  onLoginSuccess,
  onLogout
}) => {
  const [selectedRole, setSelectedRole] = useState<'School' | 'Teacher' | 'Student' | 'Admin'>('School');
  const [schoolCode, setSchoolCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [studentClass, setStudentClass] = useState('Class I');
  const [studentRoll, setStudentRoll] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedRole === 'Admin') {
      const inputId = loginId.trim().toLowerCase();
      const inputPass = password.trim();

      if (!inputId) {
        setErrorMsg('অনুগ্রহ করে সুপার এডমিন আইডি প্রদান করুন।');
        return;
      }
      if (!inputPass) {
        setErrorMsg('অনুগ্রহ করে সুপার এডমিন পাসওয়ার্ড প্রদান করুন।');
        return;
      }

      const validAdminIds = ['schar', 'admin', 'superadmin', 'sa'];
      const validAdminPass = ['786', 'admin123', 'admin', '1234'];

      if (validAdminIds.includes(inputId) && validAdminPass.includes(inputPass)) {
        const adminSession: UserSession = {
          role: 'SUPER_ADMIN',
          username: inputId,
          name: 'সুপার এডমিনিস্ট্রেটর'
        };
        if (onLoginSuccess) {
          onLoginSuccess(adminSession);
        } else {
          onOpenSuperAdmin();
        }
      } else {
        setErrorMsg('ভুল সুপার এডমিন আইডি বা পাসওয়ার্ড!');
      }
    } else {
      const cleanCode = schoolCode.trim();
      const cleanAdminId = loginId.trim();
      const cleanPassword = password.trim();

      if (!cleanCode && !cleanAdminId) {
        setErrorMsg('অনুগ্রহ করে স্কুলের আইডি / কোড প্রদান করুন।');
        return;
      }

      // Smart match against school list
      const targetSchool = schools.find(s => matchSchoolWithQuery(s, cleanCode, cleanAdminId));

      if (selectedRole === 'School') {
        if (!cleanAdminId) {
          setErrorMsg('অনুগ্রহ করে এডমিন ইউজার আইডি (Admin ID) প্রদান করুন।');
          return;
        }
        if (!cleanPassword) {
          setErrorMsg('অনুগ্রহ করে এডমিন পাসওয়ার্ড / পিন প্রদান করুন।');
          return;
        }

        setIsVerifying(true);
        try {
          const result = await verifySchoolLoginInFirestore(
            targetSchool?.schoolId || cleanCode,
            cleanPassword,
            undefined,
            targetSchool,
            cleanAdminId
          );

          if (result.success && result.school) {
            const schoolSession: UserSession = {
              role: 'SCHOOL_ADMIN',
              schoolId: result.school.schoolId,
              schoolName: result.school.name,
              username: cleanAdminId || result.school.adminId || result.school.schoolId,
              name: `${result.school.name} - এডমিন`
            };
            if (onLoginSuccess) {
              onLoginSuccess(schoolSession);
            } else {
              onSelectSchool(result.school);
            }
          } else {
            setErrorMsg(result.message || 'ভুল এডমিন আইডি বা পাসওয়ার্ড! সঠিক তথ্য প্রদান করুন।');
          }
        } catch (err) {
          setErrorMsg('লগইন ভ্যালিডেশন ব্যর্থ হয়েছে! পুনরায় চেষ্টা করুন।');
        } finally {
          setIsVerifying(false);
        }
      } else if (selectedRole === 'Teacher') {
        if (!loginId.trim()) {
          setErrorMsg('অনুগ্রহ করে শিক্ষক আইডি বা মোবাইল নম্বর প্রদান করুন।');
          return;
        }
        if (!cleanPassword) {
          setErrorMsg('অনুগ্রহ করে শিক্ষক পাসওয়ার্ড বা পিন প্রদান করুন।');
          return;
        }

        setIsVerifying(true);
        try {
          const result = await verifyTeacherLoginInFirestore(
            targetSchool?.schoolId || cleanCode,
            loginId.trim(),
            cleanPassword,
            targetSchool
          );

          if (result.success && result.teacher && result.school) {
            const teacherSession: UserSession = {
              role: 'TEACHER',
              schoolId: result.school.schoolId,
              schoolName: result.school.name,
              username: result.teacher.teacherId || result.teacher.phone || result.teacher.id,
              name: result.teacher.name || 'শিক্ষক',
              phone: result.teacher.phone
            };
            ensureUserProfileInFirestore(teacherSession).catch(() => {});
            if (onLoginSuccess) {
              onLoginSuccess(teacherSession);
            } else {
              onSelectSchool(result.school);
            }
          } else {
            setErrorMsg(result.message || 'শিক্ষক লগইন ব্যর্থ হয়েছে! সঠিক আইডি ও পাসওয়ার্ড দিন।');
          }
        } catch {
          setErrorMsg('শিক্ষক লগইন যাচাইকরণে ত্রুটি হয়েছে! পুনরায় চেষ্টা করুন।');
        } finally {
          setIsVerifying(false);
        }
      } else if (selectedRole === 'Student') {
        if (!studentClass) {
          setErrorMsg('অনুগ্রহ করে শ্রেণী নির্বাচন করুন।');
          return;
        }
        if (!studentRoll.trim()) {
          setErrorMsg('অনুগ্রহ করে রোল নম্বর প্রদান করুন।');
          return;
        }

        setIsVerifying(true);
        try {
          const result = await verifyStudentLoginInFirestore(
            targetSchool?.schoolId || cleanCode,
            studentClass,
            studentRoll.trim(),
            studentPhone.trim(),
            targetSchool
          );

          if (result.success && result.student && result.school) {
            const studentSession: UserSession = {
              role: 'STUDENT',
              schoolId: result.school.schoolId,
              schoolName: result.school.name,
              username: result.student.studentId || `student_${result.student.class}_${result.student.roll}`,
              name: result.student.name,
              studentClass: result.student.class,
              studentRoll: Number(result.student.roll),
              phone: result.student.phone
            };
            ensureUserProfileInFirestore(studentSession).catch(() => {});
            if (onLoginSuccess) {
              onLoginSuccess(studentSession);
            } else {
              onSelectSchool(result.school);
            }
          } else {
            setErrorMsg(result.message || 'শিক্ষার্থী তথ্য যাচাই ব্যর্থ হয়েছে! সঠিক শ্রেণী ও রোল দিন।');
          }
        } catch {
          setErrorMsg('শিক্ষার্থী লগইন যাচাইকরণে ত্রুটি হয়েছে!');
        } finally {
          setIsVerifying(false);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* Subtle Background Glow Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-indigo-900/20 blur-3xl rounded-full pointer-events-none -z-0" />

      {/* Top Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 py-3.5 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-cyan-400">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xl text-white tracking-tight">School</span>
                <span className="font-extrabold text-xl text-amber-500 tracking-tight">hub</span>
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">SMART INSTITUTIONAL PORTAL</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-cyan-300 font-bold bg-cyan-950/80 px-3 py-1.5 rounded-xl border border-cyan-800">
                  {session.name}
                </span>
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  লগআউট
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> V3.2 Direct Portal
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area - Direct Login Page */}
      <main className="flex-1 py-8 sm:py-12 px-4 flex flex-col items-center justify-center z-10">
        <div className="w-full max-w-lg space-y-6">

          {/* Heading */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>বিদ্যালয় ডিজিটাল সিস্টেম পোর্টাল</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              School Hub লগইন পোর্টাল
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              আপনার স্কুলের আইডি ও এডমিন পাসওয়ার্ড দিয়ে সরাসরি নিজস্ব স্কুল প্যানেলে প্রবেশ করুন।
            </p>
          </div>

          {/* Direct Login Card */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 relative">
            
            {/* Role Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
              {[
                { id: 'School', label: 'বিদ্যালয়', icon: Building2 },
                { id: 'Teacher', label: 'শিক্ষক', icon: UserCheck },
                { id: 'Student', label: 'শিক্ষার্থী', icon: GraduationCap },
                { id: 'Admin', label: 'সুপার এডমিন', icon: ShieldCheck },
              ].map(tab => {
                const Icon = tab.icon;
                const active = selectedRole === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(tab.id as any);
                      setErrorMsg(null);
                    }}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg font-extrabold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleInlineLogin} className="space-y-4">
              {selectedRole === 'Admin' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      সুপার এডমিন আইডি (Super Admin ID)
                    </label>
                    <input 
                      type="text"
                      value={loginId}
                      onChange={e => setLoginId(e.target.value)}
                      placeholder=""
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      সুপার এডমিন পাসওয়ার্ড (Password)
                    </label>
                    <input 
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder=""
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-bold"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* School Code Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      ১. স্কুল কোড / আইডি (School ID / Code) <span className="text-rose-400">*</span>
                    </label>
                    <input 
                      type="text"
                      value={schoolCode}
                      onChange={e => {
                        setSchoolCode(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="স্কুল আইডি বা কোড লিখুন"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  {selectedRole === 'School' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          ২. এডমিন ইউজার আইডি (Admin ID) <span className="text-rose-400">*</span>
                        </label>
                        <input 
                          type="text"
                          value={loginId}
                          onChange={e => setLoginId(e.target.value)}
                          placeholder="এডমিন ইউজার আইডি লিখুন"
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          ৩. এডমিন পাসওয়ার্ড / পিন (Admin Password) <span className="text-rose-400">*</span>
                        </label>
                        <input 
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="এডমিন পাসওয়ার্ড বা পিন লিখুন"
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'Teacher' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          শিক্ষক আইডি (Teacher ID)
                        </label>
                        <input 
                          type="text"
                          value={loginId}
                          onChange={e => setLoginId(e.target.value)}
                          placeholder="শিক্ষক আইডি লিখুন"
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          পাসওয়ার্ড (Password)
                        </label>
                        <input 
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="পাসওয়ার্ড লিখুন"
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'Student' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1.5">শ্রেণী (Class)</label>
                          <select
                            value={studentClass}
                            onChange={e => setStudentClass(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
                          >
                            {(() => {
                              const targetSchool = schools.find(s => s.code?.toLowerCase() === schoolCode.trim().toLowerCase() || s.schoolId === schoolCode.trim());
                              const list = targetSchool?.classConfig?.length ? targetSchool.classConfig.map(c => c.name) : CLASSES;
                              return list.map(c => <option key={c} value={c}>{c}</option>);
                            })()}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1.5">রোল (Roll)</label>
                          <input 
                            type="number"
                            value={studentRoll}
                            onChange={e => setStudentRoll(e.target.value)}
                            placeholder="রোল নম্বর"
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">ফোন নম্বর (Phone)</label>
                        <input 
                          type="text"
                          value={studentPhone}
                          onChange={e => setStudentPhone(e.target.value)}
                          placeholder=""
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer mt-4 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>যাচাই করে ড্যাশবোর্ডে প্রবেশ করানো হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <span>প্রবেশ করুন</span> <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400">
                স্কুলের তথ্য বা আইডি ভুলে গেছেন? আপনার সুপার এডমিনের সাথে যোগাযোগ করুন।
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Simple Clean Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} School Hub Portal. All rights reserved.</p>
      </footer>
    </div>
  );
};

