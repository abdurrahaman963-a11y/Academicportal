import React, { useState, useMemo } from 'react';
import { School, Student, ExamMark, RoutineEntry, NoticeItem, FeeReceipt, UserSession } from '../types';
import { normalizeClassName } from '../mockData';
import { generateStandardStudentId } from '../lib/studentIdHelper';
import { formatPhotoUrl } from '../lib/firebase';
import { MarksheetRenderer, getGradeDetails } from './MarksheetRenderer';
import {
  GraduationCap, Award, Calendar, CreditCard, Bell, Printer, LogOut,
  User, CheckCircle2, AlertCircle, FileText, Phone, MapPin, QrCode, Sparkles
} from 'lucide-react';

interface StudentPortalViewProps {
  school: School;
  student: Student;
  marks: ExamMark[];
  routines: RoutineEntry[];
  notices: NoticeItem[];
  feeReceipts?: FeeReceipt[];
  session: UserSession;
  onLogout: () => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  school,
  student,
  marks,
  routines,
  notices,
  feeReceipts = [],
  session,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'result' | 'admit' | 'idcard' | 'routine' | 'fees' | 'notices'>('result');
  const [selectedExam, setSelectedExam] = useState<string>('3rd Summative Evaluation');
  const [showFullMarksheet, setShowFullMarksheet] = useState<boolean>(false);

  const normalizedClass = normalizeClassName(student.class);

  // Filter marks for this specific student only
  const studentMarks = useMemo(() => {
    return marks.filter(
      m => normalizeClassName(m.class) === normalizedClass &&
           Number(m.roll) === Number(student.roll)
    );
  }, [marks, normalizedClass, student.roll]);

  // Exam specific marks
  const examMarks = useMemo(() => {
    return studentMarks.filter(m => m.examName === selectedExam);
  }, [studentMarks, selectedExam]);

  // Summary calculation for selected exam
  const examSummary = useMemo(() => {
    const totalObtained = examMarks.reduce((sum, m) => sum + (Number(m.markObtain) || 0), 0);
    const totalFull = examMarks.reduce((sum, m) => sum + (Number(m.totalMark) || 100), 0);
    const percentage = totalFull > 0 ? Math.round((totalObtained / totalFull) * 100) : 0;
    const gradeInfo = getGradeDetails(percentage);
    return {
      totalObtained,
      totalFull,
      percentage,
      grade: gradeInfo.grade,
      gpa: gradeInfo.gp,
      remarks: gradeInfo.remarks
    };
  }, [examMarks]);

  // Routine for this student's class
  const classRoutines = useMemo(() => {
    return routines.filter(r => normalizeClassName(r.class) === normalizedClass);
  }, [routines, normalizedClass]);

  // Available Exams from student's marks
  const availableExams = useMemo(() => {
    const exams = Array.from(new Set(studentMarks.map(m => m.examName)));
    if (exams.length === 0) {
      return ['1st Summative Evaluation', '2nd Summative Evaluation', '3rd Summative Evaluation'];
    }
    return exams;
  }, [studentMarks]);

  // Fee months calculation
  const months = [
    { key: 'january', label: 'জানুয়ারি (Jan)', status: student.january },
    { key: 'february', label: 'ফেব্রুয়ারি (Feb)', status: student.february },
    { key: 'march', label: 'মার্চ (Mar)', status: student.march },
    { key: 'april', label: 'এপ্রিল (Apr)', status: student.april },
    { key: 'may', label: 'মে (May)', status: student.may },
    { key: 'june', label: 'জুন (Jun)', status: student.june },
    { key: 'july', label: 'জুলাই (Jul)', status: student.july },
    { key: 'august', label: 'আগস্ট (Aug)', status: student.august },
    { key: 'september', label: 'সেপ্টেম্বর (Sep)', status: student.september },
    { key: 'october', label: 'অক্টোবর (Oct)', status: student.october },
    { key: 'november', label: 'নভেম্বর (Nov)', status: student.november },
    { key: 'december', label: 'ডিসেম্বর (Dec)', status: student.december },
  ];

  const paidMonthsCount = months.filter(m => (m.status || '').toLowerCase() === 'paid').length;
  const dueMonthsCount = 12 - paidMonthsCount;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="no-print border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3.5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {school.logo ? (
              <img
                src={school.logo}
                alt={school.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-white"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md">
                {school.name.substring(0, 1)}
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-base sm:text-lg text-white leading-tight">{school.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-cyan-400 font-semibold flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" /> শিক্ষার্থী ডিজিটাল পোর্টাল
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                  {school.code || school.schoolId}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="font-bold text-sm text-white">{student.name}</div>
              <div className="text-[11px] text-amber-400 font-semibold">
                শ্রেণী: {student.class} | রোল: {student.roll}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="লগআউট করুন"
            >
              <LogOut className="w-4 h-4" />
              <span>লগআউট (Logout)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full flex-1 p-4 sm:p-6 space-y-6">

        {/* Student Profile Overview Banner */}
        <div className="no-print bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
            {/* Student Photo */}
            <div className="relative shrink-0">
              {student.photo ? (
                <img
                  src={formatPhotoUrl(student.photo)}
                  alt={student.name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-cyan-400/50 shadow-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-indigo-700 to-cyan-600 flex items-center justify-center text-3xl font-black text-white shadow-xl border-2 border-indigo-400/30">
                  {student.name.substring(0, 1)}
                </div>
              )}
              <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                সক্রিয়
              </span>
            </div>

            {/* Student Info Details */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{student.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold">
                  {generateStandardStudentId(school, student)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">শ্রেণী (Class)</span>
                  <span className="font-extrabold text-white text-sm">{student.class}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">রোল নম্বর (Roll)</span>
                  <span className="font-extrabold text-amber-400 text-sm">{student.roll}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">পিতার নাম (Father)</span>
                  <span className="font-bold text-slate-200 truncate block">{student.fatherName || 'অভিভাবক'}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">যোগাযোগ (Phone)</span>
                  <span className="font-bold text-slate-200 truncate block">{student.phone || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tab Bar */}
        <div className="no-print flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          {[
            { id: 'result', label: 'মার্কশিট ও রেজাল্ট', icon: Award },
            { id: 'admit', label: 'ডিজিটাল অ্যাডমিট', icon: FileText },
            { id: 'idcard', label: 'স্টুডেন্ট আইডি কার্ড', icon: User },
            { id: 'routine', label: 'ক্লাস রুটিন', icon: Calendar },
            { id: 'fees', label: 'ফি ও পেমেন্ট বিবরণী', icon: CreditCard },
            { id: 'notices', label: 'নোটিশ বোর্ড', icon: Bell }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setShowFullMarksheet(false);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20 font-black'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: RESULT & MARKSHEET */}
        {activeTab === 'result' && (
          <div className="space-y-6">
            {/* Exam Selector and Action Bar */}
            <div className="no-print bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-300">মূল্যায়ন নির্বাচন:</label>
                <select
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-cyan-300 font-bold px-3 py-1.5 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                >
                  {availableExams.map(ex => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFullMarksheet(!showFullMarksheet)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{showFullMarksheet ? 'সাধারণ ভিউ' : 'অফিসিয়াল মার্কশিট ভিউ'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>প্রিন্ট (Print)</span>
                </button>
              </div>
            </div>

            {showFullMarksheet ? (
              /* Official Marksheet Renderer View */
              <div className="bg-white text-slate-900 p-4 rounded-2xl shadow-2xl overflow-x-auto">
                <MarksheetRenderer
                  student={student}
                  allStudents={[student]}
                  allMarks={studentMarks}
                  school={school}
                  examType={selectedExam}
                  styleType="styleA"
                  colorTheme="navy"
                  pageSize="A4"
                  orientation="portrait"
                />
              </div>
            ) : (
              /* Structured Interactive Marks Table */
              <div className="space-y-6">
                {/* Metrics Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-slate-400 text-xs font-medium block">মোট প্রাপ্ত নম্বর</span>
                    <div className="text-2xl font-black text-cyan-400 mt-1">
                      {examSummary.totalObtained} <span className="text-xs text-slate-400 font-normal">/ {examSummary.totalFull}</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-slate-400 text-xs font-medium block">শতাংশ (Percentage)</span>
                    <div className="text-2xl font-black text-emerald-400 mt-1">{examSummary.percentage}%</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-slate-400 text-xs font-medium block">লেটার গ্রেড (Grade)</span>
                    <div className="text-2xl font-black text-amber-400 mt-1">{examSummary.grade}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-slate-400 text-xs font-medium block">ফলাফল ও মন্তব্য</span>
                    <div className="text-lg font-black text-white mt-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>{examSummary.percentage >= 33 ? 'উত্তীর্ণ (Passed)' : 'পুনর্বিবেচনা'}</span>
                    </div>
                  </div>
                </div>

                {/* Subject-Wise Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-extrabold text-white text-sm">বিষয়ভিত্তিক নম্বরপত্র ({selectedExam})</h3>
                    <span className="text-xs text-slate-400 font-mono">শ্রেণী: {student.class}</span>
                  </div>

                  {examMarks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-3">বিষয় (Subject)</th>
                            <th className="px-4 py-3 text-center">পূর্ণমান (Full)</th>
                            <th className="px-4 py-3 text-center">প্রাপ্ত নম্বর (Obtained)</th>
                            <th className="px-4 py-3 text-center">গ্রেড (Grade)</th>
                            <th className="px-4 py-3 text-center">মন্তব্য</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-medium">
                          {examMarks.map((m, idx) => {
                            const pct = m.totalMark > 0 ? Math.round((m.markObtain / m.totalMark) * 100) : 0;
                            const g = getGradeDetails(pct);
                            return (
                              <tr key={idx} className="hover:bg-slate-800/40">
                                <td className="px-4 py-3.5 font-bold text-white">{m.subjectName}</td>
                                <td className="px-4 py-3.5 text-center text-slate-400">{m.totalMark}</td>
                                <td className="px-4 py-3.5 text-center font-extrabold text-cyan-300 text-sm">
                                  {m.markObtain}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                    {m.grade || g.grade}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-center text-slate-300">{g.remarks}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-950 font-black text-white border-t border-slate-800">
                          <tr>
                            <td className="px-4 py-3.5">সর্বমোট (Grand Total)</td>
                            <td className="px-4 py-3.5 text-center">{examSummary.totalFull}</td>
                            <td className="px-4 py-3.5 text-center text-cyan-400 text-base">{examSummary.totalObtained}</td>
                            <td className="px-4 py-3.5 text-center text-amber-400">{examSummary.grade}</td>
                            <td className="px-4 py-3.5 text-center text-emerald-400">{examSummary.percentage}%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-10 text-center text-slate-400">
                      <Award className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="font-bold">এই মূল্যায়নের কোনো নম্বর এখনও এন্ট্রি করা হয়নি।</p>
                      <p className="text-xs text-slate-500 mt-1">বিদ্যালয় কর্তৃপক্ষ নম্বর আপলোড করলে এখানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADMIT CARD */}
        {activeTab === 'admit' && (
          <div className="space-y-6">
            <div className="no-print flex justify-end">
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow"
              >
                <Printer className="w-4 h-4" />
                <span>অ্যাডমিট কার্ড প্রিন্ট করুন</span>
              </button>
            </div>

            {/* Printable Digital Admit Card Card */}
            <div className="bg-white text-slate-900 border-4 border-double border-indigo-900 rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto shadow-2xl space-y-6 font-sans">
              {/* Admit Header */}
              <div className="text-center border-b-2 border-indigo-900 pb-4 space-y-1">
                {school.logo && (
                  <img src={school.logo} alt="Logo" className="w-12 h-12 mx-auto object-contain mb-1" referrerPolicy="no-referrer" />
                )}
                <h2 className="text-xl sm:text-2xl font-black text-indigo-950 uppercase tracking-tight">{school.name}</h2>
                <p className="text-xs text-slate-600">{school.address}</p>
                <div className="inline-block mt-2 px-4 py-1 bg-indigo-950 text-white rounded-full text-xs font-black tracking-widest uppercase">
                  পরীক্ষার প্রবেশপত্র (EXAM ADMIT CARD)
                </div>
              </div>

              {/* Student Info Box */}
              <div className="flex items-center gap-6">
                <div className="flex-1 grid grid-cols-2 gap-y-2 text-xs">
                  <div><span className="font-bold text-slate-500">শিক্ষার্থীর নাম:</span> <span className="font-extrabold text-slate-900 text-sm block">{student.name}</span></div>
                  <div><span className="font-bold text-slate-500">শ্রেণী (Class):</span> <span className="font-extrabold text-slate-900 text-sm block">{student.class}</span></div>
                  <div><span className="font-bold text-slate-500">রোল নম্বর (Roll):</span> <span className="font-black text-indigo-900 text-base block">{student.roll}</span></div>
                  <div><span className="font-bold text-slate-500">স্টুডেন্ট আইডি:</span> <span className="font-bold text-slate-800 font-mono block">{generateStandardStudentId(school, student)}</span></div>
                  <div><span className="font-bold text-slate-500">পিতার নাম:</span> <span className="font-bold text-slate-800 block">{student.fatherName || 'N/A'}</span></div>
                  <div><span className="font-bold text-slate-500">শিক্ষাবর্ষ:</span> <span className="font-bold text-slate-800 block">{school.currentAcademicYear || '2026'}</span></div>
                </div>

                {student.photo ? (
                  <img src={formatPhotoUrl(student.photo)} alt="Photo" className="w-20 h-24 object-cover border-2 border-slate-400 rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-20 h-24 bg-slate-200 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-500 text-center p-1">
                    ছবি লাগান
                  </div>
                )}
              </div>

              {/* Rules / Instructions */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 space-y-1">
                <div className="font-bold text-indigo-950">পরীক্ষার্থীদের জন্য সাধারণ নির্দেশাবলী:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  <li>পরীক্ষা শুরুর অন্তত ১৫ মিনিট পূর্বে পরীক্ষা কক্ষে প্রবেশ করতে হবে।</li>
                  <li>প্রবেশপত্র (Admit Card) ছাড়া কোনো শিক্ষার্থীকে পরীক্ষায় অংশ নিতে দেওয়া হবে না।</li>
                  <li>পরীক্ষার হলে যেকোনো ধরণের অসদুপায় সম্পূর্ণ নিষিদ্ধ।</li>
                </ul>
              </div>

              {/* Signature Row */}
              <div className="pt-6 flex items-end justify-between text-xs">
                <div className="text-center">
                  <div className="w-32 border-b border-slate-400 mb-1"></div>
                  <span className="text-[11px] font-semibold text-slate-600">শ্রেণী শিক্ষকের স্বাক্ষর</span>
                </div>
                <div className="text-center">
                  {school.signature ? (
                    <img src={school.signature} alt="Sign" className="h-8 mx-auto mb-1 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-32 border-b border-slate-900 mb-1"></div>
                  )}
                  <span className="text-[11px] font-bold text-indigo-950">প্রধান শিক্ষক / অধ্যক্ষ</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIGITAL ID CARD */}
        {activeTab === 'idcard' && (
          <div className="space-y-6">
            <div className="no-print flex justify-end">
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow"
              >
                <Printer className="w-4 h-4" />
                <span>আইডি কার্ড প্রিন্ট করুন</span>
              </button>
            </div>

            {/* Printable ID Card */}
            <div className="w-80 sm:w-96 mx-auto bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-5 border-2 border-indigo-400/40 shadow-2xl space-y-4 text-center font-sans relative overflow-hidden">
              <div className="border-b border-indigo-700/60 pb-3 space-y-1">
                <h3 className="font-black text-sm uppercase tracking-tight text-white">{school.name}</h3>
                <p className="text-[10px] text-cyan-300 font-semibold uppercase tracking-wider">STUDENT IDENTITY CARD</p>
              </div>

              <div className="flex flex-col items-center space-y-2">
                {student.photo ? (
                  <img
                    src={formatPhotoUrl(student.photo)}
                    alt={student.name}
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-cyan-400 shadow-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-indigo-700 flex items-center justify-center text-3xl font-black text-white border-2 border-cyan-400 shadow-xl">
                    {student.name.substring(0, 1)}
                  </div>
                )}
                <div>
                  <h4 className="font-extrabold text-base text-white">{student.name}</h4>
                  <p className="text-xs text-amber-400 font-bold">Class: {student.class} | Roll: {student.roll}</p>
                </div>
              </div>

              <div className="bg-slate-900/80 rounded-2xl p-3 text-left text-xs space-y-1.5 border border-slate-800">
                <div className="flex justify-between"><span className="text-slate-400">ID No:</span> <span className="font-mono font-bold text-cyan-300">{generateStandardStudentId(school, student)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Father:</span> <span className="font-semibold text-white">{student.fatherName || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Contact:</span> <span className="font-semibold text-white">{student.phone || school.phone}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Address:</span> <span className="font-semibold text-slate-300 truncate max-w-[160px]">{student.address || school.address}</span></div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[10px] border-t border-indigo-800/60">
                <span className="text-slate-400">Session: {school.currentAcademicYear || '2026'}</span>
                <span className="font-bold text-cyan-400">Authorized Card</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLASS ROUTINE */}
        {activeTab === 'routine' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-extrabold text-white text-base">ক্লাস রুটিন (Class Routine)</h3>
                  <p className="text-xs text-slate-400">শ্রেণী: {student.class} এর সাপ্তাহিক সময়সূচী</p>
                </div>
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>প্রিন্ট</span>
                </button>
              </div>

              {classRoutines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">বার (Day)</th>
                        <th className="px-4 py-3">পিরিয়ড (Period)</th>
                        <th className="px-4 py-3">বিষয় (Subject)</th>
                        <th className="px-4 py-3">শিক্ষক (Teacher)</th>
                        <th className="px-4 py-3">সময় (Time)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {classRoutines.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3.5 font-extrabold text-cyan-300">{r.day}</td>
                          <td className="px-4 py-3.5 text-slate-400 font-bold">পিরিয়ড {r.period}</td>
                          <td className="px-4 py-3.5 font-bold text-white">{r.subject}</td>
                          <td className="px-4 py-3.5 text-amber-300">{r.teacher || 'সহকারী শিক্ষক'}</td>
                          <td className="px-4 py-3.5 text-slate-400">{r.timeSlot || '১০:০০ - ১০:৪৫'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="font-bold">এই শ্রেণীর জন্য এখনও কোনো রুটিন তৈরি করা হয়নি।</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: FEES & PAYMENT STATUS */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            {/* Fee Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-slate-400 text-xs font-medium block">মাসিক টিউশন ফি</span>
                <div className="text-2xl font-black text-white mt-1">৳ {student.monthlyFee || 300}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-slate-400 text-xs font-medium block">পরিশোধিত মাসসমূহ</span>
                <div className="text-2xl font-black text-emerald-400 mt-1">{paidMonthsCount} মাস</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-slate-400 text-xs font-medium block">বকেয়া মাসসমূহ</span>
                <div className="text-2xl font-black text-rose-400 mt-1">{dueMonthsCount} মাস</div>
              </div>
            </div>

            {/* 12 Months Status Grid */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-extrabold text-white text-sm">মাসিক ফি পরিশোধের তালিকা (১২ মাস)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {months.map((m, idx) => {
                  const isPaid = (m.status || '').toLowerCase() === 'paid';
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border flex items-center justify-between ${
                        isPaid
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="font-bold text-xs">{m.label}</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isPaid ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isPaid ? 'পরিশোধিত' : 'বকেয়া'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: NOTICES */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            {notices.length > 0 ? (
              notices.map((n, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-extrabold text-white text-base">{n.title}</h3>
                    <span className="text-xs text-slate-400 font-mono">{n.date || '২০২৬'}</span>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                </div>
              ))
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
                <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="font-bold">বর্তমানে কোনো নতুন নোটিশ নেই।</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
