import React, { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from 'react';
import { School, Student, ExamMark, DaybookEntry, Teacher, NoticeItem, SyllabusItem, RoutineEntry, RoutineSettings, UserSession, ExpenseItem, FeeReceipt, DataBackupSnapshot, VehicleConfig, FeeTotalsDoc, AttendanceDoc, PrintDocType, DocPrintConfig, PageSize, PageOrientation, MarksheetStyle, MarksheetColor, ClassConfig } from '../types';
import { CLASSES, DEFAULT_CLASS_CONFIG, SUBJECTS, CLASS_SHEET_MAP, MOCK_STUDENTS, MOCK_MARKS, normalizeClassName, safeLocalStorageSetItem, isProchestaSchool } from '../mockData';
import { MarksheetRenderer, COLOR_THEMES, getGradeDetails } from './MarksheetRenderer';
import { StudentIdCard, StudentIdCardSheet, IdCardTemplateType } from './StudentIdCardRenderer';
import { 
  saveSchoolToFirestore,
  subscribeSingleSchool,
  fetchSchoolStudentsFromFirestore,
  subscribeStudentsFromFirestore,
  saveStudentsBatchToFirestore,
  saveStudentSingleToFirestore,
  cleanupDuplicateStudentDocIds,
  deleteStudentSingleFromFirestore,
  fetchSchoolMarksFromFirestore,
  subscribeMarksFromFirestore,
  saveMarksBatchToFirestore,
  fetchTeachersFromFirestore,
  subscribeTeachersFromFirestore,
  saveTeacherSingleToFirestore,
  deleteTeacherSingleFromFirestore,
  fetchExpensesFromFirestore,
  subscribeExpensesFromFirestore,
  saveExpenseSingleToFirestore,
  deleteExpenseSingleFromFirestore,
  fetchFeeReceiptsFromFirestore,
  subscribeFeeReceiptsFromFirestore,
  fetchFeeTotalsFromFirestore,
  subscribeFeeTotalsFromFirestore,
  saveFeeReceiptSingleToFirestore,
  deleteFeeReceiptSingleFromFirestore,
  fetchDaybookFromFirestore,
  subscribeDaybookFromFirestore,
  saveDaybookSingleToFirestore,
  deleteDaybookSingleFromFirestore,
  saveAttendanceForClass,
  fetchAttendanceForClass,
  fetchRoutinesFromFirestore,
  subscribeRoutinesFromFirestore,
  saveRoutinesBatchToFirestore,
  subscribeNoticesFromFirestore,
  saveNoticeSingleToFirestore,
  deleteNoticeSingleFromFirestore,
  fetchVehiclesFromFirestore,
  subscribeVehiclesFromFirestore,
  saveVehicleSingleToFirestore,
  deleteVehicleSingleFromFirestore,
  getSchoolDataFromFirestore,
  uploadImageToCloud,
  uploadStudentPhotoToStorage,
  uploadTeacherPhotoToStorage,
  uploadSchoolAssetToStorage,
  compressAndOptimizeImageUrl,
  compressImageFileToDataUrl,
  formatPhotoUrl,
  reactivateDocument,
  permanentlyDeleteDocFromFirestore,
  hardDeleteStudentFromFirestore,
  purgeAllInactiveStudentsFromFirestore,
  deduplicateAndNormalizeStudents,
  getStandardStudentDocId,
  getNextReceiptNoFromFirestore,
  updateFeeTotalsOnReceiptSave
} from '../lib/firebase';
import {
  Building2,
  GraduationCap, Users, User, CreditCard, Award, FileText, Settings, 
  HelpCircle, Copy, Check, CheckCircle2, AlertTriangle, Save,
  Plus, Search, Edit2, Trash2, ArrowLeft, RefreshCw, Printer, Calendar,
  BookOpen, Clock, DollarSign, ChevronRight, Shield, Download, FileSpreadsheet, CheckCircle, LogOut,
  Megaphone, Bell, Share2, Eye, Camera, Image as ImageIcon, RotateCcw, History, Lock, UploadCloud,
  Car, Phone, MapPin, CheckSquare, XSquare, ShieldCheck, Sparkles, BookCheck
} from 'lucide-react';
import { StudentPortalView } from './StudentPortalView';
import { StudentPrintSelector, getStudentKey, filterPrintStudents, PrintSelectionMode } from './StudentPrintSelector';
import { StudentCsvImportModal } from './StudentCsvImportModal';
import { generateStandardStudentId, getSchoolInitials, getAcademicYear } from '../lib/studentIdHelper';

interface SchoolDashboardProps {
  school: School;
  onBackToLanding: () => void;
  onUpdateSchoolInfo: (updated: School) => void;
  session?: UserSession | null;
  onLogout?: () => void;
}

export const SchoolDashboard: React.FC<SchoolDashboardProps> = ({
  school,
  onBackToLanding,
  onUpdateSchoolInfo,
  session,
  onLogout
}) => {
  const isTeacher = session?.role === 'TEACHER';
  const isStudent = session?.role === 'STUDENT' || session?.role === 'PARENT';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN' || session?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'fees' | 'exams' | 'admit' | 'marksheet' | 'idcard' | 'notices' | 'routine' | 'certificates' | 'teachers' | 'daybook' | 'settings'>('overview');
  const isCurrentSchoolProchesta = useMemo(() => isProchestaSchool(school), [school]);

  // Dynamic Class & Section Configuration per school with fallback to DEFAULT_CLASS_CONFIG
  const availableClasses = useMemo<ClassConfig[]>(() => {
    const config = school.classConfig && school.classConfig.length > 0 ? school.classConfig : DEFAULT_CLASS_CONFIG;
    return [...config].sort((a, b) => a.order - b.order);
  }, [school.classConfig]);

  const availableClassNames = useMemo<string[]>(() => {
    return availableClasses.map(c => c.name);
  }, [availableClasses]);

  // Security guard for teacher: prevent navigating to fees, settings, daybook, etc.
  useEffect(() => {
    if (isTeacher && ['fees', 'daybook', 'settings', 'certificates', 'teachers'].includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [isTeacher, activeTab]);

  const [students, setStudents] = useState<Student[]>(() => {
    const isProchesta = isProchestaSchool(school);

    const saved = localStorage.getItem(`students_${school.schoolId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isProchesta && parsed.length < 380) {
            return MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) }));
          }
          return parsed.map(st => ({ ...st, class: normalizeClassName(st.class) }));
        }
      } catch {}
    }
    return isProchesta ? MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) })) : [];
  });

  const [marks, setMarks] = useState<ExamMark[]>(() => {
    const isProchesta = isProchestaSchool(school);

    const saved = localStorage.getItem(`marks_${school.schoolId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return isProchesta ? MOCK_MARKS : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(school.status === 'ONLINE');

  // Student Directory Sub-tab State
  const [studentSubTab, setStudentSubTab] = useState<'list' | 'attendance' | 'vehicle' | 'routine' | 'notices' | 'printhub'>('list');

  // Central Print Configuration State (Step 1)
  const [printConfigs, setPrintConfigs] = useState<Record<PrintDocType, DocPrintConfig>>({
    marksheet: { size: 'A4', orientation: 'portrait' },
    idcard: { size: 'A5', orientation: 'landscape' },
    admit: { size: 'A4', orientation: 'portrait' },
    dailyCollection: { size: 'A5', orientation: 'portrait' },
    general: { size: 'A4', orientation: 'portrait' }
  });

  const triggerPrint = (docType: PrintDocType = 'general') => {
    let cfg = printConfigs[docType] || { size: 'A4', orientation: 'portrait' };
    if (docType === 'marksheet') {
      cfg = { size: marksheetPaperSize, orientation: marksheetOrientation };
    }
    const printClass = `printing-${cfg.size.toLowerCase()}-${cfg.orientation.toLowerCase()}`;
    
    document.body.classList.remove('printing-a4-portrait', 'printing-a4-landscape', 'printing-a5-portrait', 'printing-a5-landscape', 'printing-a5-mode');
    document.body.classList.add(printClass);

    const cleanup = () => {
      document.body.classList.remove('printing-a4-portrait', 'printing-a4-landscape', 'printing-a5-portrait', 'printing-a5-landscape', 'printing-a5-mode');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1200);
  };

  // Dynamic Grade & Rank Calculation Helpers (Step 2)
  const getGradeFromPercentage = (pct: number): string => {
    return getGradeDetails(pct).grade;
  };

  const calculateClassRanksMap = (targetClass: string, examName: string): Record<number, number> => {
    const classStudents = students.filter(
      st => normalizeClassName(st.class) === normalizeClassName(targetClass) && st.isActive !== false
    );
    
    const studentTotals = classStudents.map(st => {
      const studentMarks = marks.filter(
        m => normalizeClassName(m.class) === normalizeClassName(targetClass) &&
             m.examName === examName &&
             Number(m.roll) === Number(st.roll)
      );
      const grandObtained = studentMarks.reduce((sum, m) => sum + (m.markObtain || 0), 0);
      return { roll: Number(st.roll), grandObtained };
    });

    studentTotals.sort((a, b) => b.grandObtained - a.grandObtained);

    const rankMap: Record<number, number> = {};
    studentTotals.forEach((item, index) => {
      rankMap[item.roll] = index + 1;
    });

    return rankMap;
  };

  // Form Saving Protection States (Step 3)
  const [isSavingStudent, setIsSavingStudent] = useState<boolean>(false);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState<boolean>(false);
  const [isSavingTeacher, setIsSavingTeacher] = useState<boolean>(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState<boolean>(false);
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);
  const [isSavingReceipt, setIsSavingReceipt] = useState<boolean>(false);
  const [isSavingNotice, setIsSavingNotice] = useState<boolean>(false);

  // Attendance State
  const [attendanceClass, setAttendanceClass] = useState<string>('NURSERY');
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'Present' | 'Absent'>>({});

  // Routine Settings & State
  const [routineSettings, setRoutineSettings] = useState<RoutineSettings>(() => {
    const saved = localStorage.getItem(`routine_settings_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      totalPeriods: 5,
      periodDurationMins: 45,
      startTime: '10:00',
      tiffinAfterPeriod: 3,
      tiffinDurationMins: 30,
      tiffinTimeLabel: '12:15 PM - 12:45 PM (টিফিন বিরতি)'
    };
  });

  useEffect(() => {
    localStorage.setItem(`routine_settings_${school.schoolId}`, JSON.stringify(routineSettings));
  }, [routineSettings, school.schoolId]);

  const [routineFormState, setRoutineFormState] = useState({
    class: 'Class I',
    day: 'SUNDAY',
    period: '1',
    subject: 'বাংলা',
    teacher: 'Dr. Ramesh Chandra'
  });

  const [routineEntries, setRoutineEntries] = useState<RoutineEntry[]>(() => {
    const saved = localStorage.getItem(`routine_entries_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: '1', class: 'Class I', day: 'SUNDAY', period: 1, timeSlot: '10:00 - 10:45 AM', subject: 'বাংলা', teacher: 'Dr. Ramesh Chandra' },
      { id: '2', class: 'Class I', day: 'SUNDAY', period: 2, timeSlot: '10:45 - 11:30 AM', subject: 'ইংরেজি', teacher: 'Sujata M.' },
      { id: '3', class: 'Class I', day: 'SUNDAY', period: 3, timeSlot: '11:30 AM - 12:15 PM', subject: 'গণিত', teacher: 'Bipul Paul' },
      { id: '4', class: 'Class I', day: 'SUNDAY', period: 4, timeSlot: '12:45 - 01:30 PM', subject: 'পরিবেশ', teacher: 'Headmaster' },
      { id: '5', class: 'Class I', day: 'SUNDAY', period: 5, timeSlot: '01:30 - 02:15 PM', subject: 'ক্রীড়া', teacher: 'Staff' },

      { id: '6', class: 'Class I', day: 'MONDAY', period: 1, timeSlot: '10:00 - 10:45 AM', subject: 'গণিত', teacher: 'Bipul Paul' },
      { id: '7', class: 'Class I', day: 'MONDAY', period: 2, timeSlot: '10:45 - 11:30 AM', subject: 'বাংলা', teacher: 'Dr. Ramesh Chandra' },
      { id: '8', class: 'Class I', day: 'MONDAY', period: 3, timeSlot: '11:30 AM - 12:15 PM', subject: 'ইংরেজি', teacher: 'Sujata M.' },
      { id: '9', class: 'Class I', day: 'MONDAY', period: 4, timeSlot: '12:45 - 01:30 PM', subject: 'অঙ্কন', teacher: 'Staff' },
      { id: '10', class: 'Class I', day: 'MONDAY', period: 5, timeSlot: '01:30 - 02:15 PM', subject: 'পরিবেশ', teacher: 'Headmaster' },

      { id: '11', class: 'Class I', day: 'TUESDAY', period: 1, timeSlot: '10:00 - 10:45 AM', subject: 'ইংরেজি', teacher: 'Sujata M.' },
      { id: '12', class: 'Class I', day: 'TUESDAY', period: 2, timeSlot: '10:45 - 11:30 AM', subject: 'গণিত', teacher: 'Bipul Paul' },
      { id: '13', class: 'Class I', day: 'TUESDAY', period: 3, timeSlot: '11:30 AM - 12:15 PM', subject: 'বাংলা', teacher: 'Dr. Ramesh Chandra' },
      { id: '14', class: 'Class I', day: 'TUESDAY', period: 4, timeSlot: '12:45 - 01:30 PM', subject: 'সঙ্গীত', teacher: 'Staff' },
      { id: '15', class: 'Class I', day: 'TUESDAY', period: 5, timeSlot: '01:30 - 02:15 PM', subject: 'বিজ্ঞান', teacher: 'Staff' },

      { id: '16', class: 'Class I', day: 'WEDNESDAY', period: 1, timeSlot: '10:00 - 10:45 AM', subject: 'বাংলা', teacher: 'Dr. Ramesh Chandra' },
      { id: '17', class: 'Class I', day: 'WEDNESDAY', period: 2, timeSlot: '10:45 - 11:30 AM', subject: 'পরিবেশ', teacher: 'Headmaster' },
      { id: '18', class: 'Class I', day: 'WEDNESDAY', period: 3, timeSlot: '11:30 AM - 12:15 PM', subject: 'গণিত', teacher: 'Bipul Paul' },
      { id: '19', class: 'Class I', day: 'WEDNESDAY', period: 4, timeSlot: '12:45 - 01:30 PM', subject: 'ইংরেজি', teacher: 'Sujata M.' },
      { id: '20', class: 'Class I', day: 'WEDNESDAY', period: 5, timeSlot: '01:30 - 02:15 PM', subject: 'কম্পিউটার', teacher: 'Staff' },

      { id: '21', class: 'Class I', day: 'THURSDAY', period: 1, timeSlot: '10:00 - 10:45 AM', subject: 'গণিত', teacher: 'Bipul Paul' },
      { id: '22', class: 'Class I', day: 'THURSDAY', period: 2, timeSlot: '10:45 - 11:30 AM', subject: 'ইংরেজি', teacher: 'Sujata M.' },
      { id: '23', class: 'Class I', day: 'THURSDAY', period: 3, timeSlot: '11:30 AM - 12:15 PM', subject: 'বাংলা', teacher: 'Dr. Ramesh Chandra' },
      { id: '24', class: 'Class I', day: 'THURSDAY', period: 4, timeSlot: '12:45 - 01:30 PM', subject: 'পরীক্ষা', teacher: 'All Teachers' },
      { id: '25', class: 'Class I', day: 'THURSDAY', period: 5, timeSlot: '01:30 - 02:15 PM', subject: 'সাপ্তাহিক মূল্যায়ন', teacher: 'All Teachers' }
    ];
  });

  useEffect(() => {
    localStorage.setItem(`routine_entries_${school.schoolId}`, JSON.stringify(routineEntries));
  }, [routineEntries, school.schoolId]);

  const [isRoutineConfigOpen, setIsRoutineConfigOpen] = useState(false);
  const [isSyncingRoutine, setIsSyncingRoutine] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    day: string;
    period: number;
    timeSlot: string;
    currentSubject: string;
    currentTeacher: string;
  } | null>(null);

  // Routine Issue & Conflict Detector States
  const [showRoutineIssueDetector, setShowRoutineIssueDetector] = useState(true);
  const [issueFilterScope, setIssueFilterScope] = useState<'ALL' | 'CURRENT'>('ALL');

  interface RoutineIssueItem {
    id: string;
    type: 'TEACHER_CLASH' | 'MISSING_TEACHER' | 'MISSING_SUBJECT';
    severity: 'HIGH' | 'MEDIUM';
    day: string;
    period: number;
    className: string;
    teacherName?: string;
    subjectName?: string;
    message: string;
  }

  const getRoutineIssues = (): RoutineIssueItem[] => {
    const issues: RoutineIssueItem[] = [];
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
    const totalP = Number(routineSettings.totalPeriods || 5);

    // 1. Teacher Overlap / Double Booking Check
    days.forEach(day => {
      for (let p = 1; p <= totalP; p++) {
        const entriesForDayPeriod = routineEntries.filter(
          r => r.day === day && Number(r.period) === p
        );

        const teacherMap: Record<string, RoutineEntry[]> = {};
        entriesForDayPeriod.forEach(e => {
          if (e.teacher && e.teacher.trim() && e.teacher !== 'Staff' && e.teacher !== 'All Teachers' && e.teacher !== 'শিক্ষক') {
            const k = e.teacher.trim().toLowerCase();
            if (!teacherMap[k]) teacherMap[k] = [];
            teacherMap[k].push(e);
          }
        });

        Object.entries(teacherMap).forEach(([_, matched]) => {
          if (matched.length > 1) {
            const classList = Array.from(new Set(matched.map(m => m.class)));
            if (classList.length > 1) {
              const teacherName = matched[0].teacher;
              issues.push({
                id: `clash-${day}-${p}-${teacherName}`,
                type: 'TEACHER_CLASH',
                severity: 'HIGH',
                day,
                period: p,
                teacherName,
                className: classList.join(', '),
                message: `শিক্ষক "${teacherName}" ${day}-এ ${p}ম পিরিয়ডে একাধিক শ্রেণীতে (${classList.join(' ও ')}) একসাথে ক্লাস দেওয়া হয়েছে!`
              });
            }
          }
        });
      }
    });

    // 2. Unassigned Subject or Teacher for Selected or All Classes
    const targetClasses = issueFilterScope === 'ALL' ? availableClassNames : [routineClass];
    targetClasses.forEach(cls => {
      const normCls = normalizeClassName(cls);
      days.forEach(day => {
        for (let p = 1; p <= totalP; p++) {
          const entry = routineEntries.find(
            r => normalizeClassName(r.class) === normCls && r.day === day && Number(r.period) === p
          );
          if (!entry) {
            issues.push({
              id: `missing-slot-${normCls}-${day}-${p}`,
              type: 'MISSING_SUBJECT',
              severity: 'MEDIUM',
              day,
              period: p,
              className: cls,
              message: `${cls} শ্রেণীতে ${day}-এ ${p}ম পিরিয়ড সম্পূর্ণ খালি রয়েছে (+ বিষয় বরাদ্দ দিন)`
            });
          } else if (!entry.teacher || entry.teacher === 'শিক্ষক' || !entry.teacher.trim()) {
            issues.push({
              id: `no-teacher-${normCls}-${day}-${p}`,
              type: 'MISSING_TEACHER',
              severity: 'MEDIUM',
              day,
              period: p,
              className: cls,
              subjectName: entry.subject,
              message: `${cls} শ্রেণীতে ${day}-এ ${p}ম পিরিয়ডে (${entry.subject}) শিক্ষকের নাম খালি রয়েছে`
            });
          }
        }
      });
    });

    return issues;
  };

  const getCellTeacherClash = (day: string, periodNum: number, currentTeacher?: string) => {
    if (!currentTeacher || currentTeacher === 'Staff' || currentTeacher === 'All Teachers' || currentTeacher === 'শিক্ষক') return null;
    const sameTeacherEntries = routineEntries.filter(
      r => r.day === day && Number(r.period) === periodNum && r.teacher?.trim().toLowerCase() === currentTeacher.trim().toLowerCase()
    );
    if (sameTeacherEntries.length > 1) {
      const classes = Array.from(new Set(sameTeacherEntries.map(e => e.class)));
      if (classes.length > 1) {
        return classes.filter(c => normalizeClassName(c) !== normalizeClassName(routineClass));
      }
    }
    return null;
  };

  const getCalculatedSlots = () => {
    const slots: { periodNum: number; isTiffin?: boolean; label: string; timeRange: string }[] = [];
    let [hours, mins] = (routineSettings.startTime || '10:00').split(':').map(Number);
    if (isNaN(hours)) hours = 10;
    if (isNaN(mins)) mins = 0;

    const formatTime = (h: number, m: number) => {
      const p = h >= 12 ? 'PM' : 'AM';
      const dh = h % 12 === 0 ? 12 : h % 12;
      const dm = m < 10 ? `0${m}` : m;
      return `${dh}:${dm} ${p}`;
    };

    const total = Number(routineSettings.totalPeriods || 5);
    const tiffinAfter = Number(routineSettings.tiffinAfterPeriod || 3);

    for (let i = 1; i <= total; i++) {
      const startStr = formatTime(hours, mins);
      mins += Number(routineSettings.periodDurationMins || 45);
      hours += Math.floor(mins / 60);
      mins = mins % 60;
      const endStr = formatTime(hours, mins);

      slots.push({
        periodNum: i,
        label: `Period ${i}`,
        timeRange: `${startStr} - ${endStr}`
      });

      if (i === tiffinAfter) {
        const tiffinStart = formatTime(hours, mins);
        mins += Number(routineSettings.tiffinDurationMins || 30);
        hours += Math.floor(mins / 60);
        mins = mins % 60;
        const tiffinEnd = formatTime(hours, mins);

        slots.push({
          periodNum: -1,
          isTiffin: true,
          label: '🍱 টিফিন বিরতি',
          timeRange: `${tiffinStart} - ${tiffinEnd}`
        });
      }
    }
    return slots;
  };

  const handleSaveSlot = (subject: string, teacher: string) => {
    if (!editingSlot) return;
    const normClass = normalizeClassName(routineClass);
    const existingIndex = routineEntries.findIndex(
      r => normalizeClassName(r.class) === normClass && r.day === editingSlot.day && Number(r.period) === editingSlot.period
    );

    const newEntry: RoutineEntry = {
      id: existingIndex >= 0 ? routineEntries[existingIndex].id : String(Date.now()),
      class: normClass,
      day: editingSlot.day,
      period: editingSlot.period,
      timeSlot: editingSlot.timeSlot,
      subject: subject,
      teacher: teacher
    };

    if (existingIndex >= 0) {
      const updated = [...routineEntries];
      updated[existingIndex] = newEntry;
      setRoutineEntries(updated);
    } else {
      setRoutineEntries([...routineEntries, newEntry]);
    }
    setEditingSlot(null);
  };

  const handleSyncRoutineToSheet = async () => {
    if (!school.webAppUrl) {
      alert('গুগল শিট WebApp URL যুক্ত করা নেই! অনুগ্রহ করে Settings থেকে WebApp URL আপডেট করুন।');
      return;
    }
    setIsSyncingRoutine(true);
    try {
      const res = await fetch(school.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveRoutine',
          tabName: 'Routine',
          routine: routineEntries
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ ক্লাস রুটিন সফলভাবে গুগল শিট এর "Routine" ট্যাবে সংরক্ষিত হয়েছে!');
      } else {
        alert(`সংরক্ষণ ত্রুটি: ${data.error || 'অজানা সমস্যা'}`);
      }
    } catch (err) {
      alert('গুগল শিটে রুটিন সংরক্ষণ করতে ব্যর্থ হয়েছে। আপনার ইন্টারনেট ও WebApp URL পরোক্ষ করুন।');
    } finally {
      setIsSyncingRoutine(false);
    }
  };

  // Sub-view & Filter States
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState<'ALL' | 'EXAM' | 'HOLIDAY' | 'FEES' | 'EMERGENCY'>('ALL');
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([
    {
      id: '1',
      title: 'প্রথম সাময়িক মূল্যায়ন (1st Summative Exam) সংক্রান্ত বিজ্ঞপ্তি',
      content: 'সকল অভিভাবক ও শিক্ষার্থীদের জানানো যাচ্ছে যে আগামী ১০ই মে ২০২৬ থেকে ১ম সাময়িক পরীক্ষা শুরু হতে চলেছে। প্রবেশপত্র (Admit Card) আগামী ১লা মে থেকে বিদ্যালয় কার্যালয় থেকে দেওয়া হবে।',
      date: '2026-04-10',
      targetGroup: 'ALL',
      priority: 'HIGH'
    },
    {
      id: '2',
      title: 'গ্রীষ্মকালীন ছুটি ও বিদ্যালয় পুনরায় খোলার ঘোষণা',
      content: 'আগামী ২০শে মে থেকে ১০ই জুন পর্যন্ত গ্রীষ্মকালীন ছুটি উপলক্ষে বিদ্যালয় বন্ধ থাকবে। ১১ই জুন যথারীতি বিদ্যালয় পুনরায় খোলা হবে।',
      date: '2026-05-15',
      targetGroup: 'ALL',
      priority: 'MEDIUM'
    }
  ]);
  const [newNoticeData, setNewNoticeData] = useState({
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0],
    targetGroup: 'ALL',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH'
  });

  // Routine View States
  const [routineViewMode, setRoutineViewMode] = useState<'class' | 'teacher' | 'form'>('class');
  const [routineClass, setRoutineClass] = useState('Class I');

  // Certificate View States
  const [certType, setCertType] = useState('Transfer Certificate');
  const [certClass, setCertClass] = useState('Class I');
  const [certRoll, setCertRoll] = useState<number>(1);
  const [certRefNo, setCertRefNo] = useState(() => `${getSchoolInitials(school)}/TC/${getAcademicYear(school)}/01`);
  const [certReason, setCertReason] = useState('Guardian Request / Distance');

  // Print Hub Sub-tabs
  const [printHubSubTab, setPrintHubSubTab] = useState<'idcard' | 'admit' | 'marksheet' | 'result' | 'manualmarks' | 'manualtabulation' | 'studentlist' | 'vehiclelist'>('idcard');
  const [printHubExam, setPrintHubExam] = useState<string>('1st Summative Evaluation');
  const [printHubSubject, setPrintHubSubject] = useState<string>('BENGALI');

  // Print Filter States
  const [admitClass, setAdmitClass] = useState<string>('Class I');
  const [admitExam, setAdmitExam] = useState<string>('3rd Summative Evaluation');
  const [admitSelectionMode, setAdmitSelectionMode] = useState<PrintSelectionMode>('ALL');
  const [admitSingleRoll, setAdmitSingleRoll] = useState<string>('1');
  const [admitSelectedKeys, setAdmitSelectedKeys] = useState<string[]>([]);

  const [marksheetClass, setMarksheetClass] = useState<string>('Class I');
  const [marksheetExam, setMarksheetExam] = useState<string>('3rd Summative Evaluation');
  const [marksheetSelectionMode, setMarksheetSelectionMode] = useState<PrintSelectionMode>('ALL');
  const [marksheetSingleRoll, setMarksheetSingleRoll] = useState<string>('1');
  const [marksheetSelectedKeys, setMarksheetSelectedKeys] = useState<string[]>([]);
  const [marksheetStyle, setMarksheetStyle] = useState<MarksheetStyle>('styleA');
  const [marksheetColor, setMarksheetColor] = useState<MarksheetColor>('emerald');
  const [marksheetPaperSize, setMarksheetPaperSize] = useState<PageSize>('A4');
  const [marksheetOrientation, setMarksheetOrientation] = useState<PageOrientation>('portrait');
  const [marksheetAcademicYear, setMarksheetAcademicYear] = useState<string>('2026');

  const [idCardClass, setIdCardClass] = useState<string>('ALL');
  const [idCardSelectionMode, setIdCardSelectionMode] = useState<PrintSelectionMode>('ALL');
  const [idCardSingleRoll, setIdCardSingleRoll] = useState<string>('1');
  const [idCardSelectedKeys, setIdCardSelectedKeys] = useState<string[]>([]);
  const [idCardViewMode, setIdCardViewMode] = useState<'sheet' | 'grid'>('sheet');
  const [idCardTemplate, setIdCardTemplate] = useState<IdCardTemplateType>('template1');
  const [idCardShowCuttingGuide, setIdCardShowCuttingGuide] = useState<boolean>(true);

  // Anti-Overwrite & Data Safety Hub States
  const [backupHistory, setBackupHistory] = useState<DataBackupSnapshot[]>([]);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');

  // Student Modal & CSV Import Modal
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const activeUploadStudentIdRef = useRef<string | null>(null);
  const activeUploadTokenRef = useRef<number>(0);

  const closeStudentModal = useCallback(() => {
    // Invalidate any pending in-flight photo uploads so they never leak into a new student session
    activeUploadStudentIdRef.current = null;
    activeUploadTokenRef.current = 0;
    setIsUploadingPhoto(false);
    setIsStudentModalOpen(false);
  }, []);

  const [studentFormData, setStudentFormData] = useState<Student>({
    class: 'Class I',
    roll: 1,
    name: '',
    fatherName: '',
    govtSchoolName: '',
    gender: 'Male',
    address: '',
    phone: '',
    monthlyFee: 350,
    status: 'Active',
    vehicle: 'No'
  });

  // Fee Collection Modal & Fee Management State
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [feeStudent, setFeeStudent] = useState<Student | null>(null);
  const [feeMonths, setFeeMonths] = useState<string[]>([]);
  const [receiptNumber, setReceiptNumber] = useState('REC-0005');
  const [feePaymentMode, setFeePaymentMode] = useState<string>('Cash');
  const [customFeeAmount, setCustomFeeAmount] = useState<string>('');
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Receipt Edit State
  const [editingReceipt, setEditingReceipt] = useState<FeeReceipt | null>(null);
  const [isEditReceiptModalOpen, setIsEditReceiptModalOpen] = useState(false);
  const [editReceiptFormData, setEditReceiptFormData] = useState({
    receiptNo: '',
    amount: 0,
    paymentMode: 'Cash',
    date: new Date().toISOString().split('T')[0],
    months: [] as string[]
  });

  // Fee Sub-tabs & Advanced Tracker States matching screenshots
  const [feeSubTab, setFeeSubTab] = useState<'collect' | 'dues' | 'daybook' | 'dailyprint' | 'history'>('collect');
  const [customReportStartDate, setCustomReportStartDate] = useState<string>('');
  const [customReportEndDate, setCustomReportEndDate] = useState<string>('');
  const [historicalReceipts, setHistoricalReceipts] = useState<FeeReceipt[] | null>(null);
  const [historicalDaybook, setHistoricalDaybook] = useState<DaybookEntry[] | null>(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  // Soft-Delete (Inactive) View Toggle States
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);
  const [showInactiveTeachers, setShowInactiveTeachers] = useState(false);
  const [showInactiveFeeReceipts, setShowInactiveFeeReceipts] = useState(false);
  const [showInactiveDaybook, setShowInactiveDaybook] = useState(false);
  const [showInactiveExpenses, setShowInactiveExpenses] = useState(false);
  const [showInactiveNotices, setShowInactiveNotices] = useState(false);
  const [showInactiveVehicles, setShowInactiveVehicles] = useState(false);

  // Helper to open Fee Modal for a student with persistent counter receipt number
  const openFeeModalForStudent = (st: Student) => {
    setFeeStudent(st);
    setFeeMonths([]);
    setCustomFeeAmount('');
    setIsFeeModalOpen(true);
    
    // Compute local preview receipt number without burning Firestore counter on open
    const maxNum = feeReceipts.reduce((max, r) => {
      const num = parseInt((r.receiptNo || '').replace(/\D/g, ''), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 1000);
    setReceiptNumber(`REC-${maxNum + 1}`);
  };

  // Lazy Loading & Aggregate Fee Totals State
  const [feeTotals, setFeeTotals] = useState<FeeTotalsDoc | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({ students: true });

  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  };

  const lazyLoadTab = async (tabName: string) => {
    if (loadedTabs[tabName]) return;
    setIsSyncing(true);
    try {
      const monthRange = getCurrentMonthRange();
      if (tabName === 'fees' || tabName === 'daybook') {
        const [fReceipts, dEntries, exps, fTotals] = await Promise.all([
          fetchFeeReceiptsFromFirestore(school.schoolId, monthRange),
          fetchDaybookFromFirestore(school.schoolId, monthRange),
          fetchExpensesFromFirestore(school.schoolId),
          fetchFeeTotalsFromFirestore(school.schoolId)
        ]);
        if (fReceipts && fReceipts.length > 0) {
          setFeeReceipts(fReceipts);
          safeLocalStorageSetItem(`fee_receipts_${school.schoolId}`, JSON.stringify(fReceipts));
        }
        if (dEntries && dEntries.length > 0) {
          setDaybookEntries(dEntries);
          safeLocalStorageSetItem(`daybook_${school.schoolId}`, JSON.stringify(dEntries));
        }
        if (exps && exps.length > 0) {
          setExpenses(exps);
          safeLocalStorageSetItem(`expenses_${school.schoolId}`, JSON.stringify(exps));
        }
        if (fTotals) setFeeTotals(fTotals);
        setLoadedTabs(prev => ({ ...prev, fees: true, daybook: true }));
      } else if (tabName === 'exams' || tabName === 'marksheet' || tabName === 'admit') {
        const mList = await fetchSchoolMarksFromFirestore(school.schoolId, {
          classFilter: selectedMarkClass !== 'ALL' ? selectedMarkClass : undefined,
          examFilter: selectedExam !== 'ALL' ? selectedExam : undefined
        });
        if (mList && mList.length > 0) {
          setMarks(prev => {
            const mergedMap = new Map(prev.map(m => [`${m.roll}_${m.class}_${m.examName}_${m.subjectName}`, m]));
            mList.forEach(m => mergedMap.set(`${m.roll}_${m.class}_${m.examName}_${m.subjectName}`, m));
            const updated = Array.from(mergedMap.values());
            safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(updated));
            return updated;
          });
        }
        setLoadedTabs(prev => ({ ...prev, exams: true, marksheet: true, admit: true }));
      } else if (tabName === 'teachers') {
        const tList = await fetchTeachersFromFirestore(school.schoolId);
        if (tList && tList.length > 0) {
          setTeachersList(tList);
          safeLocalStorageSetItem(`teachers_${school.schoolId}`, JSON.stringify(tList));
        }
        setLoadedTabs(prev => ({ ...prev, teachers: true }));
      } else if (tabName === 'routine') {
        const rList = await fetchRoutinesFromFirestore(school.schoolId);
        if (rList && rList.length > 0) {
          setRoutineData(rList);
          safeLocalStorageSetItem(`routines_${school.schoolId}`, JSON.stringify(rList));
        }
        setLoadedTabs(prev => ({ ...prev, routine: true }));
      } else if (tabName === 'settings' || tabName === 'vehicles') {
        const vList = await fetchVehiclesFromFirestore(school.schoolId);
        if (vList && vList.length > 0) {
          setVehiclesList(vList);
        }
        setLoadedTabs(prev => ({ ...prev, settings: true, vehicles: true }));
      }
    } catch (err) {
      console.warn('Lazy load error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (activeTab && activeTab !== 'overview' && activeTab !== 'students') {
      lazyLoadTab(activeTab);
    } else if (activeTab === 'overview' && !feeTotals) {
      fetchFeeTotalsFromFirestore(school.schoolId).then(totals => {
        if (totals) setFeeTotals(totals);
      });
    }
  }, [activeTab, school.schoolId]);

  useEffect(() => {
    let isMounted = true;
    if (studentSubTab === 'attendance' && attendanceClass && attendanceDate && school?.schoolId) {
      fetchAttendanceForClass(school.schoolId, attendanceClass, attendanceDate).then(attDoc => {
        if (!isMounted) return;
        if (attDoc && attDoc.records) {
          setAttendanceMap(attDoc.records);
        } else {
          setAttendanceMap({});
        }
      });
    }
    return () => { isMounted = false; };
  }, [studentSubTab, attendanceClass, attendanceDate, school?.schoolId]);

  const handleSaveAttendance = async () => {
    if (!attendanceClass || !attendanceDate || !school?.schoolId) return;
    setIsSyncing(true);
    try {
      const classStudents = students.filter(s => normalizeClassName(s.class) === normalizeClassName(attendanceClass));
      const recordsToSave: Record<string, 'Present' | 'Absent'> = {};
      classStudents.forEach(s => {
        const key = s.studentId || `${s.class}_${s.roll}`;
        recordsToSave[key] = attendanceMap[key] || 'Present';
      });

      const success = await saveAttendanceForClass(school.schoolId, attendanceClass, attendanceDate, recordsToSave);
      if (success) {
        alert('আজকের হাজিরা রেজিস্টার সফলভাবে ফায়ারস্টোরে সেভ হয়েছে!');
      } else {
        alert('হাজিরা সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert('হাজিরা সেভ করতে সমস্যা হয়েছে!');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchHistoricalReport = async () => {
    if (!customReportStartDate || !customReportEndDate) {
      alert('অনুগ্রহ করে শুরুর তারিখ এবং শেষের তারিখ নির্বাচন করুন');
      return;
    }
    setIsFetchingHistory(true);
    try {
      const [hReceipts, hDaybook] = await Promise.all([
        fetchFeeReceiptsFromFirestore(school.schoolId, { startDate: customReportStartDate, endDate: customReportEndDate }),
        fetchDaybookFromFirestore(school.schoolId, { startDate: customReportStartDate, endDate: customReportEndDate })
      ]);
      setHistoricalReceipts(hReceipts);
      setHistoricalDaybook(hDaybook);
    } catch (err) {
      console.error('Error fetching historical report:', err);
      alert('ঐতিহাসিক রিপোর্ট লোড করতে সমস্যা হয়েছে!');
    } finally {
      setIsFetchingHistory(false);
    }
  };
  const [selectedDailyPrintDate, setSelectedDailyPrintDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handlePrintA5Collection = () => {
    document.body.classList.add('printing-a5-mode');
    const cleanup = () => {
      document.body.classList.remove('printing-a5-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };
  const [feeSetupClass, setFeeSetupClass] = useState<string>('ALL');
  const [feeSetupSearch, setFeeSetupSearch] = useState<string>('');
  const [studentExemptions, setStudentExemptions] = useState<Record<string, string[]>>({});
  const [daybookDate, setDaybookDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [duesRunningMonth, setDuesRunningMonth] = useState<string>('March');
  const [duesClassFilter, setDuesClassFilter] = useState<string>('ALL');

  // Expense Log state matching Image 2
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem(`expenses_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: '1', voucherNo: 'V-101', date: new Date().toISOString().split('T')[0], title: 'শিক্ষকদের মে মাসের সম্মাননা', category: 'Teacher Salary', paymentMode: 'Cash', amount: 25000 },
      { id: '2', voucherNo: 'V-102', date: new Date().toISOString().split('T')[0], title: 'বিদ্যুৎ বিল (Electricity Bill)', category: 'Electricity/Bills', paymentMode: 'PhonePe', amount: 3200 }
    ];
  });

  useEffect(() => {
    localStorage.setItem(`expenses_${school.schoolId}`, JSON.stringify(expenses));
  }, [expenses, school.schoolId]);

  // Fee Receipts state matching Image 2 & Image 3
  const [feeReceipts, setFeeReceipts] = useState<FeeReceipt[]>(() => {
    const saved = localStorage.getItem(`fee_receipts_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: '1', receiptNo: '0001', date: new Date().toISOString().split('T')[0], studentName: 'ARISKA ALI', studentClass: 'NURSERY', roll: 1, fatherName: 'HAIDAR ALI', months: ['January'], amount: 600, paymentMode: 'Cash' },
      { id: '2', receiptNo: '0002', date: new Date().toISOString().split('T')[0], studentName: 'JOHIR RAIHAN', studentClass: 'NURSERY', roll: 2, fatherName: 'NURUL ISLAM', months: ['January'], amount: 600, paymentMode: 'Cash' },
      { id: '3', receiptNo: '0003', date: new Date().toISOString().split('T')[0], studentName: 'ARISKA ALI', studentClass: 'NURSERY', roll: 1, fatherName: 'HAIDAR ALI', months: ['March'], amount: 600, paymentMode: 'Cash' },
      { id: '4', receiptNo: '0004', date: new Date().toISOString().split('T')[0], studentName: 'MUHAYMIN RAHAMAN', studentClass: 'NURSERY', roll: 3, fatherName: 'MUKLESHUR RAHAMAN', months: ['January'], amount: 500, paymentMode: 'Cash' },
    ];
  });

  useEffect(() => {
    localStorage.setItem(`fee_receipts_${school.schoolId}`, JSON.stringify(feeReceipts));
  }, [feeReceipts, school.schoolId]);

  // Modals for Expenses & Blank Receipts
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [newExpenseData, setNewExpenseData] = useState({
    title: '',
    category: 'Teacher Salary',
    paymentMode: 'Cash',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    voucherNo: ''
  });

  const [isBlankReceiptModalOpen, setIsBlankReceiptModalOpen] = useState(false);
  const [blankReceiptData, setBlankReceiptData] = useState({
    receiptNo: 'REC-BLANK-101',
    studentName: '',
    studentClass: 'NURSERY',
    roll: 1,
    fatherName: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // Mark Entry State
  const [selectedExam, setSelectedExam] = useState('1st Summative Evaluation');
  const [selectedMarkClass, setSelectedMarkClass] = useState('NURSERY');
  const [selectedSubject, setSelectedSubject] = useState('BENGALI');

  useEffect(() => {
    if (['exams', 'marksheet', 'admit'].includes(activeTab)) {
      fetchSchoolMarksFromFirestore(school.schoolId, {
        classFilter: selectedMarkClass !== 'ALL' ? selectedMarkClass : undefined,
        examFilter: selectedExam !== 'ALL' ? selectedExam : undefined
      }).then(mList => {
        if (mList && mList.length > 0) {
          setMarks(prev => {
            const mergedMap = new Map(prev.map(m => [`${m.roll}_${m.class}_${m.examName}_${m.subjectName}`, m]));
            mList.forEach(m => mergedMap.set(`${m.roll}_${m.class}_${m.examName}_${m.subjectName}`, m));
            const updated = Array.from(mergedMap.values());
            safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(updated));
            return updated;
          });
        }
      }).catch(() => {});
    }
  }, [activeTab, selectedMarkClass, selectedExam, school.schoolId]);

  // Configurable Evaluation Full Marks per exam
  const [evalFullMarks, setEvalFullMarks] = useState<{ [examKey: string]: number }>(() => {
    const saved = localStorage.getItem(`evalFullMarks_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      '1st Summative Evaluation': 40,
      '2nd Summative Evaluation': 50,
      '3rd Summative Evaluation': 100
    };
  });

  const [evalFullMarksInput, setEvalFullMarksInput] = useState<Record<string, string>>({
    '1st Summative Evaluation': '40',
    '2nd Summative Evaluation': '50',
    '3rd Summative Evaluation': '100'
  });

  useEffect(() => {
    setEvalFullMarksInput({
      '1st Summative Evaluation': String(evalFullMarks['1st Summative Evaluation'] ?? 40),
      '2nd Summative Evaluation': String(evalFullMarks['2nd Summative Evaluation'] ?? 50),
      '3rd Summative Evaluation': String(evalFullMarks['3rd Summative Evaluation'] ?? 100)
    });
  }, [evalFullMarks]);

  useEffect(() => {
    safeLocalStorageSetItem(`evalFullMarks_${school.schoolId}`, JSON.stringify(evalFullMarks));
  }, [evalFullMarks, school.schoolId]);

  // Configurable Class-Wise Subjects Setup (Exam Setup)
  const [classSubjectsConfig, setClassSubjectsConfig] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem(`classSubjects_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      'DEFAULT': ["BENGALI", "ENGLISH", "MATHEMATICS", "SCIENCE", "ENVIRONMENT", "HISTORY", "GEOGRAPHY"]
    };
  });

  const [rawSubjectsText, setRawSubjectsText] = useState<string>('');

  useEffect(() => {
    const list = classSubjectsConfig[selectedMarkClass] || classSubjectsConfig['DEFAULT'] || ["BENGALI", "ENGLISH", "MATHEMATICS", "SCIENCE", "ENVIRONMENT", "HISTORY", "GEOGRAPHY"];
    setRawSubjectsText(list.join(', '));
  }, [selectedMarkClass, classSubjectsConfig]);

  useEffect(() => {
    safeLocalStorageSetItem(`classSubjects_${school.schoolId}`, JSON.stringify(classSubjectsConfig));
  }, [classSubjectsConfig, school.schoolId]);

  const getEffectiveSubjectsForClass = (cls: string, examName?: string): string[] => {
    const normCls = normalizeClassName(cls);
    let configured: string[] = [];
    
    for (const key of Object.keys(classSubjectsConfig)) {
      if (key === cls || normalizeClassName(key) === normCls) {
        if (classSubjectsConfig[key] && classSubjectsConfig[key].length > 0) {
          configured = classSubjectsConfig[key];
          break;
        }
      }
    }
    if (configured.length === 0 && classSubjectsConfig['DEFAULT']) {
      configured = classSubjectsConfig['DEFAULT'];
    }
    if (configured.length === 0) {
      configured = ["BENGALI", "ENGLISH", "MATHEMATICS", "SCIENCE", "ENVIRONMENT", "HISTORY", "GEOGRAPHY"];
    }

    const markSubjects = new Set<string>();
    marks.forEach(m => {
      if ((cls === 'ALL' || normalizeClassName(m.class) === normCls) && (!examName || examName === 'ALL' || m.examName === examName)) {
        if (m.subjectName) markSubjects.add(m.subjectName.toUpperCase());
      }
    });

    const combined = [...configured];
    markSubjects.forEach(s => {
      if (!combined.some(c => c.toUpperCase() === s.toUpperCase())) {
        combined.push(s);
      }
    });

    return combined;
  };

  const getExamMaxMark = (examName: string, mObj?: ExamMark): number => {
    if (evalFullMarks[examName] && evalFullMarks[examName] > 0) {
      return evalFullMarks[examName];
    }
    if (mObj && typeof mObj.totalMark === 'number' && mObj.totalMark > 0) {
      return mObj.totalMark;
    }
    if (examName.includes('1st')) return 40;
    if (examName.includes('2nd')) return 50;
    if (examName.includes('3rd')) return 100;
    return 100;
  };

  // Exam Navigation & Result Portal States matching user images
  const [examSubTab, setExamSubTab] = useState<'mark_entry' | 'result_view' | 'exam_setup' | 'exam_routine'>('mark_entry');
  const [resultSubTab, setResultSubTab] = useState<'tabulation' | 'single_card' | 'subject_wise'>('tabulation');
  const [selectedStudentRoll, setSelectedStudentRoll] = useState<number>(1);

  // Settings Sub-tab State
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'vehicles' | 'classes'>('profile');
  const [schoolProfile, setSchoolProfile] = useState<School>({ ...school });
  const [showAdminKeyInSettings, setShowAdminKeyInSettings] = useState(false);

  useEffect(() => {
    setSchoolProfile({ ...school });
  }, [school]);

  // Class & Section Management State (প্রতিটি স্কুলের নিজস্ব ক্লাস ও সেকশন কনফিগারেশন)
  const [classConfigList, setClassConfigList] = useState<ClassConfig[]>(() => {
    if (school.classConfig && school.classConfig.length > 0) {
      return [...school.classConfig].sort((a, b) => a.order - b.order);
    }
    return DEFAULT_CLASS_CONFIG;
  });

  useEffect(() => {
    if (school.classConfig && school.classConfig.length > 0) {
      setClassConfigList([...school.classConfig].sort((a, b) => a.order - b.order));
    }
  }, [school.classConfig]);

  const [classFormState, setClassFormState] = useState<{ name: string; sections: string; order: number }>({
    name: '',
    sections: '',
    order: (school.classConfig?.length || DEFAULT_CLASS_CONFIG.length) + 1
  });
  const [editingClassIndex, setEditingClassIndex] = useState<number | null>(null);
  const [isSavingClassConfig, setIsSavingClassConfig] = useState(false);

  // Vehicle / Car Management State (গাড়ি ও রুট সেটিংস)
  const [vehiclesList, setVehiclesList] = useState<VehicleConfig[]>(() => {
    const saved = localStorage.getItem(`vehicles_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: 'v1', vehicleName: 'গাড়ি-০১ (মাইক্রোবাস A)', phone: '01712345678', route: 'উত্তরপাড়া - কাসিমপুর মোড় - স্কুল' },
      { id: 'v2', vehicleName: 'গাড়ি-০২ (স্কুল বাস B)', phone: '01898765432', route: 'দক্ষিণ বাজার - থানা মোড় - স্কুল' },
      { id: 'v3', vehicleName: 'গাড়ি-০৩ (টাটা ম্যাজিক C)', phone: '01911223344', route: 'পূর্বপাড়া - রেলগেস্ট - স্কুল' }
    ];
  });

  useEffect(() => {
    safeLocalStorageSetItem(`vehicles_${school.schoolId}`, JSON.stringify(vehiclesList));
  }, [vehiclesList, school.schoolId]);

  const [vehicleFormData, setVehicleFormData] = useState({
    vehicleName: '',
    phone: '',
    route: ''
  });
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Student Vehicle Filter state (গাড়ি দিয়ে ছাত্র-ছাত্রী ফিল্টার)
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('ALL');

  // Class Routine State
  const [routineData, setRoutineData] = useState<RoutineEntry[]>(() => {
    const saved = localStorage.getItem(`routines_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: '1', class: 'Class I', day: 'Monday', period: '1', subject: 'BENGALI', teacher: 'Dr. Ramesh Chandra Das', time: '10:00 AM - 10:40 AM' },
      { id: '2', class: 'Class I', day: 'Monday', period: '2', subject: 'ENGLISH', teacher: 'Sujata Mukherjee', time: '10:40 AM - 11:20 AM' }
    ];
  });

  useEffect(() => {
    localStorage.setItem(`routines_${school.schoolId}`, JSON.stringify(routineData));
  }, [routineData, school.schoolId]);

  // Teacher Management State
  const [teachersList, setTeachersList] = useState<Teacher[]>(() => {
    const saved = localStorage.getItem(`teachers_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: '1',
        teacherId: 'TCH-101',
        schoolId: school.schoolId,
        password: 'pass1234',
        name: 'Dr. Ramesh Chandra Das',
        designation: 'Headmaster (প্রধান শিক্ষক)',
        qualification: 'M.A., Ph.D.',
        phone: '01711000001',
        email: 'ramesh@school.edu.bd',
        assignedClasses: ['Class IX', 'Class X', 'Class XI', 'Class XII'],
        assignedSubjects: [{ class: 'Class X', subject: 'Bengali (বাংলা)' }]
      },
      {
        id: '2',
        teacherId: 'TCH-102',
        schoolId: school.schoolId,
        password: 'pass1234',
        name: 'Sujata Mukherjee',
        designation: 'Assistant Teacher (সহকারী শিক্ষক)',
        qualification: 'M.A. (English), B.Ed.',
        phone: '01811000002',
        email: 'sujata@school.edu.bd',
        assignedClasses: ['Class V', 'Class VI', 'Class VII', 'Class VIII'],
        assignedSubjects: [{ class: 'Class VI', subject: 'English (ইংরেজি)' }]
      },
      {
        id: '3',
        teacherId: 'TCH-103',
        schoolId: school.schoolId,
        password: 'pass1234',
        name: 'Bipul Kumar Paul',
        designation: 'Assistant Teacher (সহকারী শিক্ষক)',
        qualification: 'M.Sc. (Math), B.Ed.',
        phone: '01911000003',
        email: 'bipul@school.edu.bd',
        assignedClasses: ['Class VII', 'Class VIII', 'Class IX', 'Class X'],
        assignedSubjects: [{ class: 'Class VIII', subject: 'Mathematics (গণিত)' }]
      }
    ];
  });

  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  // Subject Assignment Form State
  const [assignTeacherId, setAssignTeacherId] = useState<string>('');
  const [assignClass, setAssignClass] = useState<string>('NURSERY');
  const [assignSubject, setAssignSubject] = useState<string>('BENGALI');

  const [teacherFormData, setTeacherFormData] = useState({
    teacherId: '',
    password: '',
    name: '',
    designation: 'Assistant Teacher (সহকারী শিক্ষক)',
    qualification: 'M.A., B.Ed.',
    phone: '',
    email: '',
    photo: '',
    primarySubject: 'BENGALI'
  });
  const [isUploadingTeacherPhoto, setIsUploadingTeacherPhoto] = useState<boolean>(false);

  const handleTeacherPhotoFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('ফাইলের আকার ১৫ MB-এর চেয়ে বেশি হতে পারবে না!');
      return;
    }
    setIsUploadingTeacherPhoto(true);
    try {
      // Compress directly to a lightweight Data URL and store straight in Firestore --
      // no external cloud upload step, same reasoning as student photos.
      const compressedUrl = await compressImageFileToDataUrl(file, 300, 300, 0.72);
      if (compressedUrl) {
        setTeacherFormData(prev => ({ ...prev, photo: compressedUrl }));
      } else {
        alert('ছবি প্রসেস করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
      }
    } catch (err: any) {
      console.error('Teacher photo compression failed:', err);
      alert('ছবি প্রসেস করতে সমস্যা হয়েছে: ' + (err?.message || 'অজানা ত্রুটি'));
    } finally {
      setIsUploadingTeacherPhoto(false);
    }
  };

  useEffect(() => {
    safeLocalStorageSetItem(`teachers_${school.schoolId}`, JSON.stringify(teachersList));
  }, [teachersList, school.schoolId]);

  const handleOpenAddTeacher = () => {
    setEditingTeacherId(null);
    setTeacherFormData({
      teacherId: `TCH-${101 + teachersList.length}`,
      password: 'pass' + Math.floor(1000 + Math.random() * 9000),
      name: '',
      designation: 'Assistant Teacher (সহকারী শিক্ষক)',
      qualification: 'M.A., B.Ed.',
      phone: '',
      email: '',
      photo: '',
      primarySubject: 'BENGALI'
    });
    setIsTeacherModalOpen(true);
  };

  const handleOpenEditTeacher = (t: Teacher) => {
    setEditingTeacherId(t.id);
    setTeacherFormData({
      teacherId: t.teacherId || `TCH-${t.id}`,
      password: t.password || 'pass1234',
      name: t.name,
      designation: t.designation || 'Assistant Teacher (সহকারী শিক্ষক)',
      qualification: t.qualification || '',
      phone: t.phone || '',
      email: t.email || '',
      photo: t.photo || '',
      primarySubject: t.assignedSubjects && t.assignedSubjects[0] ? t.assignedSubjects[0].subject : 'BENGALI'
    });
    setIsTeacherModalOpen(true);
  };

  const syncTeacherToSheet = async (teacher: Teacher) => {
    try {
      await saveTeacherSingleToFirestore(school.schoolId, teacher);
    } catch {
      // keep local state
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    if (confirm(`আপনি কি সত্যিই শিক্ষক "${name}" কে নিষ্ক্রিয় (Soft Delete) করতে চান?`)) {
      const updated = teachersList.map(t => {
        if (t.id === id || t.teacherId === id) {
          return { ...t, isActive: false, deactivatedAt: new Date().toISOString() };
        }
        return t;
      });
      setTeachersList(updated);
      safeLocalStorageSetItem(`teachers_${school.schoolId}`, JSON.stringify(updated));

      try {
        await deleteTeacherSingleFromFirestore(school.schoolId, id);
      } catch {
        // Local fallback
      }
    }
  };

  const handleReactivateTeacher = async (id: string) => {
    const updated = teachersList.map(t => {
      if (t.id === id || t.teacherId === id) {
        return { ...t, isActive: true, deactivatedAt: undefined };
      }
      return t;
    });
    setTeachersList(updated);
    safeLocalStorageSetItem(`teachers_${school.schoolId}`, JSON.stringify(updated));

    await reactivateDocument(school.schoolId, 'teachers', id).catch(() => {});
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFormData.name.trim()) {
      alert('অনুগ্রহ করে শিক্ষকের নাম প্রবেশ করান।');
      return;
    }

    let cleanPhotoUrl = (teacherFormData.photo || '').trim();
    if (cleanPhotoUrl.startsWith('data:image') || cleanPhotoUrl.startsWith('blob:')) {
      try {
        const opt = await compressAndOptimizeImageUrl(cleanPhotoUrl, `tch_${teacherFormData.teacherId || Date.now()}`);
        if (opt && !opt.startsWith('blob:')) {
          cleanPhotoUrl = opt;
        }
      } catch {
        cleanPhotoUrl = formatPhotoUrl(cleanPhotoUrl);
      }
    } else if (cleanPhotoUrl) {
      cleanPhotoUrl = formatPhotoUrl(cleanPhotoUrl);
    }

    let savedTeacherObj: Teacher;

    if (editingTeacherId) {
      let updatedObj: Teacher | null = null;
      const updatedList = teachersList.map(t => {
        if (t.id === editingTeacherId) {
          updatedObj = {
            ...t,
            schoolId: school.schoolId,
            teacherId: teacherFormData.teacherId || t.teacherId || `TCH-${t.id}`,
            password: teacherFormData.password || 'pass1234',
            name: teacherFormData.name,
            designation: teacherFormData.designation,
            qualification: teacherFormData.qualification,
            phone: teacherFormData.phone,
            email: teacherFormData.email,
            photo: cleanPhotoUrl
          };
          return updatedObj;
        }
        return t;
      });
      setTeachersList(updatedList);
      safeLocalStorageSetItem(`teachers_${school.schoolId}`, JSON.stringify(updatedList));
      savedTeacherObj = updatedObj!;
    } else {
      const newTeacher: Teacher = {
        id: 'T-' + Date.now(),
        schoolId: school.schoolId,
        teacherId: teacherFormData.teacherId || `TCH-${101 + teachersList.length}`,
        password: teacherFormData.password || 'pass1234',
        name: teacherFormData.name,
        designation: teacherFormData.designation,
        qualification: teacherFormData.qualification,
        phone: teacherFormData.phone,
        email: teacherFormData.email,
        photo: cleanPhotoUrl,
        assignedSubjects: [{ class: 'NURSERY', subject: teacherFormData.primarySubject }]
      };
      const updatedList = [newTeacher, ...teachersList];
      setTeachersList(updatedList);
      safeLocalStorageSetItem(`teachers_${school.schoolId}`, JSON.stringify(updatedList));
      savedTeacherObj = newTeacher;
    }

    setIsTeacherModalOpen(false);

    if (savedTeacherObj) {
      await saveTeacherSingleToFirestore(school.schoolId, savedTeacherObj).catch(err => console.error('Teacher save to Firestore error:', err));
      await syncTeacherToSheet(savedTeacherObj).catch(() => {});
    }
  };

  const handleAssignSubjectToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeacherId = assignTeacherId || (teachersList[0]?.id || '');
    if (!targetTeacherId) {
      alert('কোনো শিক্ষক নিবন্ধিত নেই! আগে শিক্ষক যুক্ত করুন।');
      return;
    }

    const teacher = teachersList.find(t => t.id === targetTeacherId);
    if (!teacher) {
      alert('অনুগ্রহ করে শিক্ষক নির্বাচন করুন।');
      return;
    }

    let updatedTeacher: Teacher | null = null;
    const updatedList = teachersList.map(t => {
      if (t.id === targetTeacherId) {
        const currentAssigned = t.assignedSubjects || [];
        const exists = currentAssigned.some(
          item => item.class.toUpperCase() === assignClass.toUpperCase() && item.subject.toUpperCase() === assignSubject.toUpperCase()
        );
        if (exists) {
          alert(`শিক্ষক ${t.name}-এর কাছে ${assignClass} শ্রেণীর ${assignSubject} বিষয় ইতিমধ্যেই বরাদ্দ আছে!`);
          return t;
        }
        updatedTeacher = {
          ...t,
          assignedSubjects: [...currentAssigned, { class: assignClass, subject: assignSubject }]
        };
        return updatedTeacher;
      }
      return t;
    });

    setTeachersList(updatedList);
    localStorage.setItem(`teachers_${school.schoolId}`, JSON.stringify(updatedList));

    if (updatedTeacher) {
      await saveTeacherSingleToFirestore(school.schoolId, updatedTeacher).catch(() => {});
      await syncTeacherToSheet(updatedTeacher).catch(() => {});
    }
  };

  const handleRemoveAssignedSubject = async (teacherId: string, clsName: string, subjName: string) => {
    if (confirm(`আপনি কি এই শিক্ষকের কাছ থেকে ${clsName} শ্রেণীর ${subjName} বিষয়টি সরিয়ে দিতে চান?`)) {
      let updatedTeacher: Teacher | null = null;
      const updatedList = teachersList.map(t => {
        if (t.id === teacherId) {
          updatedTeacher = {
            ...t,
            assignedSubjects: (t.assignedSubjects || []).filter(
              item => !(item.class.toUpperCase() === clsName.toUpperCase() && item.subject.toUpperCase() === subjName.toUpperCase())
            )
          };
          return updatedTeacher;
        }
        return t;
      });

      setTeachersList(updatedList);
      localStorage.setItem(`teachers_${school.schoolId}`, JSON.stringify(updatedList));

      if (updatedTeacher) {
        await syncTeacherToSheet(updatedTeacher);
      }
    }
  };

  const handleAssignAttendanceClassToTeacher = async (teacherId: string, clsName: string) => {
    if (!teacherId) return;
    let updatedTeacher: Teacher | null = null;
    const updatedList = teachersList.map(t => {
      if (t.id === teacherId) {
        const currentClasses = t.assignedClasses || [];
        if (currentClasses.includes(clsName)) {
          alert(`শিক্ষক ${t.name}-এর কাছে ${clsName} শ্রেণীটি উপস্থিতির জন্য ইতিমধ্যে বরাদ্দ আছে!`);
          return t;
        }
        updatedTeacher = {
          ...t,
          assignedClasses: [...currentClasses, clsName]
        };
        return updatedTeacher;
      }
      return t;
    });

    setTeachersList(updatedList);
    localStorage.setItem(`teachers_${school.schoolId}`, JSON.stringify(updatedList));

    if (updatedTeacher) {
      await saveTeacherSingleToFirestore(school.schoolId, updatedTeacher).catch(() => {});
      await syncTeacherToSheet(updatedTeacher).catch(() => {});
    }
  };

  const handleRemoveAssignedClass = async (teacherId: string, clsName: string) => {
    if (confirm(`আপনি কি এই শিক্ষকের কাছ থেকে ${clsName} শ্রেণীর উপস্থিতি সুবিধা সরিয়ে দিতে চান?`)) {
      let updatedTeacher: Teacher | null = null;
      const updatedList = teachersList.map(t => {
        if (t.id === teacherId) {
          updatedTeacher = {
            ...t,
            assignedClasses: (t.assignedClasses || []).filter(c => c !== clsName)
          };
          return updatedTeacher;
        }
        return t;
      });

      setTeachersList(updatedList);
      localStorage.setItem(`teachers_${school.schoolId}`, JSON.stringify(updatedList));

      if (updatedTeacher) {
        await syncTeacherToSheet(updatedTeacher);
      }
    }
  };

  useEffect(() => {
    setSchoolProfile({ ...school });
  }, [school]);

  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState<boolean>(false);
  const [isOptimizingLogo, setIsOptimizingLogo] = useState<boolean>(false);
  const [isOptimizingSignature, setIsOptimizingSignature] = useState<boolean>(false);
  const [isOptimizingPhoto, setIsOptimizingPhoto] = useState<boolean>(false);

  const handleOptimizeLogo = async () => {
    if (!schoolProfile.logo) return;
    setIsOptimizingLogo(true);
    try {
      const optimizedUrl = await compressAndOptimizeImageUrl(schoolProfile.logo, `${school.schoolId}_logo`);
      setSchoolProfile(prev => ({ ...prev, logo: optimizedUrl }));
      alert('বিদ্যালয়ের লোগোর সাইজ সংকুচিত করে হালকা URL তৈরি করা হয়েছে!');
    } catch (err: any) {
      alert('লোগো অপ্টিমাইজ করতে সমস্যা হয়েছে: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsOptimizingLogo(false);
    }
  };

  const handleOptimizeSignature = async () => {
    if (!schoolProfile.signature) return;
    setIsOptimizingSignature(true);
    try {
      const optimizedUrl = await compressAndOptimizeImageUrl(schoolProfile.signature, `${school.schoolId}_sig`);
      setSchoolProfile(prev => ({ ...prev, signature: optimizedUrl }));
      alert('স্বাক্ষরের সাইজ সংকুচিত করে হালকা URL তৈরি করা হয়েছে!');
    } catch (err: any) {
      alert('স্বাক্ষর অপ্টিমাইজ করতে সমস্যা হয়েছে: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsOptimizingSignature(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const tempUrl = URL.createObjectURL(file);
    const prevLogo = schoolProfile.logo || '';
    setSchoolProfile(prev => ({ ...prev, logo: tempUrl }));

    try {
      const storageUrl = await uploadSchoolAssetToStorage(school.schoolId, 'logo', file);
      const finalProfile = { ...schoolProfile, logo: storageUrl };
      setSchoolProfile(finalProfile);
      onUpdateSchoolInfo(finalProfile);
      await saveSchoolToFirestore(finalProfile);
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setSchoolProfile(prev => ({ ...prev, logo: prevLogo }));
      alert(err?.message || 'লোগো আপলোডে সমস্যা হয়েছে — নেটওয়ার্ক কানেকশন পরীক্ষা করুন।');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSignature(true);
    const tempUrl = URL.createObjectURL(file);
    const prevSig = schoolProfile.signature || '';
    setSchoolProfile(prev => ({ ...prev, signature: tempUrl }));

    try {
      const storageUrl = await uploadSchoolAssetToStorage(school.schoolId, 'signature', file);
      const finalProfile = { ...schoolProfile, signature: storageUrl };
      setSchoolProfile(finalProfile);
      onUpdateSchoolInfo(finalProfile);
      await saveSchoolToFirestore(finalProfile);
    } catch (err: any) {
      console.error('Signature upload error:', err);
      setSchoolProfile(prev => ({ ...prev, signature: prevSig }));
      alert(err?.message || 'স্বাক্ষর আপলোডে সমস্যা হয়েছে — নেটওয়ার্ক কানেকশন পরীক্ষা করুন।');
    } finally {
      setIsUploadingSignature(false);
      e.target.value = '';
    }
  };

  const handleCleanupDuplicateStudents = async () => {
    if (!window.confirm('এটা একবারের রক্ষণাবেক্ষণ কাজ: পুরনো/ডুপ্লিকেট ছাত্র ডকুমেন্ট (যেমন "ST-NS-1" ধরনের পুরনো ID) খুঁজে বের করে মুছে ফেলবে, এবং প্রতিটা ছাত্রের সেরা তথ্য (ছবিসহ) সঠিক ID-তে রেখে দেবে। এগোতে চান?')) {
      return;
    }
    setIsCleaningDuplicates(true);
    try {
      const result = await cleanupDuplicateStudentDocIds(school.schoolId);
      alert(`✅ পরিষ্কার সম্পন্ন হয়েছে।\n\nমোট স্ক্যান করা হয়েছে: ${result.scanned} টি ডকুমেন্ট\nচূড়ান্ত (সঠিক) ছাত্র সংখ্যা: ${result.canonical} জন\nডুপ্লিকেট/পুরনো ডকুমেন্ট মুছে ফেলা হয়েছে: ${result.deleted} টি`);
    } catch (err: any) {
      console.error('Cleanup duplicate students failed:', err);
      alert('⚠️ পরিষ্কার করার সময় সমস্যা হয়েছে: ' + (err?.message || 'অজানা ত্রুটি') + '\n\nভালো ইন্টারনেট সংযোগে আবার চেষ্টা করুন।');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleSaveSchoolProfile = async () => {
    onUpdateSchoolInfo(schoolProfile);
    try {
      await saveSchoolToFirestore(schoolProfile);
      alert('বিদ্যালয়ের প্রোফাইল ও শিক্ষাবর্ষ সেটিংস সফলভাবে ক্লাউডে সংরক্ষণ করা হয়েছে!');
    } catch (e) {
      alert('বিদ্যালয়ের সেটিংস স্থানীয়ভাবে সংরক্ষিত হয়েছে!');
    }
  };

  // Class & Section Configuration Handlers
  const handleAddOrUpdateClass = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = classFormState.name.trim();
    if (!trimmedName) {
      alert('অনুগ্রহ করে ক্লাসের নাম লিখুন (যেমন: Class VIII বা Nursery)');
      return;
    }
    const sectionsArr = classFormState.sections
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    // Check duplicate class name (excluding current if editing)
    const isDuplicate = classConfigList.some((c, idx) => 
      normalizeClassName(c.name) === normalizeClassName(trimmedName) && idx !== editingClassIndex
    );
    if (isDuplicate) {
      alert(`"${trimmedName}" নামের ক্লাস তালিকায় ইতিমধ্যে বিদ্যমান!`);
      return;
    }

    let updated: ClassConfig[];
    if (editingClassIndex !== null && editingClassIndex >= 0 && editingClassIndex < classConfigList.length) {
      updated = classConfigList.map((item, idx) => 
        idx === editingClassIndex 
          ? { name: trimmedName, sections: sectionsArr, order: Number(classFormState.order) || item.order }
          : item
      );
      setEditingClassIndex(null);
    } else {
      const nextOrder = Number(classFormState.order) || (classConfigList.length > 0 ? Math.max(...classConfigList.map(c => c.order)) + 1 : 1);
      const newClassItem: ClassConfig = {
        name: trimmedName,
        sections: sectionsArr,
        order: nextOrder
      };
      updated = [...classConfigList, newClassItem];
    }

    updated.sort((a, b) => a.order - b.order);
    updated = updated.map((item, idx) => ({ ...item, order: idx + 1 }));

    setClassConfigList(updated);
    setClassFormState({ name: '', sections: '', order: updated.length + 1 });
  };

  const handleEditClass = (index: number) => {
    const item = classConfigList[index];
    if (!item) return;
    setEditingClassIndex(index);
    setClassFormState({
      name: item.name,
      sections: (item.sections || []).join(', '),
      order: item.order
    });
  };

  const handleDeleteClass = (index: number) => {
    const item = classConfigList[index];
    if (!item) return;
    const enrolledCount = students.filter(
      s => normalizeClassName(s.class) === normalizeClassName(item.name) && s.isActive !== false
    ).length;

    if (enrolledCount > 0) {
      const confirmDelete = confirm(
        `⚠️ সতর্কবার্তা: "${item.name}" ক্লাসে বর্তমানে ${enrolledCount} জন সক্রিয় শিক্ষার্থী ভর্তি রয়েছে!\n\nক্লাসটি তালিকা থেকে মুছে ফেললে বর্তমান শিক্ষার্থীদের প্রোফাইল থাকবে, কিন্তু নতুন কোনো ড্রপডাউনে এই ক্লাসটি আর পাওয়া যাবে না।\n\nআপনি কি নিশ্চিতভাবে এই ক্লাসটি মুছে ফেলতে চান?`
      );
      if (!confirmDelete) return;
    } else {
      if (!confirm(`আপনি কি "${item.name}" ক্লাসটি তালিকা থেকে মুছে ফেলতে চান?`)) return;
    }

    const updated = classConfigList.filter((_, idx) => idx !== index).map((c, idx) => ({ ...c, order: idx + 1 }));
    setClassConfigList(updated);
    if (editingClassIndex === index) {
      setEditingClassIndex(null);
      setClassFormState({ name: '', sections: '', order: updated.length + 1 });
    }
  };

  const handleMoveClassOrder = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === classConfigList.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const copy = [...classConfigList];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const updated = copy.map((c, idx) => ({ ...c, order: idx + 1 }));
    setClassConfigList(updated);
  };

  const handleSaveClassConfig = async () => {
    setIsSavingClassConfig(true);
    try {
      const updatedSchoolProfile: School = {
        ...schoolProfile,
        classConfig: classConfigList
      };
      setSchoolProfile(updatedSchoolProfile);
      onUpdateSchoolInfo(updatedSchoolProfile);
      await saveSchoolToFirestore(updatedSchoolProfile);
      setSyncMessage({ type: 'success', text: 'ক্লাস ও সেকশন তালিকা সফলভাবে সংরক্ষিত হয়েছে!' });
      alert('বিদ্যালয়ের ক্লাস ও সেকশন সেটিংস সফলভাবে ক্লাউডে সংরক্ষিত হয়েছে!');
    } catch (err) {
      console.error('Error saving class config:', err);
      alert('সংরক্ষণ ব্যর্থ হয়েছে! পুনরায় চেষ্টা করুন।');
    } finally {
      setIsSavingClassConfig(false);
    }
  };

  const handleResetToDefaultClasses = () => {
    if (confirm('আপনি কি স্ট্যান্ডার্ড প্রি-স্কুল থেকে দ্বাদশ শ্রেণি (NS to Class XII) ডিফল্ট তালিকা রিস্টোর করতে চান?')) {
      setClassConfigList(DEFAULT_CLASS_CONFIG);
      setEditingClassIndex(null);
      setClassFormState({ name: '', sections: '', order: DEFAULT_CLASS_CONFIG.length + 1 });
    }
  };

  // Car / Vehicle CRUD Handlers
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleFormData.vehicleName.trim()) {
      alert('অনুগ্রহ করে গাড়ির নাম লিখুন!');
      return;
    }

    if (editingVehicleId) {
      const updatedVehicle: VehicleConfig = { id: editingVehicleId, ...vehicleFormData };
      setVehiclesList(prev => prev.map(v => v.id === editingVehicleId ? updatedVehicle : v));
      await saveVehicleSingleToFirestore(school.schoolId, updatedVehicle).catch(() => {});
      setEditingVehicleId(null);
      alert('গাড়ির বিবরণ সফলভাবে হালনাগাদ করা হয়েছে!');
    } else {
      const newVehicle: VehicleConfig = {
        id: 'veh-' + Date.now(),
        ...vehicleFormData
      };
      setVehiclesList(prev => [...prev, newVehicle]);
      await saveVehicleSingleToFirestore(school.schoolId, newVehicle).catch(() => {});
      alert('নতুন গাড়ি সফলভাবে তালিকাভুক্ত করা হয়েছে!');
    }
    setVehicleFormData({ vehicleName: '', phone: '', route: '' });
  };

  const handleEditVehicle = (veh: VehicleConfig) => {
    setEditingVehicleId(veh.id);
    setVehicleFormData({
      vehicleName: veh.vehicleName,
      phone: veh.phone,
      route: veh.route
    });
  };

  const handleDeleteVehicle = async (id: string) => {
    if (confirm('আপনি কি এই গাড়ি সেটিংসটি নিষ্ক্রিয় (Soft Delete) করতে চান?')) {
      setVehiclesList(prev => prev.map(v => v.id === id ? { ...v, isActive: false, deactivatedAt: new Date().toISOString() } : v));
      await deleteVehicleSingleFromFirestore(school.schoolId, id).catch(() => {});
      if (editingVehicleId === id) {
        setEditingVehicleId(null);
        setVehicleFormData({ vehicleName: '', phone: '', route: '' });
      }
    }
  };

  const handleReactivateVehicle = async (id: string) => {
    setVehiclesList(prev => prev.map(v => v.id === id ? { ...v, isActive: true, deactivatedAt: undefined } : v));
    await reactivateDocument(school.schoolId, 'vehicles', id).catch(() => {});
  };

  // Targeted Save Marks Helper - Writes ONLY selected class & exam marks to Firestore in a single batch
  const saveMarksOnly = async (classFilter?: string, examFilter?: string): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const targetClass = classFilter || selectedMarkClass;
      const targetExam = examFilter || selectedExam;

      const filteredMarks = marks.filter(m => {
        const matchesClass = !targetClass || targetClass === 'ALL' || normalizeClassName(m.class) === normalizeClassName(targetClass);
        const matchesExam = !targetExam || targetExam === 'ALL' || m.examName === targetExam;
        return matchesClass && matchesExam;
      });

      if (filteredMarks.length === 0) {
        setSyncMessage({ type: 'success', text: 'সেভ করার মতো কোনো পরীক্ষা নম্বর পাওয়া যায়নি।' });
        return true;
      }

      const success = await saveMarksBatchToFirestore(school.schoolId, filteredMarks);
      if (success) {
        console.log(`[Targeted Firestore Write] Saved ${filteredMarks.length} mark docs for ${targetClass} - ${targetExam}. No full DB rewrite.`);
        setSyncMessage({ 
          type: 'success', 
          text: `নম্বর সফলভাবে সেভ হয়েছে! (${targetClass || 'ALL'} - ${targetExam || 'ALL'}, ${filteredMarks.length} টি নম্বর রেকর্ড)` 
        });
        setIsOnline(true);
        return true;
      } else {
        throw new Error('Marks batch write failed');
      }
    } catch (err) {
      console.error('saveMarksOnly error:', err);
      setSyncMessage({ type: 'error', text: 'নম্বর ফায়ারস্টোরে সেভ করার সময় সমস্যা হয়েছে।' });
      return false;
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3500);
    }
  };

  // Optimized Sync Handler - Does NOT rewrite entire database with loops
  const handleSyncToSheet = async () => {
    setIsSyncing(true);
    try {
      if (schoolProfile) {
        await saveSchoolToFirestore(schoolProfile);
      }
      // Save current class marks target batch if available
      const currentMarks = marks.filter(m => 
        (!selectedMarkClass || selectedMarkClass === 'ALL' || normalizeClassName(m.class) === normalizeClassName(selectedMarkClass)) && 
        (!selectedExam || selectedExam === 'ALL' || m.examName === selectedExam)
      );
      if (currentMarks.length > 0) {
        await saveMarksBatchToFirestore(school.schoolId, currentMarks);
      }
      setIsOnline(true);
      setSyncMessage({ type: 'success', text: 'ফায়ারস্টোর ডেটাবেজে পরিবর্তনসমূহ সফলভাবে সংরক্ষণ হয়েছে!' });
    } catch (err) {
      setSyncMessage({ type: 'error', text: 'ফায়ারস্টোর সিঙ্ক করার সময় সমস্যা হয়েছে।' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  // Daybook State
  const [daybookEntries, setDaybookEntries] = useState<DaybookEntry[]>(() => {
    const saved = localStorage.getItem(`daybook_${school.schoolId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: '1', date: new Date().toISOString().split('T')[0], type: 'INCOME', category: 'Tuition Fee', amount: 1500, description: 'Student Fee Receipt REC-1001', paymentMethod: 'Cash' }
    ];
  });

  useEffect(() => {
    safeLocalStorageSetItem(`daybook_${school.schoolId}`, JSON.stringify(daybookEntries));
  }, [daybookEntries, school.schoolId]);

  // Initial Data Load
  useEffect(() => {
    loadData();
  }, [school.schoolId]);

  // Keep totalStudents synced with actual registered student count safely
  useEffect(() => {
    if (school && students !== undefined) {
      const isProchesta = isProchestaSchool(school);
      const targetCount = isProchesta ? Math.max(387, students.length) : (students.length > 0 ? students.length : (school.totalStudents || 0));
      if (school.totalStudents !== targetCount) {
        onUpdateSchoolInfo({ ...school, totalStudents: targetCount });
      }
    }
  }, [students?.length, school.schoolId]);

  // Real-time School Profile Subscription (Name, Logo, Signature, Academic Year, Class Configs)
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeSingleSchool(school.schoolId, (updatedSchool) => {
      if (updatedSchool && updatedSchool.schoolId === school.schoolId) {
        onUpdateSchoolInfo(updatedSchool);
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Students Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const isProchesta = isProchestaSchool(school);
    const unsub = subscribeStudentsFromFirestore(school.schoolId, (updatedStudents) => {
      if (!updatedStudents) return;

      setStudents(prevStudents => {
        let baseList: Student[] = [];
        if (isProchesta) {
          baseList = (prevStudents && prevStudents.length >= 380)
            ? prevStudents
            : MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) }));
        } else {
          baseList = prevStudents || [];
        }

        const studentMap = new Map<string, Student>();
        baseList.forEach(st => {
          const key = `${normalizeClassName(st.class)}_${Number(st.roll)}`;
          studentMap.set(key, st);
        });

        updatedStudents.forEach(rem => {
          const key = `${normalizeClassName(rem.class)}_${Number(rem.roll)}`;
          const existing = studentMap.get(key);
          const cleanRemPhoto = rem.photo ? formatPhotoUrl(rem.photo) : '';
          if (existing) {
            studentMap.set(key, {
              ...existing,
              ...rem,
              class: normalizeClassName(rem.class || existing.class),
              roll: Number(rem.roll || existing.roll),
              photo: cleanRemPhoto || existing.photo || '',
              isActive: rem.isActive !== undefined ? rem.isActive : existing.isActive
            });
          } else {
            studentMap.set(key, {
              ...rem,
              class: normalizeClassName(rem.class),
              roll: Number(rem.roll),
              photo: cleanRemPhoto
            });
          }
        });

        const merged = deduplicateAndNormalizeStudents(
          isProchesta
            ? Array.from(studentMap.values())
            : (updatedStudents.length > 0 ? Array.from(studentMap.values()) : baseList)
        );
        safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(merged));
        return merged;
      });
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Marks Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeMarksFromFirestore(school.schoolId, (updatedMarks) => {
      if (updatedMarks) {
        setMarks(updatedMarks);
        safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(updatedMarks));
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Teachers Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeTeachersFromFirestore(school.schoolId, (updatedTeachers) => {
      if (updatedTeachers) {
        setTeachersList(updatedTeachers);
        safeLocalStorageSetItem(`teachers_${school.schoolId}`, JSON.stringify(updatedTeachers));
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Fee Receipts Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeFeeReceiptsFromFirestore(school.schoolId, (updatedReceipts) => {
      if (updatedReceipts) {
        setFeeReceipts(updatedReceipts);
        safeLocalStorageSetItem(`fee_receipts_${school.schoolId}`, JSON.stringify(updatedReceipts));
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Fee Totals Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeFeeTotalsFromFirestore(school.schoolId, (totals) => {
      if (totals) {
        setFeeTotals(totals);
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Daybook Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeDaybookFromFirestore(school.schoolId, (entries) => {
      if (entries) {
        setDaybookEntries(entries);
        safeLocalStorageSetItem(`daybook_${school.schoolId}`, JSON.stringify(entries));
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Expenses Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeExpensesFromFirestore(school.schoolId, (expList) => {
      if (expList) {
        setExpenses(expList);
        safeLocalStorageSetItem(`expenses_${school.schoolId}`, JSON.stringify(expList));
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Routines Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeRoutinesFromFirestore(school.schoolId, (routines) => {
      if (routines) {
        setRoutineData(routines);
        safeLocalStorageSetItem(`routines_${school.schoolId}`, JSON.stringify(routines));
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Vehicles Subscription for Cross-Device Instant Synchronization
  useEffect(() => {
    if (!school?.schoolId) return;
    const unsub = subscribeVehiclesFromFirestore(school.schoolId, (vehicles) => {
      if (vehicles) {
        setVehiclesList(vehicles);
        safeLocalStorageSetItem(`vehicles_${school.schoolId}`, JSON.stringify(vehicles));
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school?.schoolId]);

  // Real-time Notice Board Subscription with Cleanup
  useEffect(() => {
    if (!school.schoolId) return;
    const unsub = subscribeNoticesFromFirestore(school.schoolId, (updatedNotices) => {
      if (updatedNotices) {
        setNotices(updatedNotices);
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [school.schoolId]);

  const loadData = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    // Load from LocalStorage first for instant view
    const savedStudents = localStorage.getItem(`students_${school.schoolId}`);
    const savedMarks = localStorage.getItem(`marks_${school.schoolId}`);
    const savedTeachers = localStorage.getItem(`teachers_${school.schoolId}`);
    const savedExpenses = localStorage.getItem(`expenses_${school.schoolId}`);
    const savedFeeReceipts = localStorage.getItem(`fee_receipts_${school.schoolId}`);
    const savedDaybook = localStorage.getItem(`daybook_${school.schoolId}`);
    const savedRoutines = localStorage.getItem(`routines_${school.schoolId}`);

    if (savedTeachers) { try { setTeachersList(JSON.parse(savedTeachers)); } catch {} }
    if (savedExpenses) { try { setExpenses(JSON.parse(savedExpenses)); } catch {} }
    if (savedFeeReceipts) { try { setFeeReceipts(JSON.parse(savedFeeReceipts)); } catch {} }
    if (savedDaybook) { try { setDaybookEntries(JSON.parse(savedDaybook)); } catch {} }
    if (savedRoutines) { try { setRoutineData(JSON.parse(savedRoutines)); } catch {} }

    const isProchesta = isProchestaSchool(school);

    if (savedStudents) {
      try {
        const raw = JSON.parse(savedStudents);
        if (Array.isArray(raw)) {
          const isProchestaMockData = raw.some((st: any) => st?.studentId && typeof st.studentId === 'string' && st.studentId.startsWith('ST-NS-'));
          if (!isProchesta && isProchestaMockData) {
            setStudents([]);
            safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify([]));
          } else if (isProchesta && raw.length < 380) {
            const initSts = MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) }));
            setStudents(initSts);
            safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(initSts));
          } else {
            setStudents(raw.map((st: Student) => ({ ...st, class: normalizeClassName(st.class), photo: st.photo ? formatPhotoUrl(st.photo) : '' })));
          }
        } else {
          const initSts = isProchesta ? MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) })) : [];
          setStudents(initSts);
          safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(initSts));
        }
      } catch {
        const initSts = isProchesta ? MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) })) : [];
        setStudents(initSts);
        safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(initSts));
      }
    } else {
      const initSts = isProchesta ? MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) })) : [];
      setStudents(initSts);
      safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(initSts));
    }

    if (savedMarks) {
      try {
        const rawM = JSON.parse(savedMarks);
        if (Array.isArray(rawM)) {
          const isProchestaMockMarks = rawM.length > 0 && rawM[0]?.studentId?.startsWith('ST-NS-');
          if (!isProchesta && isProchestaMockMarks) {
            setMarks([]);
            safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify([]));
          } else if (isProchesta && rawM.length < 1000) {
            setMarks(MOCK_MARKS);
            safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(MOCK_MARKS));
          } else {
            setMarks(rawM);
          }
        } else {
          const initMarks = isProchesta ? MOCK_MARKS : [];
          setMarks(initMarks);
          safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(initMarks));
        }
      } catch {
        const initMarks = isProchesta ? MOCK_MARKS : [];
        setMarks(initMarks);
        safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(initMarks));
      }
    } else {
      const initMarks = isProchesta ? MOCK_MARKS : [];
      setMarks(initMarks);
      safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(initMarks));
    }

    // Purge legacy backup keys
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('backup_history_') || k.includes('autobackups_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}

    // Load fresh Students & Fee Totals from Firestore Subcollections
    try {
      const sts = await fetchSchoolStudentsFromFirestore(school.schoolId);
      if (sts && sts.length > 0) {
        setStudents(prevStudents => {
          let baseList: Student[] = [];
          if (isProchesta) {
            baseList = (prevStudents && prevStudents.length >= 380)
              ? prevStudents
              : MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) }));
          } else {
            baseList = prevStudents || [];
          }

          const studentMap = new Map<string, Student>();
          baseList.forEach(st => {
            const key = `${normalizeClassName(st.class)}_${Number(st.roll)}`;
            studentMap.set(key, st);
          });

          sts.forEach(rem => {
            const key = `${normalizeClassName(rem.class)}_${Number(rem.roll)}`;
            const existing = studentMap.get(key);
            const cleanRemPhoto = rem.photo ? formatPhotoUrl(rem.photo) : '';
            if (existing) {
              studentMap.set(key, {
                ...existing,
                ...rem,
                class: normalizeClassName(rem.class || existing.class),
                roll: Number(rem.roll || existing.roll),
                photo: cleanRemPhoto || existing.photo || '',
                isActive: rem.isActive !== undefined ? rem.isActive : existing.isActive
              });
            } else {
              studentMap.set(key, {
                ...rem,
                class: normalizeClassName(rem.class),
                roll: Number(rem.roll),
                photo: cleanRemPhoto
              });
            }
          });

          const finalMerged = deduplicateAndNormalizeStudents(
            isProchesta ? Array.from(studentMap.values()) : (sts.length > 0 ? Array.from(studentMap.values()) : baseList)
          );
          safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(finalMerged));
          return finalMerged;
        });
      } else {
        if (isProchesta) {
          const initialSts = MOCK_STUDENTS.map(st => ({ ...st, class: normalizeClassName(st.class) }));
          setStudents(initialSts);
          safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(initialSts));
        } else if (!savedStudents) {
          setStudents([]);
          safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify([]));
        }
      }

      // Load Aggregate Fee Totals Doc
      const totalsDoc = await fetchFeeTotalsFromFirestore(school.schoolId);
      if (totalsDoc) {
        setFeeTotals(totalsDoc);
      }

      setIsOnline(true);
      onUpdateSchoolInfo({ ...school, status: 'ONLINE' });
      setSyncMessage({ type: 'success', text: 'ডেটাবেজ থেকে ডাটা লোড সম্পন্ন হয়েছে।' });
    } catch (err: any) {
      setIsOnline(true);
      setSyncMessage({ type: 'error', text: 'ফায়ারস্টোর কানেকশনে সাময়িক সমস্যা, লোকাল কপি দেখানো হচ্ছে।' });
    }
    setIsSyncing(false);
  };

  const createAutoBackupSnapshot = (reason: string, currentStudents: Student[], currentMarks: ExamMark[]) => {
    if (!currentStudents || (currentStudents.length === 0 && currentMarks.length === 0)) return;

    const now = new Date();
    const formattedTime = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString('bn-BD');
    const newSnapshot: DataBackupSnapshot = {
      id: 'snap-' + Date.now(),
      timestamp: now.toISOString(),
      formattedTime,
      actionReason: reason,
      studentCount: currentStudents.length,
      markCount: currentMarks.length,
      students: JSON.parse(JSON.stringify(currentStudents)),
      marks: JSON.parse(JSON.stringify(currentMarks))
    };

    setBackupHistory(prev => {
      // Prevent rapid duplicate snapshots
      if (prev.length > 0 && (Date.now() - new Date(prev[0].timestamp).getTime() < 2000)) {
        return prev;
      }
      // Keep max 3 snapshots in memory only - strictly no LocalStorage calls
      return [newSnapshot, ...prev].slice(0, 3);
    });
  };

  const persistData = (newStudents: Student[], newMarks: ExamMark[], actionReason = 'ডাটা সংভেদনশীল পরিবর্তন ও মেমোরি রাইট') => {
    // Preserve current state into auto backup snapshot before mutating
    if (students.length > 0 || marks.length > 0) {
      createAutoBackupSnapshot(actionReason, students, marks);
    }
    setStudents(newStudents);
    setMarks(newMarks);
    safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(newStudents));
    safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(newMarks));
    if (school.totalStudents !== newStudents.length) {
      onUpdateSchoolInfo({ ...school, totalStudents: newStudents.length });
    }
  };

  const handleRestoreSnapshot = (snap: DataBackupSnapshot) => {
    // Save current state as safety point before reverting
    createAutoBackupSnapshot('রিস্টোর করার পূর্বের তাত্ক্ষণিক সেফটি পয়েন্ট', students, marks);

    setStudents(snap.students);
    setMarks(snap.marks);
    safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(snap.students));
    safeLocalStorageSetItem(`marks_${school.schoolId}`, JSON.stringify(snap.marks));
    setRestoreConfirmId(null);
    setSyncMessage({ type: 'success', text: `সফলভাবে ${snap.formattedTime} সময়কার ভার্সনে ডাটা রিস্টোর করা হয়েছে!` });
  };

  const handleCreateManualSnapshot = () => {
    createAutoBackupSnapshot('এডমিন কর্তৃক ম্যানুয়াল সেফটি ব্যাকআপ পয়েন্ট', students, marks);
    alert('একটি নতুন সেফটি ব্যাকআপ পয়েন্ট সফলভাবে তৈরি করা হয়েছে!');
  };

  const handleExportBackupJSON = () => {
    const data = {
      schoolId: school.schoolId,
      schoolName: school.name,
      exportedAt: new Date().toISOString(),
      students,
      marks,
      backupHistory
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SchoolHub_Backup_${school.schoolId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.students && Array.isArray(parsed.students) && parsed.marks && Array.isArray(parsed.marks)) {
          if (confirm(`আপনি কি এই JSON ফাইল থেকে ডাটা ইম্পোর্ট ও রিস্টোর করতে চান?\nশিক্ষার্থী: ${parsed.students.length} জন\nনম্বর এন্ট্রি: ${parsed.marks.length} টি`)) {
            persistData(parsed.students, parsed.marks, 'JSON ফাইল থেকে ডাটা ইম্পোর্ট ও রিস্টোর');
            alert('JSON ব্যাকআপ ফাইল থেকে ডাটা সফলভাবে রিস্টোর হয়েছে!');
          }
        } else {
          alert('অকার্যকর ব্যাকআপ ফাইল! ফাইলটিতে সঠিক students এবং marks ডাটা নেই।');
        }
      } catch {
        alert('JSON ফাইলটি পড়া সম্ভব হয়নি। সঠিক ফরম্যাট যাচাই করুন।');
      }
    };
    reader.readAsText(file);
  };

    // Student Photo Upload Handler: Instant lightweight compression + Background Cloud Storage
  const handlePhotoFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('ফাইলের আকার ১৫ MB-এর চেয়ে বেশি হতে পারবে না!');
      return;
    }

    const studentIdToUse = studentFormData.studentId || (editingStudent?.studentId) || `STU-${Date.now()}`;

    setIsUploadingPhoto(true);
    try {
      // Compress directly to a lightweight Data URL (~10-15KB) and store it straight in Firestore.
      // No external cloud (Cloudinary) upload step -- this removes the network-dependent hop that
      // was silently failing on slow/unstable mobile connections. Firestore document limit is 1MB,
      // so a ~10-15KB compressed photo is negligible.
      const compressedUrl = await compressImageFileToDataUrl(file, 300, 300, 0.72);
      if (compressedUrl) {
        setStudentFormData(prev => ({
          ...prev,
          studentId: studentIdToUse,
          photo: compressedUrl
        }));
      } else {
        alert('ছবি প্রসেস করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
      }
    } catch (e: any) {
      console.error('Photo compression failed:', e);
      alert('ছবি প্রসেস করতে সমস্যা হয়েছে: ' + (e?.message || 'অজানা ত্রুটি'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Student Save / Add (Optimistic Instant UI + Background Persistence)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentFormData.name || !studentFormData.name.trim()) {
      alert('শিক্ষার্থীর নাম প্রদান করুন!');
      return;
    }

    if (!studentFormData.class || !studentFormData.class.trim()) {
      alert('অবৈধ শ্রেণি! সঠিক শ্রেণি নির্বাচন করুন।');
      return;
    }

    const rollVal = Number(studentFormData.roll);
    if (isNaN(rollVal) || rollVal <= 0) {
      alert('অবৈধ রোল নম্বর! রোল নম্বর ১ বা তার বেশি ধনাত্মক সংখ্যা হতে হবে।');
      return;
    }

    const normalizedClass = normalizeClassName(studentFormData.class);
    const isDuplicateRoll = students.some(s => 
      normalizeClassName(s.class) === normalizedClass && 
      Number(s.roll) === rollVal &&
      (!editingStudent || (editingStudent && (normalizeClassName(editingStudent.class) !== normalizedClass || editingStudent.roll !== rollVal)))
    );

    if (isDuplicateRoll) {
      alert(`অবৈধ রোল! এই শ্রেণিতে (${studentFormData.class}) রোল #${rollVal} ইতিমধ্যে অন্য একজন শিক্ষার্থীর জন্য নির্ধারিত রয়েছে।`);
      return;
    }

    setIsSavingStudent(true);

    try {
      let finalPhotoUrl = (studentFormData.photo || '').trim();

      // If photo is still a temporary blob url, convert it to data url
      if (finalPhotoUrl.startsWith('blob:')) {
        try {
          const res = await fetch(finalPhotoUrl);
          const blob = await res.blob();
          finalPhotoUrl = await compressImageFileToDataUrl(blob, 280, 280, 0.72);
        } catch {
          // keep existing
        }
      } else if (finalPhotoUrl) {
        finalPhotoUrl = formatPhotoUrl(finalPhotoUrl);
      }

      const standardStudentId = generateStandardStudentId(school, {
        ...studentFormData,
        class: normalizedClass,
        roll: rollVal
      });

      const updatedStudent: Student = {
        ...studentFormData,
        studentId: standardStudentId,
        photo: finalPhotoUrl,
        class: normalizedClass,
        roll: rollVal,
        isActive: studentFormData.status !== 'Inactive'
      };

      let updatedStudents: Student[];
      if (editingStudent) {
        updatedStudents = students.map(s => 
          (normalizeClassName(s.class) === normalizeClassName(editingStudent.class) && Number(s.roll) === Number(editingStudent.roll))
            ? updatedStudent
            : s
        );
      } else {
        updatedStudents = [...students, updatedStudent];
      }

      // 1. Instant local state update & immediate modal close (Zero UI Lag!)
      setStudents(updatedStudents);
      persistData(updatedStudents, marks);
      closeStudentModal();

      // 2. Persist to Firestore (photo now travels inside this same write -- no separate cloud step)
      saveStudentSingleToFirestore(school.schoolId, updatedStudent).then(success => {
        if (!success) {
          alert(`⚠️ "${updatedStudent.name}"-এর তথ্য সার্ভারে (cloud-এ) নিশ্চিতভাবে সংরক্ষণ করা যায়নি (নেটওয়ার্ক সমস্যা)। এই তথ্য শুধু এই ডিভাইসে সাময়িকভাবে আছে -- অন্য ডিভাইসে দেখা যাবে না। ভালো ইন্টারনেট সংযোগে থেকে এই শিক্ষার্থীকে আবার Save করুন।`);
        }
      }).catch(err => {
        console.warn('Background Firestore save student warning:', err);
        alert(`⚠️ "${updatedStudent.name}"-এর তথ্য সার্ভারে (cloud-এ) সংরক্ষণ করা যায়নি (নেটওয়ার্ক সমস্যা)। ভালো ইন্টারনেট সংযোগে থেকে আবার Save করুন।`);
      });


    } catch (unexpectedErr: any) {
      console.error('Unexpected error in handleSaveStudent:', unexpectedErr);
      alert('শিক্ষার্থী সংরক্ষণ করতে সমস্যা হয়েছে: ' + (unexpectedErr?.message || 'Error'));
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Google Sheet / CSV Import Confirmation Handler with Multi-School Isolation & Mode Switching
  const handleConfirmCsvImport = async (
    importedStudents: Student[], 
    mode: 'replace' | 'merge' = 'replace'
  ): Promise<{ success: number; failed: number }> => {
    if (!school?.schoolId || !importedStudents || importedStudents.length === 0) {
      return { success: 0, failed: 0 };
    }

    try {
      let finalStudentList: Student[] = [];

      if (mode === 'replace') {
        // 1. REPLACE MODE: Deduplicate fresh imported student list
        finalStudentList = deduplicateAndNormalizeStudents(importedStudents);

        // Save to Firestore with replaceExisting = true (purges old student subcollection documents)
        const ok = await saveStudentsBatchToFirestore(school.schoolId, finalStudentList, true);
        if (!ok) throw new Error('Firestore batch save failed');
      } else {
        // 2. MERGE MODE: Merge imported student data with existing state preserving photos
        const existingMap = new Map<string, Student>();
        students.forEach(s => {
          const k = `${normalizeClassName(s.class)}_${Number(s.roll)}`;
          existingMap.set(k, s);
        });

        importedStudents.forEach(imp => {
          const k = `${normalizeClassName(imp.class)}_${Number(imp.roll)}`;
          const prev = existingMap.get(k);
          if (prev) {
            existingMap.set(k, {
              ...prev,
              ...imp,
              class: normalizeClassName(imp.class || prev.class),
              roll: Number(imp.roll || prev.roll),
              // Keep existing photo if present
              photo: (prev.photo && !prev.photo.startsWith('blob:')) ? prev.photo : (imp.photo || ''),
              isActive: true
            });
          } else {
            existingMap.set(k, { ...imp, isActive: true });
          }
        });

        finalStudentList = deduplicateAndNormalizeStudents(Array.from(existingMap.values()));
        const ok = await saveStudentsBatchToFirestore(school.schoolId, finalStudentList, false);
        if (!ok) throw new Error('Firestore batch save failed');
      }

      // Update memory & LocalStorage namespaced to this school
      setStudents(finalStudentList);
      persistData(
        finalStudentList, 
        marks, 
        mode === 'replace' ? 'CSV ফাইল থেকে সম্পূর্ণ নতুন তালিকা প্রতিস্থাপন' : 'CSV থেকে শিক্ষার্থী ডাটা মার্জ ও আপডেট'
      );

      return { success: finalStudentList.length, failed: 0 };
    } catch (err: any) {
      console.error('Error during CSV import:', err);
      return { success: 0, failed: importedStudents.length };
    }
  };

  // Student Soft Delete & Reactivate
  const handleDeleteStudent = async (student: Student) => {
    if (confirm(`আপনি কি নিশ্চিত যে ${student.name} (Class: ${student.class}, Roll: ${student.roll}) কে নিষ্ক্রিয় (Soft Delete) করতে চান?`)) {
      const studentDocId = student.studentId || `${student.class}_${student.roll}`;
      
      const updatedStudents = students.map(s => {
        if (normalizeClassName(s.class) === normalizeClassName(student.class) && Number(s.roll) === Number(student.roll)) {
          return { ...s, isActive: false, deactivatedAt: new Date().toISOString() };
        }
        return s;
      });

      setStudents(updatedStudents);
      persistData(updatedStudents, marks);

      if (editingStudent && normalizeClassName(editingStudent.class) === normalizeClassName(student.class) && Number(editingStudent.roll) === Number(student.roll)) {
        setEditingStudent(null);
        closeStudentModal();
      }
      if (feeStudent && normalizeClassName(feeStudent.class) === normalizeClassName(student.class) && Number(feeStudent.roll) === Number(student.roll)) {
        setFeeStudent(null);
        setIsFeeModalOpen(false);
      }

      try {
        await deleteStudentSingleFromFirestore(school.schoolId, studentDocId);
      } catch (err) {
        console.error('Error soft deleting student:', err);
      }
    }
  };

  // Student Permanent Hard Delete
  const handleHardDeleteStudent = async (student: Student) => {
    if (confirm(`⚠️ স্থায়ীভাবে মুছুন: আপনি কি নিশ্চিত যে ${student.name} (Class: ${student.class}, Roll: ${student.roll}) কে ডেটাবেস থেকে স্থায়ীভাবে (Permanently) মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।`)) {
      const studentDocId = student.studentId || `${student.class}_${student.roll}`;
      
      const filtered = students.filter(s => 
        !(normalizeClassName(s.class) === normalizeClassName(student.class) && Number(s.roll) === Number(student.roll))
      );

      setStudents(filtered);
      persistData(filtered, marks);

      if (editingStudent && normalizeClassName(editingStudent.class) === normalizeClassName(student.class) && Number(editingStudent.roll) === Number(student.roll)) {
        setEditingStudent(null);
        closeStudentModal();
      }
      if (feeStudent && normalizeClassName(feeStudent.class) === normalizeClassName(student.class) && Number(feeStudent.roll) === Number(student.roll)) {
        setFeeStudent(null);
        setIsFeeModalOpen(false);
      }

      try {
        await hardDeleteStudentFromFirestore(school.schoolId, student);
      } catch (err) {
        console.error('Error permanently deleting student:', err);
      }
    }
  };

  // Purge all soft-deleted / inactive students
  const handlePurgeAllInactiveStudents = async () => {
    const inactiveCount = students.filter(s => s.isActive === false).length;
    if (inactiveCount === 0) {
      alert('কোনো নিষ্ক্রিয় শিক্ষার্থী পাওয়া যায়নি।');
      return;
    }

    if (confirm(`আপনি কি নিশ্চিত যে সকল নিষ্ক্রিয় শিক্ষার্থী (${inactiveCount} জন) ডেটাবেস থেকে স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      const activeOnly = students.filter(s => s.isActive !== false);
      setStudents(activeOnly);
      persistData(activeOnly, marks);

      try {
        await purgeAllInactiveStudentsFromFirestore(school.schoolId);
        alert(`${inactiveCount} জন নিষ্ক্রিয় শিক্ষার্থীর রেকর্ড স্থায়ীভাবে মুছে ফেলা হয়েছে।`);
      } catch (err) {
        console.error('Error purging inactive students:', err);
        alert('নিষ্ক্রিয় রেকর্ড মুছতে সমস্যা হয়েছে।');
      }
    }
  };

  const handleReactivateStudent = async (student: Student) => {
    const studentDocId = student.studentId || `${student.class}_${student.roll}`;
    const updatedStudents = students.map(s => {
      if (normalizeClassName(s.class) === normalizeClassName(student.class) && Number(s.roll) === Number(student.roll)) {
        return { ...s, isActive: true, deactivatedAt: undefined };
      }
      return s;
    });

    setStudents(updatedStudents);
    persistData(updatedStudents, marks);

    await reactivateDocument(school.schoolId, 'students', studentDocId).catch(() => {});
  };

  // Fee Collection Save (Uses transaction counter, updates fee totals & student paid status)
  const handleCollectFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeStudent || feeMonths.length === 0) return;

    const monthlyRate = feeStudent.monthlyFee || 350;
    const defaultAmount = feeMonths.length * monthlyRate;
    const customNum = Number(customFeeAmount);
    const paidAmount = (!isNaN(customNum) && customNum > 0)
      ? customNum
      : defaultAmount;

    // Use transaction counter for guaranteed unique monotonic receipt number
    const finalReceiptNo = await getNextReceiptNoFromFirestore(school.schoolId);

    const updatedStudents = students.map(st => {
      if (normalizeClassName(st.class) === normalizeClassName(feeStudent.class) && Number(st.roll) === Number(feeStudent.roll)) {
        const updatedSt = { ...st };
        feeMonths.forEach(m => {
          const lowerM = m.toLowerCase();
          const capM = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
          (updatedSt as any)[lowerM] = 'Paid';
          (updatedSt as any)[capM] = 'Paid';
        });
        updatedSt.totalCollection = (updatedSt.totalCollection || 0) + paidAmount;
        updatedSt.lastReceiptNo = finalReceiptNo;
        return updatedSt;
      }
      return st;
    });

    const newReceiptId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
    const selectedDate = collectionDate || new Date().toISOString().split('T')[0];

    const newReceipt: FeeReceipt = {
      id: newReceiptId,
      receiptNo: finalReceiptNo,
      date: selectedDate,
      studentName: feeStudent.name,
      studentClass: feeStudent.class,
      studentSection: feeStudent.section || '',
      roll: Number(feeStudent.roll),
      fatherName: feeStudent.fatherName || '',
      months: feeMonths,
      amount: paidAmount,
      paymentMode: feePaymentMode || 'Cash',
      academicYear: school.currentAcademicYear || String(new Date().getFullYear()),
      isActive: true
    };

    const updatedReceipts = [newReceipt, ...feeReceipts];
    setFeeReceipts(updatedReceipts);
    safeLocalStorageSetItem(`fee_receipts_${school.schoolId}`, JSON.stringify(updatedReceipts));

    // Add entry to Daybook
    const newDaybookEntry: DaybookEntry = {
      id: newReceiptId,
      linkedReceiptId: newReceiptId,
      date: selectedDate,
      type: 'INCOME',
      category: 'Tuition Fee',
      amount: paidAmount,
      description: `Fee Payment for ${feeStudent.name} (${feeStudent.class}, Roll ${feeStudent.roll}) - Months: ${feeMonths.join(', ')} [Receipt #${finalReceiptNo}]`,
      paymentMethod: feePaymentMode || 'Cash',
      receiptNo: finalReceiptNo,
      isActive: true
    };

    const updatedDaybook = [newDaybookEntry, ...daybookEntries];
    setDaybookEntries(updatedDaybook);
    safeLocalStorageSetItem(`daybook_${school.schoolId}`, JSON.stringify(updatedDaybook));
    persistData(updatedStudents, marks);

    const targetStudent = updatedStudents.find(st => normalizeClassName(st.class) === normalizeClassName(feeStudent.class) && Number(st.roll) === Number(feeStudent.roll));
    if (targetStudent) {
      setFeeStudent(targetStudent);
    }

    setIsFeeModalOpen(false);
    setFeeMonths([]);
    setCustomFeeAmount('');

    // Save Fee Receipt, Daybook Entry, and Updated Student to Firestore Subcollections
    saveFeeReceiptSingleToFirestore(school.schoolId, newReceipt).catch(() => {});
    saveDaybookSingleToFirestore(school.schoolId, newDaybookEntry).catch(() => {});
    updateFeeTotalsOnReceiptSave(school.schoolId, paidAmount, selectedDate).catch(() => {});
    if (targetStudent) {
      saveStudentSingleToFirestore(school.schoolId, targetStudent).catch(() => {});
    }
  };

  // Helper to recalculate student paid months status by querying full receipt history directly from Firestore
  const recalculateStudentPaidStatus = async (studentClass: string, studentRoll: number) => {
    const allMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    
    // Query full student receipt history directly from Firestore
    const stReceiptsFromFs = await fetchFeeReceiptsFromFirestore(school.schoolId, {
      studentClass,
      studentRoll: Number(studentRoll)
    });

    const activeStudentReceipts = stReceiptsFromFs.filter(r => r.isActive !== false);

    const paidMonthsSet = new Set<string>();
    let totalCollected = 0;
    let lastRecNo = '';

    activeStudentReceipts.forEach(r => {
      const monthsArr = Array.isArray(r.months)
        ? r.months
        : typeof r.months === 'string'
        ? (r.months as string).split(',')
        : [];
      monthsArr.forEach(m => {
        if (m) paidMonthsSet.add(String(m).trim().toLowerCase());
      });
      totalCollected += Number(r.amount || 0);
      lastRecNo = r.receiptNo || lastRecNo;
    });

    let targetUpdatedStudent: Student | null = null;
    const updatedStudents = students.map(st => {
      if (normalizeClassName(st.class) === normalizeClassName(studentClass) && Number(st.roll) === Number(studentRoll)) {
        const updatedSt = { ...st };
        allMonths.forEach(m => {
          if (paidMonthsSet.has(m)) {
            (updatedSt as any)[m] = 'Paid';
          } else {
            (updatedSt as any)[m] = undefined;
          }
        });
        updatedSt.totalCollection = totalCollected;
        updatedSt.lastReceiptNo = lastRecNo;
        targetUpdatedStudent = updatedSt;
        return updatedSt;
      }
      return st;
    });

    setStudents(updatedStudents);
    persistData(updatedStudents, marks);

    if (targetUpdatedStudent) {
      await saveStudentSingleToFirestore(school.schoolId, targetUpdatedStudent).catch(() => {});
    }

    if (feeStudent && normalizeClassName(feeStudent.class) === normalizeClassName(studentClass) && Number(feeStudent.roll) === Number(studentRoll)) {
      const freshSt = updatedStudents.find(s => normalizeClassName(s.class) === normalizeClassName(studentClass) && Number(s.roll) === Number(studentRoll));
      if (freshSt) {
        setFeeStudent(freshSt);
      }
    }
  };

  const handleDeleteReceipt = async (rec: FeeReceipt) => {
    if (!confirm(`আপনি কি নিশ্চিত যে রশিদ নম্বর #${rec.receiptNo} (${rec.studentName}, পরিমাণ: ₹${rec.amount}) নিষ্ক্রিয় (Soft Delete) করতে চান?`)) {
      return;
    }

    const updatedReceipts = feeReceipts.filter(r => r.id !== rec.id);
    setFeeReceipts(updatedReceipts);

    const updatedDaybook = daybookEntries.filter(d => (d.linkedReceiptId ? d.linkedReceiptId !== rec.id : d.id !== rec.id));
    setDaybookEntries(updatedDaybook);

    // Soft delete in Firestore and update aggregate fee totals
    await deleteFeeReceiptSingleFromFirestore(school.schoolId, rec.id, rec.amount, rec.date);

    // Recalculate student paid status using complete history from Firestore
    await recalculateStudentPaidStatus(rec.studentClass, rec.roll);
  };

  const handleOpenEditReceipt = (rec: FeeReceipt) => {
    setEditingReceipt(rec);
    const monthsArr = Array.isArray(rec.months) 
      ? rec.months 
      : typeof rec.months === 'string' 
      ? (rec.months as string).split(',').map(m => m.trim()).filter(Boolean)
      : [];
    setEditReceiptFormData({
      receiptNo: rec.receiptNo,
      amount: rec.amount,
      paymentMode: rec.paymentMode || 'Cash',
      date: rec.date || new Date().toISOString().split('T')[0],
      months: monthsArr
    });
    setIsEditReceiptModalOpen(true);
  };

  const handleSaveEditedReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceipt) return;

    let modifiedReceiptObj: FeeReceipt | null = null;
    const updatedReceipts = feeReceipts.map(r => {
      if (r.id === editingReceipt.id) {
        modifiedReceiptObj = {
          ...r,
          receiptNo: editReceiptFormData.receiptNo,
          amount: Number(editReceiptFormData.amount),
          paymentMode: editReceiptFormData.paymentMode,
          date: editReceiptFormData.date,
          months: editReceiptFormData.months
        };
        return modifiedReceiptObj;
      }
      return r;
    });

    setFeeReceipts(updatedReceipts);

    let modifiedDaybookObj: DaybookEntry | null = null;
    const updatedDaybook = daybookEntries.map(d => {
      if ((d.linkedReceiptId && d.linkedReceiptId === editingReceipt.id) || d.id === editingReceipt.id) {
        modifiedDaybookObj = {
          ...d,
          receiptNo: editReceiptFormData.receiptNo,
          amount: Number(editReceiptFormData.amount),
          paymentMethod: editReceiptFormData.paymentMode,
          date: editReceiptFormData.date,
          description: `Fee Payment for ${editingReceipt.studentName} (${editingReceipt.studentClass}, Roll ${editingReceipt.roll}) - Months: ${editReceiptFormData.months.join(', ')}`
        };
        return modifiedDaybookObj;
      }
      return d;
    });
    setDaybookEntries(updatedDaybook);

    if (modifiedReceiptObj) {
      await saveFeeReceiptSingleToFirestore(school.schoolId, modifiedReceiptObj).catch(() => {});
    }
    if (modifiedDaybookObj) {
      await saveDaybookSingleToFirestore(school.schoolId, modifiedDaybookObj).catch(() => {});
    }

    await recalculateStudentPaidStatus(editingReceipt.studentClass, editingReceipt.roll);

    setIsEditReceiptModalOpen(false);
    setEditingReceipt(null);
  };

  // Student list pagination
  const [studentPage, setStudentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Deferred values for fast search inputs without UI lag
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredFeeSetupSearch = useDeferredValue(feeSetupSearch);
  const deferredTeacherSearchQuery = useDeferredValue(teacherSearchQuery);

  // Class order index map for proper sequential sorting (NS -> LKG -> UKG -> Class I ...)
  const classOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    availableClassNames.forEach((cls, idx) => {
      map.set(normalizeClassName(cls), idx);
    });
    return map;
  }, [availableClassNames]);

  // Student counts per class for dropdown display
  const classStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(st => {
      if (!st) return;
      if (!showInactiveStudents && st.isActive === false) return;
      const normalizedCls = normalizeClassName(st.class || '');
      counts[normalizedCls] = (counts[normalizedCls] || 0) + 1;
    });
    return counts;
  }, [students, showInactiveStudents]);

  // Reset studentPage to 1 whenever filters or page size change
  useEffect(() => {
    setStudentPage(1);
  }, [selectedClassFilter, selectedSectionFilter, deferredSearchQuery, showInactiveStudents, pageSize]);

  // Logged-in Teacher identification
  const loggedInTeacher = useMemo(() => {
    if (!isTeacher) return null;
    return teachersList.find(t => {
      const tId = (t.teacherId || t.id || '').toLowerCase();
      const uName = (session?.username || '').toLowerCase();
      const tPhone = (t.phone || '').trim();
      return tId === uName || (session?.phone && tPhone === session.phone) || (t.name && session?.name && t.name.includes(session.name));
    }) || teachersList[0] || null;
  }, [teachersList, isTeacher, session]);

  // Classes assigned to this teacher in routine
  const teacherTodayClasses = useMemo(() => {
    if (!loggedInTeacher) return [];
    const tName = (loggedInTeacher.name || '').toLowerCase();
    return routineEntries.filter(r => {
      return (r.teacher || '').toLowerCase().includes(tName);
    });
  }, [routineEntries, loggedInTeacher]);

  // 1. Classes where teacher has permission for attendance and viewing/editing students
  const teacherPermittedClasses = useMemo(() => {
    if (!isTeacher || !loggedInTeacher) return availableClassNames;
    const classes = new Set<string>();
    if (loggedInTeacher.assignedClasses && loggedInTeacher.assignedClasses.length > 0) {
      loggedInTeacher.assignedClasses.forEach(c => c && classes.add(c));
    }
    if (loggedInTeacher.assignedSubjects && loggedInTeacher.assignedSubjects.length > 0) {
      loggedInTeacher.assignedSubjects.forEach(s => s.class && classes.add(s.class));
    }
    teacherTodayClasses.forEach(r => {
      if (r.class) classes.add(r.class);
    });
    const arr = Array.from(classes).filter(Boolean);
    return arr.length > 0 ? arr : availableClassNames;
  }, [isTeacher, loggedInTeacher, teacherTodayClasses, availableClassNames]);

  // 2. Specific Class & Subject combinations where teacher has permission for Marks Entry
  const teacherPermittedSubjectPairs = useMemo(() => {
    if (!isTeacher || !loggedInTeacher) return [];
    const list: { class: string; subject: string }[] = [];
    if (loggedInTeacher.assignedSubjects && loggedInTeacher.assignedSubjects.length > 0) {
      loggedInTeacher.assignedSubjects.forEach(item => {
        if (item.class && item.subject) {
          list.push({ class: item.class, subject: item.subject });
        }
      });
    }
    teacherTodayClasses.forEach(r => {
      if (r.class && r.subject) {
        const already = list.some(x => normalizeClassName(x.class) === normalizeClassName(r.class) && x.subject.trim().toLowerCase() === r.subject.trim().toLowerCase());
        if (!already) {
          list.push({ class: r.class, subject: r.subject });
        }
      }
    });
    // Fallback if teacher has assignedClasses but no specific assignedSubjects
    if (list.length === 0 && loggedInTeacher.assignedClasses && loggedInTeacher.assignedClasses.length > 0) {
      loggedInTeacher.assignedClasses.forEach(cls => {
        const classSubs = getEffectiveSubjectsForClass(cls, selectedExam);
        classSubs.forEach(sub => {
          list.push({ class: cls, subject: sub });
        });
      });
    }
    return list;
  }, [isTeacher, loggedInTeacher, teacherTodayClasses, selectedExam]);

  // Classes permitted for marks entry specifically
  const teacherPermittedMarkClasses = useMemo(() => {
    if (!isTeacher) return availableClassNames;
    const classes = Array.from(new Set(teacherPermittedSubjectPairs.map(p => p.class)));
    return classes.length > 0 ? classes : teacherPermittedClasses;
  }, [isTeacher, teacherPermittedSubjectPairs, teacherPermittedClasses, availableClassNames]);

  // Subjects permitted for the currently selected class in marks entry
  const teacherPermittedSubjectsForSelectedClass = useMemo(() => {
    if (!isTeacher) {
      return getEffectiveSubjectsForClass(selectedMarkClass, selectedExam);
    }
    const filtered = teacherPermittedSubjectPairs
      .filter(p => normalizeClassName(p.class) === normalizeClassName(selectedMarkClass))
      .map(p => p.subject);
    const uniqueSubs = Array.from(new Set(filtered.filter(Boolean)));
    if (uniqueSubs.length > 0) return uniqueSubs;
    return getEffectiveSubjectsForClass(selectedMarkClass, selectedExam);
  }, [isTeacher, teacherPermittedSubjectPairs, selectedMarkClass, selectedExam]);

  const teacherAssignedStudentsCount = useMemo(() => {
    if (teacherPermittedClasses.length === 0) return students.length;
    return students.filter(st => teacherPermittedClasses.some(c => normalizeClassName(c) === normalizeClassName(st.class))).length;
  }, [students, teacherPermittedClasses]);

  // Filtered Students List Memoized (Sorted by Class sequence then Roll)
  const filteredStudents = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      if (isTeacher) {
        const inPermitted = teacherPermittedClasses.some(c => normalizeClassName(c) === normalizeClassName(st.class || ''));
        if (!inPermitted) return false;
      }
      const matchesClass = selectedClassFilter === 'ALL' || normalizeClassName(st.class || '') === normalizeClassName(selectedClassFilter);
      const matchesSection = selectedSectionFilter === 'ALL' || (st.section || '').trim().toUpperCase() === selectedSectionFilter.trim().toUpperCase();
      const matchesQuery = !q || 
        (st.name || '').toLowerCase().includes(q) ||
        (st.phone || '').includes(q) ||
        (st.fatherName || '').toLowerCase().includes(q) ||
        (st.class || '').toLowerCase().includes(q) ||
        String(st.roll || '') === q;
      return matchesClass && matchesSection && matchesQuery;
    }).sort((a, b) => {
      const classA = classOrderMap.get(normalizeClassName(a.class || '')) ?? 999;
      const classB = classOrderMap.get(normalizeClassName(b.class || '')) ?? 999;
      if (classA !== classB) return classA - classB;
      return Number(a.roll) - Number(b.roll);
    });
  }, [students, showInactiveStudents, selectedClassFilter, selectedSectionFilter, deferredSearchQuery, classOrderMap, isTeacher, teacherPermittedClasses]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const currentPageStudents = useMemo(() => {
    if (pageSize >= 1000) return filteredStudents;
    const safePage = Math.min(Math.max(1, studentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, studentPage, totalPages, pageSize]);

  // Fee Setup Filtered Students Memoized
  const feeSetupFilteredStudents = useMemo(() => {
    const q = deferredFeeSetupSearch.trim().toLowerCase();
    return students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      const matchesClass = feeSetupClass === 'ALL' || normalizeClassName(st.class || '') === normalizeClassName(feeSetupClass);
      const matchesQuery = !q || (st.name || '').toLowerCase().includes(q) || String(st.roll || '').includes(q);
      return matchesClass && matchesQuery;
    }).sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [students, showInactiveStudents, feeSetupClass, deferredFeeSetupSearch]);

  // Marks Lookup Map O(1) Memoized
  const marksLookupMap = useMemo(() => {
    const map = new Map<string, ExamMark>();
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      if (!m) continue;
      const key = `${normalizeClassName(m.class)}|${m.examName}|${(m.subjectName || '').toUpperCase()}|${m.roll}`;
      map.set(key, m);
    }
    return map;
  }, [marks]);

  // Calculate Total Fee Collections Memoized
  const totalCollectedFees = useMemo(() => {
    return students.reduce((acc, st) => acc + (st.totalCollection || 0), 0);
  }, [students]);

  // Overview Active/Inactive Student Counts
  const activeStudentsCount = useMemo(() => {
    return students.filter(s => s.status === 'Active' || s.isActive !== false).length;
  }, [students]);

  const inactiveStudentsCount = useMemo(() => {
    return students.filter(s => s.isActive === false || s.status !== 'Active').length;
  }, [students]);

  // Overview Attendance Stats Memoized
  const overviewAttendanceStats = useMemo(() => {
    if (students.length === 0) {
      return { present: 0, absent: 0, rate: 0 };
    }
    let present = 0;
    let absent = 0;
    students.forEach(s => {
      const key = s.studentId || `${s.class}_${s.roll}`;
      const status = attendanceMap[key];
      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
    });
    const totalMarked = present + absent;
    const rate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : (students.length > 0 ? 100 : 0);
    return { present, absent, rate };
  }, [students, attendanceMap]);

  // Overview Class-wise Boy/Girl Stats Memoized
  const classWiseStats = useMemo(() => {
    const classMap: Record<string, { boys: number; girls: number }> = {};
    availableClassNames.forEach(cls => {
      classMap[normalizeClassName(cls)] = { boys: 0, girls: 0 };
    });

    let totalBoys = 0;
    let totalGirls = 0;

    students.forEach(s => {
      const norm = normalizeClassName(s.class);
      if (!classMap[norm]) {
        classMap[norm] = { boys: 0, girls: 0 };
      }
      const g = (s.gender || '').trim().toLowerCase();
      if (g === 'f' || g === 'female' || g === 'ছাত্রী' || g === 'girl') {
        classMap[norm].girls++;
        totalGirls++;
      } else {
        classMap[norm].boys++;
        totalBoys++;
      }
    });

    let maxCount = 1;
    availableClassNames.forEach(cls => {
      const norm = normalizeClassName(cls);
      const b = classMap[norm]?.boys || 0;
      const g = classMap[norm]?.girls || 0;
      if (b > maxCount) maxCount = b;
      if (g > maxCount) maxCount = g;
    });

    const list = availableClassNames.map(cls => {
      const norm = normalizeClassName(cls);
      return {
        class: cls,
        boys: classMap[norm]?.boys || 0,
        girls: classMap[norm]?.girls || 0,
      };
    });

    let ratioStr = '0 : 0';
    if (totalGirls > 0) {
      ratioStr = `${(totalBoys / totalGirls).toFixed(1)} : 1`;
    } else if (totalBoys > 0) {
      ratioStr = `${totalBoys} : 0`;
    }

    return { list, totalBoys, totalGirls, maxCount, ratioStr };
  }, [students, availableClassNames]);

  // Attendance Tab Memoized
  const attendanceClassStudents = useMemo(() => {
    return students.filter(s => normalizeClassName(s.class) === normalizeClassName(attendanceClass));
  }, [students, attendanceClass]);

  const attendanceStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    attendanceClassStudents.forEach(s => {
      const status = attendanceMap[s.studentId || `${s.class}_${s.roll}`] || 'Present';
      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
    });
    return { present, absent };
  }, [attendanceClassStudents, attendanceMap]);

  // Vehicle Counts Map & Filter Memoized
  const vehicleCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach(s => {
      if (s.vehicle && s.vehicle !== 'No') {
        map[s.vehicle] = (map[s.vehicle] || 0) + 1;
      }
    });
    return map;
  }, [students]);

  const vehicleFilterStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedVehicleFilter === 'ALL') return !!(s.vehicle && s.vehicle !== 'No');
      return s.vehicle === selectedVehicleFilter;
    });
  }, [students, selectedVehicleFilter]);

  // Daybook Tab Memoized
  const daybookTodayReceipts = useMemo(() => {
    return feeReceipts.filter(r => r.date === daybookDate);
  }, [feeReceipts, daybookDate]);

  const daybookTodayExpenses = useMemo(() => {
    return expenses.filter(e => e.date === daybookDate);
  }, [expenses, daybookDate]);

  const daybookTotals = useMemo(() => {
    const feeCash = daybookTodayReceipts.filter(r => (r.paymentMode || 'Cash').toLowerCase() === 'cash').reduce((sum, r) => sum + (r.amount || 0), 0);
    const feeTotal = daybookTodayReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const feeOnline = feeTotal - feeCash;

    const totalFeeAllTime = feeReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);

    const expCash = daybookTodayExpenses.filter(e => (e.paymentMode || 'Cash').toLowerCase() === 'cash').reduce((sum, e) => sum + (e.amount || 0), 0);
    const expTotal = daybookTodayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const expOnline = expTotal - expCash;

    const netCashToday = feeTotal - expTotal;
    const totalNetFund = totalFeeAllTime - expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return { feeCash, feeOnline, feeTotal, totalFeeAllTime, expCash, expOnline, expTotal, netCashToday, totalNetFund };
  }, [daybookTodayReceipts, daybookTodayExpenses, feeReceipts, expenses]);

  // Dues Filtered Students Memoized
  const duesFilteredStudents = useMemo(() => {
    return students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      return duesClassFilter === 'ALL' || normalizeClassName(st.class) === normalizeClassName(duesClassFilter);
    }).sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [students, showInactiveStudents, duesClassFilter]);

  // Selected Mark Class Students Memoized
  const selectedMarkClassStudents = useMemo(() => {
    return students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      return normalizeClassName(st.class) === normalizeClassName(selectedMarkClass);
    }).sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [students, showInactiveStudents, selectedMarkClass]);

  // Marksheet / Admit / ID Card Students Memoized
  const marksheetClassStudents = useMemo(() => {
    return students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      return normalizeClassName(st.class) === normalizeClassName(marksheetClass);
    }).sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [students, showInactiveStudents, marksheetClass]);

  const idCardClassStudents = useMemo(() => {
    return students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      return idCardClass === 'ALL' || normalizeClassName(st.class) === normalizeClassName(idCardClass);
    }).sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [students, showInactiveStudents, idCardClass]);

  const admitClassStudents = useMemo(() => {
    return students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      return normalizeClassName(st.class) === normalizeClassName(admitClass);
    }).sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [students, showInactiveStudents, admitClass]);

  // Memoized Result Table Data & True Score Rank Calculation
  const resultSummaryData = useMemo(() => {
    const activeClassSubjects = getEffectiveSubjectsForClass(idCardClass, printHubExam);
    const maxMark = getExamMaxMark(printHubExam);

    const filtered = students.filter(st => {
      if (!st) return false;
      if (!showInactiveStudents && st.isActive === false) return false;
      return idCardClass === 'ALL' || normalizeClassName(st.class) === normalizeClassName(idCardClass);
    });

    // Calculate marks with O(1) marksLookupMap
    const calculated = filtered.map(st => {
      const stNormClass = normalizeClassName(st.class);
      const scores = activeClassSubjects.map(sub => {
        const key = `${stNormClass}|${printHubExam}|${sub.toUpperCase()}|${st.roll}`;
        const markObj = marksLookupMap.get(key);
        if (markObj && markObj.markObtain !== undefined && markObj.markObtain !== null) {
          return Number(markObj.markObtain);
        }
        return 0;
      });

      const totalObtained = scores.reduce((sum, s) => sum + s, 0);
      const totalFullPossible = activeClassSubjects.length * maxMark;
      const percentage = totalFullPossible > 0 ? Math.round((totalObtained / totalFullPossible) * 100) : 0;

      return {
        student: st,
        scores,
        totalObtained,
        totalFullPossible,
        percentage,
        rank: 1
      };
    });

    // Sort descending by totalObtained to compute actual ranks
    const scoreSorted = [...calculated].sort((a, b) => {
      if (b.totalObtained !== a.totalObtained) {
        return b.totalObtained - a.totalObtained;
      }
      return Number(a.student.roll) - Number(b.student.roll);
    });

    let currentRank = 1;
    scoreSorted.forEach((item, idx) => {
      if (idx > 0 && item.totalObtained < scoreSorted[idx - 1].totalObtained) {
        currentRank = idx + 1;
      }
      item.rank = currentRank;
    });

    // Display ordered by roll number ascending
    const displayOrdered = [...calculated].sort((a, b) => Number(a.student.roll) - Number(b.student.roll));

    return {
      activeClassSubjects,
      maxMark,
      studentResults: displayOrdered
    };
  }, [printHubSubTab, idCardClass, printHubExam, students, showInactiveStudents, marksLookupMap, classSubjectsConfig, evalFullMarks]);

  const [printHubBatchPage, setPrintHubBatchPage] = useState<number>(1);
  const [printHubBatchSize, setPrintHubBatchSize] = useState<number | 'ALL'>(50);

  // Auto-reset batch page to 1 when filters or subtabs change
  useEffect(() => {
    setPrintHubBatchPage(1);
  }, [idCardClass, marksheetClass, printHubSubTab, printHubExam, marksheetSelectionMode, idCardSelectionMode, printHubBatchSize]);

  // Filtered Students for Print Hub (ID Card, Admit, Marksheet, Result, Lists)
  const filteredPrintStudents = useMemo(() => {
    if (printHubSubTab === 'marksheet') {
      return filterPrintStudents(
        students,
        marksheetSelectionMode,
        marksheetClass,
        marksheetSingleRoll,
        marksheetSelectedKeys,
        showInactiveStudents
      );
    }
    if (printHubSubTab === 'idcard') {
      return filterPrintStudents(
        students,
        idCardSelectionMode,
        idCardClass,
        idCardSingleRoll,
        idCardSelectedKeys,
        showInactiveStudents
      );
    }
    if (printHubSubTab === 'admit') {
      return filterPrintStudents(
        students,
        idCardSelectionMode,
        idCardClass,
        idCardSingleRoll,
        idCardSelectedKeys,
        showInactiveStudents
      );
    }
    return filterPrintStudents(
      students,
      idCardSelectionMode,
      idCardClass,
      idCardSingleRoll,
      idCardSelectedKeys,
      showInactiveStudents
    );
  }, [
    students,
    showInactiveStudents,
    idCardClass,
    marksheetClass,
    printHubSubTab,
    marksheetSelectionMode,
    marksheetSingleRoll,
    marksheetSelectedKeys,
    idCardSelectionMode,
    idCardSingleRoll,
    idCardSelectedKeys
  ]);

  const visiblePrintStudents = useMemo(() => {
    if (printHubBatchSize === 'ALL' || filteredPrintStudents.length <= printHubBatchSize) {
      return filteredPrintStudents;
    }
    const startIndex = (printHubBatchPage - 1) * printHubBatchSize;
    return filteredPrintStudents.slice(startIndex, startIndex + printHubBatchSize);
  }, [filteredPrintStudents, printHubBatchPage, printHubBatchSize]);

  // Filtered Notices Memoized
  const filteredNotices = useMemo(() => {
    return notices.filter(n => {
      if (!showInactiveNotices && n.isActive === false) return false;
      if (noticeCategoryFilter !== 'ALL' && (n.category || n.priority) !== noticeCategoryFilter) return false;
      return true;
    });
  }, [notices, showInactiveNotices, noticeCategoryFilter]);

  // Filtered Teachers Memoized
  const filteredTeachers = useMemo(() => {
    const q = deferredTeacherSearchQuery.trim().toLowerCase();
    return teachersList.filter((t: Teacher) => {
      if (!t) return false;
      if (!showInactiveTeachers && t.isActive === false) return false;
      if (q) {
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchPhone = (t.phone || '').includes(q);
        const matchQual = (t.qualification || '').toLowerCase().includes(q);
        const matchSub = (t.assignedSubjects || []).some((s: any) => (typeof s === 'string' ? s : s.subject || '').toLowerCase().includes(q));
        if (!matchName && !matchPhone && !matchQual && !matchSub) return false;
      }
      return true;
    });
  }, [teachersList, showInactiveTeachers, deferredTeacherSearchQuery]);

  const handleForceRefresh = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage({ type: 'success', text: 'ফায়ারস্টোর থেকে টাটকা ডেটা লোড করা হচ্ছে...' });
    try {
      const sts = await fetchSchoolStudentsFromFirestore(school.schoolId);
      if (sts && sts.length > 0) {
        const normalized = sts.map((st: Student) => ({ ...st, class: normalizeClassName(st.class) }));
        setStudents(normalized);
        safeLocalStorageSetItem(`students_${school.schoolId}`, JSON.stringify(normalized));
      }
      const totalsDoc = await fetchFeeTotalsFromFirestore(school.schoolId);
      if (totalsDoc) {
        setFeeTotals(totalsDoc);
      }
      const lastFetchKey = `last_students_fetch_${school.schoolId}`;
      safeLocalStorageSetItem(lastFetchKey, Date.now().toString());
      setSyncMessage({ type: 'success', text: 'সর্বশেষ নতুন ডাটা লোড সম্পন্ন হয়েছে!' });
    } catch {
      setSyncMessage({ type: 'error', text: 'রিফ্রেশ ব্যর্থ হয়েছে, সাম্প্রতিক লোকাল ডাটা ব্যবহার করা হচ্ছে।' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  // Student Role Handling: Direct full-featured Student Portal rendering
  const loggedInStudent = useMemo(() => {
    if (!isStudent) return null;
    const found = students.find(st => {
      if (session?.studentRoll && Number(st.roll) === Number(session.studentRoll)) {
        if (session.studentClass && normalizeClassName(st.class) === normalizeClassName(session.studentClass)) {
          return true;
        }
      }
      if (st.phone && session?.phone && st.phone.replace(/\D/g, '') === session.phone.replace(/\D/g, '')) {
        return true;
      }
      if (st.studentId && session?.username && (session.username.includes(st.studentId) || st.studentId.includes(session.username))) {
        return true;
      }
      return false;
    });
    return found || (session?.studentClass ? students.find(st => normalizeClassName(st.class) === normalizeClassName(session.studentClass)) : null) || students[0];
  }, [students, isStudent, session]);

  // Restrict teacher active tab to allowed tabs only (strictly NO Print Hub or Finance)
  useEffect(() => {
    if (isTeacher) {
      const allowedTeacherTabs = ['overview', 'students', 'exams', 'routine', 'notices'];
      if (!allowedTeacherTabs.includes(activeTab)) {
        setActiveTab('overview');
      }
    }
  }, [isTeacher, activeTab]);

  // Auto-adjust selected class filter in students tab for teacher
  useEffect(() => {
    if (isTeacher && teacherPermittedClasses.length > 0) {
      if (selectedClassFilter === 'ALL' || !teacherPermittedClasses.some(c => normalizeClassName(c) === normalizeClassName(selectedClassFilter))) {
        setSelectedClassFilter(teacherPermittedClasses[0]);
      }
    }
  }, [isTeacher, teacherPermittedClasses, selectedClassFilter]);

  // Auto-adjust mark entry class and subject for teacher
  useEffect(() => {
    if (isTeacher && teacherPermittedMarkClasses.length > 0) {
      if (!teacherPermittedMarkClasses.some(c => normalizeClassName(c) === normalizeClassName(selectedMarkClass))) {
        setSelectedMarkClass(teacherPermittedMarkClasses[0]);
      }
    }
  }, [isTeacher, teacherPermittedMarkClasses, selectedMarkClass]);

  useEffect(() => {
    if (isTeacher && teacherPermittedSubjectsForSelectedClass.length > 0) {
      if (!teacherPermittedSubjectsForSelectedClass.includes(selectedSubject)) {
        setSelectedSubject(teacherPermittedSubjectsForSelectedClass[0]);
      }
    }
  }, [isTeacher, teacherPermittedSubjectsForSelectedClass, selectedSubject]);

  // Auto-adjust attendance class for teacher
  useEffect(() => {
    if (isTeacher && teacherPermittedClasses.length > 0) {
      if (!teacherPermittedClasses.some(c => normalizeClassName(c) === normalizeClassName(attendanceClass))) {
        setAttendanceClass(teacherPermittedClasses[0]);
      }
    }
  }, [isTeacher, teacherPermittedClasses, attendanceClass]);

  // Early return for student role to ensure 100% strict isolation
  if (isStudent && loggedInStudent) {
    return (
      <StudentPortalView
        school={school}
        student={loggedInStudent}
        marks={marks}
        routines={routineEntries}
        notices={notices}
        feeReceipts={feeReceipts}
        session={session!}
        onLogout={onLogout || onBackToLanding}
      />
    );
  }

  // Define dynamic tabs based on role - Print Hub is strictly removed for teachers
  const sidebarTabs = isTeacher ? [
    { id: 'overview', label: 'Teacher Portal (শিক্ষক পোর্টাল)', icon: GraduationCap },
    { id: 'students', label: 'Students (শিক্ষার্থী ও উপস্থিতি)', icon: Users },
    { id: 'exams', label: 'Mark Entry (মার্কস এন্ট্রি)', icon: Award },
    { id: 'routine', label: 'Routine (স্কুল রুটিন)', icon: Calendar },
    { id: 'notices', label: 'Notices (নোটিশ বোর্ড)', icon: Bell }
  ] : [
    { id: 'overview', label: 'Dashboard (ড্যাশবোর্ড)', icon: GraduationCap },
    { id: 'students', label: 'Students (ছাত্র-ছাত্রী)', icon: Users },
    { id: 'routine', label: 'Routine (ক্লাস রুটিন)', icon: Calendar },
    { id: 'fees', label: 'Fee Collection (ফি)', icon: CreditCard },
    { id: 'exams', label: 'Exam (পরীক্ষা ও রেজাল্ট)', icon: Award },
    { id: 'teachers', label: 'Teacher (শিক্ষক)', icon: User },
    { id: 'idcard', label: 'Print Hub (প্রিন্ট হাব)', icon: Printer },
    { id: 'certificates', label: 'Certificate (সার্টিফিকেট)', icon: FileText },
    { id: 'settings', label: 'Settings (সেটিংস)', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Navigation Header */}
      <header className="no-print border-b border-slate-800 bg-slate-950 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title={isTeacher ? "লগআউট করুন" : "ফিরে যান"}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white">{school.name}</h1>
                <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                  {school.schoolId}
                </span>
                {isTeacher && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    শিক্ষক প্যানেল
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{school.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isOnline ? 'ক্লাউড ডেটাবেজ অন' : 'অফলাইন/লোকাল মোড'}
            </span>

            <button
              onClick={handleForceRefresh}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="ফায়ারস্টোর থেকে টাটকা ডেটা রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ (Refresh)</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
              {session && (
                <div className="hidden sm:block text-right mr-1">
                  <div className="font-bold text-white leading-tight">{session.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {session.role === 'SUPER_ADMIN' ? 'সুপার এডমিন' : session.role === 'TEACHER' ? 'সহকারী শিক্ষক' : 'স্কুল এডমিন'}
                  </div>
                </div>
              )}
              <button
                onClick={onLogout || onBackToLanding}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>লগআউট (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sync Status Banner */}
      {syncMessage && (
        <div className={`no-print px-4 py-2 text-xs text-center border-b ${
          syncMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        }`}>
          {syncMessage.text}
        </div>
      )}

      {/* Main Dashboard Layout with 3D Fixed Vertical Sidebar */}
      <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-6 relative">
        {/* 3D Fixed Vertical Navigation Sidebar */}
        <aside className="no-print lg:w-64 shrink-0 lg:sticky lg:top-20 lg:self-start z-40 w-full">
          <div className="bg-slate-950/95 backdrop-blur-md border-2 border-slate-800/90 rounded-3xl p-3.5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                  {isTeacher ? 'শিক্ষক মেনু' : 'মেইন নেভিগেশন'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">3D MENU</span>
            </div>

            {/* Vertical Stack of Menu Items */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col gap-2.5">
              {sidebarTabs.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`group w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                      active
                        ? 'bg-gradient-to-r from-cyan-500 via-cyan-600 to-teal-600 text-slate-950 font-black border-2 border-cyan-300 shadow-[0_10px_25px_rgba(6,182,212,0.45),inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(0,0,0,0.4)] transform -translate-y-0.5 ring-2 ring-cyan-400/40'
                        : 'bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 text-slate-300 border border-slate-800/90 hover:border-cyan-500/50 hover:text-white shadow-[0_6px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_0_rgba(0,0,0,0.5)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.7)]'
                    }`}
                  >
                    <div className={`p-2 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      active
                        ? 'bg-slate-950 text-cyan-300 shadow-md border border-cyan-400/50'
                        : 'bg-slate-950/80 text-cyan-400 border border-slate-800 group-hover:border-cyan-500/40'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Logout Button in Sidebar Bottom */}
            <div className="pt-2 border-t border-slate-800 hidden lg:block">
              <button
                onClick={onLogout || onBackToLanding}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-rose-950/80 text-rose-300 border border-rose-800/80 hover:bg-rose-600 hover:text-white shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all cursor-pointer"
                title="লগআউট করুন"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout (লগআউট)</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Tab Contents */}
        <main className="flex-1 min-w-0 space-y-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          isTeacher ? (
            /* TEACHER PORTAL OVERVIEW */
            <div className="space-y-6">
              {/* Teacher Profile Card */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-xl border border-cyan-400/40 shrink-0">
                    {loggedInTeacher?.name ? loggedInTeacher.name.substring(0, 1) : (session?.name ? session.name.substring(0, 1) : 'T')}
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                      <h2 className="text-xl sm:text-2xl font-black text-white">{loggedInTeacher?.name || session?.name}</h2>
                      <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                        অনুমোদিত শিক্ষক (Authorized Teacher)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">শিক্ষক আইডি:</span>
                        <strong className="text-cyan-300 font-mono">{loggedInTeacher?.teacherId || loggedInTeacher?.id || session?.username}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">পদবী:</span>
                        <strong className="text-white">{loggedInTeacher?.designation || 'সহকারী শিক্ষক (Assistant Teacher)'}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">মোবাইল:</span>
                        <strong className="text-emerald-300 font-mono">{loggedInTeacher?.phone || session?.phone || 'N/A'}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">যোগ্যতা:</span>
                        <strong className="text-white">{loggedInTeacher?.qualification || 'বি.এ / বি.এস.সি / বি.এড'}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">বিদ্যালয়:</span>
                        <strong className="text-amber-300">{school.name}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">ইমেইল:</span>
                        <strong className="text-white">{loggedInTeacher?.email || 'N/A'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PERMISSION CARDS GRID: Attendance & Marks Entry Permissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Permitted Classes for Attendance & Student Management */}
                <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <CheckSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-sm">হাজিরা ও ছাত্র তালিকার অনুমোদিত শ্রেণী</h3>
                        <p className="text-[11px] text-slate-400">আপনার হাজিরা দেওয়ার ও শিক্ষার্থী দেখার অনুমোদিত ক্লাস</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('students');
                        setStudentSubTab('attendance');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 cursor-pointer"
                    >
                      হাজিরা নিন &rarr;
                    </button>
                  </div>

                  <div className="space-y-2">
                    {teacherPermittedClasses.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {teacherPermittedClasses.map(cls => {
                          const count = classStudentCounts[normalizeClassName(cls)] || 0;
                          return (
                            <div 
                              key={cls}
                              onClick={() => {
                                setAttendanceClass(cls);
                                setSelectedClassFilter(cls);
                                setActiveTab('students');
                                setStudentSubTab('attendance');
                              }}
                              className="p-3 rounded-xl bg-slate-950/80 border border-cyan-900/40 hover:border-cyan-500/80 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] group"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 group-hover:animate-ping"></span>
                                <span className="font-bold text-white text-xs">{cls}</span>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                                {count} জন ছাত্র
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        কোনো নির্দিষ্ট ক্লাস অ্যাসাইন করা হয়নি।
                      </div>
                    )}
                  </div>
                </div>

                {/* Permitted Classes & Subjects for Marks Entry */}
                <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-sm">নম্বর ইনপুটের অনুমোদিত বিষয় ও শ্রেণী</h3>
                        <p className="text-[11px] text-slate-400">আপনার নম্বর এন্ট্রি করার অনুমোদিত বিষয়সমূহ</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('exams');
                        setExamSubTab('mark_entry');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 cursor-pointer"
                    >
                      নম্বর এন্ট্রি &rarr;
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {teacherPermittedSubjectPairs.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {teacherPermittedSubjectPairs.map((pair, idx) => (
                          <div 
                            key={`${pair.class}_${pair.subject}_${idx}`}
                            onClick={() => {
                              setSelectedMarkClass(pair.class);
                              setSelectedSubject(pair.subject);
                              setActiveTab('exams');
                              setExamSubTab('mark_entry');
                            }}
                            className="p-3 rounded-xl bg-slate-950/80 border border-indigo-900/40 hover:border-indigo-500/80 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] group"
                          >
                            <div>
                              <span className="font-bold text-white text-xs block group-hover:text-indigo-300">{pair.subject}</span>
                              <span className="text-[10px] text-slate-400">শ্রেণী: {pair.class}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                              নম্বর দিন
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        কোনো নির্দিষ্ট বিষয় অ্যাসাইন করা হয়নি।
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions & Routine Schedule */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Routine Schedule */}
                <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span>আমার ক্লাস রুটিন ও সময়সূচী</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('routine')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                    >
                      সম্পূর্ণ রুটিন &rarr;
                    </button>
                  </div>

                  {teacherTodayClasses.length > 0 ? (
                    <div className="space-y-2.5">
                      {teacherTodayClasses.slice(0, 5).map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                          <div>
                            <span className="font-bold text-white block">{r.subject}</span>
                            <span className="text-[11px] text-slate-400">শ্রেণী: {r.class} | {r.day}</span>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold block">
                              পিরিয়ড {r.period}
                            </span>
                            <span className="text-[10px] text-slate-400">{r.timeSlot || '১০:০০ - ১০:৪৫'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <span>কোনো রুটিন অ্যাসাইন করা পাওয়া যায়নি।</span>
                    </div>
                  )}
                </div>

                {/* Teacher Quick Shortcuts */}
                <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>শিক্ষক কুইক অ্যাকশন</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setActiveTab('students');
                        setStudentSubTab('attendance');
                      }}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500 text-left transition-all cursor-pointer group"
                    >
                      <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 w-fit mb-2 group-hover:scale-110 transition-transform">
                        <CheckSquare className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-white text-xs">দৈনিক হাজিরা নিন</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">অনুমোদিত শ্রেণীর হাজিরা দিন</p>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('exams');
                        setExamSubTab('mark_entry');
                      }}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-left transition-all cursor-pointer group"
                    >
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-2 group-hover:scale-110 transition-transform">
                        <Award className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-white text-xs">নম্বর এন্ট্রি করুন</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">অনুমোদিত বিষয়ের মার্কস ইনপুট</p>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('students');
                        setStudentSubTab('list');
                      }}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500 text-left transition-all cursor-pointer group"
                    >
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-2 group-hover:scale-110 transition-transform">
                        <Users className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-white text-xs">শিক্ষার্থী তালিকা ও এডিট</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">অনুমোদিত ছাত্রদের তথ্য সম্পাদন</p>
                    </button>

                    <button
                      onClick={() => setActiveTab('notices')}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-left transition-all cursor-pointer group"
                    >
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 w-fit mb-2 group-hover:scale-110 transition-transform">
                        <Bell className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-white text-xs">স্কুল নোটিশ বোর্ড</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">বিদ্যালয়ের সকল নোটিশ দেখুন</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ADMIN OVERVIEW */
            <div className="space-y-8">
            {/* Top 5 Metrics Row matching Screenshot 1 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Total Enrolled (মোট শিক্ষার্থী)</div>
                  <div className="text-2xl font-black text-white mt-0.5 flex items-baseline gap-1.5">
                    <span>{activeStudentsCount}</span>
                    {inactiveStudentsCount > 0 && (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.2 rounded-full">
                        +{inactiveStudentsCount} নিষ্ক্রিয়
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Active Students</div>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    {activeStudentsCount}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">De-active Students</div>
                  <div className="text-2xl font-black text-rose-400 mt-0.5 flex items-center gap-2">
                    <span>{inactiveStudentsCount}</span>
                    {inactiveStudentsCount > 0 && !isTeacher && (
                      <button
                        onClick={handlePurgeAllInactiveStudents}
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer transition-all"
                        title="সমস্ত নিষ্ক্রিয় শিক্ষার্থী স্থায়ীভাবে মুছুন"
                      >
                        ক্লিন
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Attendance Today</div>
                  <div className="text-2xl font-black text-cyan-400 mt-0.5">{overviewAttendanceStats.present} <span className="text-xs font-semibold text-slate-400">Present</span></div>
                </div>
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between col-span-2 sm:col-span-1">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Total Fees Collected</div>
                  <div className="text-2xl font-black text-white mt-0.5">৳ {totalCollectedFees.toLocaleString()}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Attendance Donut Chart Card matching Screenshot 1 */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-extrabold text-white text-base">Today's Attendance Graph</h3>
                  <p className="text-xs text-slate-400">আজকের মোট উপস্থিত ও অনুপস্থিত ছাত্র-ছাত্রীর তুলনামূলক চিত্র</p>
                </div>
                <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>

              {/* Ring Chart Graphic */}
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-pink-500"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      strokeDasharray="100, 100"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-cyan-400"
                      strokeWidth="3.8"
                      strokeDasharray={`${overviewAttendanceStats.rate}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-2xl font-black text-white">{overviewAttendanceStats.rate}%</span>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Present</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-4 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-pink-500" />
                    <span className="text-slate-300">Absent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-cyan-400" />
                    <span className="text-slate-300">Present</span>
                  </div>
                </div>
              </div>

              {/* Bottom Attendance Readouts */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 text-center text-xs">
                <div>
                  <div className="text-lg font-black text-cyan-400">{overviewAttendanceStats.present}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Present</div>
                </div>
                <div>
                  <div className="text-lg font-black text-pink-500">{overviewAttendanceStats.absent}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Absent</div>
                </div>
                <div>
                  <div className="text-lg font-black text-white">{overviewAttendanceStats.rate}%</div>
                  <div className="text-[11px] text-slate-400 font-medium">Attendance Rate</div>
                </div>
              </div>
            </div>

            {/* Boy / Girl Class-wise Bar Chart matching Screenshot 1 */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-extrabold text-white text-base">Boy / Girl Class-wise Stats</h3>
                  <p className="text-xs text-slate-400">শ্রেণিভিত্তিক ছাত্র ও ছাত্রীদের অনুপাত ও মোট শিক্ষার্থীর তালিকা</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-cyan-400" />
                    <span className="text-slate-300">Boys (ছাত্র)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-pink-500" />
                    <span className="text-slate-300">Girls (ছাত্রী)</span>
                  </div>
                </div>
              </div>

              {/* Class-wise Bar Chart Visual */}
              <div className="h-48 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-800">
                {classWiseStats.list.map((item, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <div className="w-full flex justify-center items-end gap-1 h-36">
                      <div 
                        style={{ height: `${item.boys > 0 ? (item.boys / classWiseStats.maxCount) * 100 : 0}%` }} 
                        className="w-2.5 bg-cyan-400 rounded-t-sm transition-all group-hover:brightness-125 min-h-[2px]" 
                        title={`${item.class} - Boys (ছাত্র): ${item.boys}`}
                      />
                      <div 
                        style={{ height: `${item.girls > 0 ? (item.girls / classWiseStats.maxCount) * 100 : 0}%` }} 
                        className="w-2.5 bg-pink-500 rounded-t-sm transition-all group-hover:brightness-125 min-h-[2px]" 
                        title={`${item.class} - Girls (ছাত্রী): ${item.girls}`}
                      />
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400 truncate max-w-[45px] text-center">{item.class}</span>
                  </div>
                ))}
              </div>

              {/* Bar Chart Readout Footer */}
              <div className="flex items-center justify-between pt-4 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Total Boys: <strong className="text-white">{classWiseStats.totalBoys}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  <span>Total Girls: <strong className="text-white">{classWiseStats.totalGirls}</strong></span>
                </div>
                <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 font-mono text-[11px]">
                  Ratio: <strong className="text-white">{classWiseStats.ratioStr}</strong>
                </div>
              </div>
            </div>

            {/* Interactive 3D Menu Connect Cards matching Screenshot 1 */}
            <div>
              <h3 className="font-extrabold text-white text-base mb-4">Interactive 3D Menu Connect</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div 
                  onClick={() => setActiveTab('students')}
                  className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/20 hover:border-indigo-500 p-5 rounded-2xl shadow-2xl relative overflow-hidden cursor-pointer group transition-all"
                >
                  <div className="absolute right-3 top-2 text-5xl font-black text-slate-800/40 group-hover:text-indigo-500/20 transition-colors pointer-events-none">
                    01
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-3">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm mb-1">Students Menu</h4>
                  <p className="text-[11px] text-slate-400">ভর্তি, এডিট, হাজিরা ও প্রিন্ট →</p>
                </div>

                <div 
                  onClick={() => setActiveTab('routine')}
                  className="bg-gradient-to-br from-slate-900 to-teal-950/40 border border-teal-500/30 hover:border-teal-400 p-5 rounded-2xl shadow-2xl relative overflow-hidden cursor-pointer group transition-all ring-1 ring-teal-500/20"
                >
                  <div className="absolute right-3 top-2 text-5xl font-black text-slate-800/40 group-hover:text-teal-500/20 transition-colors pointer-events-none">
                    02
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center mb-3">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm mb-1">Routine (রুটিন)</h4>
                  <p className="text-[11px] text-teal-300">পিরিয়ড, টিফিন ও শিক্ষক ক্লা্যাশ ডিটেক্টর →</p>
                </div>

                <div 
                  onClick={() => setActiveTab('fees')}
                  className="bg-gradient-to-br from-slate-900 to-purple-950/40 border border-purple-500/20 hover:border-purple-500 p-5 rounded-2xl shadow-2xl relative overflow-hidden cursor-pointer group transition-all"
                >
                  <div className="absolute right-3 top-2 text-5xl font-black text-slate-800/40 group-hover:text-purple-500/20 transition-colors pointer-events-none">
                    03
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mb-3">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm mb-1">Fees Menu</h4>
                  <p className="text-[11px] text-slate-400">ফি কালেকশন, বকেয়া ট্র্যাক →</p>
                </div>

                <div 
                  onClick={() => setActiveTab('exams')}
                  className="bg-gradient-to-br from-slate-900 to-amber-950/40 border border-amber-500/20 hover:border-amber-500 p-5 rounded-2xl shadow-2xl relative overflow-hidden cursor-pointer group transition-all"
                >
                  <div className="absolute right-3 top-2 text-5xl font-black text-slate-800/40 group-hover:text-amber-500/20 transition-colors pointer-events-none">
                    04
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3">
                    <Award className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm mb-1">Exam Menu</h4>
                  <p className="text-[11px] text-slate-400">নম্বর এন্ট্রি ও রেজাল্ট →</p>
                </div>

                <div 
                  onClick={() => setActiveTab('settings')}
                  className="bg-gradient-to-br from-slate-900 to-cyan-950/40 border border-cyan-500/20 hover:border-cyan-500 p-5 rounded-2xl shadow-2xl relative overflow-hidden cursor-pointer group transition-all"
                >
                  <div className="absolute right-3 top-2 text-5xl font-black text-slate-800/40 group-hover:text-cyan-500/20 transition-colors pointer-events-none">
                    05
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-3">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm mb-1">Settings</h4>
                  <p className="text-[11px] text-slate-400">শিট কানেক্ট ও কাস্টমাইজেশন →</p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {/* Header Banner matching Image 1 & 2 */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    Student Directory <span className="text-cyan-400 font-normal">/ ছাত্র-ছাত্রী পোর্টাল</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    ভর্তি, হাজিরা, ছাত্র তালিকা আপডেট ও প্রিন্ট পোর্টাল
                  </p>
                </div>
              </div>

              {/* Sub-action pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button 
                  onClick={() => setStudentSubTab('list')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    studentSubTab === 'list' 
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' 
                      : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Student List (শিক্ষার্থী তালিকা)
                </button>
                {!isTeacher && (
                  <>
                    <button 
                      onClick={() => {
                      const nextClass = selectedClassFilter !== 'ALL' ? selectedClassFilter : 'Class I';
                      const classStudents = students.filter(s => normalizeClassName(s.class) === normalizeClassName(nextClass));
                      const maxRoll = classStudents.reduce((max, s) => Math.max(max, Number(s.roll) || 0), 0);
                      const nextRoll = maxRoll + 1;
                      setEditingStudent(null);
                      setStudentFormData({ 
                        class: nextClass, 
                        roll: nextRoll, 
                        studentId: `STU-${getAcademicYear(school)}-${String(nextRoll).padStart(3, '0')}`,
                        name: '', 
                        fatherName: '', 
                        govtSchoolName: '', 
                        gender: 'Male', 
                        address: '', 
                        phone: '', 
                        monthlyFee: 350, 
                        status: 'Active', 
                        vehicle: 'No' 
                      });
                      setIsStudentModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-cyan-800 text-cyan-300 bg-slate-900/80 hover:bg-slate-800 font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Admit Student (+ভর্তি)
                  </button>
                  <button
                    onClick={() => setIsCsvImportModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl border border-emerald-500/50 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    title="Google Sheet বা CSV ফাইল থেকে শিক্ষার্থী তালিকা এক ক্লিকে ইম্পোর্ট করুন"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> CSV Import (ইম্পোর্ট)
                  </button>
                </>
                )}
                <button 
                  onClick={() => setStudentSubTab('attendance')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    studentSubTab === 'attendance'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-bold'
                      : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Daily Attendance (হাজিরা)
                </button>
                {!isTeacher && (
                  <>
                    <button 
                      onClick={() => setStudentSubTab('vehicle')}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        studentSubTab === 'vehicle'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-bold'
                          : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                      }`}
                    >
                      Vehicle Students (গাড়ি ও যাতায়াত)
                    </button>
                    <button 
                      onClick={() => setStudentSubTab('routine')}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        studentSubTab === 'routine'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-bold'
                          : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                      }`}
                    >
                      Class Routine (শ্রেণী রুটিন)
                    </button>
                    <button 
                      onClick={() => setStudentSubTab('notices')}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        studentSubTab === 'notices'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-bold'
                          : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                      }`}
                    >
                      Notice Board (নোটিশ বোর্ড)
                    </button>
                    <button 
                      onClick={() => setStudentSubTab('printhub')}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        studentSubTab === 'printhub'
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                          : 'border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                      }`}
                    >
                      Print Hub (প্রিন্ট পোর্টাল) 🖨️
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* SUB TAB CONTENT */}
            {studentSubTab === 'list' && (
              <>
                {/* Filter Bar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                    {/* Class Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 shrink-0">Class:</span>
                      <select
                        value={selectedClassFilter}
                        onChange={e => {
                          setSelectedClassFilter(e.target.value);
                          setSelectedSectionFilter('ALL');
                        }}
                        className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-bold cursor-pointer"
                      >
                        {isTeacher ? (
                          teacherPermittedClasses.map(cls => {
                            const count = classStudentCounts[normalizeClassName(cls)] || 0;
                            return (
                              <option key={cls} value={cls}>{cls} ({count} জন)</option>
                            );
                          })
                        ) : (
                          <>
                            <option value="ALL">ALL CLASSES ({students.filter(s => showInactiveStudents || s.isActive !== false).length} জন)</option>
                            {availableClassNames.map(cls => {
                              const count = classStudentCounts[normalizeClassName(cls)] || 0;
                              return (
                                <option key={cls} value={cls}>{cls} ({count} জন)</option>
                              );
                            })}
                          </>
                        )}
                      </select>
                    </div>

                    {/* Section Filter (Conditional on selected class having sections) */}
                    {(() => {
                      const currentClassConfig = availableClasses.find(c => normalizeClassName(c.name) === normalizeClassName(selectedClassFilter));
                      const configuredSections = currentClassConfig?.sections && currentClassConfig.sections.length > 0 ? currentClassConfig.sections : [];
                      if (selectedClassFilter !== 'ALL' && configuredSections.length > 0) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400 shrink-0">Section:</span>
                            <select
                              value={selectedSectionFilter}
                              onChange={e => setSelectedSectionFilter(e.target.value)}
                              className="px-3 py-2 bg-slate-950 border border-amber-600/50 rounded-xl text-xs text-amber-300 focus:outline-none focus:border-amber-400 font-bold cursor-pointer"
                            >
                              <option value="ALL">ALL SECTIONS</option>
                              {configuredSections.map(sec => (
                                <option key={sec} value={sec}>Section {sec}</option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 shrink-0">দেখাবেন:</span>
                      <select
                        value={pageSize}
                        onChange={e => setPageSize(Number(e.target.value))}
                        className="px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-bold cursor-pointer"
                      >
                        <option value={50}>৫০ জন / পৃষ্ঠা</option>
                        <option value={100}>১০০ জন / পৃষ্ঠা</option>
                        <option value={200}>২০০ জন / পৃষ্ঠা</option>
                        <option value={1000}>এক পেজে সব (ALL {filteredStudents.length} জন)</option>
                      </select>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="নাম, আইডি, রোল, পিতা বা ফোন..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 font-semibold flex items-center justify-between sm:justify-end gap-3 shrink-0 flex-wrap">
                    <span>মোট ফিল্টারকৃত: <strong className="text-cyan-400 font-black text-sm">{filteredStudents.length}</strong> জন</span>
                    {!isTeacher && (
                      <button
                        type="button"
                        onClick={() => setIsCsvImportModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
                        title="Google Sheet থেকে CSV ফাইল ইম্পোর্ট করুন"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        CSV Import
                      </button>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-400 font-bold bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                      <input 
                        type="checkbox" 
                        checked={showInactiveStudents} 
                        onChange={e => setShowInactiveStudents(e.target.checked)} 
                        className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      নিষ্ক্রিয় ছাত্র দেখান ({inactiveStudentsCount})
                    </label>
                  </div>
                </div>

                {/* Inactive Records Maintenance Banner */}
                {inactiveStudentsCount > 0 && !isTeacher && (
                  <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
                    <div className="flex items-center gap-2 text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        তালিকায় <strong>{inactiveStudentsCount} জন নিষ্ক্রিয় (Soft-deleted)</strong> শিক্ষার্থী রয়েছে।
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handlePurgeAllInactiveStudents}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg cursor-pointer transition-all shadow text-xs flex items-center gap-1"
                        title="সবগুলো নিষ্ক্রিয় রেকর্ড স্থায়ীভাবে ডেটাবেস থেকে মুছে ফেলুন"
                      >
                        <Trash2 className="w-3 h-3" />
                        সব নিষ্ক্রিয় স্থায়ীভাবে মুছুন
                      </button>
                    </div>
                  </div>
                )}

                {/* Students Table & Mobile Cards */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  {/* Mobile Card List View (Visible on small screens < md) */}
                  <div className="block md:hidden divide-y divide-slate-800/80">
                    {currentPageStudents.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        কোন শিক্ষার্থী পাওয়া যায়নি।
                      </div>
                    ) : (
                      currentPageStudents.map((st, idx) => (
                        <div key={`m_${st.class}_${st.roll}_${idx}`} className={`p-3.5 space-y-2.5 ${st.isActive === false ? 'opacity-75 bg-rose-950/20' : ''}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {/* Student Photo Avatar */}
                              <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center font-bold text-cyan-300 text-sm overflow-hidden shrink-0 shadow">
                                {st.photo ? (
                                  <img src={formatPhotoUrl(st.photo)} alt={st.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                                ) : (
                                  st.name.substring(0, 1)
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-cyan-400 text-xs">#{st.roll}</span>
                                  <span className="text-white font-bold text-xs">{st.name}</span>
                                  {st.isActive === false && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300">Inactive</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span>{st.class}</span>
                                  {st.section && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      Sec {st.section}
                                    </span>
                                  )}
                                  {st.fatherName ? <span>• পিতা: {st.fatherName}</span> : ''}
                                </p>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              st.gender === 'Female' || st.gender === 'Girl' 
                                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' 
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}>
                              {st.gender === 'Female' || st.gender === 'Girl' ? 'Girl' : 'Boy'}
                            </span>
                          </div>

                          {/* Mobile Contact & Address */}
                          <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                            <div>
                              {st.phone ? (
                                <a href={`tel:${st.phone}`} className="flex items-center gap-1 text-cyan-300 hover:underline">
                                  <Phone className="w-3 h-3 text-emerald-400" />
                                  {st.phone}
                                </a>
                              ) : (
                                <span className="text-slate-500">ফোন: -</span>
                              )}
                            </div>
                            {st.address && <div className="text-amber-200/90 truncate max-w-[140px]">{st.address}</div>}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                            {st.isActive === false ? (
                              !isTeacher && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleReactivateStudent(st)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
                                  >
                                    সক্রিয় করুন
                                  </button>
                                  <button
                                    onClick={() => handleHardDeleteStudent(st)}
                                    className="p-1.5 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg cursor-pointer"
                                    title="স্থায়ীভাবে ডিলিট করুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )
                            ) : (
                              <>
                                {!isTeacher && (
                                  <button
                                    onClick={() => openFeeModalForStudent(st)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
                                  >
                                    ফি জমা
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingStudent(st);
                                    setStudentFormData({ ...st });
                                    setIsStudentModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-300 bg-slate-800 hover:text-white rounded-lg cursor-pointer flex items-center gap-1 text-xs"
                                  title="তথ্য এডিট করুন"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                                  {isTeacher && <span className="text-[11px] text-cyan-300 font-bold">এডিট</span>}
                                </button>
                                {!isTeacher && (
                                  <button
                                    onClick={() => handleDeleteStudent(st)}
                                    className="p-1.5 text-rose-400 bg-rose-500/10 hover:text-rose-300 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-300 uppercase font-bold border-b border-slate-800 text-[11px]">
                        <tr>
                          <th className="px-3.5 py-3.5">ROLL</th>
                          <th className="px-3.5 py-3.5">STUDENT NAME</th>
                          <th className="px-3.5 py-3.5">CLASS</th>
                          <th className="px-3.5 py-3.5 text-center">PHOTO</th>
                          <th className="px-3.5 py-3.5">FATHER NAME</th>
                          <th className="px-3.5 py-3.5">ADDRESS / ঠিকানা</th>
                          <th className="px-3.5 py-3.5">PHONE / মোবাইল</th>
                          <th className="px-3.5 py-3.5">GOV. SCHL</th>
                          <th className="px-3.5 py-3.5 text-center">GENDER / STATUS</th>
                          <th className="px-3.5 py-3.5 text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-slate-300">
                        {currentPageStudents.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-5 py-8 text-center text-slate-500 text-xs">
                              কোন শিক্ষার্থী পাওয়া যায়নি।
                            </td>
                          </tr>
                        ) : (
                          currentPageStudents.map((st, idx) => (
                            <tr key={`${st.class}_${st.roll}_${idx}`} className={`hover:bg-slate-800/40 transition-colors ${st.isActive === false ? 'bg-rose-950/20 opacity-75' : ''}`}>
                              <td className="px-3.5 py-3 font-mono font-bold text-cyan-400">#{st.roll}</td>
                              <td className="px-3.5 py-3 font-bold text-white text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-cyan-300 overflow-hidden shrink-0">
                                    {st.photo ? (
                                      <img src={formatPhotoUrl(st.photo)} alt={st.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                                    ) : (
                                      st.name.substring(0, 1)
                                    )}
                                  </div>
                                  <span>{st.name}</span>
                                  {st.isActive === false && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3.5 py-3 font-semibold text-slate-300">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{st.class}</span>
                                  {st.section && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      Sec {st.section}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3.5 py-3 text-center">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-xs font-bold text-cyan-300 overflow-hidden">
                                  {st.photo ? (
                                    <img src={formatPhotoUrl(st.photo)} alt={st.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                                  ) : (
                                    st.name.substring(0, 1)
                                  )}
                                </div>
                              </td>
                              <td className="px-3.5 py-3 text-slate-300 font-medium text-xs">{st.fatherName || '-'}</td>
                              <td className="px-3.5 py-3 text-amber-200/90 font-medium text-xs max-w-[150px] truncate" title={st.address || ''}>
                                {st.address || '-'}
                              </td>
                              <td className="px-3.5 py-3 text-cyan-300 font-mono text-[11px] font-semibold whitespace-nowrap">
                                {st.phone ? (
                                  <a href={`tel:${st.phone}`} className="hover:underline flex items-center gap-1.5 text-cyan-300">
                                    <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                    {st.phone}
                                  </a>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                                {st.govtSchoolName || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  st.gender === 'Female' || st.gender === 'Girl' 
                                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' 
                                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                }`}>
                                  {st.gender === 'Female' || st.gender === 'Girl' ? 'Girl' : 'Boy'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                {st.isActive === false ? (
                                  !isTeacher && (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleReactivateStudent(st)}
                                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
                                      >
                                        পুনরায় সক্রিয় করুন
                                      </button>
                                      <button
                                        onClick={() => handleHardDeleteStudent(st)}
                                        className="p-1.5 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-200 border border-rose-500/30 rounded-lg cursor-pointer"
                                        title="স্থায়ীভাবে (Hard Delete) মুছুন"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  <>
                                    {!isTeacher && (
                                      <button
                                        onClick={() => openFeeModalForStudent(st)}
                                        className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
                                      >
                                        ফি জমা
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingStudent(st);
                                        setStudentFormData({ ...st });
                                        setIsStudentModalOpen(true);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1"
                                      title="শিক্ষার্থী তথ্য এডিট করুন"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      {isTeacher && <span className="text-[11px] text-cyan-300 font-semibold">এডিট</span>}
                                    </button>
                                    {!isTeacher && (
                                      <button
                                        onClick={() => handleDeleteStudent(st)}
                                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                        title="নিষ্ক্রিয় (Soft Delete) করুন"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar */}
                  {totalPages > 1 && (
                    <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                      <div>
                        পৃষ্ঠা <strong className="text-cyan-400 font-extrabold">{studentPage}</strong> / <strong className="text-white font-bold">{totalPages}</strong> (মোট <strong className="text-white font-bold">{filteredStudents.length}</strong> জন শিক্ষার্থী)
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setStudentPage(prev => Math.max(1, prev - 1))}
                          disabled={studentPage === 1}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg font-bold cursor-pointer"
                        >
                          পূর্ববর্তী
                        </button>

                        {/* Page Number Buttons */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setStudentPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-black cursor-pointer transition-all ${
                              studentPage === p
                                ? 'bg-cyan-500 text-slate-950 shadow-md font-black scale-105'
                                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {p}
                          </button>
                        ))}

                        <button
                          onClick={() => setStudentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={studentPage === totalPages}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg font-bold cursor-pointer"
                        >
                          পরবর্তী
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* DAILY ATTENDANCE SUBTAB matching Image 2 */}
            {studentSubTab === 'attendance' && (
              <div className="space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                  {/* Top Bar matching Image 2 */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div>
                      <h3 className="font-extrabold text-white text-base">Take Class Attendance</h3>
                      <p className="text-xs text-slate-400">অনলাইন গুগল শিট হাজিরা রেজিস্টার</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">CLASS:</span>
                        <select
                          value={attendanceClass}
                          onChange={e => setAttendanceClass(e.target.value)}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
                        >
                          {availableClassNames.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={attendanceDate}
                          onChange={e => setAttendanceDate(e.target.value)}
                          className="bg-transparent text-xs text-white focus:outline-none font-bold"
                        />
                      </div>

                      {/* Counters */}
                      <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-extrabold">
                        Present (উপস্থিত): {attendanceStats.present}
                      </div>

                      <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-extrabold">
                        Absent (অনুপস্থিত): {attendanceStats.absent}
                      </div>

                      {/* Action Buttons */}
                      <button
                        onClick={() => {
                          const updated: Record<string, 'Present' | 'Absent'> = { ...attendanceMap };
                          attendanceClassStudents.forEach(s => {
                            updated[s.studentId || `${s.class}_${s.roll}`] = 'Present';
                          });
                          setAttendanceMap(updated);
                        }}
                        className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        Mark All Present
                      </button>

                      <button
                        onClick={() => {
                          const updated: Record<string, 'Present' | 'Absent'> = { ...attendanceMap };
                          attendanceClassStudents.forEach(s => {
                            updated[s.studentId || `${s.class}_${s.roll}`] = 'Absent';
                          });
                          setAttendanceMap(updated);
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        Mark All Absent
                      </button>
                    </div>
                  </div>

                  {/* Student Cards Grid matching Image 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attendanceClassStudents.map((st, i) => {
                        const key = st.studentId || `${st.class}_${st.roll}`;
                        const isPresent = (attendanceMap[key] || 'Present') === 'Present';
                        return (
                          <div 
                            key={i}
                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isPresent 
                                ? 'bg-slate-950/80 border-slate-800 shadow-md' 
                                : 'bg-rose-950/20 border-rose-500/30 shadow-md'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0">
                                {st.roll}
                              </div>
                              <div>
                                <h4 className="font-extrabold text-white text-xs tracking-wide">{st.name}</h4>
                                <p className="text-[11px] text-slate-400">Father: {st.fatherName || 'N/A'}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setAttendanceMap({ ...attendanceMap, [key]: 'Present' })}
                                className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold transition-all cursor-pointer ${
                                  isPresent
                                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg'
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-cyan-500/50'
                                }`}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setAttendanceMap({ ...attendanceMap, [key]: 'Absent' })}
                                className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold transition-all cursor-pointer ${
                                  !isPresent
                                    ? 'bg-rose-600 text-white border-rose-500 shadow-lg'
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-rose-500/50'
                                }`}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Bottom Save Bar matching Image 2 */}
                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={handleSaveAttendance}
                      className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-xl transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Attendance (হাজিরা সেভ করুন)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VEHICLE STUDENTS SUBTAB */}
            {studentSubTab === 'vehicle' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
                {/* Header & Car Selector Dropdown */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Vehicle / Transport Students (স্কুল গাড়ি ও কার সার্ভিস)</h3>
                      <p className="text-xs text-slate-400">কার/গাড়ির নাম সিলেক্ট করে নির্দিষ্ট গাড়ির ছাত্র-ছাত্রীদের তালিকা পরিচালনা করুন</p>
                    </div>
                  </div>

                  {/* Car Filter Dropdown */}
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-cyan-500/40 shadow-inner">
                    <label className="text-xs font-bold text-cyan-300 whitespace-nowrap flex items-center gap-1">
                      <Car className="w-4 h-4 text-cyan-400" /> কার/গাড়ি সিলেক্ট করুন:
                    </label>
                    <select
                      value={selectedVehicleFilter}
                      onChange={e => setSelectedVehicleFilter(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-cyan-500/50 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="ALL">সকল গাড়ি ({Object.values(vehicleCountsMap).reduce((a, b) => a + b, 0)} জন)</option>
                      {vehiclesList.map(v => {
                        const count = vehicleCountsMap[v.vehicleName] || 0;
                        return (
                          <option key={v.id} value={v.vehicleName}>
                            🚗 {v.vehicleName} ({count} জন)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Selected Vehicle Detail Banner */}
                {selectedVehicleFilter !== 'ALL' && (() => {
                  const currentCar = vehiclesList.find(v => v.vehicleName === selectedVehicleFilter);
                  const assignedCount = vehicleCountsMap[selectedVehicleFilter] || 0;
                  return (
                    <div className="bg-slate-950/90 border border-cyan-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg font-black text-xs">
                            🚗 {selectedVehicleFilter}
                          </span>
                          <span className="text-xs text-slate-300">
                            মোট রেজিস্টার্ড শিক্ষার্থী: <strong className="text-cyan-400 font-extrabold text-sm">{assignedCount} জন</strong>
                          </span>
                        </div>
                        {currentCar && (
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                            <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-amber-400" /> হেল্পলাইন/ড্রাইভার ফোন: <strong className="text-white font-mono">{currentCar.phone || 'N/A'}</strong></span>
                            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-rose-400" /> গাড়ি রুট: <strong className="text-white">{currentCar.route || 'N/A'}</strong></span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('settings');
                          setActiveSubTab('vehicles');
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Settings className="w-3.5 h-3.5" /> গাড়ি সেটিংস পরিবর্তন
                      </button>
                    </div>
                  );
                })()}

                {/* Vehicle Students Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3">শ্রেণি & রোল</th>
                        <th className="p-3">শিক্ষার্থীর নাম</th>
                        <th className="p-3">অভিভাবক & ফোন</th>
                        <th className="p-3">ঠিকানা / রুট</th>
                        <th className="p-3 text-center">কার/গাড়ির নাম</th>
                        <th className="p-3 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {(() => {
                        const vehicleStudents = vehicleFilterStudents;

                        if (vehicleStudents.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                                <div>
                                  <Car className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                  <p className="font-bold text-slate-300">এই গাড়ির নামে কোনো শিক্ষার্থী নিবন্ধিত নেই</p>
                                  <p className="text-[11px] text-slate-500 mt-1">শিক্ষার্থী ভর্তি ফরমে "গাড়ি সার্ভিস" অপশনে এই গাড়ি নির্বাচন করুন</p>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return vehicleStudents.map((st, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-3 font-bold text-cyan-400">{st.class} - #{st.roll}</td>
                            <td className="p-3 font-bold text-white">{st.name}</td>
                            <td className="p-3 text-slate-300">{st.fatherName} ({st.phone || 'N/A'})</td>
                            <td className="p-3 text-slate-400">{st.address || 'N/A'}</td>
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-bold text-[10px]">
                                🚗 {st.vehicle}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setEditingStudent(st);
                                  setStudentFormData({ ...st });
                                  setIsStudentModalOpen(true);
                                }}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-all"
                              >
                                এডিট
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ROUTINE SUBTAB matching Image 3 & Image 4 */}
            {studentSubTab === 'routine' && (
              <div className="space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                  {/* Routine Header matching Image 3 & 4 */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-base">ক্লাস সময়সূচী ও সাপ্তাহিক রুটিন (Class & Teacher Routine)</h3>
                        <p className="text-xs text-slate-400">শ্রেণি ভিত্তিক রুটিন, শিক্ষকের নিজস্ব রুটিন এবং ড্রপডাউন ভিত্তিক নতুন রুটিন সেট করুন</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                      <button
                        onClick={() => setRoutineViewMode('class')}
                        className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          routineViewMode === 'class'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-md'
                            : 'bg-slate-950 border-slate-800 text-cyan-300 hover:border-cyan-500/50'
                        }`}
                      >
                        শ্রেণি ভিত্তিক রুটিন (Class View)
                      </button>
                      <button
                        onClick={() => setRoutineViewMode('teacher')}
                        className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          routineViewMode === 'teacher'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-md'
                            : 'bg-slate-950 border-slate-800 text-cyan-300 hover:border-cyan-500/50'
                        }`}
                      >
                        শিক্ষক ভিত্তিক রুটিন (Teacher View)
                      </button>
                      <button
                        onClick={() => setRoutineViewMode('form')}
                        className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
                          routineViewMode === 'form'
                            ? 'bg-orange-500 text-slate-950 border-orange-400 font-bold shadow-md'
                            : 'bg-orange-500/20 border-orange-500/40 text-orange-300 hover:bg-orange-500/30'
                        }`}
                      >
                        + রুটিন সেট করুন (Routine Set Form)
                      </button>
                    </div>
                  </div>

                  {/* ROUTINE SET FORM matching Image 4 */}
                  {routineViewMode === 'form' && (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                            + সাপ্তাহিক রুটিন সেট ফরম (Set Weekly Routine Slot)
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">শ্রেণি, দিন, পিরিয়ড, বিষয় এবং শিক্ষক ড্রপডাউন থেকে নির্বাচন করে সেভ করুন</p>
                        </div>
                        <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold rounded-lg">
                          {routineFormState.class} | {routineFormState.day} | {routineFormState.period.split(' ')[0]} {routineFormState.period.split(' ')[1]}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-300 mb-1">১. শ্রেণি নির্বাচন (CLASS)</label>
                          <select
                            value={routineFormState.class}
                            onChange={e => setRoutineFormState({ ...routineFormState, class: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                          >
                            {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-300 mb-1">২. বার/দিন নির্বাচন (DAY)</label>
                          <select
                            value={routineFormState.day}
                            onChange={e => setRoutineFormState({ ...routineFormState, day: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                          >
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-300 mb-1">৩. পিরিয়ড নির্বাচন (PERIOD)</label>
                          <select
                            value={routineFormState.period}
                            onChange={e => setRoutineFormState({ ...routineFormState, period: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                          >
                            <option value="Period 1 (10:30 AM - 11:15 AM)">Period 1 (10:30 AM - 11:15 AM)</option>
                            <option value="Period 2 (11:15 AM - 12:00 PM)">Period 2 (11:15 AM - 12:00 PM)</option>
                            <option value="Period 3 (12:00 PM - 12:45 PM)">Period 3 (12:00 PM - 12:45 PM)</option>
                            <option value="Period 4 (12:45 PM - 01:30 PM)">Period 4 (RECESS/TIFFIN)</option>
                            <option value="Period 5 (01:30 PM - 02:15 PM)">Period 5 (01:30 PM - 02:15 PM)</option>
                            <option value="Period 6 (02:15 PM - 03:00 PM)">Period 6 (02:15 PM - 03:00 PM)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-300 mb-1">৪. বিষয় নির্বাচন (SUBJECT)</label>
                          <select
                            value={routineFormState.subject}
                            onChange={e => setRoutineFormState({ ...routineFormState, subject: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                          >
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-300 mb-1">৫. শিক্ষক নির্বাচন (TEACHER)</label>
                          <select
                            value={routineFormState.teacher}
                            onChange={e => setRoutineFormState({ ...routineFormState, teacher: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                          >
                            <option value="আব্দুর রহমান স্যার">আব্দুর রহমান স্যার</option>
                            <option value="সুমতি বিশ্বাস স্যার">সুমতি বিশ্বাস স্যার</option>
                            <option value="তারিকুল ইসলাম স্যার">তারিকুল ইসলাম স্যার</option>
                            <option value="আশরাফ হাসান স্যার">আশরাফ হাসান স্যার</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          onClick={() => {
                            setRoutineEntries(routineEntries.filter(r => !(r.class === routineFormState.class && r.day === routineFormState.day && String(r.period).startsWith(routineFormState.period.split(' ')[0]))));
                          }}
                          className="px-4 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> এই স্লট রিমুভ করুন
                        </button>
                        <button
                          onClick={() => {
                            const newEntry: RoutineEntry = {
                              id: String(Date.now()),
                              class: routineFormState.class,
                              day: routineFormState.day,
                              period: routineFormState.period,
                              subject: routineFormState.subject.split(' ')[0],
                              teacher: routineFormState.teacher
                            };
                            setRoutineEntries([...routineEntries.filter(r => !(r.class === routineFormState.class && r.day === routineFormState.day && String(r.period).startsWith(routineFormState.period.split(' ')[0]))), newEntry]);
                            alert('রুটিন স্লট সফলভাবে সেভ হয়েছে!');
                          }}
                          className="px-6 py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" /> রুটিন স্লট সেভ করুন
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ROUTINE TABLE GRID matching Image 3 & Image 4 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">শ্রেণি নির্বাচন করুন:</span>
                        <select
                          value={routineClass}
                          onChange={e => setRoutineClass(e.target.value)}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-extrabold focus:outline-none focus:border-cyan-500"
                        >
                          {availableClassNames.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                      </div>

                      <button
                        onClick={() => window.print()}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" /> শ্রেণি রুটিন প্রিন্ট করুন
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-center text-xs border-collapse">
                        <thead className="bg-slate-950 text-slate-300 font-extrabold border-b border-slate-800">
                          <tr>
                            <th className="p-3 border-r border-slate-800 w-28">বার / সময়</th>
                            <th className="p-2 border-r border-slate-800">
                              <div>PERIOD 1</div>
                              <div className="text-[10px] font-mono text-slate-400 font-normal">10:30 AM - 11:15 AM</div>
                            </th>
                            <th className="p-2 border-r border-slate-800">
                              <div>PERIOD 2</div>
                              <div className="text-[10px] font-mono text-slate-400 font-normal">11:15 AM - 12:00 PM</div>
                            </th>
                            <th className="p-2 border-r border-slate-800">
                              <div>PERIOD 3</div>
                              <div className="text-[10px] font-mono text-slate-400 font-normal">12:00 PM - 12:45 PM</div>
                            </th>
                            <th className="p-2 border-r border-slate-800 bg-amber-950/20 text-amber-300">
                              <div>PERIOD 4</div>
                              <div className="text-[10px] font-mono text-amber-400 font-normal">12:45 PM - 01:30 PM (RECESS)</div>
                            </th>
                            <th className="p-2 border-r border-slate-800">
                              <div>PERIOD 5</div>
                              <div className="text-[10px] font-mono text-slate-400 font-normal">01:30 PM - 02:15 PM</div>
                            </th>
                            <th className="p-2">
                              <div>PERIOD 6</div>
                              <div className="text-[10px] font-mono text-slate-400 font-normal">02:15 PM - 03:00 PM</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-200">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, dIdx) => (
                            <tr key={dIdx} className="hover:bg-slate-800/30">
                              <td className="p-3 font-bold text-slate-300 bg-slate-950 border-r border-slate-800">{day}</td>
                              {[1, 2, 3, 4, 5, 6].map(pNum => {
                                if (pNum === 4) {
                                  return (
                                    <td key={pNum} className="p-3 bg-amber-950/20 border-r border-slate-800 font-extrabold text-amber-400 text-[11px]">
                                      টিফিন (RECESS)
                                    </td>
                                  );
                                }
                                const match = routineEntries.find(r => 
                                  normalizeClassName(r.class) === normalizeClassName(routineClass) && 
                                  r.day === day && 
                                  String(r.period).includes(`Period ${pNum}`)
                                );
                                return (
                                  <td 
                                    key={pNum} 
                                    onClick={() => {
                                      setRoutineFormState({
                                        ...routineFormState,
                                        class: routineClass,
                                        day: day,
                                        period: `Period ${pNum}`
                                      });
                                      setRoutineViewMode('form');
                                    }}
                                    className="p-3 border-r border-slate-800 hover:bg-cyan-500/10 cursor-pointer transition-colors"
                                  >
                                    {match ? (
                                      <div>
                                        <div className="font-extrabold text-cyan-300 uppercase text-xs">{match.subject}</div>
                                        <div className="text-[10px] text-slate-400">{match.teacher}</div>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-slate-600 font-semibold">+ এড করুন</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NOTICE BOARD SUBTAB matching Image 5 & Image 6 */}
            {studentSubTab === 'notices' && (
              <div className="space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                  {/* Notice Banner matching Image 5 */}
                  <div className="bg-[#1c0f04] border border-amber-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <Megaphone className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                          বিদ্যালয় নোটিশ বোর্ড (School Notice Board)
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          পরীক্ষা, ছুটি, ফি সংক্রান্ত ঘোষণা এবং অভিভাবক ও শিক্ষার্থীদের জন্য গুরুত্বপূর্ণ বিজ্ঞপ্তি প্রচার
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsNoticeModalOpen(true)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-4 h-4" /> নতুন নোটিশ যোগ করুন
                    </button>
                  </div>

                  {/* Filter Pills matching Image 5 */}
                  <div className="flex items-center gap-2 flex-wrap text-xs font-semibold border-b border-slate-800 pb-4">
                    {[
                      { id: 'ALL', label: 'সকল নোটিশ (All Notices)' },
                      { id: 'EXAM', label: 'পরীক্ষা সংক্রান্ত (Exam)' },
                      { id: 'HOLIDAY', label: 'ছুটির নোটিশ (Holiday)' },
                      { id: 'FEES', label: 'ফি সংক্রান্ত (Fees)' },
                      { id: 'EMERGENCY', label: 'জরুরী বিজ্ঞপ্তি (Emergency)' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setNoticeCategoryFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          noticeCategoryFilter === f.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Notice Cards Grid matching Image 5 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {notices
                      .filter(n => noticeCategoryFilter === 'ALL' || (n.category || n.priority) === (noticeCategoryFilter as string))
                      .map(n => (
                        <div key={n.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-[10px] rounded-full uppercase">
                                EXAM
                              </span>
                              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {n.date}
                              </span>
                            </div>

                            <h4 className="font-extrabold text-white text-sm leading-snug">{n.title}</h4>
                            <div className="bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl text-xs text-slate-300 leading-relaxed">
                              {n.content}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-semibold">
                            <span className="text-slate-400">শ্রেণি: <strong className="text-cyan-400">{n.targetGroup}</strong></span>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => window.print()}
                                className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" /> প্রিন্ট
                              </button>
                              <button 
                                onClick={() => alert('নোটিশ লিংক কপি করা হয়েছে!')}
                                className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Share2 className="w-3 h-3" /> শেয়ার
                              </button>
                              <button 
                                onClick={() => {
                                  if (confirm('আপনি কি এই নোটিশটি মুছে ফেলতে চান?')) {
                                    setNotices(notices.filter(x => x.id !== n.id));
                                    deleteNoticeSingleFromFirestore(school.schoolId, n.id).catch(() => {});
                                  }
                                }}
                                className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* PRINT HUB SUBTAB */}
            {studentSubTab === 'printhub' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="font-extrabold text-white text-base">Print Hub / প্রিন্ট পোর্টাল 🖨️</h3>
                    <p className="text-xs text-slate-400">স্টুডেন্ট আইডি কার্ড, রোল শিট ও এডমিট প্রিন্ট হাব</p>
                  </div>
                  <button 
                    onClick={() => window.print()}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> প্রিন্ট করুন
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {students.slice(0, 6).map((st, i) => (
                    <div key={i} className="printable-area bg-slate-950 border-2 border-cyan-500/40 rounded-2xl p-4 text-center space-y-3 shadow-xl relative overflow-hidden">
                      <div className="bg-gradient-to-r from-cyan-600 to-indigo-600 text-white p-2 rounded-xl text-xs font-black uppercase tracking-wider">
                        {school.name}
                      </div>

                      <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-cyan-400 mx-auto flex items-center justify-center font-black text-cyan-300 text-xl overflow-hidden">
                        {st.photo ? (
                          <img src={formatPhotoUrl(st.photo)} alt={st.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          (st.name || 'S').substring(0, 1)
                        )}
                      </div>

                      <div>
                        <h4 className="font-extrabold text-white text-sm">{st.name}</h4>
                        <span className="text-[11px] text-cyan-400 font-bold">Class: {st.class} | Roll: #{st.roll}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 space-y-0.5 border-t border-slate-800 pt-2 font-mono">
                        <div>ID: {generateStandardStudentId(school, st)}</div>
                        <div>Father: {st.fatherName || 'N/A'}</div>
                        <div>Phone: {st.phone || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEES TAB */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            {/* Header Banner matching Screenshots */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <CreditCard className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    Fee Collection & Daybook Tracker
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    মাসিক ফি আদায়, বকেয়া হিসাব, আয়-ব্যয় ডে-বুক ও খরচের ভাউচার
                  </p>
                </div>
              </div>

              {/* Action Tabs Pills matching Screenshot header */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button 
                  onClick={() => setFeeSubTab('collect')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    feeSubTab === 'collect'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                      : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Collect Fee (ফি আদায়)
                </button>

                <button 
                  onClick={() => setFeeSubTab('dues')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    feeSubTab === 'dues'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                      : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Dues Tracker (বকেয়া খাতা)
                </button>

                <button 
                  onClick={() => setFeeSubTab('daybook')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    feeSubTab === 'daybook'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                      : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Daybook Tracker (আদায় ও ব্যয় খাতা)
                </button>

                <button 
                  onClick={() => setFeeSubTab('dailyprint')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    feeSubTab === 'dailyprint'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                      : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Daily Print (দৈনিক আদায় প্রিন্ট A5)
                </button>

                <button 
                  onClick={() => setFeeSubTab('history')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    feeSubTab === 'history'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                      : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Range Report (আর্কাইভ ও সময়কাল রিপোর্ট)
                </button>

                <button 
                  onClick={() => setIsBlankReceiptModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  ✨ ফাঁকা রসিদ নং পূরণ
                </button>
              </div>
            </div>

            {/* SUBTAB HISTORY: ON-DEMAND RANGE QUERY */}
            {feeSubTab === 'history' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="font-extrabold text-white text-base">পুরনো মাস/বছরের অন-ডিমান্ড রিপোর্ট</h4>
                  <p className="text-xs text-slate-400 mt-1">নির্দিষ্ট তারিখ সীমার ফি রসিদ ও ডে-বুক রেকর্ড ফায়ারস্টোর থেকে আলাদাভাবে লোড করুন</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-4 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">শুরুর তারিখ:</span>
                    <input 
                      type="date"
                      value={customReportStartDate}
                      onChange={e => setCustomReportStartDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">শেষের তারিখ:</span>
                    <input 
                      type="date"
                      value={customReportEndDate}
                      onChange={e => setCustomReportEndDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold"
                    />
                  </div>

                  <button
                    onClick={handleFetchHistoricalReport}
                    disabled={isFetchingHistory}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isFetchingHistory ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    রিপোর্ট লোড করুন
                  </button>
                </div>

                {historicalReceipts && historicalDaybook && (
                  <div className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400">উক্ত রেঞ্জে মোট রসিদ:</span>
                        <div className="text-xl font-bold text-cyan-400 font-mono mt-1">{historicalReceipts.length} টি (মোট: ৳{historicalReceipts.reduce((sum, r) => sum + r.amount, 0)})</div>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400">উক্ত রেঞ্জে আয়/ব্যয় হিসাব:</span>
                        <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                          আদায়: ৳{historicalDaybook.filter(d => d.type === 'INCOME').reduce((s, d) => s + d.amount, 0)} | 
                          ব্যয়: ৳{historicalDaybook.filter(d => d.type === 'EXPENSE').reduce((s, d) => s + d.amount, 0)}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-300 uppercase font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-3">তারিখ</th>
                            <th className="p-3">রসিদ নং</th>
                            <th className="p-3">শিক্ষার্থী</th>
                            <th className="p-3">শ্রেণি / রোল</th>
                            <th className="p-3 text-right">পরিমাণ</th>
                            <th className="p-3 text-center">পেমেন্ট মোড</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                          {historicalReceipts.length === 0 ? (
                            <tr><td colSpan={6} className="p-4 text-center text-slate-500">এই সময়ের মধ্যে কোনো রসিদ পাওয়া যায়নি</td></tr>
                          ) : (
                            historicalReceipts.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-800/50">
                                <td className="p-3 font-mono text-slate-300">{r.date}</td>
                                <td className="p-3 font-mono text-amber-400">{r.receiptNo}</td>
                                <td className="p-3 font-bold text-white">{r.studentName}</td>
                                <td className="p-3 text-slate-300">{r.studentClass} ({r.roll})</td>
                                <td className="p-3 text-right font-mono font-bold text-emerald-400">৳{r.amount}</td>
                                <td className="p-3 text-center text-slate-400">{r.paymentMode}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 1: COLLECT FEE */}
            {feeSubTab === 'collect' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h4 className="font-extrabold text-white text-base">ফি আদায়ের জন্য শিক্ষার্থী নির্বাচন করুন</h4>
                    <p className="text-xs text-slate-400">শ্রেণি অনুযায়ী শিক্ষার্থীদের বকেয়া ও পরিশোধিত ফি দেখুন এবং ফি জমা নিন</p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                      value={feeSetupClass}
                      onChange={e => setFeeSetupClass(e.target.value)}
                      className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ALL">ALL (সব ক্লাস)</option>
                      {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="শিক্ষার্থীর নাম / রোল দিয়ে খুঁজুন..."
                        value={feeSetupSearch}
                        onChange={e => setFeeSetupSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-300 uppercase font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3">রোল</th>
                        <th className="p-3">শিক্ষার্থীর নাম</th>
                        <th className="p-3">শ্রেণি</th>
                        <th className="p-3">অভিভাবক</th>
                        <th className="p-3 text-right">মাসিক ফি</th>
                        <th className="p-3 text-center">পরিশোধিত মাস</th>
                        <th className="p-3 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                      {feeSetupFilteredStudents.map((st, i) => {
                          const rate = st.monthlyFee || 350;
                          const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                          const paidMonthsCount = months.filter(m => (st as any)[m] === 'Paid').length;

                          return (
                            <tr key={i} className="hover:bg-slate-800/60 transition-colors">
                              <td className="p-3 font-bold text-cyan-400">#{st.roll}</td>
                              <td className="p-3 font-extrabold text-white">{st.name}</td>
                              <td className="p-3 font-bold text-slate-300">{st.class}</td>
                              <td className="p-3 text-slate-400">{st.fatherName || 'N/A'}</td>
                              <td className="p-3 text-right font-mono font-bold text-amber-400">₹{rate}</td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold text-[11px]">
                                  {paidMonthsCount} / 12 মাস
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => {
                                    setFeeStudent(st);
                                    setFeeMonths([]);
                                    setCustomFeeAmount('0');
                                    setIsFeeModalOpen(true);
                                  }}
                                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs"
                                >
                                  Collect Fee (ফি আদায়)
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB 2: DUES TRACKER (Matches Image 3) */}
            {feeSubTab === 'dues' && (
              <div className="space-y-6">
                {/* Upto Month Due Tracker Header Card matching Image 3 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-white text-base">Upto Month Due Tracker</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      রানিং মাস নির্বাচন করে কার কত মাসের ফি বকেয়া আছে চেক করুন
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap text-xs">
                    <div className="flex items-center gap-2">
                      <label className="font-bold text-slate-300">Class:</label>
                      <select
                        value={duesClassFilter}
                        onChange={e => setDuesClassFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                      >
                        <option value="ALL">ALL (সব ক্লাস)</option>
                        {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="font-bold text-slate-300">Running Month:</label>
                      <select
                        value={duesRunningMonth}
                        onChange={e => setDuesRunningMonth(e.target.value)}
                        className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                      >
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Outstanding Due List Table Card matching Image 3 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h4 className="font-extrabold text-white text-sm">
                      Outstanding Due List ({duesRunningMonth} পর্যন্ত)
                    </h4>

                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-cyan-400" />
                      Print Lists
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase font-extrabold border-b border-slate-800">
                        <tr>
                          <th className="p-3">STUDENT</th>
                          <th className="p-3">CLASS</th>
                          <th className="p-3">TUITION</th>
                          <th className="p-3">EXPECTED PAID</th>
                          <th className="p-3">ACTUAL PAID</th>
                          <th className="p-3">DUE AMOUNT</th>
                          <th className="p-3">MONTHS DUE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                        {(() => {
                          const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                          const monthMapBn: Record<string, string> = {
                            'January': 'জানুয়ারি', 'February': 'ফেব্রুয়ারি', 'March': 'মার্চ',
                            'April': 'এপ্রিল', 'May': 'মে', 'June': 'জুন',
                            'July': 'জুলাই', 'August': 'আগস্ট', 'September': 'সেপ্টেম্বর',
                            'October': 'অক্টোবর', 'November': 'নভেম্বর', 'December': 'ডিসেম্বর'
                          };

                          const runningIdx = allMonths.indexOf(duesRunningMonth);
                          const elapsedMonths = allMonths.slice(0, runningIdx + 1);

                          return duesFilteredStudents.map((st, i) => {
                            const tuitionRate = st.monthlyFee || 350;
                            const exemptList = (studentExemptions[st.name] || []).map(x => x.toLowerCase());

                            const activeElapsedMonths = elapsedMonths.filter(m => !exemptList.includes(m.toLowerCase()));
                            
                            const isMonthPaid = (stObj: any, mStr: string) => {
                              const val1 = stObj[mStr.toLowerCase()];
                              const val2 = stObj[mStr];
                              const val3 = stObj[mStr.charAt(0).toUpperCase() + mStr.slice(1).toLowerCase()];
                              return val1 === 'Paid' || val2 === 'Paid' || val3 === 'Paid' || val1 === true || val2 === true;
                            };

                            // Check paid months for student
                            const paidMonthsList = elapsedMonths.filter(m => isMonthPaid(st, m));
                            const unpaidMonthsList = activeElapsedMonths.filter(m => !isMonthPaid(st, m));

                            const expectedAmount = activeElapsedMonths.length * tuitionRate;
                            const actualPaidAmount = paidMonthsList.length * tuitionRate;
                            const dueAmount = Math.max(0, expectedAmount - actualPaidAmount);

                            return (
                              <tr key={i} className="hover:bg-slate-800/40 transition-colors font-sans">
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-400 shrink-0 uppercase text-xs overflow-hidden">
                                      {st.photo ? (
                                        <img src={formatPhotoUrl(st.photo)} alt={st.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                                      ) : (
                                        (st.name || 'S').substring(0, 2)
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-extrabold text-white uppercase text-xs">{st.name}</div>
                                      <div className="text-[11px] text-slate-400 font-mono">
                                        Roll: {st.roll} • Father: {st.fatherName || 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 font-bold text-cyan-400 font-mono">{(st.class || '').toUpperCase()}</td>
                                <td className="p-3 font-mono font-bold text-slate-200">₹{tuitionRate}</td>
                                <td className="p-3 font-mono font-bold text-slate-300">₹{expectedAmount}</td>
                                <td className="p-3 font-mono font-bold text-cyan-400">₹{actualPaidAmount}</td>
                                <td className="p-3 font-mono font-extrabold text-rose-400">₹{dueAmount}</td>
                                <td className="p-3">
                                  {unpaidMonthsList.length > 0 ? (
                                    <div className="space-y-1">
                                      <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 font-bold text-[10px] inline-block">
                                        {unpaidMonthsList.length} months
                                      </span>
                                      <div className="text-[10px] text-slate-400 italic">
                                        {unpaidMonthsList.map(m => monthMapBn[m] || m).join(', ')}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                                      Clear (পরিশোধিত)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 3: DAYBOOK TRACKER (Matches Image 2) */}
            {feeSubTab === 'daybook' && (
              <div className="space-y-6">
                {/* Header Bar matching Image 2 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-cyan-400" />
                      Daybook & Expense Tracker (আদায় ও ব্যয় খাতা)
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      প্রতিদিনের আয়-ব্যয় বিবরণী, খরচ ভাউচার ম্যানেজমেন্ট এবং নেট ক্যাশ ব্যালান্স
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                      <label className="font-bold text-slate-300">তারিখ নির্বাচন:</label>
                      <input
                        type="date"
                        value={daybookDate}
                        onChange={e => setDaybookDate(e.target.value)}
                        className="bg-transparent text-white font-mono font-bold focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={() => setDaybookDate(new Date().toISOString().split('T')[0])}
                      className="px-3.5 py-2 bg-cyan-500 text-slate-950 font-extrabold rounded-xl text-xs hover:bg-cyan-400 transition-all cursor-pointer shadow-md"
                    >
                      আজকের হিসাব
                    </button>

                    <button
                      onClick={() => {
                        setNewExpenseData({
                          title: '',
                          category: 'Teacher Salary',
                          paymentMode: 'Cash',
                          amount: 0,
                          date: daybookDate,
                          voucherNo: `V-${101 + expenses.length}`
                        });
                        setIsAddExpenseModalOpen(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      + নতুন ব্যয় নথিভুক্ত করুন
                    </button>
                  </div>
                </div>

                {/* 4 Stat Cards Grid matching Image 2 */}
                {(() => {
                  const { feeCash, feeOnline, feeTotal, totalFeeAllTime, expCash, expOnline, expTotal, netCashToday, totalNetFund } = daybookTotals;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Card 1: Today's Fee */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                          <span>আজকের ফি আদায়</span>
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                            ↗
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono">₹{feeTotal}</div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
                          <span>ক্যাশ: ₹{feeCash}</span>
                          <span>অনলাইন/ফোনপে: ₹{feeOnline}</span>
                        </div>
                      </div>

                      {/* Card 2: Total Fee */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                          <span>সর্বমোট ফি আদায় (TOTAL)</span>
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono">₹{totalFeeAllTime}</div>
                        <div className="text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
                          মোট রসিদ জমা: {feeReceipts.length} টি
                        </div>
                      </div>

                      {/* Card 3: Today's Expense */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                          <span>আজকের ব্যয় (খরচ)</span>
                          <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                            ↘
                          </div>
                        </div>
                        <div className="text-2xl font-black text-rose-400 font-mono">₹{expTotal}</div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
                          <span>ক্যাশ: ₹{expCash}</span>
                          <span>অনলাইন: ₹{expOnline}</span>
                        </div>
                      </div>

                      {/* Card 4: Net Cash Balance */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                          <span>নেট ব্যালেন্স (NET CASH)</span>
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                            <DollarSign className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className={`text-2xl font-black font-mono ${netCashToday < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ₹{netCashToday}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
                          <span>সর্বমোট তহবিল: ₹{totalNetFund}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${netCashToday < 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {netCashToday < 0 ? 'ঘাটতি (Deficit)' : 'উদ্বৃত্ত (Surplus)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Section 1: Fee Receipts List matching Image 2 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">↓</span>
                      ফি আদায়ের হিসাব (Fee Receipts)
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono">তারিখ: {daybookDate}</span>
                      <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-extrabold rounded-lg font-mono text-xs">
                        ₹{daybookTotals.feeTotal}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {daybookTodayReceipts.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">এই তারিখে কোনো ফি আদায়ের এনট্রি নেই।</p>
                    ) : (
                      daybookTodayReceipts.map((rec, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition-all">
                          <div>
                            <div className="font-extrabold text-white text-xs">
                              {rec.studentName} <span className="text-slate-400 font-normal">({rec.studentClass} - রোল: {rec.roll})</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              মাস: {(Array.isArray(rec.months) ? rec.months : typeof rec.months === 'string' ? [rec.months] : []).join(', ')} #Rec: {rec.receiptNo} <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 ml-1">{rec.paymentMode}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="font-mono font-extrabold text-cyan-400 text-sm">₹{rec.amount}</span>
                            <button 
                              onClick={() => handleOpenEditReceipt(rec)} 
                              className="p-1.5 bg-slate-900 hover:bg-cyan-600 hover:text-slate-950 border border-slate-700 text-cyan-300 rounded-lg text-xs cursor-pointer transition-all flex items-center gap-1 font-bold"
                              title="রশিদ এডিট করুন"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">এডিট</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteReceipt(rec)} 
                              className="p-1.5 bg-slate-900 hover:bg-rose-600 hover:text-white border border-slate-700 text-rose-400 rounded-lg text-xs cursor-pointer transition-all flex items-center gap-1 font-bold"
                              title="রশিদ মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">ডিলেট</span>
                            </button>
                            <button 
                              onClick={() => window.print()} 
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                              title="প্রিন্ট করুন"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 2: Expenses Log matching Image 2 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs">↑</span>
                      খরচের হিসাব (Expenses Log)
                    </h4>
                    <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-extrabold rounded-lg font-mono text-xs">
                      ₹{daybookTotals.expTotal}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {daybookTodayExpenses.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">এই তারিখে কোনো খরচের ভাউচার নেই।</p>
                    ) : (
                      daybookTodayExpenses.map((exp, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition-all">
                          <div>
                            <div className="font-extrabold text-white text-xs">
                              {exp.title} <span className="text-cyan-400 font-mono">#{exp.voucherNo}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {exp.category} • {exp.paymentMode}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="font-mono font-extrabold text-rose-400 text-sm">₹{exp.amount}</span>
                            <button
                              onClick={() => {
                                setExpenses(expenses.filter(e => e.id !== exp.id));
                                deleteExpenseSingleFromFirestore(school.schoolId, exp.id).catch(() => {});
                              }}
                              className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg text-xs cursor-pointer"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 3: All Expense Log Table matching Image 2 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      স্কুল খরচের সর্বমোট ভাউচার হিস্ট্রি (All Expense Log)
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">
                      মোট খরচ তালিকা: {expenses.length} টি | সর্বমোট: ₹{expenses.reduce((sum, e) => sum + e.amount, 0)}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3">তারিখ</th>
                          <th className="p-3">ভাউচার নং</th>
                          <th className="p-3">খাত / বিবরণ</th>
                          <th className="p-3">ক্যাটাগরি</th>
                          <th className="p-3">পেমেন্ট মোড</th>
                          <th className="p-3 text-right">টাকা (Amount)</th>
                          <th className="p-3 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 font-mono">
                        {expenses.map((exp, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 text-cyan-400 font-bold">{exp.date}</td>
                            <td className="p-3 font-bold text-white">{exp.voucherNo}</td>
                            <td className="p-3 font-sans font-bold text-slate-200">{exp.title}</td>
                            <td className="p-3 font-sans font-semibold text-amber-400">{exp.category}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-bold text-[10px]">
                                {exp.paymentMode}
                              </span>
                            </td>
                            <td className="p-3 text-right font-extrabold text-rose-400">₹{exp.amount}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setExpenses(expenses.filter(e => e.id !== exp.id));
                                  deleteExpenseSingleFromFirestore(school.schoolId, exp.id).catch(() => {});
                                }}
                                className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 4: DAILY COLLECTION PRINT (A5 PORTRAIT) */}
            {feeSubTab === 'dailyprint' && (
              <div className="space-y-6">
                {/* Control Panel Header (Hidden on Print) */}
                <div className="no-print bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                      <Printer className="w-5 h-5 text-cyan-400" />
                      Daily Fee Collection Print (দৈনিক আদায় তালিকা A5)
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      নির্দিষ্ট তারিখের আদায়কৃত সমস্ত রশিদের বিবরণী A5 Portrait ফরম্যাটে প্রিন্ট করুন
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                      <label className="font-bold text-slate-300">তারিখ নির্বাচন:</label>
                      <input
                        type="date"
                        value={selectedDailyPrintDate}
                        onChange={e => setSelectedDailyPrintDate(e.target.value)}
                        className="bg-transparent text-white font-mono font-bold focus:outline-none cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={() => setSelectedDailyPrintDate(new Date().toISOString().split('T')[0])}
                      className="px-3.5 py-2 bg-slate-800 text-slate-200 font-extrabold rounded-xl text-xs hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      আজকের দিন
                    </button>

                    <button
                      onClick={handlePrintA5Collection}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      A5 প্রিন্ট করুন (Print A5)
                    </button>
                  </div>
                </div>

                {/* Printable A5 Collection Document Container */}
                {(() => {
                  const dayReceipts = feeReceipts.filter(r => r.date === selectedDailyPrintDate);
                  const grandTotal = dayReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
                  const cashTotal = dayReceipts.filter(r => (r.paymentMode || 'Cash').toLowerCase() === 'cash').reduce((sum, r) => sum + (r.amount || 0), 0);
                  const onlineTotal = grandTotal - cashTotal;

                  return (
                    <div className="printable-a5-collection bg-white text-slate-900 border border-slate-300 rounded-xl p-6 font-sans space-y-4 shadow-2xl max-w-2xl mx-auto">
                      {/* Header info */}
                      <div className="text-center border-b pb-3 border-slate-300 space-y-1">
                        <h2 className="text-lg font-black uppercase text-slate-900 tracking-wide">
                          {school.name || 'স্কুল হ্যাব একাডেমী'}
                        </h2>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {school.address || 'পশ্চিমবঙ্গ, ভারত'} • ESTD: 2020
                        </p>
                        <div className="pt-1 flex items-center justify-between text-xs font-bold font-mono text-slate-800 px-1">
                          <span className="bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                            দৈনিক ফি আদায় বিবরণী (Daily Collection Sheet)
                          </span>
                          <span>তারিখ: {selectedDailyPrintDate}</span>
                        </div>
                      </div>

                      {/* Collection Table */}
                      {dayReceipts.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-300 rounded-lg">
                          এই তারিখে ({selectedDailyPrintDate}) কোনো ফি আদায়ের রসিদ পাওয়া যায়নি।
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                            <thead>
                              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                                <th className="p-1.5 border border-slate-300 text-center w-8">ক্রম</th>
                                <th className="p-1.5 border border-slate-300 font-mono">রসিদ নং</th>
                                <th className="p-1.5 border border-slate-300">শিক্ষার্থীর নাম</th>
                                <th className="p-1.5 border border-slate-300 font-mono">শ্রেণি ও রোল</th>
                                <th className="p-1.5 border border-slate-300">মাসসমূহ</th>
                                <th className="p-1.5 border border-slate-300 text-center">মোড</th>
                                <th className="p-1.5 border border-slate-300 text-right font-mono">টাকা (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {dayReceipts.map((rec, idx) => {
                                const monthText = Array.isArray(rec.months) 
                                  ? rec.months.join(', ') 
                                  : typeof rec.months === 'string' 
                                  ? rec.months 
                                  : '';
                                return (
                                  <tr key={rec.id || idx} className="hover:bg-slate-50">
                                    <td className="p-1.5 border border-slate-300 text-center font-mono text-[10px]">{idx + 1}</td>
                                    <td className="p-1.5 border border-slate-300 font-mono font-bold text-slate-800">#{rec.receiptNo}</td>
                                    <td className="p-1.5 border border-slate-300 font-bold uppercase">{rec.studentName}</td>
                                    <td className="p-1.5 border border-slate-300 font-mono text-[10px]">{rec.studentClass} (#{rec.roll})</td>
                                    <td className="p-1.5 border border-slate-300 text-[10px] text-slate-700">{monthText}</td>
                                    <td className="p-1.5 border border-slate-300 text-center text-[10px] font-bold">{rec.paymentMode || 'Cash'}</td>
                                    <td className="p-1.5 border border-slate-300 text-right font-mono font-bold">₹{rec.amount}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                                <td colSpan={6} className="p-2 border border-slate-300 text-right font-black">
                                  সর্বমোট ক্যাশ ও অনলাইন আদায়:
                                </td>
                                <td className="p-2 border border-slate-300 text-right font-mono font-extrabold text-sm text-emerald-800">
                                  ₹{grandTotal}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Summary breakdown box */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-center text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">মোট রসিদ</span>
                          <strong className="text-slate-900 font-bold">{dayReceipts.length} টি</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">ক্যাশ আদায়</span>
                          <strong className="text-emerald-700 font-bold">₹{cashTotal}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">অনলাইন / ব্যাংক</span>
                          <strong className="text-indigo-700 font-bold">₹{onlineTotal}</strong>
                        </div>
                      </div>

                      {/* Signatures */}
                      <div className="pt-8 flex justify-between items-end text-xs font-bold text-slate-700 font-mono">
                        <div className="text-center border-t border-slate-400 pt-1 w-32">
                          ক্যাশিয়ার / হিসাবি
                        </div>
                        <div className="text-center border-t border-slate-400 pt-1 w-36">
                          প্রধান শিক্ষক / পরিচালকের স্বাক্ষর
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* EXAMS TAB - Reorganized according to user design specifications */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            {/* Academic & Exam Portal Header Banner */}
            <div className="bg-[#0b1320] border border-slate-800 rounded-2xl p-5 text-slate-100 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
                  <Award className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    Academic & Exam Portal
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    নম্বর এন্ট্রি, শ্রেণীভিত্তিক বিষয় বিন্যাস এবং মার্কশীট ও এডমিট প্রিন্ট হাব
                  </p>
                </div>
              </div>

              {/* Button navigation grid */}
              <div className="flex items-center gap-2 flex-wrap text-xs w-full xl:w-auto">
                <button 
                  onClick={() => setExamSubTab('mark_entry')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    examSubTab === 'mark_entry'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-black'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Mark Entry (নম্বর এন্ট্রি)
                </button>
                <button 
                  onClick={() => setExamSubTab('result_view')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    examSubTab === 'result_view'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-black'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Result View (ফলাফল বিবরণী)
                </button>
                <button 
                  onClick={() => setExamSubTab('exam_setup')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    examSubTab === 'exam_setup'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-black'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Exam Setup (বিষয় সাজানো)
                </button>
                <button 
                  onClick={() => setExamSubTab('exam_routine')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    examSubTab === 'exam_routine'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-black'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Exam Routine (রুটিন সেটআপ)
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: Mark Entry (Image 1) */}
            {examSubTab === 'mark_entry' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div>
                    <h4 className="font-extrabold text-white text-base">Bulk Mark Entry Panel</h4>
                    <p className="text-xs text-slate-400 mt-0.5">শ্রেণী, পরীক্ষা ও বিষয় নির্বাচন করে সরাসরি মার্কস এন্ট্রি করুন</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold mr-1">Class:</label>
                      <select
                        value={selectedMarkClass}
                        onChange={e => setSelectedMarkClass(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                      >
                        {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold mr-1">Exam:</label>
                      <select
                        value={selectedExam}
                        onChange={e => setSelectedExam(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                      >
                        <option value="1st Summative Evaluation">1st Summative Evaluation</option>
                        <option value="2nd Summative Evaluation">2nd Summative Evaluation</option>
                        <option value="3rd Summative Evaluation">3rd Summative Evaluation</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold mr-1">Subject:</label>
                      <select
                        value={selectedSubject}
                        onChange={e => setSelectedSubject(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold uppercase"
                      >
                        {getEffectiveSubjectsForClass(selectedMarkClass, selectedExam).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Keyboard Nav Info Bar matching Image 1 */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold rounded text-[11px]">⌨️ কিবোর্ড নেভিগেশন</span>
                    <span>নম্বর লিখে <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px]">Enter ↵</kbd> বা <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px]">↓ Down</kbd> চাপলে সরাসরি পরবর্তী স্থানের বাক্সে চলে যাবে।</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-xs">
                    সর্বোচ্চ নম্বর (Max Mark): {getExamMaxMark(selectedExam)}
                  </span>
                </div>

                {/* Mark Entry Table matching Image 1 */}
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5 w-16">ROLL</th>
                        <th className="px-4 py-3.5">STUDENT NAME</th>
                        <th className="px-4 py-3.5">FATHER NAME</th>
                        <th className="px-4 py-3.5 text-center w-56">MARKS OBTAINED (MAX: {getExamMaxMark(selectedExam)})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 font-mono">
                      {selectedMarkClassStudents.map((st) => {
                          const key = `${normalizeClassName(selectedMarkClass)}|${selectedExam}|${(selectedSubject || '').toUpperCase()}|${st.roll}`;
                          const existing = marksLookupMap.get(key);
                          const currentMaxMark = getExamMaxMark(selectedExam, existing);

                          return (
                            <tr key={`${selectedMarkClass}-${selectedExam}-${selectedSubject}-${st.roll}`} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-3 font-bold text-white text-center">{st.roll}</td>
                              <td className="px-4 py-3 font-sans font-extrabold text-cyan-400 uppercase tracking-wide">{st.name}</td>
                              <td className="px-4 py-3 font-sans text-slate-400 uppercase">{st.fatherName || 'HAIDAR ALI'}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={currentMaxMark}
                                    placeholder={`0 - ${currentMaxMark}`}
                                    value={existing !== undefined && existing.markObtain !== undefined ? existing.markObtain : ''}
                                    onChange={e => {
                                      const rawVal = e.target.value;
                                      setMarks(prev => {
                                        const filtered = prev.filter(
                                          m => !(normalizeClassName(m.class) === normalizeClassName(selectedMarkClass) &&
                                                m.examName === selectedExam &&
                                                m.subjectName === selectedSubject &&
                                                Number(m.roll) === Number(st.roll))
                                        );
                                        if (rawVal === '') {
                                          return filtered;
                                        }
                                        let val = Number(rawVal);
                                        if (isNaN(val)) return filtered;
                                        if (val < 0) val = 0;
                                        if (val > currentMaxMark) {
                                          val = currentMaxMark;
                                          alert(`নম্বর পূর্ণমানের (${currentMaxMark}) চেয়ে বেশি দেওয়া সম্ভব নয়! সর্বোচ্চ ${currentMaxMark} গ্রহণ করা হয়েছে।`);
                                        }
                                        const pct = Math.round((val / currentMaxMark) * 100);
                                        const grade = getGradeFromPercentage(pct);
                                        return [...filtered, {
                                          class: selectedMarkClass,
                                          roll: Number(st.roll),
                                          studentName: st.name,
                                          examName: selectedExam,
                                          subjectName: selectedSubject,
                                          markObtain: val,
                                          totalMark: currentMaxMark,
                                          grade: grade
                                        }];
                                      });
                                    }}
                                    className="w-28 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-white font-mono font-bold text-xs focus:border-cyan-400 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMarks(prev => {
                                        const filtered = prev.filter(
                                          m => !(normalizeClassName(m.class) === normalizeClassName(selectedMarkClass) &&
                                                m.examName === selectedExam &&
                                                m.subjectName === selectedSubject &&
                                                Number(m.roll) === Number(st.roll))
                                        );
                                        return [...filtered, {
                                          class: selectedMarkClass,
                                          roll: Number(st.roll),
                                          studentName: st.name,
                                          examName: selectedExam,
                                          subjectName: selectedSubject,
                                          markObtain: 0,
                                          totalMark: currentMaxMark,
                                          grade: 'F',
                                          remarks: 'ABSENT'
                                        }];
                                      });
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-800 text-slate-300 font-bold text-[11px] rounded-lg border border-slate-700 hover:bg-slate-700 cursor-pointer"
                                  >
                                    AB
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      saveMarksOnly(selectedMarkClass, selectedExam);
                    }}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    Save Marks (নম্বর সেভ করুন)
                  </button>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: Result View (Images 2, 3, 4) */}
            {examSubTab === 'result_view' && (
              <div className="space-y-6">
                {/* Header Card matching Image 2, 3, 4 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-base">
                        Result Portal & Tabulation Hub (ফলাফল বিবরণী)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ছাত্র-ছাত্রীদের মেধা তালিকা, মার্কস শিট এবং বিষয়ভিত্তিক ফলাফল
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold mr-1">Class:</label>
                      <select
                        value={selectedMarkClass}
                        onChange={e => setSelectedMarkClass(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                      >
                        {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-bold mr-1">Evaluation:</label>
                      <select
                        value={selectedExam}
                        onChange={e => setSelectedExam(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                      >
                        <option value="1st Summative Evaluation">1st Summative Evaluation</option>
                        <option value="2nd Summative Evaluation">2nd Summative Evaluation</option>
                        <option value="3rd Summative Evaluation">3rd Summative Evaluation</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setExamSubTab('mark_entry')}
                      className="px-3.5 py-1.5 bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Marks (নম্বর এডিট)
                    </button>
                  </div>
                </div>

                {/* Sub-tab pills matching Image 2, 3, 4 */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap text-xs">
                  <button
                    onClick={() => setResultSubTab('tabulation')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                      resultSubTab === 'tabulation'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Tabulation Sheet & Mark Entry (ট্যাবুলেশন শিট ও নম্বর সেভ)
                  </button>

                  <button
                    onClick={() => setResultSubTab('single_card')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                      resultSubTab === 'single_card'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Student Result Card (একক ছাত্র ফলাফল)
                  </button>

                  <button
                    onClick={() => setResultSubTab('subject_wise')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                      resultSubTab === 'subject_wise'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Subject-wise Marks List (বিষয়ভিত্তিক নম্বর)
                  </button>
                </div>

                {/* Result Sub-Tab 1: Tabulation Sheet (Image 2) */}
                {resultSubTab === 'tabulation' && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="font-extrabold text-white text-base">
                          Result Tabulation Sheet — Class: {selectedMarkClass} ({selectedExam.split(' ')[0]} Summative)
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          সরাসরি নম্বর বসান/পরিবর্তন করুন। মোট নম্বর, % শতাংশ, গ্রেড ও মেধা স্থান স্বয়ংক্রিয়ভাবে হিসাব হবে।
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            saveMarksOnly(selectedMarkClass, selectedExam);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                        >
                          <Save className="w-4 h-4" /> Save All Changes (সংরক্ষণ করুন)
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" /> Print Tabulation (ট্যাবুলেশন প্রিন্ট)
                        </button>
                      </div>
                    </div>

                    {/* Keyboard Nav Info Bar matching Image 2 */}
                    <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-indigo-200">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold rounded text-[11px]">⚡ দ্রুত নেভিগেশন</span>
                        <span>নম্বর লিখে <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white font-mono text-[10px]">Enter ↵</kbd> বা <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white font-mono text-[10px]">↓ Down</kbd> চাপলে পরের ছাত্র, <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white font-mono text-[10px]">↑ Up</kbd> চাপলে আগের ছাত্র, এবং <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white font-mono text-[10px]">Right → / Left ←</kbd> আরো দিয়ে বিষয় পরিবর্তন করুন।</span>
                      </div>
                      <span className="text-cyan-300 font-bold">সর্বোচ্চ নম্বর (Max Mark): {getExamMaxMark(selectedExam)}</span>
                    </div>

                    {/* Tabulation Table matching Image 2 */}
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-3 w-16 text-center">RANK</th>
                            <th className="p-3 w-16 text-center">ROLL</th>
                            <th className="p-3 min-w-[180px]">STUDENT NAME</th>
                            {getEffectiveSubjectsForClass(selectedMarkClass, selectedExam).map(sub => (
                              <th key={sub} className="p-3 text-center min-w-[120px]">{sub}</th>
                            ))}
                            <th className="p-3 text-center w-28">TOTAL SCORE</th>
                            <th className="p-3 text-center w-24">PERCENTAGE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                          {students
                            .filter(st => normalizeClassName(st.class) === normalizeClassName(selectedMarkClass))
                            .map((st, idx) => {
                              const activeSubjs = getEffectiveSubjectsForClass(selectedMarkClass, selectedExam);
                              const studentMarks = marks.filter(
                                m => normalizeClassName(m.class) === normalizeClassName(selectedMarkClass) &&
                                m.examName === selectedExam &&
                                Number(m.roll) === Number(st.roll)
                              );
                              const totalObtained = studentMarks.reduce((sum, m) => sum + (m.markObtain || 0), 0);
                              const totalFull = activeSubjs.reduce((sum, sub) => {
                                const mObj = studentMarks.find(m => m.subjectName.toUpperCase() === sub.toUpperCase());
                                return sum + getExamMaxMark(selectedExam, mObj);
                              }, 0) || (activeSubjs.length * getExamMaxMark(selectedExam));
                              const pct = totalFull > 0 ? Math.round((totalObtained / totalFull) * 100) : 0;

                              return (
                                <tr key={`${selectedMarkClass}-${selectedExam}-${st.roll}`} className="hover:bg-slate-800/40 transition-colors font-mono">
                                  <td className="p-3 text-center">
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[11px] ${
                                      idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                      idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40' :
                                      idx === 2 ? 'bg-amber-700/20 text-amber-400 border border-amber-700/40' :
                                      'text-slate-500'
                                    }`}>
                                      #{idx + 1}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center font-bold text-white">{st.roll}</td>
                                  <td className="p-3 font-sans font-extrabold text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                      {st.name.substring(0, 1)}
                                    </div>
                                    {st.name}
                                  </td>

                                  {activeSubjs.map(sub => {
                                    const mObj = studentMarks.find(m => m.subjectName.toUpperCase() === sub.toUpperCase());
                                    const subMaxMark = getExamMaxMark(selectedExam, mObj);

                                    return (
                                      <td key={sub} className="p-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <input
                                            type="number"
                                            min={0}
                                            max={subMaxMark}
                                            value={mObj !== undefined && mObj.markObtain !== undefined ? mObj.markObtain : ''}
                                            onChange={e => {
                                              const rawVal = e.target.value;
                                              setMarks(prev => {
                                                const filtered = prev.filter(
                                                  m => !(normalizeClassName(m.class) === normalizeClassName(selectedMarkClass) &&
                                                        m.examName === selectedExam &&
                                                        m.subjectName.toUpperCase() === sub.toUpperCase() &&
                                                        Number(m.roll) === Number(st.roll))
                                                );
                                                if (rawVal === '') return filtered;
                                                let val = Number(rawVal);
                                                if (isNaN(val)) return filtered;
                                                if (val < 0) val = 0;
                                                if (val > subMaxMark) {
                                                  val = subMaxMark;
                                                  alert(`নম্বর পূর্ণমানের (${subMaxMark}) চেয়ে বেশি দেওয়া সম্ভব নয়! সর্বোচ্চ ${subMaxMark} গ্রহণ করা হয়েছে।`);
                                                }
                                                const pct = Math.round((val / subMaxMark) * 100);
                                                const grade = getGradeFromPercentage(pct);
                                                return [...filtered, {
                                                  class: selectedMarkClass,
                                                  roll: Number(st.roll),
                                                  studentName: st.name,
                                                  examName: selectedExam,
                                                  subjectName: sub,
                                                  markObtain: val,
                                                  totalMark: subMaxMark,
                                                  grade: grade
                                                }];
                                              });
                                            }}
                                            className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-center text-white font-mono font-bold text-xs"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setMarks(prev => {
                                                const filtered = prev.filter(
                                                  m => !(normalizeClassName(m.class) === normalizeClassName(selectedMarkClass) &&
                                                        m.examName === selectedExam &&
                                                        m.subjectName.toUpperCase() === sub.toUpperCase() &&
                                                        Number(m.roll) === Number(st.roll))
                                                );
                                                return [...filtered, {
                                                  class: selectedMarkClass,
                                                  roll: Number(st.roll),
                                                  studentName: st.name,
                                                  examName: selectedExam,
                                                  subjectName: sub,
                                                  markObtain: 0,
                                                  totalMark: subMaxMark,
                                                  grade: 'F',
                                                  remarks: 'ABSENT'
                                                }];
                                              });
                                            }}
                                            className="px-1.5 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded text-[10px] hover:text-white"
                                          >
                                            AB
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  })}

                                  <td className="p-3 text-center font-bold text-white">
                                    {totalObtained} / {totalFull}
                                  </td>
                                  <td className="p-3 text-center font-bold text-cyan-400">
                                    {pct}%
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Result Sub-Tab 2: Single Student Result Card (Image 3) */}
                {resultSubTab === 'single_card' && (
                  <div className="space-y-6">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                      <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">SELECT STUDENT</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {students
                          .filter(st => normalizeClassName(st.class) === normalizeClassName(selectedMarkClass))
                          .map((st, i) => {
                            const isSelected = selectedStudentRoll === st.roll;
                            return (
                              <button
                                key={i}
                                onClick={() => setSelectedStudentRoll(st.roll)}
                                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-lg'
                                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span className="font-extrabold uppercase text-xs">{st.name}</span>
                                <span className="text-[11px] font-mono opacity-80">Roll: {st.roll}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Selected Student Marksheet Card matching Image 3 */}
                    {(() => {
                      const currentStudent = students.find(
                        st => normalizeClassName(st.class) === normalizeClassName(selectedMarkClass) && Number(st.roll) === Number(selectedStudentRoll)
                      ) || students.filter(st => normalizeClassName(st.class) === normalizeClassName(selectedMarkClass))[0];

                      if (!currentStudent) return <p className="text-slate-400 text-xs">ছাত্র নির্বাচন করুন</p>;

                      const studentMarks = marks.filter(
                        m => normalizeClassName(m.class) === normalizeClassName(selectedMarkClass) &&
                        m.examName === selectedExam &&
                        Number(m.roll) === Number(currentStudent.roll)
                      );

                      const classRanksMap = calculateClassRanksMap(selectedMarkClass, selectedExam);
                      const currentRank = classRanksMap[Number(currentStudent.roll)] || 1;

                      // Dynamic subjects extraction
                      const classMarks = marks.filter(
                        m => normalizeClassName(m.class) === normalizeClassName(selectedMarkClass) &&
                        m.examName === selectedExam
                      );
                      const dynamicSubjects = Array.from(new Set([
                        ...studentMarks.map(m => m.subjectName),
                        ...classMarks.map(m => m.subjectName)
                      ])).filter(Boolean);

                      let grandObtained = 0;
                      let grandFull = 0;

                      const subjectRows = dynamicSubjects.map(sub => {
                        const mObj = studentMarks.find(m => m.subjectName.toUpperCase() === sub.toUpperCase());
                        const obtained = mObj ? mObj.markObtain : 0;
                        const fullMark = mObj ? (mObj.totalMark || 100) : 100;
                        grandObtained += obtained;
                        grandFull += fullMark;
                        const pct = fullMark > 0 ? Math.round((obtained / fullMark) * 100) : 0;
                        const grade = getGradeFromPercentage(pct);

                        return { sub, fullMark, obtained, pct, grade };
                      });

                      if (grandFull === 0) grandFull = 100;
                      const overallPercent = Math.round((grandObtained / grandFull) * 100);
                      const overallGrade = getGradeFromPercentage(overallPercent);

                      return (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                              <h3 className="font-black text-white text-lg uppercase">{currentStudent.name}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Father: <span className="text-slate-200">{currentStudent.fatherName || 'N/A'}</span> | Class: <span className="text-cyan-400 font-bold">{currentStudent.class}</span> | Roll: <span className="text-cyan-400 font-bold">#{currentStudent.roll}</span>
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-black uppercase tracking-wider">
                              {selectedExam}
                            </span>
                          </div>

                          {/* Marks Table matching Image 3 */}
                          <div className="overflow-x-auto border border-slate-800 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                                <tr>
                                  <th className="p-3.5">Subject</th>
                                  <th className="p-3.5 text-center">Full Marks</th>
                                  <th className="p-3.5 text-center">Marks Obtained</th>
                                  <th className="p-3.5 text-center">Percentage</th>
                                  <th className="p-3.5 text-center">Grade</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 font-mono">
                                {subjectRows.map(row => (
                                  <tr key={row.sub} className="hover:bg-slate-800/30">
                                    <td className="p-3.5 font-sans font-bold text-white uppercase">{row.sub}</td>
                                    <td className="p-3.5 text-center text-slate-300">{row.fullMark}</td>
                                    <td className="p-3.5 text-center font-bold text-cyan-400">{row.obtained}</td>
                                    <td className="p-3.5 text-center text-slate-300">{row.pct}%</td>
                                    <td className="p-3.5 text-center font-bold text-rose-400">{row.grade}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Summary 4-Stats Grid matching Image 3 */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">TOTAL OBTAINED</div>
                              <div className="text-base font-black text-white font-mono">{grandObtained} / {grandFull}</div>
                            </div>

                            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">OVERALL PERCENT</div>
                              <div className="text-base font-black text-emerald-400 font-mono">{overallPercent}%</div>
                            </div>

                            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">OVERALL GRADE</div>
                              <div className="text-base font-black text-amber-400 font-mono">{overallGrade}</div>
                            </div>

                            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">CLASS RANK</div>
                              <div className="text-base font-black text-indigo-400 font-mono">Rank {currentRank}</div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-bold">প্রিন্ট লেআউট:</span>
                              <select
                                value={printConfigs.marksheet.size}
                                onChange={e => setPrintConfigs(prev => ({
                                  ...prev,
                                  marksheet: { ...prev.marksheet, size: e.target.value as PageSize }
                                }))}
                                className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold"
                              >
                                <option value="A4">A4 সাইজ</option>
                                <option value="A5">A5 সাইজ</option>
                              </select>
                              <select
                                value={printConfigs.marksheet.orientation}
                                onChange={e => setPrintConfigs(prev => ({
                                  ...prev,
                                  marksheet: { ...prev.marksheet, orientation: e.target.value as PageOrientation }
                                }))}
                                className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold"
                              >
                                <option value="portrait">Portrait</option>
                                <option value="landscape">Landscape</option>
                              </select>
                            </div>

                            <button
                              onClick={() => triggerPrint('marksheet')}
                              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                            >
                              <Printer className="w-4 h-4" /> Print Single Marksheet (মার্কশিট প্রিন্ট)
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Result Sub-Tab 3: Subject-wise Marks List (Image 4) */}
                {resultSubTab === 'subject_wise' && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h4 className="font-extrabold text-white text-base">Subject-wise Marks List (বিষয়ভিত্তিক নম্বর)</h4>
                        <p className="text-xs text-slate-400 mt-0.5">নির্দিষ্ট বিষয়ের মেধা তালিকা দেখুন</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold">Select Subject:</span>
                        <select
                          value={selectedSubject}
                          onChange={e => setSelectedSubject(e.target.value)}
                          className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold uppercase"
                        >
                          {getEffectiveSubjectsForClass(selectedMarkClass, selectedExam).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Table matching Image 4 */}
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-3.5 w-20 text-center">Roll</th>
                            <th className="p-3.5">Student Name</th>
                            <th className="p-3.5 text-center">Marks Obtained</th>
                            <th className="p-3.5 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 font-mono">
                          {selectedMarkClassStudents.map((st, idx) => {
                              const key = `${normalizeClassName(selectedMarkClass)}|${selectedExam}|${(selectedSubject || '').toUpperCase()}|${st.roll}`;
                              const mObj = marksLookupMap.get(key);

                              const maxM = getExamMaxMark(selectedExam, mObj);
                              const obtained = mObj !== undefined && mObj.markObtain !== undefined ? mObj.markObtain : '-';
                              const pct = mObj && typeof mObj.markObtain === 'number' ? Math.round((mObj.markObtain / maxM) * 100) : null;
                              const grade = pct !== null ? getGradeFromPercentage(pct) : '-';

                              return (
                                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                                  <td className="p-3.5 text-center font-bold text-white">{st.roll}</td>
                                  <td className="p-3.5 font-sans font-extrabold text-cyan-400 uppercase">{st.name}</td>
                                  <td className="p-3.5 text-center font-bold text-slate-300">{obtained} / {maxM}</td>
                                  <td className="p-3.5 text-center">
                                    <span className={`px-2 py-0.5 rounded font-bold ${
                                      grade === 'A+' || grade === 'A' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                      grade === 'B' || grade === 'C' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                      grade === 'F' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                      'bg-slate-800 text-slate-400'
                                    }`}>
                                      {grade}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: Exam Setup (Image 5) */}
            {examSubTab === 'exam_setup' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                      <Settings className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-base">Configure Class Subjects (বিষয় বিন্যাস)</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        শ্রেণীভিত্তিক বিষয়, প্রিন্ট লেআউট এবং পরীক্ষার পূর্ণমান নির্ধারণের পৃষ্ঠা
                      </p>
                    </div>
                  </div>

                  <button className="px-3.5 py-2 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold hover:bg-indigo-600/30 cursor-pointer flex items-center gap-1.5">
                    ⚙️ বিস্তারিত টেবিল মোড (Detailed Mode)
                  </button>
                </div>

                {/* Form matching Image 5 */}
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">SELECT CLASS *</label>
                    <select
                      value={selectedMarkClass}
                      onChange={e => setSelectedMarkClass(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">CLASS SUBJECTS (কমা দিয়ে আলাদা করুন) *</label>
                    <textarea
                      rows={3}
                      value={rawSubjectsText}
                      onChange={e => setRawSubjectsText(e.target.value)}
                      onBlur={() => {
                        const list = rawSubjectsText
                          .split(',')
                          .map(s => s.trim().toUpperCase())
                          .filter(Boolean);
                        setClassSubjectsConfig(prev => ({
                          ...prev,
                          [selectedMarkClass]: list
                        }));
                      }}
                      className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      প্রত্যেক ক্লাসের জন্য আলাদা আলাদা নির্ধারিত বিষয় নির্বাচন করুন (ইংরেজি বড় হাতের কমা সহ)।
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">PRINT TEMPLATE LAYOUT</label>
                    <select className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold">
                      <option value="Classic Institutional">Classic Institutional (ঐতিহ্যবাহী)</option>
                      <option value="Modern Compact">Modern Compact (আধুনিক সংক্ষেপ)</option>
                    </select>
                  </div>

                  {/* Evaluation Full Marks Box matching Image 5 */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <h5 className="font-extrabold text-cyan-400 text-xs flex items-center gap-1.5">
                      <Award className="w-4 h-4" /> Evaluation Full Marks (মূল্যায়নের পূর্ণমান)
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">1st Summative</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={evalFullMarksInput['1st Summative Evaluation'] ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEvalFullMarksInput(prev => ({ ...prev, '1st Summative Evaluation': val }));
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num > 0) {
                              setEvalFullMarks(prev => ({ ...prev, '1st Summative Evaluation': num }));
                            }
                          }}
                          onBlur={() => {
                            const num = parseInt(evalFullMarksInput['1st Summative Evaluation'] || '', 10);
                            const valid = isNaN(num) || num < 1 ? 40 : num;
                            setEvalFullMarksInput(prev => ({ ...prev, '1st Summative Evaluation': String(valid) }));
                            setEvalFullMarks(prev => ({ ...prev, '1st Summative Evaluation': valid }));
                          }}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-center"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">2nd Summative</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={evalFullMarksInput['2nd Summative Evaluation'] ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEvalFullMarksInput(prev => ({ ...prev, '2nd Summative Evaluation': val }));
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num > 0) {
                              setEvalFullMarks(prev => ({ ...prev, '2nd Summative Evaluation': num }));
                            }
                          }}
                          onBlur={() => {
                            const num = parseInt(evalFullMarksInput['2nd Summative Evaluation'] || '', 10);
                            const valid = isNaN(num) || num < 1 ? 50 : num;
                            setEvalFullMarksInput(prev => ({ ...prev, '2nd Summative Evaluation': String(valid) }));
                            setEvalFullMarks(prev => ({ ...prev, '2nd Summative Evaluation': valid }));
                          }}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-center"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">3rd Summative</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={evalFullMarksInput['3rd Summative Evaluation'] ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEvalFullMarksInput(prev => ({ ...prev, '3rd Summative Evaluation': val }));
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num > 0) {
                              setEvalFullMarks(prev => ({ ...prev, '3rd Summative Evaluation': num }));
                            }
                          }}
                          onBlur={() => {
                            const num = parseInt(evalFullMarksInput['3rd Summative Evaluation'] || '', 10);
                            const valid = isNaN(num) || num < 1 ? 100 : num;
                            setEvalFullMarksInput(prev => ({ ...prev, '3rd Summative Evaluation': String(valid) }));
                            setEvalFullMarks(prev => ({ ...prev, '3rd Summative Evaluation': valid }));
                          }}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-center"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      শ্রেণীভিত্তিক প্রতিটি বিষয়ের মূল্যায়নের পূর্ণমান নির্ধারণ করুন (যেমন: ১০, ২০, ৫০ অথবা ১০, ২০, ৫০)।
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        const parsedSubjects = rawSubjectsText
                          .split(',')
                          .map(s => s.trim().toUpperCase())
                          .filter(Boolean);

                        const updatedSubjectsConfig = {
                          ...classSubjectsConfig,
                          [selectedMarkClass]: parsedSubjects
                        };
                        setClassSubjectsConfig(updatedSubjectsConfig);

                        const updatedEvalMarks: Record<string, number> = {
                          '1st Summative Evaluation': Math.max(1, parseInt(evalFullMarksInput['1st Summative Evaluation'] || '40', 10) || 40),
                          '2nd Summative Evaluation': Math.max(1, parseInt(evalFullMarksInput['2nd Summative Evaluation'] || '50', 10) || 50),
                          '3rd Summative Evaluation': Math.max(1, parseInt(evalFullMarksInput['3rd Summative Evaluation'] || '100', 10) || 100)
                        };
                        setEvalFullMarks(updatedEvalMarks);

                        safeLocalStorageSetItem(`classSubjects_${school.schoolId}`, JSON.stringify(updatedSubjectsConfig));
                        safeLocalStorageSetItem(`evalFullMarks_${school.schoolId}`, JSON.stringify(updatedEvalMarks));

                        const updateExisting = window.confirm(
                          `'${selectedMarkClass}' শ্রেণীর বিষয় বিন্যাস এবং মূল্যায়নের পূর্ণমান সফলভাবে সংরক্ষণ করা হয়েছে!\n\n` +
                          `পূর্বে এই শ্রেণীর এন্ট্রি করা সব নম্বর রেকর্ডের Full Mark-ও কি নতুন পূর্ণমানে (1st: ${updatedEvalMarks['1st Summative Evaluation']}, 2nd: ${updatedEvalMarks['2nd Summative Evaluation']}, 3rd: ${updatedEvalMarks['3rd Summative Evaluation']}) আপডেট করতে চান?`
                        );

                        if (updateExisting) {
                          const normSelectedClass = normalizeClassName(selectedMarkClass);
                          const updatedMarks = marks.map(m => {
                            if (normalizeClassName(m.class) === normSelectedClass || selectedMarkClass === 'ALL') {
                              const newFull = updatedEvalMarks[m.examName] || (m.examName.includes('1st') ? 40 : m.examName.includes('2nd') ? 50 : 100);
                              return { ...m, totalMark: newFull };
                            }
                            return m;
                          });

                          setMarks(updatedMarks);
                          const affectedMarks = updatedMarks.filter(m => normalizeClassName(m.class) === normSelectedClass || selectedMarkClass === 'ALL');
                          if (affectedMarks.length > 0) {
                            saveMarksBatchToFirestore(school.schoolId, affectedMarks)
                              .then(() => alert('ফায়ারস্টোরে পূর্বে এন্ট্রি করা মার্কসের Full Mark সফলভাবে আপডেট হয়েছে!'))
                              .catch(err => console.error('Batch save error:', err));
                          }
                        } else {
                          alert(`'${selectedMarkClass}' শ্রেণীর নতুন সেটআপ সফলভাবে সেভ করা হয়েছে!`);
                        }
                      }}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                      Save Configuration (সেটআপ সেভ)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 4: Exam Routine (Image 6) */}
            {examSubTab === 'exam_routine' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="font-extrabold text-white text-base">
                      Exam Routine Setup Panel (পরীক্ষার রুটিন সেটআপ)
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      শ্রেণী ও পরীক্ষা অনুযায়ী পরীক্ষার তারিখ এবং সময় নির্ধারণ করুন
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold mr-1">Class:</label>
                      <select
                        value={selectedMarkClass}
                        onChange={e => setSelectedMarkClass(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                      >
                        {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-bold mr-1">Exam:</label>
                      <select
                        value={selectedExam}
                        onChange={e => setSelectedExam(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                      >
                        <option value="1st Summative Evaluation">1st Summative Evaluation</option>
                        <option value="2nd Summative Evaluation">2nd Summative Evaluation</option>
                        <option value="3rd Summative Evaluation">3rd Summative Evaluation</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Routine Table matching Image 6 */}
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3.5 w-40">Subject Name (বিষয়)</th>
                        <th className="p-3.5 w-48">Date of Exam (তারিখ)</th>
                        <th className="p-3.5 w-56">Time Period (সময়)</th>
                        <th className="p-3.5">Quick Presets (সময় প্রিসেট)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                      {getEffectiveSubjectsForClass(selectedMarkClass, selectedExam).map(sub => (
                        <tr key={sub} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-white uppercase">{sub}</td>
                          <td className="p-3.5">
                            <input
                              type="date"
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-xs"
                            />
                          </td>
                          <td className="p-3.5">
                            <input
                              type="text"
                              placeholder="e.g. 11:00 AM - 01:30 PM"
                              defaultValue="11:00 AM - 01:30 PM"
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-xs"
                            />
                          </td>
                          <td className="p-3.5">
                            <div className="grid grid-cols-2 gap-1.5">
                              {['11:00 AM - 12:30 PM', '11:00 AM - 01:00 PM', '11:00 AM - 01:30 PM', '02:00 PM - 04:00 PM'].map(preset => (
                                <button
                                  type="button"
                                  key={preset}
                                  className="px-2 py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-[10px] font-mono cursor-pointer"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => alert('পরীক্ষার রুটিন সফলভাবে সেভ করা হয়েছে!')}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    Save Exam Routine (রুটিন সেভ করুন)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADMIT CARD TAB */}
        {activeTab === 'admit' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4 no-print shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    প্রবেশ পত্র জেনারেটর (Admit Card Generator)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">পরীক্ষার এডমিট কার্ড সিলেক্ট করে সরাসরি প্রিন্ট করুন (সিঙ্গেল ক্লাস বা একাধিক ক্লাসের শিক্ষার্থী একসাথে)</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-bold">পরীক্ষা (Exam)</label>
                    <select
                      value={admitExam}
                      onChange={e => setAdmitExam(e.target.value)}
                      className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="1st Summative Evaluation">1st Summative Evaluation</option>
                      <option value="2nd Summative Evaluation">2nd Summative Evaluation</option>
                      <option value="3rd Summative Evaluation">3rd Summative Evaluation</option>
                    </select>
                  </div>

                  <button
                    onClick={() => window.print()}
                    className="mt-4 sm:mt-0 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> প্রবেশপত্র প্রিন্ট করুন ({filterPrintStudents(students, admitSelectionMode, admitClass, admitSingleRoll, admitSelectedKeys, showInactiveStudents).length} জন)
                  </button>
                </div>
              </div>

              {/* Enhanced Student Selection Component (All, Single, Ticked, Multi-Class) */}
              <StudentPrintSelector
                mode={admitSelectionMode}
                onModeChange={setAdmitSelectionMode}
                selectedKeys={admitSelectedKeys}
                onSelectedKeysChange={setAdmitSelectedKeys}
                currentClass={admitClass}
                onClassChange={setAdmitClass}
                singleRoll={admitSingleRoll}
                onSingleRollChange={setAdmitSingleRoll}
                availableClasses={availableClassNames}
                allStudents={students}
                showInactive={showInactiveStudents}
                themeColor="indigo"
                docTitle="প্রবেশপত্র (Admit Card)"
              />
            </div>

            {/* Printable Admit Cards List */}
            <div className="printable-area space-y-8">
              {filterPrintStudents(students, admitSelectionMode, admitClass, admitSingleRoll, admitSelectedKeys, showInactiveStudents)
                .map((st, idx) => (
                  <div 
                    key={idx} 
                    className="bg-white text-slate-900 border-2 border-indigo-900 p-6 rounded-2xl max-w-3xl mx-auto shadow-2xl relative page-break font-sans mb-6"
                  >
                    {/* Header */}
                    <div className="text-center border-b-2 border-indigo-900 pb-4 mb-4">
                      <div className="flex items-center justify-center gap-3">
                        {school.logo ? (
                          <img src={school.logo} alt="Logo" className="w-12 h-12 object-contain" />
                        ) : (
                          <div className="w-12 h-12 bg-indigo-900 text-white font-bold rounded-full flex items-center justify-center text-xl">
                            {school.name.substring(0, 1)}
                          </div>
                        )}
                        <div>
                          <h2 className="text-xl font-black text-indigo-950 uppercase tracking-tight">{school.name}</h2>
                          <p className="text-xs font-semibold text-slate-600">{school.address}</p>
                        </div>
                      </div>
                      <div className="mt-3 inline-block px-6 py-1 bg-indigo-900 text-white font-black text-xs uppercase tracking-wider rounded-full shadow">
                        {admitExam} - ADMIT CARD (প্রবেশ পত্র) - {school.currentAcademicYear || '2026'}
                      </div>
                    </div>

                    {/* Student Info & Photo Frame */}
                    <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
                      <div className="col-span-2 space-y-1.5">
                        <div className="grid grid-cols-3">
                          <span className="font-bold text-slate-600">শিক্ষার্থীর নাম:</span>
                          <span className="col-span-2 font-bold text-indigo-950 text-sm">{st.name}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span className="font-bold text-slate-600">স্টুডেন্ট আইডি:</span>
                          <span className="col-span-2 font-mono font-bold text-indigo-900 text-xs">{generateStandardStudentId(school, st)}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span className="font-bold text-slate-600">শ্রেণী (Class):</span>
                          <span className="col-span-2 font-semibold text-slate-900">{st.class}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span className="font-bold text-slate-600">রোল নম্বর (Roll):</span>
                          <span className="col-span-2 font-bold text-indigo-900 text-sm">#{st.roll}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span className="font-bold text-slate-600">অভিভাবকের নাম:</span>
                          <span className="col-span-2 font-medium text-slate-800">{st.fatherName || '-'}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span className="font-bold text-slate-600">যোগাযোগ নম্বর:</span>
                          <span className="col-span-2 font-mono text-slate-800">{st.phone || '-'}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-2 text-center bg-slate-50">
                        <User className="w-10 h-10 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-500 font-semibold">শিক্ষার্থীর ছবি</span>
                      </div>
                    </div>

                    {/* Exam Schedule Table */}
                    <div className="mb-6">
                      <h4 className="font-bold text-xs text-indigo-900 mb-1">পরীক্ষার বিষয়সূচী (Exam Schedule):</h4>
                      <table className="w-full border-collapse border border-slate-300 text-xs text-left">
                        <thead>
                          <tr className="bg-indigo-50 text-indigo-950 font-bold">
                            <th className="border border-slate-300 p-1.5">বিষয় (Subject)</th>
                            <th className="border border-slate-300 p-1.5">পরীক্ষার সময়</th>
                            <th className="border border-slate-300 p-1.5 text-center">পরিদর্শকের স্বাক্ষর</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['বাংলা (Bengali)', 'ইংরেজি (English)', 'গণিত (Mathematics)', 'পরিবেশ ও বিজ্ঞান (EVS)', 'শারীর শিক্ষা'].map((sub, sIdx) => (
                            <tr key={sIdx} className="hover:bg-slate-50">
                              <td className="border border-slate-300 p-1.5 font-medium">{sub}</td>
                              <td className="border border-slate-300 p-1.5 font-mono text-[11px]">১১:০০ AM - ০১:৩০ PM</td>
                              <td className="border border-slate-300 p-1.5 text-center text-slate-300">...............</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer & Signatures */}
                    <div className="pt-4 border-t border-slate-200 flex items-end justify-between text-xs">
                      <div className="text-[10px] text-slate-500 max-w-xs space-y-0.5">
                        <p className="font-bold text-slate-700">নিয়মাবলী:</p>
                        <p>১. প্রবেশপত্র পরীক্ষা হলে সাথে আনা বাধ্যতামূলক।</p>
                        <p>২. পরীক্ষা শুরুর ১৫ মিনিট পূর্বে নির্দিষ্ট স্থানে বসতে হবে।</p>
                      </div>

                      <div className="text-center space-y-1">
                        {school.signature ? (
                          <img src={school.signature} alt="Sign" className="h-8 mx-auto object-contain" />
                        ) : (
                          <div className="h-8" />
                        )}
                        <div className="border-t border-slate-900 pt-0.5 font-bold text-indigo-950 text-xs">
                          ভারপ্রাপ্ত শিক্ষক / প্রধান শিক্ষকের স্বাক্ষর
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* MARKSHEET TAB */}
        {activeTab === 'marksheet' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4 no-print">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-teal-400" />
                    ডাইনামিক মাল্টি-স্টাইল মার্কশিট জেনারেটর (Dynamic Multi-Style Marksheet Hub)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    4টি প্রিমিয়াম ডিজাইন, মাল্টি-কালার থিম, 3-সামেটিভ রেজাল্ট, স্টুডেন্ট ফিল্টার ও ১-পেজে ফিট প্রিন্ট অপশন
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Dropdown 1: Marksheet Style */}
                  <div>
                    <label className="block text-[11px] text-teal-300 font-bold mb-1">1. ডিজাইন স্টাইল (Style)</label>
                    <select
                      value={marksheetStyle}
                      onChange={e => setMarksheetStyle(e.target.value as MarksheetStyle)}
                      className="px-3 py-1.5 bg-slate-950 border border-teal-500/50 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="styleA">Style A: Modern Green Header Banner</option>
                      <option value="styleB">Style B: Cream Soft Certificate Format</option>
                      <option value="styleC">Style C: Double Border Corner Accents</option>
                      <option value="styleD">Style D: Formal Master Ledger (3-Summative)</option>
                    </select>
                  </div>

                  {/* Dropdown 2: Color Theme */}
                  <div>
                    <label className="block text-[11px] text-teal-300 font-bold mb-1">2. কালার থিম (Color)</label>
                    <select
                      value={marksheetColor}
                      onChange={e => setMarksheetColor(e.target.value as MarksheetColor)}
                      className="px-3 py-1.5 bg-slate-950 border border-teal-500/50 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="emerald">Emerald Green (মরকত সবুজ)</option>
                      <option value="navy">Royal Navy Blue (রয়েল নেভি ব্লু)</option>
                      <option value="maroon">Deep Crimson Maroon (গাঢ় মেরুন)</option>
                      <option value="charcoal">Charcoal Gold (চারকোল গোল্ড)</option>
                    </select>
                  </div>

                  {/* Dropdown 3: Paper Size */}
                  <div>
                    <label className="block text-[11px] text-slate-300 font-bold mb-1">3. পেপার সাইজ</label>
                    <select
                      value={marksheetPaperSize}
                      onChange={e => setMarksheetPaperSize(e.target.value as PageSize)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="A4">A4 Paper</option>
                      <option value="A5">A5 Paper</option>
                    </select>
                  </div>

                  {/* Dropdown 4: Orientation */}
                  <div>
                    <label className="block text-[11px] text-slate-300 font-bold mb-1">4. ওরিয়েন্টেশন</label>
                    <select
                      value={marksheetOrientation}
                      onChange={e => setMarksheetOrientation(e.target.value as PageOrientation)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="portrait">Portrait (লম্বালম্বি)</option>
                      <option value="landscape">Landscape (আড়াআড়ি)</option>
                    </select>
                  </div>

                  {/* Dropdown 5: Academic Year */}
                  <div>
                    <label className="block text-[11px] text-amber-300 font-bold mb-1">5. শিক্ষাবর্ষ (Academic Year)</label>
                    <select
                      value={marksheetAcademicYear}
                      onChange={e => setMarksheetAcademicYear(e.target.value)}
                      className="px-3 py-1.5 bg-slate-950 border border-amber-500/60 rounded-xl text-xs text-amber-300 font-bold"
                    >
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                      <option value="2027">2027</option>
                      <option value="2028">2028</option>
                    </select>
                  </div>

                  {/* Dropdown 6: Exam Type */}
                  <div>
                    <label className="block text-[11px] text-slate-300 font-bold mb-1">6. মূল্যায়ন / পরীক্ষা</label>
                    <select
                      value={marksheetExam}
                      onChange={e => setMarksheetExam(e.target.value)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="1st Summative Evaluation">1st Summative Evaluation</option>
                      <option value="2nd Summative Evaluation">2nd Summative Evaluation</option>
                      <option value="3rd Summative Evaluation">3rd Summative Evaluation (Final)</option>
                    </select>
                  </div>

                  {/* Dropdown 7: Class */}
                  {marksheetSelectionMode !== 'MULTI_CLASS' && (
                    <div>
                      <label className="block text-[11px] text-slate-300 font-bold mb-1">7. শ্রেণী (Class)</label>
                      <select
                        value={marksheetClass}
                        onChange={e => {
                          const newCls = e.target.value;
                          setMarksheetClass(newCls);
                          const newClsStudents = students.filter(st => normalizeClassName(st.class) === normalizeClassName(newCls));
                          if (newClsStudents.length > 0) {
                            setMarksheetSingleRoll(String(newClsStudents[0].roll));
                            setMarksheetSelectedKeys(newClsStudents.map(getStudentKey));
                          } else {
                            setMarksheetSingleRoll('1');
                            setMarksheetSelectedKeys([]);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                      >
                        {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => triggerPrint('marksheet')}
                      className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-xl transition-all cursor-pointer flex items-center gap-2 border border-teal-300"
                    >
                      <Printer className="w-4 h-4" /> মার্কশিট প্রিন্ট / PDF সেভ করুন ({filterPrintStudents(students, marksheetSelectionMode, marksheetClass, marksheetSingleRoll, marksheetSelectedKeys, showInactiveStudents).length} জন)
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Print Selector Component for Marksheets */}
              <StudentPrintSelector
                mode={marksheetSelectionMode}
                onModeChange={setMarksheetSelectionMode}
                selectedKeys={marksheetSelectedKeys}
                onSelectedKeysChange={setMarksheetSelectedKeys}
                currentClass={marksheetClass}
                onClassChange={setMarksheetClass}
                singleRoll={marksheetSingleRoll}
                onSingleRollChange={setMarksheetSingleRoll}
                availableClasses={availableClassNames}
                allStudents={students}
                showInactive={showInactiveStudents}
                themeColor="teal"
                docTitle="মার্কশিট (Marksheet)"
              />
            </div>

            {/* Printable Marksheets Area */}
            <div className="printable-area space-y-8 print:space-y-0 print:p-0 print:m-0 print:border-none print:shadow-none">
              {filterPrintStudents(students, marksheetSelectionMode, marksheetClass, marksheetSingleRoll, marksheetSelectedKeys, showInactiveStudents)
                .map((st, idx) => (
                  <MarksheetRenderer
                    key={getStudentKey(st) || idx}
                    student={st}
                    allStudents={students}
                    allMarks={marks}
                    school={school}
                    examType={marksheetExam}
                    styleType={marksheetStyle}
                    colorTheme={marksheetColor}
                    pageSize={marksheetPaperSize}
                    orientation={marksheetOrientation}
                    academicYear={marksheetAcademicYear}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ID CARD / PRINT HUB TAB matching Image 8 */}
        {activeTab === 'idcard' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl no-print">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    Print Hub & Document Portal <span className="text-cyan-400 font-normal">/ অল-ইন-ওয়ান প্রিন্ট হাব</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    আইডি কার্ড, এডমিট কার্ড, মার্কশিট, রেসাল্ট, ম্যানুয়াল নম্বর ইনপুট শিট, ট্যাবুলেশন শিট ও শিক্ষার্থী রেজিস্টার প্রিন্ট
                  </p>
                </div>
              </div>

              {/* Action Pills */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <button 
                  onClick={() => setPrintHubSubTab('idcard')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'idcard' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  আইডি কার্ড (ID Card)
                </button>
                <button 
                  onClick={() => setPrintHubSubTab('admit')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'admit' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  এডমিট কার্ড (Admit Card)
                </button>
                <button 
                  onClick={() => setPrintHubSubTab('marksheet')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'marksheet' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  মার্কশিট (Marksheet)
                </button>
                <button 
                  onClick={() => setPrintHubSubTab('result')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'result' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  রেসাল্ট (Result)
                </button>
                <button 
                  onClick={() => setPrintHubSubTab('manualmarks')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'manualmarks' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  ম্যানুয়াল বিষয়ভিত্তিক নম্বর শিট
                </button>
                <button 
                  onClick={() => setPrintHubSubTab('manualtabulation')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'manualtabulation' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  ম্যানুয়াল ট্যাবুলেশন শিট
                </button>
                <button 
                  onClick={() => setPrintHubSubTab('studentlist')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'studentlist' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  শিক্ষার্থী তালিকা
                </button>
                <button 
                  onClick={() => setPrintHubSubTab('vehiclelist')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    printHubSubTab === 'vehiclelist' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  পরিবহন তালিকা
                </button>
              </div>
            </div>

            {/* Filter Bar & Print Controls */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 no-print shadow-xl">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  {/* Class Filter for general tabs */}
                  {!['idcard', 'admit', 'marksheet'].includes(printHubSubTab) && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-300 whitespace-nowrap">শ্রেণী (Class):</label>
                      <select
                        value={idCardClass}
                        onChange={e => setIdCardClass(e.target.value)}
                        className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                      >
                        <option value="ALL">সকল শ্রেণী (All Classes)</option>
                        {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Exam Filter - Show for Exam related printables */}
                  {['admit', 'marksheet', 'result', 'manualmarks', 'manualtabulation'].includes(printHubSubTab) && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-300 whitespace-nowrap">পরীক্ষা (Exam):</label>
                      <select
                        value={printHubExam}
                        onChange={e => {
                          setPrintHubExam(e.target.value);
                          setMarksheetExam(e.target.value);
                          setAdmitExam(e.target.value);
                        }}
                        className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value="1st Summative Evaluation">1st Summative Evaluation</option>
                        <option value="2nd Summative Evaluation">2nd Summative Evaluation</option>
                        <option value="3rd Summative Evaluation">3rd Summative Evaluation</option>
                      </select>
                    </div>
                  )}

                  {/* Subject Filter - Show for manual marksheet */}
                  {printHubSubTab === 'manualmarks' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-300 whitespace-nowrap">বিষয় (Subject):</label>
                      <select
                        value={printHubSubject}
                        onChange={e => setPrintHubSubject(e.target.value)}
                        className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                      >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}

                  {/* ID CARD SPECIFIC EXTRA CONTROLS */}
                  {printHubSubTab === 'idcard' && (
                    <>
                      {/* Template Selector (Template 1 vs Template 2 vs Template 3 vs Template 4) */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-amber-300 whitespace-nowrap">টেমপ্লেট (Design):</label>
                        <select
                          value={idCardTemplate}
                          onChange={e => setIdCardTemplate(e.target.value as IdCardTemplateType)}
                          className="px-3 py-2 bg-slate-950 border border-amber-500/60 rounded-xl text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                        >
                          <option value="template1">টেমপ্লেট ১: ক্লাসিক ব্লু ও গোল্ড (Template 1)</option>
                          <option value="template2">টেমপ্লেট ২: মডার্ন ইয়েলো ও রেড (Template 2)</option>
                          <option value="template3">টেমপ্লেট ৩: সায়ান ও ডার্ক নেভি (Template 3 — Ginyard Style)</option>
                          <option value="template4">টেমপ্লেট ৪: স্কুলহাব ব্র্যান্ডেড (Template 4 — Navy/Purple Gradient)</option>
                        </select>
                      </div>

                      {/* View Mode (A4 Sheet 9-Grid vs Responsive Cards) */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-300 whitespace-nowrap">ভিউ মোড (Layout):</label>
                        <select
                          value={idCardViewMode}
                          onChange={e => setIdCardViewMode(e.target.value as 'sheet' | 'grid')}
                          className="px-3 py-2 bg-slate-950 border border-sky-500/50 rounded-xl text-xs text-cyan-300 font-bold"
                        >
                          <option value="sheet">A4 পেজ শিট (৯টি প্রতি পেজ - 3x3)</option>
                          <option value="grid">কার্ড গ্রিড মোড (Card Grid Preview)</option>
                        </select>
                      </div>

                      {/* Cutting Guide Checkbox */}
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={idCardShowCuttingGuide}
                            onChange={e => setIdCardShowCuttingGuide(e.target.checked)}
                            className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                          />
                          <span>কাটিং গাইড ড্যাশড লাইন</span>
                        </label>
                      </div>
                    </>
                  )}

                  {/* MARKSHEET SPECIFIC EXTRA CONTROLS */}
                  {printHubSubTab === 'marksheet' && (
                    <>
                      {/* Design Style */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-300 whitespace-nowrap">ডিজাইন (Style):</label>
                        <select
                          value={marksheetStyle}
                          onChange={e => setMarksheetStyle(e.target.value as MarksheetStyle)}
                          className="px-3 py-2 bg-slate-950 border border-teal-500/50 rounded-xl text-xs text-white font-bold"
                        >
                          <option value="styleA">Style A: Modern Green</option>
                          <option value="styleB">Style B: Cream Soft</option>
                          <option value="styleC">Style C: Double Border</option>
                          <option value="styleD">Style D: Master Ledger</option>
                        </select>
                      </div>

                      {/* Color Theme */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-300 whitespace-nowrap">কালার (Color):</label>
                        <select
                          value={marksheetColor}
                          onChange={e => setMarksheetColor(e.target.value as MarksheetColor)}
                          className="px-3 py-2 bg-slate-950 border border-teal-500/50 rounded-xl text-xs text-white font-bold"
                        >
                          <option value="emerald">Emerald Green</option>
                          <option value="navy">Royal Navy Blue</option>
                          <option value="maroon">Deep Crimson Maroon</option>
                          <option value="charcoal">Charcoal Gold</option>
                        </select>
                      </div>

                      {/* Paper Size */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-300 whitespace-nowrap">পেজ সাইজ (Page):</label>
                        <select
                          value={marksheetPaperSize}
                          onChange={e => setMarksheetPaperSize(e.target.value as PageSize)}
                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                        >
                          <option value="A4">A4 Paper</option>
                          <option value="A5">A5 Paper</option>
                        </select>
                      </div>

                      {/* Academic Year */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-amber-300 whitespace-nowrap">শিক্ষাবর্ষ (Year):</label>
                        <select
                          value={marksheetAcademicYear}
                          onChange={e => setMarksheetAcademicYear(e.target.value)}
                          className="px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-bold"
                        >
                          <option value="2026">2026</option>
                          <option value="2025">2025</option>
                          <option value="2024">2024</option>
                          <option value="2027">2027</option>
                          <option value="2028">2028</option>
                        </select>
                      </div>

                      {/* Orientation */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-300 whitespace-nowrap">ওরিয়েন্টেশন:</label>
                        <select
                          value={marksheetOrientation}
                          onChange={e => setMarksheetOrientation(e.target.value as PageOrientation)}
                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                        >
                          <option value="portrait">Portrait (লম্বালম্বি)</option>
                          <option value="landscape">Landscape (আড়াআড়ি)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => printHubSubTab === 'marksheet' ? triggerPrint('marksheet') : window.print()}
                  className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                >
                  <Printer className="w-4 h-4" /> {printHubSubTab === 'marksheet' ? `মার্কশিট প্রিন্ট / PDF (${filteredPrintStudents.length} জন)` : `প্রিন্ট ডকুমেন্ট (${filteredPrintStudents.length} জন)`}
                </button>
              </div>

              {/* Student Print Selector for ID Card & Admit Print Hub */}
              {['idcard', 'admit'].includes(printHubSubTab) && (
                <StudentPrintSelector
                  mode={idCardSelectionMode}
                  onModeChange={setIdCardSelectionMode}
                  selectedKeys={idCardSelectedKeys}
                  onSelectedKeysChange={setIdCardSelectedKeys}
                  currentClass={idCardClass}
                  onClassChange={setIdCardClass}
                  singleRoll={idCardSingleRoll}
                  onSingleRollChange={setIdCardSingleRoll}
                  availableClasses={availableClassNames}
                  allStudents={students}
                  showInactive={showInactiveStudents}
                  themeColor={printHubSubTab === 'idcard' ? 'sky' : 'indigo'}
                  docTitle={printHubSubTab === 'idcard' ? 'আইডি কার্ড (ID Card)' : 'প্রবেশপত্র (Admit Card)'}
                />
              )}

              {/* Student Print Selector for Marksheet Print Hub */}
              {printHubSubTab === 'marksheet' && (
                <StudentPrintSelector
                  mode={marksheetSelectionMode}
                  onModeChange={setMarksheetSelectionMode}
                  selectedKeys={marksheetSelectedKeys}
                  onSelectedKeysChange={setMarksheetSelectedKeys}
                  currentClass={marksheetClass}
                  onClassChange={setMarksheetClass}
                  singleRoll={marksheetSingleRoll}
                  onSingleRollChange={setMarksheetSingleRoll}
                  availableClasses={availableClassNames}
                  allStudents={students}
                  showInactive={showInactiveStudents}
                  themeColor="teal"
                  docTitle="মার্কশিট (Marksheet)"
                />
              )}

              {/* Print Hub Batch Navigation UI Bar */}
              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs no-print shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-slate-300 whitespace-nowrap">ব্যাচ সাইজ (Batch Size):</label>
                    <select
                      value={printHubBatchSize}
                      onChange={e => {
                        const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                        setPrintHubBatchSize(val);
                        setPrintHubBatchPage(1);
                      }}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                    >
                      <option value={25}>২৫ জন (25 per batch)</option>
                      <option value={50}>৫০ জন (50 per batch)</option>
                      <option value={100}>১০০ জন (100 per batch)</option>
                      <option value="ALL">সকল শিক্ষার্থী (ALL)</option>
                    </select>
                  </div>

                  {filteredPrintStudents.length > 0 && (
                    <div className="text-slate-300 font-medium bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                      <span>মোট <strong className="text-cyan-400">{filteredPrintStudents.length}</strong> জনের মধ্যে</span>
                      <strong className="text-amber-300">
                        {printHubBatchSize === 'ALL'
                          ? `১-${filteredPrintStudents.length}`
                          : `${(printHubBatchPage - 1) * printHubBatchSize + 1}-${Math.min(printHubBatchPage * printHubBatchSize, filteredPrintStudents.length)}`}
                      </strong>
                      <span>জন দেখানো হচ্ছে</span>
                      {printHubBatchSize !== 'ALL' && (
                        <span className="text-slate-400"> (ব্যাচ <strong className="text-white">{printHubBatchPage}</strong> / {Math.ceil(filteredPrintStudents.length / printHubBatchSize)})</span>
                      )}
                    </div>
                  )}
                </div>

                {printHubBatchSize !== 'ALL' && filteredPrintStudents.length > printHubBatchSize && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      disabled={printHubBatchPage <= 1}
                      onClick={() => setPrintHubBatchPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      &larr; পূর্ববর্তী ব্যাচ
                    </button>
                    <span className="font-extrabold text-cyan-300 px-2 py-1 bg-slate-900 rounded-lg border border-slate-800">
                      {printHubBatchPage} / {Math.ceil(filteredPrintStudents.length / printHubBatchSize)}
                    </span>
                    <button
                      disabled={printHubBatchPage >= Math.ceil(filteredPrintStudents.length / printHubBatchSize)}
                      onClick={() => setPrintHubBatchPage(p => Math.min(Math.ceil(filteredPrintStudents.length / printHubBatchSize), p + 1))}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      পরবর্তী ব্যাচ &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-tab 1: ID Cards Grid */}
            {printHubSubTab === 'idcard' && (
              <div className="space-y-8">
                {/* Information and print instruction header */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs no-print shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div>
                    <span className="text-slate-300 font-semibold">
                      মোট প্রস্তুতকৃত আইডি কার্ড: <strong className="text-cyan-300 font-extrabold">{visiblePrintStudents.length}</strong> টি 
                      {idCardViewMode === 'sheet' && (
                        <span className="ml-1 text-slate-400">
                          (প্রতি A4 পেজে ঠিক ৯টি কার্ড — মোট <strong className="text-amber-400 font-extrabold">{Math.ceil(visiblePrintStudents.length / 9)}</strong> টি A4 শিট)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>স্ট্যান্ডার্ড সাইজ: <strong>CR80 (2.1" x 3.4")</strong></span>
                    <span>লেআউট: <strong>A4 ৩ কলাম x ৩ সারি (9 Cards)</strong></span>
                  </div>
                </div>

                {visiblePrintStudents.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 no-print">
                    কোন শিক্ষার্থী পাওয়া যায়নি। উপরে শ্রেণী অথবা শিক্ষার্থী নির্বাচন করুন।
                  </div>
                ) : idCardViewMode === 'grid' ? (
                  <div className="printable-area flex flex-wrap gap-5 justify-center p-4">
                    {visiblePrintStudents.map((st, idx) => (
                      <div key={st.studentId || st.roll || idx} className="page-break">
                        <StudentIdCard
                          student={st}
                          school={school}
                          template={idCardTemplate}
                          showCuttingGuide={idCardShowCuttingGuide}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="printable-area space-y-8 print:space-y-0">
                    {(() => {
                      const sheets: Student[][] = [];
                      for (let i = 0; i < visiblePrintStudents.length; i += 9) {
                        sheets.push(visiblePrintStudents.slice(i, i + 9));
                      }
                      return sheets.map((sheet, idx) => (
                        <StudentIdCardSheet
                          key={idx}
                          students={sheet}
                          school={school}
                          template={idCardTemplate}
                          showCuttingGuide={idCardShowCuttingGuide}
                          sheetIndex={idx}
                          totalSheets={sheets.length}
                        />
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Admit Cards */}
            {printHubSubTab === 'admit' && (
              <div className="printable-area grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
                {visiblePrintStudents.map((st, idx) => (
                    <div key={st.roll || idx} className="bg-white text-slate-900 border-2 border-slate-800 rounded-2xl p-6 shadow-xl page-break space-y-4">
                      {/* School Header */}
                      <div className="text-center border-b border-slate-300 pb-3">
                        <h2 className="text-lg font-black text-slate-950 uppercase">{school.name}</h2>
                        <p className="text-[10px] text-slate-600">{school.address}</p>
                        <div className="mt-2 inline-block px-3 py-1 bg-amber-500 text-slate-950 text-xs font-black rounded-full uppercase tracking-wider">
                          EXAMINATION ADMIT CARD (প্রবেশপত্র) - {school.currentAcademicYear || '2026'}
                        </div>
                        <p className="text-xs font-bold text-slate-800 mt-1">{printHubExam}</p>
                      </div>

                      {/* Student Info Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs border bg-slate-50 p-3 rounded-xl border-slate-200">
                        <div><span className="text-slate-500">শিক্ষার্থীর নাম:</span> <strong className="text-slate-950 block">{st.name}</strong></div>
                        <div><span className="text-slate-500">স্টুডেন্ট আইডি:</span> <strong className="text-indigo-900 font-mono block">{generateStandardStudentId(school, st)}</strong></div>
                        <div><span className="text-slate-500">শ্রেণী (Class):</span> <strong className="text-slate-950 block">{st.class}</strong></div>
                        <div><span className="text-slate-500">রোল নম্বর:</span> <strong className="text-amber-800 font-mono text-sm block">#{st.roll}</strong></div>
                        <div className="col-span-2"><span className="text-slate-500">অভিভাবকের নাম:</span> <strong className="text-slate-900 block">{st.fatherName || '-'}</strong></div>
                      </div>

                      {/* Exam Timetable Routine Table */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-700">পরীক্ষার সময়সূচি (Exam Schedule):</span>
                        <table className="w-full text-[11px] border-collapse border border-slate-300 text-left">
                          <thead className="bg-slate-100 font-bold text-slate-800">
                            <tr>
                              <th className="border p-1.5">বিষয় (Subject)</th>
                              <th className="border p-1.5">সময় (Time)</th>
                              <th className="border p-1.5">পরিদর্শকের স্বাক্ষর</th>
                            </tr>
                          </thead>
                          <tbody>
                            {SUBJECTS.slice(0, 5).map((subj, sIdx) => (
                              <tr key={sIdx}>
                                <td className="border p-1.5 font-semibold">{subj}</td>
                                <td className="border p-1.5 text-slate-600">11:00 AM - 01:30 PM</td>
                                <td className="border p-1.5"></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Signatures */}
                      <div className="pt-6 flex justify-between items-end text-[10px] font-bold text-slate-800">
                        <div className="text-center">
                          <div className="w-24 border-b border-slate-400 mb-1"></div>
                          <span>পরীক্ষা নিয়ন্ত্রক (Exam Controller)</span>
                        </div>
                        <div className="text-center">
                          {school.signature && <img src={school.signature} alt="Sign" loading="lazy" className="h-5 mx-auto object-contain mb-0.5" />}
                          <div className="w-24 border-b border-slate-400 mb-1"></div>
                          <span>প্রধান শিক্ষক (Headmaster Sign)</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Sub-tab 3: Marksheets */}
            {printHubSubTab === 'marksheet' && (
              <div className="printable-area space-y-8 p-2 print:space-y-0 print:p-0 print:m-0 print:border-none print:shadow-none">
                {visiblePrintStudents.map((st, idx) => (
                    <MarksheetRenderer
                      key={st.roll || idx}
                      student={st}
                      allStudents={students}
                      allMarks={marks}
                      school={school}
                      examType={printHubExam || marksheetExam}
                      styleType={marksheetStyle}
                      colorTheme={marksheetColor}
                      pageSize={marksheetPaperSize}
                      orientation={marksheetOrientation}
                      academicYear={marksheetAcademicYear}
                    />
                  ))}
              </div>
            )}

            {/* Sub-tab 4: Result Summary Tabulation */}
            {printHubSubTab === 'result' && (() => {
              const { activeClassSubjects, maxMark, studentResults } = resultSummaryData;

              return (
                <div className="printable-area bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border-2 border-slate-800 shadow-xl space-y-6 max-w-6xl mx-auto font-sans">
                  <div className="text-center border-b-2 border-slate-800 pb-4">
                    <h2 className="text-2xl font-black text-slate-950 uppercase">{school.name}</h2>
                    <p className="text-xs text-slate-600 font-semibold">{school.address}</p>
                    <div className="mt-2 inline-block px-5 py-1.5 bg-slate-950 text-white text-xs font-black rounded-full uppercase tracking-wider">
                      ফলাফল ও মেধা স্থান তালিকা (EXAM RESULT SUMMARY) - {idCardClass} ({printHubExam})
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border-2 border-slate-800 text-left">
                      <thead className="bg-slate-200 font-black text-slate-950 border-b-2 border-slate-800">
                        <tr>
                          <th className="border-2 border-slate-800 p-2 text-center w-12">রোল</th>
                          <th className="border-2 border-slate-800 p-2 min-w-[140px]">শিক্ষার্থীর নাম</th>
                          <th className="border-2 border-slate-800 p-2 text-center w-16">শ্রেণী</th>
                          {activeClassSubjects.map(sub => (
                            <th key={sub} className="border-2 border-slate-800 p-2 text-center font-bold">{sub}</th>
                          ))}
                          <th className="border-2 border-slate-800 p-2 text-center w-20">মোট নম্বর</th>
                          <th className="border-2 border-slate-800 p-2 text-center w-14">শতকরা (%)</th>
                          <th className="border-2 border-slate-800 p-2 text-center w-16">ফলাফল</th>
                          <th className="border-2 border-slate-800 p-2 text-center w-16">মেধা স্থান</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {studentResults.map((res, i) => {
                          const { student: st, scores, totalObtained, totalFullPossible, percentage, rank } = res;

                          return (
                            <tr key={st.roll || i} className="h-9 hover:bg-slate-50 font-semibold text-slate-900">
                              <td className="border-2 border-slate-800 p-1.5 text-center font-mono font-bold text-cyan-950">#{st.roll}</td>
                              <td className="border-2 border-slate-800 p-1.5 font-extrabold text-slate-950">{st.name}</td>
                              <td className="border-2 border-slate-800 p-1.5 text-center font-bold text-slate-800">{st.class}</td>
                              {scores.map((sc, scIdx) => (
                                <td key={scIdx} className="border-2 border-slate-800 p-1.5 text-center font-mono font-bold text-slate-900">
                                  {sc}
                                </td>
                              ))}
                              <td className="border-2 border-slate-800 p-1.5 text-center font-mono font-black text-slate-950 bg-slate-50">{totalObtained} / {totalFullPossible}</td>
                              <td className="border-2 border-slate-800 p-1.5 text-center font-mono font-bold">{percentage}%</td>
                              <td className="border-2 border-slate-800 p-1.5 text-center">
                                <span className={`px-1.5 py-0.5 font-black rounded text-[10px] ${percentage >= 30 ? 'bg-emerald-100 text-emerald-950' : 'bg-rose-100 text-rose-950'}`}>
                                  {percentage >= 30 ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'}
                                </span>
                              </td>
                              <td className="border-2 border-slate-800 p-1.5 text-center font-mono font-black text-amber-900">#{rank}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Signatures */}
                  <div className="pt-8 flex justify-between items-end text-xs font-extrabold text-slate-950">
                    <div className="text-center">
                      <div className="w-36 border-b-2 border-slate-800 mb-1"></div>
                      <span>শ্রেণী শিক্ষক (Class Teacher)</span>
                    </div>
                    <div className="text-center">
                      <div className="w-36 border-b-2 border-slate-800 mb-1"></div>
                      <span>পরীক্ষা কমিটির স্বাক্ষর</span>
                    </div>
                    <div className="text-center">
                      <div className="w-36 border-b-2 border-slate-800 mb-1"></div>
                      <span>প্রধান শিক্ষক (Headmaster)</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Sub-tab 5: Manual Subject-wise Mark Input Sheet */}
            {printHubSubTab === 'manualmarks' && (() => {
              const maxMark = getExamMaxMark(printHubExam);
              const writtenMark = Math.round(maxMark * 0.9);
              const oralMark = maxMark - writtenMark;

              return (
                <div className="printable-area bg-white text-slate-900 p-8 rounded-2xl border-2 border-slate-800 shadow-xl space-y-6 max-w-4xl mx-auto font-sans">
                  {/* Header */}
                  <div className="text-center border-b-2 border-slate-800 pb-4">
                    <h2 className="text-2xl font-black text-slate-950 uppercase">{school.name}</h2>
                    <p className="text-xs text-slate-600 font-semibold">{school.address}</p>
                    <div className="mt-2 inline-block px-5 py-1.5 bg-slate-900 text-white text-xs font-black rounded-full uppercase tracking-wider">
                      ম্যানুয়াল বিষয়ভিত্তিক নম্বর ইনপুট রেজিস্টার (MANUAL MARKSHEET ENTRY REGISTER)
                    </div>
                  </div>

                  {/* Info Metadata Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-100 p-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900">
                    <div>শ্রেণী (Class): <span className="text-cyan-900 font-black">{idCardClass}</span></div>
                    <div>বিষয় (Subject): <span className="text-emerald-800 font-black">{printHubSubject}</span></div>
                    <div>পরীক্ষা: <span className="text-amber-800 font-black">{printHubExam}</span></div>
                    <div>পূর্ণমান (Full Marks): <span className="font-mono font-black">{maxMark}</span></div>
                  </div>

                  {/* Blank Table for Manual Input */}
                  <table className="w-full text-xs border-collapse border-2 border-slate-800 text-left">
                    <thead className="bg-slate-200 font-black text-slate-950 border-b-2 border-slate-800">
                      <tr>
                        <th className="border-2 border-slate-800 p-2 text-center w-12">ক্র.নং</th>
                        <th className="border-2 border-slate-800 p-2 text-center w-16">রোল</th>
                        <th className="border-2 border-slate-800 p-2">শিক্ষার্থীর নাম</th>
                        <th className="border-2 border-slate-800 p-2 text-center w-28">প্রাপ্ত নম্বর (Obtained)</th>
                        <th className="border-2 border-slate-800 p-2 text-center w-28">অক্ষরে (In Words)</th>
                        <th className="border-2 border-slate-800 p-2 text-center w-28">মোট নম্বর ({maxMark})</th>
                        <th className="border-2 border-slate-800 p-2 text-center w-36">পরিদর্শকের স্বাক্ষর</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePrintStudents
                        .map((st, i) => (
                          <tr key={st.roll || i} className="h-10">
                            <td className="border-2 border-slate-800 p-2 text-center font-mono font-extrabold text-slate-900">{i + 1}</td>
                            <td className="border-2 border-slate-800 p-2 text-center font-mono font-extrabold text-cyan-950">#{st.roll}</td>
                            <td className="border-2 border-slate-800 p-2 font-extrabold text-slate-950">{st.name}</td>
                            <td className="border-2 border-slate-800 p-2"></td>
                            <td className="border-2 border-slate-800 p-2"></td>
                            <td className="border-2 border-slate-800 p-2 text-center font-mono font-bold text-slate-400">/ {maxMark}</td>
                            <td className="border-2 border-slate-800 p-2"></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* Footer Signatures */}
                  <div className="pt-10 flex justify-between items-end text-xs font-extrabold text-slate-950">
                    <div className="text-center">
                      <div className="w-40 border-b-2 border-slate-800 mb-1"></div>
                      <span>ছাত্র/ছাত্রীর স্বাক্ষর (Student Sign)</span>
                    </div>
                    <div className="text-center">
                      <div className="w-40 border-b-2 border-slate-800 mb-1"></div>
                      <span>প্রধান শিক্ষক (Headmaster)</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Sub-tab 6: Manual Tabulation Sheet */}
            {printHubSubTab === 'manualtabulation' && (() => {
              const activeClassSubjects = getEffectiveSubjectsForClass(idCardClass, printHubExam);

              return (
                <div className="printable-area bg-white text-slate-900 p-6 rounded-2xl border-2 border-slate-800 shadow-xl space-y-6 max-w-6xl mx-auto font-sans">
                  {/* Header */}
                  <div className="text-center border-b-2 border-slate-800 pb-3">
                    <h2 className="text-2xl font-black text-slate-950 uppercase">{school.name}</h2>
                    <p className="text-xs text-slate-600 font-semibold">{school.address}</p>
                    <div className="mt-2 inline-block px-6 py-1.5 bg-slate-950 text-white text-xs font-black rounded-full uppercase tracking-wider">
                      ম্যানুয়াল ট্যাবুলেশন মাস্টার শিট (MANUAL TABULATION MASTER SHEET)
                    </div>
                  </div>

                  {/* Info Bar */}
                  <div className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900">
                    <div>শ্রেণী (Class): <span className="text-cyan-900 font-black">{idCardClass}</span></div>
                    <div>পরীক্ষার নাম: <span className="text-amber-900 font-black">{printHubExam}</span></div>
                    <div>শিক্ষাবর্ষ: <span className="font-mono font-black">2026</span></div>
                  </div>

                  {/* Tabulation Grid Table */}
                  <table className="w-full text-xs border-collapse border-2 border-slate-800 text-left">
                    <thead className="bg-slate-200 font-black text-slate-950 border-b-2 border-slate-800">
                      <tr>
                        <th className="border-2 border-slate-800 p-2 text-center w-12">রোল</th>
                        <th className="border-2 border-slate-800 p-2">শিক্ষার্থীর নাম</th>
                        {activeClassSubjects.map(sub => (
                          <th key={sub} className="border-2 border-slate-800 p-2 text-center font-bold">{sub}</th>
                        ))}
                        <th className="border-2 border-slate-800 p-2 text-center w-16">মোট</th>
                        <th className="border-2 border-slate-800 p-2 text-center w-14">%</th>
                        <th className="border-2 border-slate-800 p-2 text-center w-24">মন্তব্য</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePrintStudents
                        .map((st, i) => (
                          <tr key={st.roll || i} className="h-9">
                            <td className="border-2 border-slate-800 p-1.5 text-center font-mono font-extrabold text-slate-900">#{st.roll}</td>
                            <td className="border-2 border-slate-800 p-1.5 font-extrabold text-slate-950">{st.name}</td>
                            {activeClassSubjects.map(sub => (
                              <td key={sub} className="border-2 border-slate-800 p-1.5"></td>
                            ))}
                            <td className="border-2 border-slate-800 p-1.5"></td>
                            <td className="border-2 border-slate-800 p-1.5"></td>
                            <td className="border-2 border-slate-800 p-1.5"></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* Footer Signatures */}
                  <div className="pt-10 flex justify-between items-end text-xs font-extrabold text-slate-950">
                    <div className="text-center">
                      <div className="w-36 border-b-2 border-slate-800 mb-1"></div>
                      <span>শ্রেণী শিক্ষক (Class Teacher)</span>
                    </div>
                    <div className="text-center">
                      <div className="w-36 border-b-2 border-slate-800 mb-1"></div>
                      <span>পরীক্ষা কমিটির স্বাক্ষর</span>
                    </div>
                    <div className="text-center">
                      <div className="w-36 border-b-2 border-slate-800 mb-1"></div>
                      <span>প্রধান শিক্ষক (Headmaster)</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Sub-tab 7: Class Student Printable List */}
            {printHubSubTab === 'studentlist' && (
              <div className="printable-area bg-white text-slate-950 p-8 rounded-2xl border-2 border-slate-800 shadow-xl space-y-6 max-w-5xl mx-auto font-sans">
                <div className="text-center border-b-2 border-slate-800 pb-4">
                  <h2 className="text-2xl font-black text-slate-950 uppercase">{school.name}</h2>
                  <p className="text-xs text-slate-600 font-semibold">{school.address}</p>
                  <div className="mt-2 inline-block px-5 py-1.5 bg-slate-950 text-white text-xs font-black rounded-full uppercase tracking-wider">
                    শিক্ষার্থী রেজিস্টার তালিকা - {idCardClass}
                  </div>
                </div>

                <table className="w-full text-left text-xs border-collapse border-2 border-slate-800">
                  <thead className="bg-slate-200 font-black text-slate-950 border-b-2 border-slate-800">
                    <tr>
                      <th className="border-2 border-slate-800 p-2.5 text-center w-14">রোল</th>
                      <th className="border-2 border-slate-800 p-2.5 text-sm">শিক্ষার্থীর নাম</th>
                      <th className="border-2 border-slate-800 p-2.5 text-xs">অভিভাবকের নাম</th>
                      <th className="border-2 border-slate-800 p-2.5 text-xs">ঠিকানা (Address)</th>
                      <th className="border-2 border-slate-800 p-2.5 text-xs text-center w-28">ফোন নম্বর</th>
                      <th className="border-2 border-slate-800 p-2.5 text-xs text-center w-20">লিঙ্গ</th>
                      <th className="border-2 border-slate-800 p-2.5 text-xs">সরকারি স্কুল</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-semibold">
                    {visiblePrintStudents
                      .map((st, i) => (
                        <tr key={st.roll || i} className="hover:bg-slate-50 text-slate-900">
                          <td className="border-2 border-slate-800 p-2 text-center font-mono font-extrabold text-sm text-cyan-950">#{st.roll}</td>
                          <td className="border-2 border-slate-800 p-2 font-black text-sm text-slate-950">{st.name}</td>
                          <td className="border-2 border-slate-800 p-2 text-xs font-bold text-slate-900">{st.fatherName || '-'}</td>
                          <td className="border-2 border-slate-800 p-2 text-xs font-bold text-slate-900">{st.address || '-'}</td>
                          <td className="border-2 border-slate-800 p-2 text-center font-mono font-bold text-xs text-slate-950">{st.phone || '-'}</td>
                          <td className="border-2 border-slate-800 p-2 text-center text-xs font-bold text-slate-900">{st.gender}</td>
                          <td className="border-2 border-slate-800 p-2 text-xs font-medium text-slate-800">{st.govtSchoolName || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sub-tab 8: Vehicle Transport List */}
            {printHubSubTab === 'vehiclelist' && (
              <div className="printable-area bg-white text-slate-900 p-8 rounded-2xl border border-slate-200 shadow-xl space-y-6 max-w-4xl mx-auto">
                <div className="text-center border-b pb-4">
                  <h2 className="text-xl font-black text-slate-900 uppercase">{school.name}</h2>
                  <p className="text-xs text-slate-600">{school.address}</p>
                  <div className="mt-2 inline-block px-4 py-1 bg-cyan-800 text-white text-xs font-bold rounded-full">
                    বিদ্যালয় পরিবহন ও গাড়ি রুট তালিকা (Transport Directory)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { busNo: 'BUS-01 (উত্তর রুট)', driver: 'আবুল কালাম', phone: '01711223344', seats: 32, route: 'স্কুল মোড় -> বাজার গেট -> স্টেশন রোড' },
                    { busNo: 'BUS-02 (দক্ষিণ রুট)', driver: 'রহিম উল্লাহ', phone: '01811223355', seats: 28, route: 'স্কুল মোড় -> হাসপাতাল মোড় -> ব্রিজ পাড়া' }
                  ].map((v, idx) => (
                    <div key={idx} className="border border-slate-300 rounded-xl p-4 space-y-2 bg-slate-50">
                      <div className="font-extrabold text-slate-900 text-sm flex justify-between">
                        <span>{v.busNo}</span>
                        <span className="text-xs text-cyan-800 font-bold">{v.seats} সিট</span>
                      </div>
                      <div className="text-xs text-slate-700">ড্রাইভার: <span className="font-bold">{v.driver}</span> ({v.phone})</div>
                      <div className="text-xs text-slate-500">রুট: {v.route}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTICES TAB matching Image 4 */}
        {activeTab === 'notices' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    School Notice Board <span className="text-cyan-400 font-normal">/ নোটিশ বোর্ড</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    অফিশিয়াল নোটিশ, ছুটির তথ্য ও জরুরি ঘোষণা প্রকাশ কেন্দ্র
                  </p>
                </div>
              </div>

              {/* Action Pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {(['ALL', 'EXAM', 'HOLIDAY', 'FEES', 'EMERGENCY'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNoticeCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      noticeCategoryFilter === cat ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                    }`}
                  >
                    {cat === 'ALL' ? 'ALL (সকল)' : cat === 'EXAM' ? 'EXAM (পরীক্ষা)' : cat === 'HOLIDAY' ? 'HOLIDAY (ছুটি)' : cat === 'FEES' ? 'FEES (ফি)' : 'EMERGENCY (জরুরি)'}
                  </button>
                ))}
                {!isTeacher && (
                  <>
                    <button
                      onClick={() => setIsNoticeModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 ml-2"
                    >
                      <Plus className="w-4 h-4" /> New Notice (নতুন নোটিশ)
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-400 font-bold bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all ml-2">
                      <input 
                        type="checkbox" 
                        checked={showInactiveNotices} 
                        onChange={e => setShowInactiveNotices(e.target.checked)} 
                        className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      নিষ্ক্রিয় দেখান (Show Inactive)
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Notices List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredNotices.map(n => (
                <div key={n.id} className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl relative flex flex-col justify-between ${n.isActive === false ? 'bg-rose-950/20 opacity-75' : ''}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                          n.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : n.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {n.priority} PRIORITY
                        </span>
                        {n.isActive === false && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" /> {n.date}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-base text-white leading-snug">{n.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{n.content}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-semibold">গ্রুপ: {n.targetGroup}</span>
                    <div className="flex items-center gap-2">
                      {!isTeacher && (
                        <>
                          <button 
                            onClick={() => window.print()}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" /> প্রিন্ট
                          </button>
                          {n.isActive === false ? (
                            <button
                              onClick={async () => {
                                setNotices(prev => prev.map(x => x.id === n.id ? { ...x, isActive: true, deactivatedAt: undefined } : x));
                                await reactivateDocument(school.schoolId, 'notices', n.id).catch(() => {});
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer"
                            >
                              পুনরায় সক্রিয় করুন
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (confirm('আপনি কি এই নোটিশটি নিষ্ক্রিয় (Soft Delete) করতে চান?')) {
                                  setNotices(prev => prev.map(x => x.id === n.id ? { ...x, isActive: false, deactivatedAt: new Date().toISOString() } : x));
                                  await deleteNoticeSingleFromFirestore(school.schoolId, n.id).catch(() => {});
                                }
                              }}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                              title="নিষ্ক্রিয় (Soft Delete) করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Notice Modal */}
            {isNoticeModalOpen && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                  <h3 className="font-extrabold text-lg text-white">নতুন অফিশিয়াল নোটিশ প্রকাশ করুন</h3>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">নোটিশের শিরোনাম:</label>
                      <input 
                        type="text" 
                        value={newNoticeData.title}
                        onChange={e => setNewNoticeData({ ...newNoticeData, title: e.target.value })}
                        placeholder="যেমন: ছুটির ঘোষণা / পরীক্ষার রুটিন"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">বিস্তারিত বিবরণ:</label>
                      <textarea 
                        rows={4}
                        value={newNoticeData.content}
                        onChange={e => setNewNoticeData({ ...newNoticeData, content: e.target.value })}
                        placeholder="নোটিশের বিস্তারিত লিখুন..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">তারিখ:</label>
                        <input 
                          type="date"
                          value={newNoticeData.date}
                          onChange={e => setNewNoticeData({ ...newNoticeData, date: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">জরুরি মাত্রা (Priority):</label>
                        <select 
                          value={newNoticeData.priority}
                          onChange={e => setNewNoticeData({ ...newNoticeData, priority: e.target.value as any })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button 
                      onClick={() => setIsNoticeModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-700 cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button 
                      onClick={async () => {
                        if (!newNoticeData.title) return;
                        const newNoticeItem: NoticeItem = {
                          id: String(Date.now()),
                          ...newNoticeData,
                          isActive: true
                        };
                        setNotices(prev => [newNoticeItem, ...prev]);
                        setIsNoticeModalOpen(false);
                        setNewNoticeData({
                          title: '',
                          content: '',
                          date: new Date().toISOString().split('T')[0],
                          targetGroup: 'ALL',
                          priority: 'MEDIUM'
                        });
                        await saveNoticeSingleToFirestore(school.schoolId, newNoticeItem).catch(err => {
                          console.error('Error saving notice to Firestore:', err);
                        });
                      }}
                      className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs cursor-pointer shadow-md"
                    >
                      পাবলিশ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROUTINE TAB */}
        {activeTab === 'routine' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    Class & Teacher Routine <span className="text-cyan-400 font-normal">/ পিরিয়ড সময়সূচি, টিফিন টাইম ও রুটিন</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    পিরিয়ডের সংখ্যা নির্ধারণ, টিফিন টাইম সেটআপ, পিরিয়ডের সমস্যা/কনফ্লিক্ট ডিটেকশন ও রুটিন ড্যাশবোর্ড
                  </p>
                </div>
              </div>

              {/* Action Buttons & Issue Badge */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {!isTeacher && (
                  <>
                    {(() => {
                      const issues = getRoutineIssues();
                      const teacherClashes = issues.filter(i => i.type === 'TEACHER_CLASH');
                      return (
                        <button 
                          onClick={() => setShowRoutineIssueDetector(!showRoutineIssueDetector)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            showRoutineIssueDetector 
                              ? 'bg-rose-500 text-slate-950 border-rose-400 shadow-md' 
                              : teacherClashes.length > 0 
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800 animate-pulse' 
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" /> 
                          সমস্যা ডিটেকশন 
                          {issues.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-rose-900 text-rose-100 rounded-full text-[10px] font-black">
                              {issues.length}
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    <button 
                      onClick={() => setIsRoutineConfigOpen(!isRoutineConfigOpen)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isRoutineConfigOpen ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md' : 'bg-slate-800 text-amber-300 border-amber-800/80 hover:bg-slate-700'
                      }`}
                    >
                      <Settings className="w-4 h-4" /> ⚙️ পিরিয়ড ও টিফিন সেটআপ
                    </button>

                    <button 
                      onClick={() => window.print()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700"
                    >
                      <Printer className="w-4 h-4" /> প্রিন্ট
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ROUTINE CONFIGURATION DRAWER / PANEL */}
            {isRoutineConfigOpen && (
              <div className="bg-slate-900/95 border-2 border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="font-bold text-sm text-amber-300 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> পিরিয়ড সংখ্যা, সময়সূচি ও টিফিন টাইম কনফিগারেশন (Period & Tiffin Configuration)
                  </h4>
                  <button 
                    onClick={() => setIsRoutineConfigOpen(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg"
                  >
                    বন্ধ করুন ✖
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
                  {/* Total Periods */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">মোট পিরিয়ডের সংখ্যা:</label>
                    <select
                      value={routineSettings.totalPeriods}
                      onChange={e => setRoutineSettings({ ...routineSettings, totalPeriods: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                    >
                      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <option key={n} value={n}>{n} টি পিরিয়ড (Periods)</option>
                      ))}
                    </select>
                  </div>

                  {/* School Start Time */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">বিদ্যালয় শুরুর সময়:</label>
                    <input
                      type="time"
                      value={routineSettings.startTime}
                      onChange={e => setRoutineSettings({ ...routineSettings, startTime: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Period Duration */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">প্রতি পিরিয়ড সময় (মিনিট):</label>
                    <input
                      type="number"
                      min="15"
                      max="120"
                      value={routineSettings.periodDurationMins}
                      onChange={e => setRoutineSettings({ ...routineSettings, periodDurationMins: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Tiffin After Period */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">কত পিরিয়ড পর টিফিন:</label>
                    <select
                      value={routineSettings.tiffinAfterPeriod}
                      onChange={e => setRoutineSettings({ ...routineSettings, tiffinAfterPeriod: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                    >
                      {Array.from({ length: routineSettings.totalPeriods }, (_, i) => i + 1).map(p => (
                        <option key={p} value={p}>{p}ম পিরিয়ড এর পর (After Period {p})</option>
                      ))}
                    </select>
                  </div>

                  {/* Tiffin Duration */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">টিফিন বিরতির সময় (মিনিট):</label>
                    <input
                      type="number"
                      min="10"
                      max="90"
                      value={routineSettings.tiffinDurationMins}
                      onChange={e => setRoutineSettings({ ...routineSettings, tiffinDurationMins: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Tiffin Custom Title */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">টিফিন লেবেল/নাম:</label>
                    <input
                      type="text"
                      value={routineSettings.tiffinTimeLabel || '🍱 টিফিন বিরতি'}
                      onChange={e => setRoutineSettings({ ...routineSettings, tiffinTimeLabel: e.target.value })}
                      placeholder="যেমন: 🍱 টিফিন ও নামাজ"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-slate-300 flex items-center gap-2 flex-wrap">
                    <span className="text-emerald-400 font-bold">✓ জেনারেট হওয়া সময়সূচি হিসাব:</span>
                    <span>মোট {routineSettings.totalPeriods} টি পিরিয়ড</span> |
                    <span>প্রতিটি {routineSettings.periodDurationMins} মিনিট</span> |
                    <span>{routineSettings.tiffinAfterPeriod}ম পিরিয়ড পর {routineSettings.tiffinDurationMins} মিনিট টিফিন</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsRoutineConfigOpen(false);
                      alert('✅ পিরিয়ড সংখ্যা ও টিফিন ব্রেইক সময়সূচি সফলভাবে সংরক্ষণ করা হয়েছে!');
                    }}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    সেটিংস প্রয়োগ করুন
                  </button>
                </div>
              </div>
            )}

            {/* ROUTINE ISSUE / PROBLEM DIAGNOSTIC PANEL */}
            {showRoutineIssueDetector && (
              <div className="bg-slate-900/90 border border-rose-900/50 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                        পিরিয়ডের সমস্যা ও শিক্ষক ওভারল্যাপ চেক (Routine Problem & Conflict Detector)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        শিক্ষকের একই সময়ে একাধিক ক্লাসে ওভারল্যাপ সমস্যা এবং খালি পিরিয়ড ডিটেকশন সিস্টেম
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">ফিল্টার:</span>
                    <button
                      onClick={() => setIssueFilterScope('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        issueFilterScope === 'ALL' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      সকল শ্রেণী (All Classes)
                    </button>
                    <button
                      onClick={() => setIssueFilterScope('CURRENT')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        issueFilterScope === 'CURRENT' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      শুধু {routineClass}
                    </button>
                  </div>
                </div>

                {(() => {
                  const issues = getRoutineIssues();
                  if (issues.length === 0) {
                    return (
                      <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-center space-y-1 text-xs text-emerald-300">
                        <div className="font-bold flex items-center justify-center gap-1.5 text-emerald-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" /> অভিনন্দন! কোনো রুটিন সমস্যা বা শিক্ষক ক্লা্যাশ পাওয়া যায়নি!
                        </div>
                        <p className="text-[11px] text-emerald-300/80">
                          সকল শিক্ষকের সময়সূচি ও পিরিয়ডের বরাদ্দ সঠিকভাবে সাজানো রয়েছে।
                        </p>
                      </div>
                    );
                  }

                  const teacherClashes = issues.filter(i => i.type === 'TEACHER_CLASH');
                  const missingSlots = issues.filter(i => i.type !== 'TEACHER_CLASH');

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <span className="px-3 py-1 bg-rose-950 text-rose-300 rounded-lg border border-rose-800 flex items-center gap-1.5">
                          🚨 শিক্ষক ওভারল্যাপ/ক্লা্যাশ: {teacherClashes.length} টি
                        </span>
                        <span className="px-3 py-1 bg-amber-950 text-amber-300 rounded-lg border border-amber-800 flex items-center gap-1.5">
                          ⚠️ খালি বা অসম্পূর্ণ পিরিয়ড: {missingSlots.length} টি
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                        {issues.map((iss) => (
                          <div 
                            key={iss.id} 
                            className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 shadow-md ${
                              iss.severity === 'HIGH' 
                                ? 'bg-rose-950/60 border-rose-600/60 text-rose-200' 
                                : 'bg-slate-950/80 border-amber-700/50 text-amber-200'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="font-bold flex items-center gap-1.5 text-white">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  iss.severity === 'HIGH' ? 'bg-rose-500 text-slate-950' : 'bg-amber-500 text-slate-950'
                                }`}>
                                  {iss.severity === 'HIGH' ? '🔴 ক্লা্যাশ' : '🟡 খালি'}
                                </span>
                                <span>{iss.day} - Period {iss.period} ({iss.className})</span>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {iss.message}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setRoutineClass(iss.className.split(',')[0].trim());
                                const calcSlots = getCalculatedSlots();
                                const matchedSlot = calcSlots.find(s => !s.isTiffin && s.periodNum === iss.period);
                                setEditingSlot({
                                  day: iss.day,
                                  period: iss.period,
                                  timeSlot: matchedSlot ? matchedSlot.timeRange : `Period ${iss.period}`,
                                  currentSubject: iss.subjectName || 'বাংলা',
                                  currentTeacher: iss.teacherName || ''
                                });
                              }}
                              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] rounded-lg shrink-0 cursor-pointer shadow"
                            >
                              ঠিক করুন ✏️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Routine Table Container */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-400">শ্রেণী নির্বাচন (Class Selection):</label>
                  <select
                    value={routineClass}
                    onChange={e => setRoutineClass(e.target.value)}
                    className="px-3.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {availableClassNames.map(c => <option key={c} value={c}>Class: {c}</option>)}
                  </select>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{isTeacher ? 'বিদ্যালয়ের সাপ্তাহিক পিরিয়ড ও ক্লাস সময়সূচি (রিড-অনলি মোড)' : 'যে কোনো ঘরে ক্লিক করে বিষয়টি ও শিক্ষকের নাম পরিবর্তন করতে পারেন'}</span>
                </div>
              </div>

              {/* ROUTINE MATRIX TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                  <thead className="bg-slate-950 text-slate-300 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3 border-r border-slate-800 w-28 bg-slate-950 text-amber-400">
                        DAY / TIME
                      </th>
                      {getCalculatedSlots().map((slot, idx) => (
                        <th
                          key={idx}
                          className={`p-3 text-center border-r border-slate-800 ${
                            slot.isTiffin 
                              ? 'bg-amber-950/80 text-amber-300 font-extrabold border-x-2 border-amber-600/50' 
                              : 'bg-slate-950 text-slate-200'
                          }`}
                        >
                          <div>{slot.label}</div>
                          <div className="text-[10px] text-cyan-400 font-mono mt-0.5 normal-case">
                            {slot.timeRange}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'].map((dayName) => {
                      const calculatedSlots = getCalculatedSlots();
                      const normClass = normalizeClassName(routineClass);

                      return (
                        <tr key={dayName} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-bold text-amber-400 bg-slate-950/80 border-r border-slate-800">
                            {dayName}
                          </td>
                          {calculatedSlots.map((slot, sIdx) => {
                            if (slot.isTiffin) {
                              return (
                                <td 
                                  key={sIdx} 
                                  className="p-3 text-center bg-amber-950/30 text-amber-300/90 font-bold border-x-2 border-amber-600/30 select-none"
                                >
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <span className="text-sm">🍱</span>
                                    <span className="text-[11px] font-extrabold text-amber-400">
                                      {routineSettings.tiffinTimeLabel || 'টিফিন বিরতি'}
                                    </span>
                                    <span className="text-[9px] text-amber-300/70">{slot.timeRange}</span>
                                  </div>
                                </td>
                              );
                            }

                            // Find entry for this day and period
                            const entry = routineEntries.find(
                              r => normalizeClassName(r.class) === normClass && r.day === dayName && Number(r.period) === slot.periodNum
                            );

                            const clashClasses = entry ? getCellTeacherClash(dayName, slot.periodNum, entry.teacher) : null;
                            const hasClash = clashClasses && clashClasses.length > 0;

                            return (
                              <td 
                                key={sIdx}
                                onClick={() => {
                                  if (!isTeacher) {
                                    setEditingSlot({
                                      day: dayName,
                                      period: slot.periodNum,
                                      timeSlot: slot.timeRange,
                                      currentSubject: entry ? entry.subject : 'বাংলা',
                                      currentTeacher: entry ? entry.teacher : (teachersList[0]?.name || 'শিক্ষক')
                                    });
                                  }
                                }}
                                className={`p-3 text-center border-r border-slate-800 transition-all group relative ${
                                  isTeacher ? '' : 'cursor-pointer'
                                } ${
                                  hasClash 
                                    ? 'bg-rose-950/70 border-2 border-rose-500 hover:bg-rose-900/80' 
                                    : isTeacher ? '' : 'hover:bg-cyan-950/40'
                                }`}
                              >
                                {entry ? (
                                  <div>
                                    <div className={`font-bold text-white transition-colors ${!isTeacher ? 'group-hover:text-cyan-300' : ''}`}>
                                      {entry.subject}
                                    </div>
                                    <div className={`text-[10px] text-slate-400 flex items-center justify-center gap-1 ${!isTeacher ? 'group-hover:text-cyan-200/80' : ''}`}>
                                      {entry.teacher}
                                    </div>
                                    {hasClash && (
                                      <div className="mt-1 px-1.5 py-0.5 bg-rose-500 text-slate-950 font-black text-[9px] rounded shadow animate-pulse">
                                        ⚠️ ক্লা্যাশ: {clashClasses.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className={`text-slate-600 text-[10px] italic ${!isTeacher ? 'group-hover:text-cyan-400' : ''}`}>
                                    {isTeacher ? '-' : '+ বিষয় সেট করুন'}
                                  </div>
                                )}
                                {!isTeacher && (
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-[9px] text-cyan-400 bg-slate-950 px-1 rounded border border-cyan-800">
                                    এডিট ✏️
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EDIT PERIOD SLOT MODAL */}
            {editingSlot && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-cyan-400" /> পিরিয়ড এডিট ({editingSlot.day} - Period {editingSlot.period})
                    </h3>
                    <button 
                      onClick={() => setEditingSlot(null)}
                      className="text-slate-400 hover:text-white text-xs bg-slate-800 px-2 py-1 rounded-lg"
                    >
                      ✖
                    </button>
                  </div>

                  <div className="text-xs text-cyan-300 bg-cyan-950/50 p-2.5 rounded-xl border border-cyan-800/60">
                    শ্রেণী: <span className="font-bold text-white">{routineClass}</span> | 
                    সময়সূচি: <span className="font-bold text-white">{editingSlot.timeSlot}</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">বিষয় (Subject):</label>
                      <select
                        value={editingSlot.currentSubject}
                        onChange={e => setEditingSlot({ ...editingSlot, currentSubject: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
                      >
                        {SUBJECTS.concat(['পরিবেশ', 'কম্পিউটার', 'ধর্মীয় শিক্ষা', 'শারীরিক শিক্ষা', 'অঙ্কন', 'সঙ্গীত', 'পরীক্ষা', 'সাপ্তাহিক মূল্যায়ন']).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">শিক্ষক / ম্যাডাম নির্বাচন করুন (Select Teacher):</label>
                      {teachersList.length > 0 && (
                        <select
                          onChange={e => {
                            if (e.target.value) {
                              setEditingSlot({ ...editingSlot, currentTeacher: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold focus:outline-none focus:border-cyan-500 mb-2"
                        >
                          <option value="">-- নিবন্ধিত শিক্ষক নির্বাচন করুন --</option>
                          {teachersList.map(t => (
                            <option key={t.id} value={t.name}>{t.name} ({t.designation || 'শিক্ষক'})</option>
                          ))}
                          <option value="Staff">সাধারণ স্টাফ (Staff)</option>
                          <option value="All Teachers">সকল শিক্ষক (All Teachers)</option>
                        </select>
                      )}
                      <input
                        type="text"
                        value={editingSlot.currentTeacher}
                        onChange={e => setEditingSlot({ ...editingSlot, currentTeacher: e.target.value })}
                        placeholder="শিক্ষকের নাম টাইপ করুন..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => setEditingSlot(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      onClick={() => handleSaveSlot(editingSlot.currentSubject, editingSlot.currentTeacher)}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
                    >
                      রুটিনে সংরক্ষণ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CERTIFICATES TAB matching Image 6 */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    TC & Certificates Generator <span className="text-cyan-400 font-normal">/ ছাড়পত্র ও প্রশংসা পত্র</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    ট্রান্সফার সার্টিফিকেট (TC), চারিত্রিক সনদ ও প্রশংসা পত্র জেনারেটর
                  </p>
                </div>
              </div>

              {/* Action Pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {['Transfer Certificate', 'Character Certificate', 'Appreciation Certificate'].map(t => (
                  <button
                    key={t}
                    onClick={() => setCertType(t)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      certType === t ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Certificate Form Controls */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 no-print shadow-xl">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">শ্রেণী:</label>
                  <select
                    value={certClass}
                    onChange={e => setCertClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">শিক্ষার্থীর রোল:</label>
                  <input
                    type="number"
                    value={certRoll}
                    onChange={e => setCertRoll(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">রেফারেন্স নম্বর:</label>
                  <input
                    type="text"
                    value={certRefNo}
                    onChange={e => setCertRefNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">ছাড়পত্রের কারণ:</label>
                  <input
                    type="text"
                    value={certReason}
                    onChange={e => setCertReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow-md hover:from-amber-400 hover:to-orange-400 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> প্রিন্ট সার্টিফিকেট (Print Certificate)
                </button>
              </div>
            </div>

            {/* Certificate Preview Frame */}
            {(() => {
              const certStudent = students.find(s => normalizeClassName(s.class) === normalizeClassName(certClass) && Number(s.roll) === Number(certRoll));
              const schoolLogo = schoolProfile.logo || school.logo;
              return (
                <div className="printable-area bg-white text-slate-900 border-4 border-amber-900 p-8 sm:p-10 rounded-2xl max-w-3xl mx-auto shadow-2xl space-y-6 font-serif relative">
                  {/* Top Header with School Logo, School Info, and Student Photo */}
                  <div className="border-b-2 border-amber-900 pb-5">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: School Logo */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0 border border-amber-300 rounded-xl p-1 bg-amber-50/50">
                        {schoolLogo ? (
                          <img src={schoolLogo} alt="School Logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-amber-900 text-amber-50 flex items-center justify-center font-bold text-xl">
                            {school.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Center: School Name & Address */}
                      <div className="text-center flex-1 px-2">
                        <h2 className="text-2xl sm:text-3xl font-black text-amber-950 uppercase tracking-wide">{school.name}</h2>
                        <p className="text-xs font-sans text-slate-600 mt-1">{school.address}</p>
                        <p className="text-[11px] font-sans text-slate-500 mt-0.5">কোড: {school.schoolId}</p>
                      </div>

                      {/* Right: Student Photo Frame */}
                      <div className="w-20 h-24 sm:w-24 sm:h-28 border-2 border-dashed border-amber-900/60 rounded-lg overflow-hidden bg-amber-50/40 flex flex-col items-center justify-center shrink-0 text-center p-1">
                        {certStudent?.photo ? (
                          <img src={formatPhotoUrl(certStudent.photo)} alt={certStudent.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover rounded" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          <div className="text-center font-sans text-[10px] text-amber-950 font-bold leading-tight">
                            <User className="w-6 h-6 mx-auto text-amber-800 mb-1 opacity-60" />
                            শিক্ষার্থীর ছবি<br/><span className="text-[9px] text-slate-500">(Photo)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Certificate Badge */}
                    <div className="text-center mt-4">
                      <div className="inline-block px-8 py-2 bg-amber-900 text-white font-black text-sm uppercase tracking-widest rounded-full shadow">
                        {certType}
                      </div>
                    </div>
                  </div>

                  {/* Ref & Date */}
                  <div className="flex justify-between text-xs font-sans font-bold text-slate-700">
                    <span>স্মারক নং: {certRefNo}</span>
                    <span>তারিখ: {new Date().toLocaleDateString('bn-BD')}</span>
                  </div>

                  {/* Body Paragraphs according to certType */}
                  <div className="text-sm leading-loose text-slate-800 text-justify space-y-4 font-sans">
                    {certType === 'Character Certificate' ? (
                      <>
                        <p>
                          এই মর্মে চারিত্রিক সনদ প্রদান করা যাচ্ছে যে, <strong className="text-slate-950 border-b border-slate-400 px-2">{certStudent?.name || 'শিক্ষার্থীর নাম'}</strong>, পিতা: <strong className="text-slate-950 border-b border-slate-400 px-2">{certStudent?.fatherName || 'অভিভাবকের নাম'}</strong>, অত্র বিদ্যালয়ের <strong className="text-slate-950 border-b border-slate-400 px-2">{certClass}</strong> শ্রেণীর একজন নিয়মিত শিক্ষার্থী। তাহার রোল নম্বর ছিল <strong className="text-slate-950 font-mono px-1">#{certRoll}</strong> এবং স্টুডেন্ট আইডি: <strong className="text-slate-950 font-mono px-1">{certStudent ? generateStandardStudentId(school, certStudent) : generateStandardStudentId(school, { class: certClass, roll: certRoll })}</strong>।
                        </p>
                        <p>
                          বিদ্যালয়ে অধ্যয়নকালে তাহার আচরণ, শৃঙ্খলা ও চরিত্র অত্যন্ত সন্তোষজনক ও চমৎকার ছিল। আমাদের জানা মতে সে কোনো সমাজবিরোধী বা শৃঙ্খলাপরিপন্থী কর্মকাণ্ডে জড়িত ছিল না।
                        </p>
                        <p>
                          আমি তাহার সার্বিক উন্নতি, উজ্জ্বল ভবিষ্যৎ ও দীর্ঘায়ু কামনা করি।
                        </p>
                      </>
                    ) : certType === 'Appreciation Certificate' ? (
                      <>
                        <p>
                          এই মর্মে প্রশংসা পত্র প্রদান করা যাচ্ছে যে, <strong className="text-slate-950 border-b border-slate-400 px-2">{certStudent?.name || 'শিক্ষার্থীর নাম'}</strong>, পিতা: <strong className="text-slate-950 border-b border-slate-400 px-2">{certStudent?.fatherName || 'অভিভাবকের নাম'}</strong>, অত্র বিদ্যালয়ের <strong className="text-slate-950 border-b border-slate-400 px-2">{certClass}</strong> শ্রেণীর রোল নম্বর <strong className="text-slate-950 font-mono px-1">#{certRoll}</strong> (স্টুডেন্ট আইডি: <strong className="text-slate-950 font-mono px-1">{certStudent ? generateStandardStudentId(school, certStudent) : generateStandardStudentId(school, { class: certClass, roll: certRoll })}</strong>) একজন অত্যন্ত মেধাবী, অনুগত ও নিয়মানুবর্তী শিক্ষার্থী।
                        </p>
                        <p>
                          বিদ্যালয়ের শিক্ষা, সংস্কৃতি ও সার্বিক কার্যক্রমে তাহার অসামান্য অংশগ্রহণ, শৃঙ্খলা ও আগ্রহ প্রশংসনীয়।
                        </p>
                        <p>
                          তাহার মেধা ও নিষ্ঠার স্বীকৃতিস্বরূপ এই প্রশংসা পত্র প্রদান করা হইল। আমি তাহার সুস্বাস্থ্য ও উজ্জ্বল ভবিষ্যৎ কামনা করি।
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, <strong className="text-slate-950 border-b border-slate-400 px-2">{certStudent?.name || 'শিক্ষার্থীর নাম'}</strong>, পিতা: <strong className="text-slate-950 border-b border-slate-400 px-2">{certStudent?.fatherName || 'অভিভাবকের নাম'}</strong>, অত্র বিদ্যালয়ের <strong className="text-slate-950 border-b border-slate-400 px-2">{certClass}</strong> শ্রেণীর একজন নিয়মিত শিক্ষার্থী ছিল। তাহার রোল নম্বর ছিল <strong className="text-slate-950 font-mono px-1 font-bold">#{certRoll}</strong> এবং স্টুডেন্ট আইডি: <strong className="text-slate-950 font-mono px-1 font-bold">{certStudent ? generateStandardStudentId(school, certStudent) : generateStandardStudentId(school, { class: certClass, roll: certRoll })}</strong>।
                        </p>
                        <p>
                          বিদ্যালয়ে অধ্যয়নকালে তাহার আচরণ ও চরিত্র অত্যন্ত সন্তোষজনক ছিল। আমাদের জানা মতে সে কোনো রাষ্ট্রবিরোধী বা শৃঙ্খলাপরিপন্থী কর্মকাণ্ডে জড়িত ছিল না।
                        </p>
                        <p>
                          অভিভাবকের আবেদনের প্রেক্ষিতে (<span className="italic font-semibold">{certReason}</span>) তাহাকে এই ছাড়পত্র প্রদান করা হইল। আমি তাহার উত্তরোত্তর উজ্জ্বল ভবিষ্যৎ কামনা করি।
                        </p>
                      </>
                    )}
                  </div>

                  {/* Signatures */}
                  <div className="pt-10 flex justify-between items-end font-sans">
                    <div className="text-center">
                      <div className="border-t border-slate-400 w-32 text-xs font-semibold text-slate-600 pt-1">অফিস সহকারী</div>
                    </div>

                    <div className="text-center space-y-1">
                      {school.signature && (
                        <img src={school.signature} alt="Sign" className="h-10 mx-auto object-contain" />
                      )}
                      <div className="border-t-2 border-amber-950 w-48 text-xs font-bold text-amber-950 pt-1">
                        প্রধান শিক্ষক / ভারপ্রাপ্ত শিক্ষক
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TEACHERS TAB matching User Request */}
        {activeTab === 'teachers' && (
          <div className="space-y-8">
            {/* Header Banner */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    Teachers & Subject Mapping <span className="text-cyan-400 font-normal">/ শিক্ষক প্যানেল ও বিষয় বণ্টন</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    শিক্ষকবৃন্দের বিবরণী, শিক্ষাগত যোগ্যতা, নম্বর ইনপুটের বিষয় বণ্টন ও সরাসরি ফোন/ইমেইল যোগাযোগ
                  </p>
                </div>
              </div>

              {/* Action Buttons & Counters */}
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <div className="px-3.5 py-1.5 bg-slate-900/90 border border-slate-700 text-cyan-300 rounded-xl font-mono font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>মোট শিক্ষক: <strong className="text-white text-sm">{teachersList.length}</strong> জন</span>
                </div>
                <button 
                  onClick={handleOpenAddTeacher}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-[0_4px_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center gap-2 border border-cyan-300 transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ নতুন শিক্ষক যুক্ত করুন (Add Teacher)</span>
                </button>
              </div>
            </div>

            {/* SECTION: Teacher Subject Assignment (শিক্ষক ভিত্তিক বিষয় বণ্টন) Card matching Image */}
            <div className="bg-slate-900/95 border-2 border-slate-800/90 rounded-3xl p-6 lg:p-7 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="border-b border-slate-800/80 pb-4">
                <h4 className="text-white font-black text-base flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  <span>শিক্ষক ভিত্তিক বিষয় বণ্টন (Teacher Subject Assignment)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  প্রত্যেক শিক্ষক কোন শ্রেণীর কোন কোন বিষয় পড়াবেন তা সিলেক্ট করে সেট করুন। শিক্ষক তাদের নিজস্ব আইডি দিয়ে লগইন করলে শুধুমাত্র তাদের বরাদ্দকৃত বিষয় গুলির নম্বর ইনপুট দিতে পারবেন।
                </p>
              </div>

              {/* 1. ASSIGNMENT FORM (ATTENDANCE & MARK ENTRY) */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-5 space-y-4">
                <div className="text-cyan-400 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>১. ক্লাস ও বিষয় বণ্টন ফর্ম (ASSIGN CLASS & SUBJECT TO TEACHER)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Select Teacher */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-bold text-xs">
                      শিক্ষক নির্বাচন করুন (Select Teacher) *
                    </label>
                    <select
                      value={assignTeacherId || (teachersList[0]?.id || '')}
                      onChange={e => setAssignTeacherId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {teachersList.length === 0 ? (
                        <option value="">কোনো শিক্ষক নিবন্ধিত নেই</option>
                      ) : (
                        teachersList.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.designation || 'Teacher'})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Select Class */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-bold text-xs">
                      শ্রেণী নির্বাচন করুন (Select Class) *
                    </label>
                    <select
                      value={assignClass}
                      onChange={e => setAssignClass(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-extrabold uppercase focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {['NURSERY', 'LKG', 'UKG', 'CLASS I', 'CLASS II', 'CLASS III', 'CLASS IV', 'CLASS V', 'CLASS VI', 'CLASS VII', 'CLASS VIII', 'CLASS IX', 'CLASS X', 'CLASS XI', 'CLASS XII', 'CLASS XIII'].map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Subject */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-bold text-xs">
                      বিষয় নির্বাচন করুন (Mark Entry Subject) *
                    </label>
                    <select
                      value={assignSubject}
                      onChange={e => setAssignSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-extrabold uppercase focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {[
                        'BENGALI', 'ENGLISH', 'MATHEMATICS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY',
                        'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'COMPUTER', 'EVS', 'HEALTH_PHYSICAL_EDUCATION',
                        'WORK_EDUCATION', 'ART_CRAFT', 'ARABIC_SANSKRIT'
                      ].map(subj => (
                        <option key={subj} value={subj}>{subj.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = assignTeacherId || (teachersList[0]?.id || '');
                      handleAssignAttendanceClassToTeacher(targetId, assignClass);
                    }}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>+ উপস্থিতির জন্য ক্লাস বরাদ্দ করুন (Assign Class for Attendance)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAssignSubjectToTeacher}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-black text-xs rounded-xl shadow-[0_4px_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>+ মার্ক এন্ট্রির জন্য বিষয় যুক্ত করুন (Assign Subject for Mark Entry)</span>
                  </button>
                </div>
              </div>

              {/* 2. CURRENT TEACHER ASSIGNMENTS */}
              <div className="space-y-3 pt-2">
                <div className="text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <span>২. শিক্ষক ভিত্তিক বরাদ্দকৃত ক্লাস ও বিষয়সমূহ (ASSIGNED CLASSES & SUBJECTS)</span>
                </div>

                {teachersList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    কোনো শিক্ষক পাওয়া যায়নি। শিক্ষক প্যানেল থেকে শিক্ষক যুক্ত করুন।
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teachersList.map(t => {
                      const hasAssignedSub = t.assignedSubjects && t.assignedSubjects.length > 0;
                      const hasAssignedClass = t.assignedClasses && t.assignedClasses.length > 0;
                      return (
                        <div key={t.id} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                            <div>
                              <h5 className="font-extrabold text-white text-sm">{t.name}</h5>
                              <p className="text-[11px] text-cyan-400 font-semibold">{t.designation || 'Teacher'}</p>
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md text-slate-400">
                              {(t.assignedClasses?.length || 0) + (t.assignedSubjects?.length || 0)} Mapped
                            </span>
                          </div>

                          {/* Attendance Classes */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Assigned Class for Attendance:</span>
                            <div className="flex flex-wrap gap-1 min-h-[28px] items-center">
                              {hasAssignedClass ? (
                                t.assignedClasses!.map((cls, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-amber-950/80 border border-amber-500/40 text-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                    <span>{cls}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAssignedClass(t.id, cls)}
                                      className="text-amber-400 hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                                      title="মুছে ফেলুন"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">কোনো ক্লাস নেই</span>
                              )}
                            </div>
                          </div>

                          {/* Mark Entry Subjects */}
                          <div className="space-y-1 pt-1 border-t border-slate-800/60">
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Assigned Subject for Mark Entry:</span>
                            <div className="flex flex-wrap gap-1 min-h-[28px] items-center">
                              {hasAssignedSub ? (
                                t.assignedSubjects!.map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                    <span>{item.class}: <strong className="text-white">{item.subject}</strong></span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAssignedSubject(t.id, item.class, item.subject)}
                                      className="text-cyan-400 hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                                      title="মুছে ফেলুন"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">কোনো বিষয় নেই</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SEARCH BAR FOR TEACHERS DIRECTORY */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={teacherSearchQuery}
                  onChange={e => setTeacherSearchQuery(e.target.value)}
                  placeholder="শিক্ষকের নাম, ফোন বা বিষয় দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-semibold"
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400 font-medium">
                  মোট নিবন্ধিত শিক্ষক: <strong className="text-white font-bold">{teachersList.length}</strong> জন
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-400 font-bold bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                  <input 
                    type="checkbox" 
                    checked={showInactiveTeachers} 
                    onChange={e => setShowInactiveTeachers(e.target.checked)} 
                    className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  নিষ্ক্রিয় দেখান (Show Inactive)
                </label>
              </div>
            </div>

            {/* TEACHERS DIRECTORY CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeachers.map((t) => (
                  <div key={t.id} className={`bg-slate-900/90 border-2 border-slate-800/90 hover:border-cyan-500/60 rounded-3xl p-6 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:-translate-y-1 relative group flex flex-col justify-between ${t.isActive === false ? 'bg-rose-950/20 opacity-75' : ''}`}>
                    <div className="space-y-4">
                      {/* Top Info */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-teal-500/10 to-slate-900 border-2 border-cyan-400/40 flex items-center justify-center text-cyan-300 font-black text-xl shadow-[0_0_15px_rgba(6,182,212,0.2)] shrink-0">
                            {t.name.substring(0, 1)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-white text-base leading-snug flex items-center gap-2">
                              {t.name}
                              {t.isActive === false && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  Inactive
                                </span>
                              )}
                            </h4>
                            <span className="inline-block px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[11px] font-bold rounded-full border border-cyan-500/30 mt-1">
                              {t.designation || 'Assistant Teacher (সহকারী শিক্ষক)'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {t.isActive === false ? (
                            <button
                              onClick={() => handleReactivateTeacher(t.id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer"
                            >
                              পুনরায় সক্রিয় করুন
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenEditTeacher(t)}
                                className="p-2 bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-slate-300 rounded-xl transition-all cursor-pointer"
                                title="এডিট করুন"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTeacher(t.id, t.name)}
                                className="p-2 bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 rounded-xl transition-all cursor-pointer"
                                title="নিষ্ক্রিয় (Soft Delete) করুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Details & Credentials Block */}
                      <div className="space-y-2 text-xs text-slate-300 pt-3 border-t border-slate-800/80">
                        {/* Credentials Badge Row */}
                        <div className="bg-slate-950/90 border border-cyan-900/50 rounded-xl p-2.5 space-y-1.5 shadow-inner">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-bold flex items-center gap-1">
                              <Shield className="w-3 h-3 text-cyan-400" /> স্কুল ID (Auto):
                            </span>
                            <span className="font-mono font-extrabold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                              {school.schoolId}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-bold flex items-center gap-1">
                              <User className="w-3 h-3 text-emerald-400" /> শিক্ষক ID:
                            </span>
                            <span className="font-mono font-extrabold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                              {t.teacherId || `TCH-${t.id}`}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-bold flex items-center gap-1">
                              <Shield className="w-3 h-3 text-amber-400" /> পাসওয়ার্ড (Password):
                            </span>
                            <span className="font-mono font-extrabold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                              {t.password || 'pass1234'}
                            </span>
                          </div>
                        </div>

                        {t.qualification && (
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-slate-500 font-semibold">শিক্ষাগত যোগ্যতা:</span>
                            <span className="font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">{t.qualification}</span>
                          </div>
                        )}
                        {t.phone && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-semibold">ফোন নম্বর:</span>
                            <a href={`tel:${t.phone}`} className="font-mono text-emerald-400 font-bold hover:underline">{t.phone}</a>
                          </div>
                        )}
                        {t.email && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-semibold">ইমেইল:</span>
                            <span className="font-mono text-slate-400 text-[11px] truncate max-w-[150px]">{t.email}</span>
                          </div>
                        )}
                      </div>

                      {/* Allocated Attendance Classes */}
                      <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                          <span>উপস্থিতি ক্লাস (Attendance Access):</span>
                          <span className="font-mono">({t.assignedClasses?.length || 0})</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {t.assignedClasses && t.assignedClasses.length > 0 ? (
                            t.assignedClasses.map((cls: string, idx: number) => (
                              <span key={idx} className="px-2.5 py-0.5 bg-slate-950 border border-amber-500/40 text-amber-300 font-bold text-[10px] rounded-lg shadow-sm">
                                {cls}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-[10px] italic">কোনো ক্লাস নেই</span>
                          )}
                        </div>
                      </div>

                      {/* Allocated Mark Entry Subjects */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                          <span>মার্ক বিষয় (Mark Entry Access):</span>
                          <span className="font-mono">({t.assignedSubjects?.length || 0})</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {t.assignedSubjects && t.assignedSubjects.length > 0 ? (
                            t.assignedSubjects.map((sub: any, idx: number) => (
                              <span key={idx} className="px-2.5 py-0.5 bg-slate-950 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] rounded-lg shadow-sm">
                                {sub.class}: {sub.subject}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-[10px] italic">কোনো বিষয় নেই</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Empty State */}
            {teachersList.length === 0 && (
              <div className="p-12 text-center bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                <User className="w-12 h-12 text-slate-600 mx-auto" />
                <h4 className="font-bold text-white text-base">কোনো শিক্ষকের তথ্য পাওয়া যায়নি</h4>
                <p className="text-xs text-slate-400">নতুন শিক্ষকের তথ্য যুক্ত করতে ওপরের "+ নতুন শিক্ষক যুক্ত করুন" বাটনে ক্লিক করুন।</p>
              </div>
            )}

            {/* ADD / EDIT TEACHER MODAL */}
            {isTeacherModalOpen && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 lg:p-8 max-w-xl w-full space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white">
                          {editingTeacherId ? 'শিক্ষকের তথ্য এডিট করুন' : 'নতুন শিক্ষক যুক্ত করুন (Add New Teacher)'}
                        </h3>
                        <p className="text-xs text-slate-400">শিক্ষকের ব্যক্তিগত বিবরণী ও যোগাযোগের তথ্য কনফিগার করুন</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsTeacherModalOpen(false)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Form Body */}
                  <form onSubmit={handleSaveTeacher} className="space-y-5 text-xs">
                    {/* Credentials Section */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="text-cyan-400 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/80 pb-2">
                        <Shield className="w-3.5 h-3.5" />
                        <span>লগইন ও পোর্টাল আইডি (Authentication Credentials)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* School ID (Auto-Set from Super Admin) */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                            <span>স্কুল ID *:</span>
                            <span className="text-[10px] text-cyan-400 font-normal">অটো সেট (Admin)</span>
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={school.schoolId}
                            className="w-full px-3 py-2 bg-slate-900 border border-cyan-800/60 rounded-xl text-cyan-300 font-mono font-extrabold focus:outline-none cursor-not-allowed"
                            title="Super Admin কর্তৃক নির্ধারিত স্কুলের আইডি"
                          />
                        </div>

                        {/* Teacher ID */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">শিক্ষক ID (Teacher ID) *:</label>
                          <input
                            type="text"
                            required
                            value={teacherFormData.teacherId}
                            onChange={e => setTeacherFormData({ ...teacherFormData, teacherId: e.target.value })}
                            placeholder="যেমন: TCH-101"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">পাসওয়ার্ড (Password) *:</label>
                          <input
                            type="text"
                            required
                            value={teacherFormData.password}
                            onChange={e => setTeacherFormData({ ...teacherFormData, password: e.target.value })}
                            placeholder="যেমন: pass1234"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 1: Name & Designation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5">শিক্ষকের নাম (Full Name) *:</label>
                        <input
                          type="text"
                          required
                          value={teacherFormData.name}
                          onChange={e => setTeacherFormData({ ...teacherFormData, name: e.target.value })}
                          placeholder="যেমন: আব্দুর রহমান স্যার / সুমিতা বিশ্বাস"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5">পদবী (Designation):</label>
                        <select
                          value={teacherFormData.designation}
                          onChange={e => setTeacherFormData({ ...teacherFormData, designation: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-500"
                        >
                          <option value="Headmaster (প্রধান শিক্ষক)">Headmaster (প্রধান শিক্ষক)</option>
                          <option value="Assistant Teacher (সহকারী শিক্ষক)">Assistant Teacher (সহকারী শিক্ষক)</option>
                          <option value="Guest Teacher (অতিথি শিক্ষক)">Guest Teacher (অতিথি শিক্ষক)</option>
                          <option value="Subject Teacher (বিষয় শিক্ষক)">Subject Teacher (বিষয় শিক্ষক)</option>
                          <option value="Computer Teacher (কম্পিউটার শিক্ষক)">Computer Teacher (কম্পিউটার শিক্ষক)</option>
                          <option value="Sports Teacher (ক্রীড়া শিক্ষক)">Sports Teacher (ক্রীড়া শিক্ষক)</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Qualification & Primary Subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5">শিক্ষাগত যোগ্যতা (Qualification):</label>
                        <input
                          type="text"
                          value={teacherFormData.qualification}
                          onChange={e => setTeacherFormData({ ...teacherFormData, qualification: e.target.value })}
                          placeholder="যেমন: M.A. (Bengali), B.Ed. / M.Sc., Ph.D."
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5">মূল বিষয় (Primary Subject):</label>
                        <select
                          value={teacherFormData.primarySubject}
                          onChange={e => setTeacherFormData({ ...teacherFormData, primarySubject: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-500"
                        >
                          {[
                            'BENGALI', 'ENGLISH', 'MATHEMATICS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY',
                            'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'COMPUTER', 'EVS', 'HEALTH_PHYSICAL_EDUCATION',
                            'WORK_EDUCATION', 'ART_CRAFT', 'ARABIC_SANSKRIT'
                          ].map(sub => (
                            <option key={sub} value={sub}>{sub.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Phone & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5">ফোন নম্বর (Phone Number):</label>
                        <input
                          type="tel"
                          value={teacherFormData.phone}
                          onChange={e => setTeacherFormData({ ...teacherFormData, phone: e.target.value })}
                          placeholder="যেমন: 01711000000"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5">ইমেইল (Email Address):</label>
                        <input
                          type="email"
                          value={teacherFormData.email}
                          onChange={e => setTeacherFormData({ ...teacherFormData, email: e.target.value })}
                          placeholder="যেমন: teacher@school.edu.bd"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsTeacherModalOpen(false)}
                        className="px-5 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        বাতিল (Cancel)
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        {editingTeacherId ? 'পরিবর্তন সংরক্ষণ করুন' : 'শিক্ষক সংরক্ষণ করুন (Save Teacher)'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DAYBOOK TAB */}
        {activeTab === 'daybook' && (
          <div className="space-y-6">
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    Cash Book & Daybook <span className="text-cyan-400 font-normal">/ ক্যাশ বুক</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">দৈনন্দিন আয়-ব্যয় হিসেব বিবরণী</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">তারিখ</th>
                      <th className="p-3">টাইপ</th>
                      <th className="p-3">ক্যাটাগরি</th>
                      <th className="p-3">বিবরণ</th>
                      <th className="p-3 text-right">পরিমাণ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {daybookEntries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{e.date}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${e.type === 'INCOME' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                            {e.type}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-200">{e.category}</td>
                        <td className="p-3 text-slate-400">{e.description}</td>
                        <td className="p-3 text-right font-bold font-mono text-emerald-400">৳ {e.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Active Section Banner matching Screenshot 3 */}
            <div className="bg-[#042027] border border-cyan-900/60 rounded-2xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    School Settings & Controls <span className="text-cyan-400 font-normal">/ বিদ্যালয় ওয়েবসাইট ও গাড়ি সেটিংস</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    এখানে বিদ্যালয়ের প্রোফাইল তথ্য এবং স্কুল গাড়ি/কার সার্ভিস রুট সেটিংস পরিচালনা করতে পারবেন।
                  </p>
                </div>
              </div>

              {/* Sub-nav pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button 
                  onClick={() => setActiveSubTab('profile')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    activeSubTab === 'profile' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-bold' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  School Profile (প্রোফাইল)
                </button>
                <button 
                  onClick={() => setActiveSubTab('classes')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    activeSubTab === 'classes' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-bold' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  📚 Class & Section (শ্রেণী ও সেকশন)
                </button>
                <button 
                  onClick={() => setActiveSubTab('vehicles')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    activeSubTab === 'vehicles' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-bold' : 'bg-slate-900/80 text-cyan-300 border-cyan-800 hover:bg-slate-800'
                  }`}
                >
                  Car Menu (কার ও গাড়ি সেটআপ)
                </button>
              </div>
            </div>

            {/* Profile & Branding Content (White Light Theme matching Screenshot 3) */}
            {activeSubTab === 'profile' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 text-slate-800">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">
                    বিদ্যালয়ের বিবরণ ও ব্র্যান্ডিং / Profile & Branding
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    বিদ্যালয়ের নাম, ঠিকানা, হেল্পলাইন এবং মার্কেটিং ব্র্যান্ডিং লোগো ও স্বাক্ষর সেটিংস।
                  </p>
                </div>

                {/* Logo & Signature row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* School Logo */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-slate-800">বিদ্যালয়ের লোগো / School Logo</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl border border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                        {schoolProfile.logo ? (
                          <img src={schoolProfile.logo} alt="School Logo" className="w-full h-full object-cover" />
                        ) : (
                          <GraduationCap className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="inline-block px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm">
                          {isUploadingLogo ? 'আপলোড হচ্ছে...' : 'ফটো আপলোড করুন / Choose Photo'}
                          <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="hidden" />
                        </label>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          যেযেকোনো বিদ্যালয়ের সাইজের ছবি (JPG/PNG) আপলোড করতে পারেন, সিস্টেম এটি অটোমেটিক ফিট করে নেবে।
                        </p>
                        <div className="mt-2 space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">🔗 অনলাইন ছবির লিঙ্ক / URL দিয়ে সেট করুন</label>
                          <div className="flex gap-2">
                            <input 
                              type="url"
                              placeholder="https://..."
                              value={schoolProfile.logo || ''}
                              onChange={e => setSchoolProfile({ ...schoolProfile, logo: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                            />
                            {schoolProfile.logo && (
                              <button
                                type="button"
                                disabled={isOptimizingLogo}
                                onClick={handleOptimizeLogo}
                                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer disabled:opacity-50"
                                title="ছবির সাইজ কমিয়ে হালকা করুন"
                              >
                                {isOptimizingLogo ? 'প্রসেসিং...' : '⚡ অপ্টিমাইজ'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Authorized Signature */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-slate-800">অনুমোদিত স্বাক্ষর / Authorized Signature</label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-16 rounded-xl border border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0 p-1">
                        {schoolProfile.signature ? (
                          <img src={schoolProfile.signature} alt="Signature" loading="lazy" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-400 text-center">স্বাক্ষর নেই</span>
                        )}
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <label className="inline-block px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm">
                          {isUploadingSignature ? 'আপলোড হচ্ছে...' : 'স্বাক্ষর আপলোড করুন / Choose Signature'}
                          <input type="file" accept="image/*" onChange={handleSignatureUpload} disabled={isUploadingSignature} className="hidden" />
                        </label>
                        <div className="mt-2 space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">🔗 অনলাইন ছবির লিঙ্ক / URL দিয়ে সেট করুন</label>
                          <div className="flex gap-2">
                            <input 
                              type="url"
                              placeholder="https://..."
                              value={schoolProfile.signature || ''}
                              onChange={e => setSchoolProfile({ ...schoolProfile, signature: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                            />
                            {schoolProfile.signature && (
                              <button
                                type="button"
                                disabled={isOptimizingSignature}
                                onClick={handleOptimizeSignature}
                                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer disabled:opacity-50"
                                title="স্বাক্ষরের সাইজ কমিয়ে হালকা করুন"
                              >
                                {isOptimizingSignature ? 'প্রসেসিং...' : '⚡ অপ্টিমাইজ'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2">
                          <input 
                            type="text"
                            placeholder="স্বাক্ষরকারীর পদ / Signatory Designation *"
                            value={schoolProfile.headmasterName || ''}
                            onChange={e => setSchoolProfile({ ...schoolProfile, headmasterName: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Fields Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">বিদ্যালয়ের নাম (ইংরেজি) / School Name (English)</label>
                    <input 
                      type="text"
                      value={schoolProfile.name}
                      onChange={e => setSchoolProfile({ ...schoolProfile, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">বিদ্যালয়ের নাম (বাংলা) / School Name (Bengali)</label>
                    <input 
                      type="text"
                      value={schoolProfile.nameBengali || ''}
                      onChange={e => setSchoolProfile({ ...schoolProfile, nameBengali: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">রেজিস্ট্রেশন নম্বর / Reg or Index No.</label>
                    <input 
                      type="text"
                      value={schoolProfile.regNo || ''}
                      onChange={e => setSchoolProfile({ ...schoolProfile, regNo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>

                {/* Form Fields Row 2 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">প্রধান শিক্ষক/স্বাক্ষরকারীর নাম / Headmaster Name</label>
                    <input 
                      type="text"
                      value={schoolProfile.headmasterName || ''}
                      onChange={e => setSchoolProfile({ ...schoolProfile, headmasterName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">কেন্দ্রীয় শিক্ষাবর্ষ / Academic Year</label>
                    <input 
                      type="text"
                      placeholder="যেমন: 2026 বা 2025-2026"
                      value={schoolProfile.currentAcademicYear || '2026'}
                      onChange={e => setSchoolProfile({ ...schoolProfile, currentAcademicYear: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-teal-700 font-bold focus:outline-none focus:border-teal-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ঠিকানা / Physical Address</label>
                    <input 
                      type="text"
                      value={schoolProfile.address}
                      onChange={e => setSchoolProfile({ ...schoolProfile, address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">হেল্পলাইন ফোন নম্বর / Contact Phone Helpline</label>
                    <input 
                      type="text"
                      value={schoolProfile.phone}
                      onChange={e => setSchoolProfile({ ...schoolProfile, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>

                {/* Form Fields Row 3 - Security & Login Credentials (Super Admin Managed) */}
                <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                        <Lock className="w-4 h-4 text-cyan-400" />
                        <span>লগইন এক্সেস ও নিরাপত্তা ক্রেডেনশিয়াল (Login Access Credentials)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        * এই তথ্যগুলো সুপার এডমিন কর্তৃক নির্ধারিত এবং বিদ্যালয়ের নিজস্ব লগইন চাবি হিসেবে সংরক্ষিত।
                      </p>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-lg font-mono font-bold self-start sm:self-auto">
                      🔒 Super Admin Authority
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* 1. School ID / Code */}
                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-300">১. স্কুল কোড / আইডি</label>
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">School ID</span>
                      </div>
                      <div className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-indigo-300 font-mono text-xs font-bold flex items-center justify-between">
                        <span>{schoolProfile.code || schoolProfile.schoolId}</span>
                        <span className="text-[10px] text-slate-500 font-normal">ID: {schoolProfile.schoolId}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        লগইন পেজে ১ম ফিল্ডে এই কোড/আইডি দিন।
                      </p>
                    </div>

                    {/* 2. School Admin ID */}
                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-300">২. এডমিন ইউজার আইডি</label>
                        <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded font-mono">Admin ID</span>
                      </div>
                      <div className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-emerald-300 font-mono text-xs font-bold">
                        {schoolProfile.adminId || schoolProfile.code || schoolProfile.schoolId}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        লগইন পেজে ২য় ফিল্ডে এই এডমিন আইডি দিন।
                      </p>
                    </div>

                    {/* 3. School Admin Password / PIN */}
                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-300">৩. এডমিন পাসওয়ার্ড / পিন</label>
                        <button
                          type="button"
                          onClick={() => setShowAdminKeyInSettings(!showAdminKeyInSettings)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline"
                        >
                          {showAdminKeyInSettings ? 'লুকান (Hide)' : 'দেখান (Show)'}
                        </button>
                      </div>
                      <div className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-mono text-xs font-bold flex items-center justify-between">
                        <span>{showAdminKeyInSettings ? (schoolProfile.adminKey || 'সুপার এডমিন কর্তৃক সেট করা') : '••••••••'}</span>
                        <span className="text-[9px] text-slate-500 uppercase">PIN / PASS</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        লগইন পেজে ৩য় ফিল্ডে এই পাসওয়ার্ড দিন।
                      </p>
                    </div>
                  </div>

                  <div className="bg-cyan-950/40 border border-cyan-900/60 p-2.5 rounded-xl text-[11px] text-cyan-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      নিরাপত্তা বিধান: স্কুল আইডি, এডমিন আইডি এবং পাসওয়ার্ড পরিবর্তন করতে চাইলে সুপার এডমিনের সাথে যোগাযোগ করুন।
                    </span>
                  </div>

                  <div className="bg-amber-950/30 border border-amber-900/50 p-3 rounded-xl space-y-2">
                    <div className="text-[11px] text-amber-200 font-semibold">রক্ষণাবেক্ষণ (Maintenance)</div>
                    <p className="text-[10px] text-slate-400">
                      পুরনো/ডুপ্লিকেট ছাত্র ডকুমেন্ট (যেমন পুরনো "ST-NS-1" ধরনের ID) খুঁজে একত্র ও পরিষ্কার করে -- প্রতিটা ছাত্রের সেরা তথ্য (ছবিসহ) রেখে দেয়। একবার চালালেই যথেষ্ট, পরে আবার চালালেও ক্ষতি নেই।
                    </p>
                    <button
                      type="button"
                      onClick={handleCleanupDuplicateStudents}
                      disabled={isCleaningDuplicates}
                      className="w-full px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-[11px] transition-all"
                    >
                      {isCleaningDuplicates ? 'পরিষ্কার হচ্ছে... অপেক্ষা করুন' : 'ডুপ্লিকেট ছাত্র ডকুমেন্ট পরিষ্কার করুন'}
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveSchoolProfile}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    সংরক্ষণ করুন / Save Settings
                  </button>
                </div>

              </div>
            )}

            {/* Class & Section Settings Tab */}
            {activeSubTab === 'classes' && (
              <div className="space-y-6 text-slate-800">
                {/* Academic Year Control Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-teal-600" />
                        কেন্দ্রীয় শিক্ষাবর্ষ / Academic Year Setting
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        এই বছরটি স্বয়ংক্রিয়ভাবে মার্কশিট, অ্যাডমিট কার্ড, আইডি কার্ড ও মানি রিসিট সহ বিদ্যালয়ের সকল নথিতে দেখানো হবে।
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold font-mono shrink-0">
                      বর্তমান শিক্ষাবর্ষ: {schoolProfile.currentAcademicYear || '2026'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        শিক্ষাবর্ষ বছর (Academic Year Text) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="যেমন: 2026 বা 2025-2026"
                        value={schoolProfile.currentAcademicYear || '2026'}
                        onChange={e => setSchoolProfile({ ...schoolProfile, currentAcademicYear: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-teal-600 font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        দ্রুত নির্বাচন করুন (Quick Preset)
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {['2025', '2026', '2027', '2028', '2025-2026', '2026-2027'].map(yr => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => setSchoolProfile({ ...schoolProfile, currentAcademicYear: yr })}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                              (schoolProfile.currentAcademicYear || '2026') === yr
                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {yr}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveSchoolProfile}
                        className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        শিক্ষাবর্ষ সেভ করুন
                      </button>
                    </div>
                  </div>
                </div>

                {/* Class & Section Management Form */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-teal-600" />
                        {editingClassIndex !== null ? 'ক্লাস ও সেকশন এডিট করুন / Edit Class' : 'নতুন ক্লাস ও সেকশন যুক্ত করুন / Add New Class'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        আপনার বিদ্যালয়ের নিজস্ব ক্লাসের নাম এবং সেকশনগুলো (A, B, C ইত্যাদি) কনফিগার করুন।
                      </p>
                    </div>
                    {editingClassIndex !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClassIndex(null);
                          setClassFormState({ name: '', sections: '', order: classConfigList.length + 1 });
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        ✕ বাতিল করুন (Cancel)
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleAddOrUpdateClass} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          ক্লাসের নাম (Class Name) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="যেমন: Class VIII, Nursery, LKG, Play"
                          value={classFormState.name}
                          onChange={e => setClassFormState({ ...classFormState, name: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-teal-600"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">বিদ্যালয়ের নিজস্ব ফরম্যাটে নাম দিন</p>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          সেকশনসমূহ (Sections - কমা দিয়ে আলাদা করুন)
                        </label>
                        <input
                          type="text"
                          placeholder="যেমন: A, B, C বা গোলাপ, শাপলা"
                          value={classFormState.sections}
                          onChange={e => setClassFormState({ ...classFormState, sections: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-teal-600"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">সেকশন না থাকলে খালি রাখুন</p>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          ক্রম / সিরিয়াল নম্বর (Order)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={classFormState.order}
                          onChange={e => setClassFormState({ ...classFormState, order: Number(e.target.value) })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-teal-600"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">ড্রপডাউনে প্রদর্শনের ক্রমানুসার</p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {editingClassIndex !== null ? 'ক্লাস আপডেট করুন' : 'তালিকায় ক্লাস যুক্ত করুন'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Class List Table */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">
                        বিদ্যালয়ের অনুমোদিত ক্লাস ও সেকশন তালিকা ({classConfigList.length} টি ক্লাস)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        এই তালিকা অনুসারে পুরো সফটওয়্যারের সমস্ত ড্রপডাউন এবং মার্কশিট/ফি সিস্টেম কাজ করবে।
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleResetToDefaultClasses}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer flex items-center gap-1.5"
                        title="স্ট্যান্ডার্ড NS থেকে Class XII তালিকা রিস্টোর করুন"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        ডিফল্ট রিস্টোর (NS-XII)
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveClassConfig}
                        disabled={isSavingClassConfig}
                        className="px-5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSavingClassConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {isSavingClassConfig ? 'সংরক্ষণ হচ্ছে...' : 'ক্লাউডে সেভ করুন'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-center w-16">ক্রম</th>
                          <th className="p-3">ক্লাসের নাম (Class Name)</th>
                          <th className="p-3">সেকশনসমূহ (Sections)</th>
                          <th className="p-3 text-center">নিবন্ধিত শিক্ষার্থী</th>
                          <th className="p-3 text-center w-24">স্থান পরিবর্তন</th>
                          <th className="p-3 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {classConfigList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500">
                              এখনো কোনো ক্লাস কনফিগার করা হয়নি। উপরের ফরম থেকে ক্লাস যুক্ত করুন বা "ডিফল্ট রিস্টোর" বাটনে ক্লিক করুন।
                            </td>
                          </tr>
                        ) : (
                          classConfigList.map((c, index) => {
                            const enrolledCount = students.filter(
                              s => normalizeClassName(s.class) === normalizeClassName(c.name) && s.isActive !== false
                            ).length;
                            return (
                              <tr key={c.name + index} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 text-center font-mono font-bold text-slate-500">
                                  #{index + 1}
                                </td>
                                <td className="p-3 font-bold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center text-[10px] font-black font-mono">
                                      {index + 1}
                                    </span>
                                    <span>{c.name}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  {c.sections && c.sections.length > 0 ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {c.sections.map(sec => (
                                        <span
                                          key={sec}
                                          className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]"
                                        >
                                          Sec {sec}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">কোনো সেকশন নেই</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                                    enrolledCount > 0
                                      ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {enrolledCount} জন
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => handleMoveClassOrder(index, 'UP')}
                                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-xs"
                                      title="উপরে নিন"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === classConfigList.length - 1}
                                      onClick={() => handleMoveClassOrder(index, 'DOWN')}
                                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-xs"
                                      title="নিচে নিন"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditClass(index)}
                                      className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg border border-teal-200 transition-all cursor-pointer text-xs"
                                    >
                                      এডিট
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClass(index)}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition-all cursor-pointer text-xs"
                                      title="ক্লাস মুছে ফেলুন"
                                    >
                                      মুছে ফেলুন
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary & Save reminder */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600">
                      💡 <strong>টিপস:</strong> ক্লাস বা সেকশনে কোনো পরিবর্তন করার পর উপরে বা ডানের <strong className="text-teal-700">"ক্লাউডে সেভ করুন"</strong> বাটনে ক্লিক করে স্থায়ীভাবে সেভ করুন।
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveClassConfig}
                      disabled={isSavingClassConfig}
                      className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      {isSavingClassConfig ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Car Menu (গাড়ি ও রুট এন্ট্রি ও ম্যানেজমেন্ট) */}
            {activeSubTab === 'vehicles' && (
              <div className="space-y-6">
                {/* Car Add / Edit Form */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                        <Car className="w-5 h-5 text-teal-600" />
                        গাড়ি ও কার এন্ট্রি ফরম / Add Vehicle Form
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        গাড়ির নাম, ফোন নম্বর এবং নির্ধারিত রুট এন্ট্রি করুন। এই তালিকাটি শিক্ষার্থী ভর্তি ফরমের গাড়ি ড্রপডাউন অপশনে দেখাবে।
                      </p>
                    </div>
                    {editingVehicleId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicleId(null);
                          setVehicleFormData({ vehicleName: '', phone: '', route: '' });
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer"
                      >
                        বাতিল করুন (Cancel Edit)
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* 1. গাড়ির নাম */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          গাড়ির নাম (Car / Vehicle Name) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="যেমন: গাড়ি-০১ (মাইক্রোবাস A)"
                          value={vehicleFormData.vehicleName}
                          onChange={e => setVehicleFormData({ ...vehicleFormData, vehicleName: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-teal-600"
                        />
                      </div>

                      {/* 2. ফোন নম্বর */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          ফোন নম্বর (Phone Number) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="যেমন: 01712345678"
                          value={vehicleFormData.phone}
                          onChange={e => setVehicleFormData({ ...vehicleFormData, phone: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-teal-600"
                        />
                      </div>

                      {/* 3. রুট */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          রুট (Route / Area) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="যেমন: উত্তরপাড়া - বাজার মোড় - স্কুল"
                          value={vehicleFormData.route}
                          onChange={e => setVehicleFormData({ ...vehicleFormData, route: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-teal-600"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {editingVehicleId ? 'পরিবর্তন সংরক্ষণ করুন' : 'গাড়ি যুক্ত করুন (Add Vehicle)'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Registered Vehicle List Table */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      নিবন্ধিত গাড়ি ও রুট তালিকা ({vehiclesList.length}টি গাড়ি)
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-700 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 hover:bg-amber-100 transition-all">
                      <input 
                        type="checkbox" 
                        checked={showInactiveVehicles} 
                        onChange={e => setShowInactiveVehicles(e.target.checked)} 
                        className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                      />
                      নিষ্ক্রিয় গাড়ি দেখান (Show Inactive)
                    </label>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">গাড়ির নাম</th>
                          <th className="p-3">ফোন নম্বর</th>
                          <th className="p-3">রুট / যাতায়াত এলাকা</th>
                          <th className="p-3 text-center">নিবন্ধিত শিক্ষার্থী</th>
                          <th className="p-3 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {vehiclesList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-500">
                              এখনো কোনো গাড়ি যুক্ত করা হয়নি। উপরের ফরম থেকে নতুন গাড়ি যুক্ত করুন।
                            </td>
                          </tr>
                        ) : (
                          vehiclesList
                            .filter(v => showInactiveVehicles || v.isActive !== false)
                            .map(v => {
                            const count = students.filter(s => s.vehicle === v.vehicleName).length;
                            return (
                              <tr key={v.id} className={`hover:bg-slate-50 ${v.isActive === false ? 'bg-rose-50/50 opacity-75' : ''}`}>
                                <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                                  <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">🚗</span>
                                  {v.vehicleName}
                                  {v.isActive === false && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                      Inactive
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-slate-700">{v.phone || 'N/A'}</td>
                                <td className="p-3 text-slate-700">{v.route || 'N/A'}</td>
                                <td className="p-3 text-center font-bold">
                                  <span className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-full font-bold text-[11px]">
                                    {count} জন
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {v.isActive === false ? (
                                      <button
                                        onClick={() => handleReactivateVehicle(v.id)}
                                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg border border-amber-200 transition-all cursor-pointer text-xs"
                                      >
                                        পুনরায় সক্রিয় করুন
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleEditVehicle(v)}
                                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg border border-teal-200 transition-all cursor-pointer"
                                        >
                                          এডিট
                                        </button>
                                        <button
                                          onClick={() => handleDeleteVehicle(v.id)}
                                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition-all cursor-pointer"
                                          title="নিষ্ক্রিয় (Soft Delete) করুন"
                                        >
                                          নিষ্ক্রিয় করুন
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>

      {/* Google Sheet / CSV Import Modal */}
      <StudentCsvImportModal
        isOpen={isCsvImportModalOpen}
        onClose={() => setIsCsvImportModalOpen(false)}
        onConfirmImport={handleConfirmCsvImport}
        existingStudents={students}
        schoolName={school.name}
        schoolId={school.schoolId}
        school={school}
      />

      {/* Student Admission Form Modal matching Image 1 */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-800/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto">
            {/* Header matching Image 1 */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={closeStudentModal}
                  disabled={isSavingStudent || isUploadingPhoto}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  ←
                </button>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  Student Admission Form <span className="text-cyan-400 font-semibold">(ভর্তি ফরম)</span>
                </h3>
              </div>
              <button 
                type="button"
                onClick={closeStudentModal} 
                disabled={isSavingStudent || isUploadingPhoto}
                className="text-slate-400 hover:text-white text-lg cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              {/* Row 1: CLASS & ROLL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    CLASS <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={studentFormData.class}
                    onChange={e => {
                      const newCls = e.target.value;
                      const nextRoll = students.filter(s => normalizeClassName(s.class) === normalizeClassName(newCls)).length + 1;
                      const currentYear = school.currentAcademicYear || '2026';
                      setStudentFormData({ 
                        ...studentFormData, 
                        class: newCls,
                        roll: nextRoll,
                        studentId: `STU-${currentYear}-${String(nextRoll).padStart(3, '0')}`
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    SECTION (সেকশন)
                  </label>
                  {(() => {
                    const clsConfig = availableClasses.find(c => normalizeClassName(c.name) === normalizeClassName(studentFormData.class));
                    const sections = clsConfig?.sections && clsConfig.sections.length > 0 ? clsConfig.sections : [];
                    if (sections.length > 0) {
                      return (
                        <select
                          value={studentFormData.section || ''}
                          onChange={e => setStudentFormData({ ...studentFormData, section: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                        >
                          <option value="">কোনো সেকশন নেই / None</option>
                          {sections.map(sec => (
                            <option key={sec} value={sec}>Section {sec}</option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="text"
                        placeholder="যেমন: A, B বা খালি রাখুন"
                        value={studentFormData.section || ''}
                        onChange={e => setStudentFormData({ ...studentFormData, section: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 uppercase"
                      />
                    );
                  })()}
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    ROLL NUMBER (শ্রেণি রোল) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={studentFormData.roll}
                    onChange={e => setStudentFormData({ ...studentFormData, roll: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* STUDENT ID */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                  STUDENT ID (স্টুডেন্ট আইডি) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentFormData.studentId || `STU-2026-${String(studentFormData.roll).padStart(3, '0')}`}
                  onChange={e => setStudentFormData({ ...studentFormData, studentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-cyan-400 font-mono font-bold focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  স্বয়ংক্রিয় আইডি জেনারেট হয়েছে। প্রয়োজনে ইউনিক আইডি পরিবর্তন করতে পারেন (ডুপ্লিকেট আইডি গ্রহণযোগ্য নয়)।
                </p>
              </div>

              {/* STUDENT NAME */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                  STUDENT NAME (ইংরেজিতে বড় হাতের অক্ষরের) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.G. MOHAMMAD ALI"
                  value={studentFormData.name}
                  onChange={e => setStudentFormData({ ...studentFormData, name: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 tracking-wide"
                />
              </div>

              {/* FATHER'S NAME & GENDER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    FATHER'S NAME <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.G. ABDUL ALI"
                    value={studentFormData.fatherName}
                    onChange={e => setStudentFormData({ ...studentFormData, fatherName: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 tracking-wide"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    GENDER (লিঙ্গ) <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setStudentFormData({ ...studentFormData, gender: 'Male' })}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        studentFormData.gender === 'Male' || studentFormData.gender === 'Boy'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Boy (ছাত্র)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentFormData({ ...studentFormData, gender: 'Female' })}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        studentFormData.gender === 'Female' || studentFormData.gender === 'Girl'
                          ? 'bg-pink-500 text-slate-950 border-pink-400 shadow-md'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Girl (ছাত্রী)
                    </button>
                  </div>
                </div>
              </div>

              {/* PHONE NUMBER & MONTHLY FEE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    PHONE NUMBER
                  </label>
                  <input
                    type="text"
                    placeholder="10-digit number"
                    value={studentFormData.phone}
                    onChange={e => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    INDIVIDUAL MONTHLY FEE (শিক্ষার্থীর নিজস্ব নির্ধারিত মাসিক ফি ৳) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={studentFormData.monthlyFee}
                    onChange={e => setStudentFormData({ ...studentFormData, monthlyFee: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* VILLAGE / ADDRESS */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                  VILLAGE / ADDRESS <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.G. MADNA"
                  value={studentFormData.address}
                  onChange={e => setStudentFormData({ ...studentFormData, address: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 tracking-wide"
                />
              </div>

              {/* GOVT. SCHOOL / PRIMARY SCHOOL NAME */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                  GOVT. SCHOOL / PRIMARY SCHOOL NAME (সরকারি বিদ্যালয়ের নাম - ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="E.G. MADNA GOVT. PRIMARY SCHOOL"
                  value={studentFormData.govtSchoolName || ''}
                  onChange={e => setStudentFormData({ ...studentFormData, govtSchoolName: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 tracking-wide"
                />
              </div>

              {/* STUDENT PHOTO SECTION with Storage Upload, Gallery, Camera & Direct URL Option */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <label className="block font-extrabold text-cyan-400 uppercase tracking-wide text-xs">
                  STUDENT PHOTO (ছাত্র/ছাত্রীর ছবি)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 flex items-center justify-center shrink-0 overflow-hidden relative group">
                    {isUploadingPhoto ? (
                      <div className="text-center p-2 text-cyan-400 space-y-1">
                        <RefreshCw className="w-6 h-6 mx-auto animate-spin" />
                        <span className="text-[10px] block font-bold">আপলোড হচ্ছে...</span>
                      </div>
                    ) : studentFormData.photo ? (
                      <>
                        <img src={formatPhotoUrl(studentFormData.photo)} alt="Student" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setStudentFormData({ ...studentFormData, photo: '' })}
                          className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 text-[10px] cursor-pointer shadow transition-all"
                          title="ছবি অপসারণ করুন"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2 text-slate-500">
                        <Users className="w-8 h-8 mx-auto opacity-40 mb-1" />
                        <span className="text-[10px] block font-bold">No Photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className={`px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold rounded-xl text-xs cursor-pointer text-center transition-all flex items-center justify-center gap-1.5 ${isUploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                        <ImageIcon className="w-3.5 h-3.5" />
                        {isUploadingPhoto ? 'আপলোড হচ্ছে...' : 'গ্যালারি থেকে ছবি'}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingPhoto}
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoFileUpload(file);
                          }}
                        />
                      </label>

                      <label className={`px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold rounded-xl text-xs cursor-pointer text-center transition-all flex items-center justify-center gap-1.5 ${isUploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Camera className="w-3.5 h-3.5" />
                        {isUploadingPhoto ? 'আপলোড হচ্ছে...' : 'ক্যামেরা দিয়ে তুলুন'}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          disabled={isUploadingPhoto}
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoFileUpload(file);
                          }}
                        />
                      </label>
                    </div>

                    {/* Direct Image URL Setting Option with Fast Optimization */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-300">
                        🔗 অনলাইন ছবির লিঙ্ক / URL দিয়ে সেট করুন:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://example.com/photo.jpg বা bit.ly/..., imgbb.com/..."
                          value={studentFormData.photo || ''}
                          onChange={e => setStudentFormData({ ...studentFormData, photo: e.target.value })}
                          onBlur={e => {
                            const trimmed = e.target.value.trim();
                            if (trimmed) {
                              const formatted = formatPhotoUrl(trimmed);
                              if (formatted && formatted !== studentFormData.photo) {
                                setStudentFormData(prev => ({ ...prev, photo: formatted }));
                              }
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                        />
                        {studentFormData.photo && (
                          <>
                            <button
                              type="button"
                              disabled={isOptimizingPhoto}
                              onClick={async () => {
                                if (!studentFormData.photo) return;
                                setIsOptimizingPhoto(true);
                                try {
                                  const optUrl = await compressAndOptimizeImageUrl(studentFormData.photo, `stu_${studentFormData.studentId || Date.now()}`);
                                  setStudentFormData(prev => ({ ...prev, photo: optUrl }));
                                  alert('ছবি সফলভাবে অপ্টিমাইজ ও সাইজ সংকুচিত করা হয়েছে!');
                                } catch (e: any) {
                                  alert('ছবি অপ্টিমাইজ করতে সমস্যা হয়েছে: ' + (e?.message || 'Error'));
                                } finally {
                                  setIsOptimizingPhoto(false);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold rounded-xl shrink-0 cursor-pointer transition-all disabled:opacity-50"
                              title="ছবির সাইজ কমিয়ে হালকা ও দ্রুতগতির করুন"
                            >
                              {isOptimizingPhoto ? 'প্রসেসিং...' : '⚡ অপ্টিমাইজ'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudentFormData({ ...studentFormData, photo: '' })}
                              className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 text-xs font-bold rounded-xl shrink-0 cursor-pointer transition-all"
                            >
                              Clear
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-tight">
                      * ছবি ক্লায়েন্ট-সাইডে স্মার্টভাবে রিসাইজ ও সাইজ সংকুচিত করে হালকা URL আকারে দ্রুত লোড হওয়ার জন্য সংরক্ষণ করা হয়।
                    </p>
                  </div>
                </div>
              </div>

              {/* STATUS & VEHICLE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide">
                    STATUS (অবস্থা)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStudentFormData({ ...studentFormData, status: 'Active' })}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        studentFormData.status === 'Active'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Active (সক্রিয়)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentFormData({ ...studentFormData, status: 'Inactive' })}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        studentFormData.status === 'Inactive'
                          ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Inactive (নিষ্ক্রিয়)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>SCHOOL VEHICLE / TRANSPORT (স্কুল গাড়ি সার্ভিস)</span>
                    <span className="text-[11px] text-cyan-400 font-normal lowercase">সেটিংস থেকে কার যুক্ত করা যাবে</span>
                  </label>
                  <select
                    value={studentFormData.vehicle || 'No'}
                    onChange={e => setStudentFormData({ ...studentFormData, vehicle: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    <option value="No">No (কোনো গাড়ি/পরিবহন সার্ভিস প্রয়োজন নেই)</option>
                    {vehiclesList.map(v => (
                      <option key={v.id} value={v.vehicleName}>
                        🚗 {v.vehicleName} — রুট: {v.route} (ফোন: {v.phone || 'N/A'})
                      </option>
                    ))}
                    {/* Fallback for legacy 'Yes' or custom values */}
                    {studentFormData.vehicle && studentFormData.vehicle !== 'No' && !vehiclesList.some(v => v.vehicleName === studentFormData.vehicle) && (
                      <option value={studentFormData.vehicle}>
                        🚗 {studentFormData.vehicle === 'Yes' ? 'গাড়ি সার্ভিস (সাধারণ)' : studentFormData.vehicle}
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={closeStudentModal} 
                  disabled={isSavingStudent || isUploadingPhoto}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingStudent || isUploadingPhoto}
                  className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs shadow-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingStudent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSavingStudent ? 'সেভ হচ্ছে...' : editingStudent ? 'Update Student' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fee Collection Modal */}
      {isFeeModalOpen && feeStudent && (() => {
        const studentReceiptsList = feeReceipts.filter(r => 
          normalizeClassName(r.studentClass) === normalizeClassName(feeStudent.class) &&
          Number(r.roll) === Number(feeStudent.roll)
        );

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  ফি জমা গ্রহণ ({feeStudent.name})
                </h3>
                <button onClick={() => setIsFeeModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer font-bold">✕</button>
              </div>

              <form onSubmit={handleCollectFee} className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span><strong>শ্রেণী:</strong> {feeStudent.class} | <strong>রোল:</strong> #{feeStudent.roll}</span>
                    <span className="text-cyan-400 font-bold">অভিভাবক: {feeStudent.fatherName || 'N/A'}</span>
                  </div>
                  <div>
                    <strong>মাসিক ফি (Individual Fee):</strong> ₹{feeStudent.monthlyFee || 350}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-2">যে যে মাসের ফি জমা নিতে চান নির্বাচন করুন:</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'january', label: 'Jan (জানুয়ারি)' },
                      { key: 'february', label: 'Feb (ফেব্রুয়ারি)' },
                      { key: 'march', label: 'Mar (মার্চ)' },
                      { key: 'april', label: 'Apr (এপ্রিল)' },
                      { key: 'may', label: 'May (মে)' },
                      { key: 'june', label: 'Jun (জুন)' },
                      { key: 'july', label: 'Jul (জুলাই)' },
                      { key: 'august', label: 'Aug (আগস্ট)' },
                      { key: 'september', label: 'Sep (সেপ্টেম্বর)' },
                      { key: 'october', label: 'Oct (অক্টোবর)' },
                      { key: 'november', label: 'Nov (নভেম্বর)' },
                      { key: 'december', label: 'Dec (ডিসেম্বর)' }
                    ].map(m => {
                      const isAlreadyPaid = (feeStudent as any)[m.key] === 'Paid';
                      const isSelected = feeMonths.includes(m.key);
                      const isExempted = feeStudent?.name ? (studentExemptions[feeStudent.name] || []).includes(m.key) : false;
                      const matchingRec = studentReceiptsList.find(r => {
                        const monthsArr = Array.isArray(r.months)
                          ? r.months
                          : typeof r.months === 'string'
                          ? (r.months as string).split(',')
                          : [];
                        return monthsArr.map(x => String(x || '').trim().toLowerCase()).includes(m.key.toLowerCase());
                      });

                      return (
                        <button
                          type="button"
                          key={m.key}
                          disabled={isAlreadyPaid}
                          onClick={() => {
                            let nextMonths: string[];
                            if (isSelected) {
                              nextMonths = feeMonths.filter(x => x !== m.key);
                            } else {
                              nextMonths = [...feeMonths, m.key];
                            }
                            setFeeMonths(nextMonths);
                            setCustomFeeAmount(String(nextMonths.length * (feeStudent.monthlyFee || 350)));
                          }}
                          className={`p-2 rounded-xl border text-center transition-all font-bold text-[11px] cursor-pointer ${
                            isAlreadyPaid 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-not-allowed' 
                              : isExempted
                              ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                              : isSelected 
                              ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md font-black' 
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col items-center leading-tight">
                            <span>{m.label.split(' ')[0]}</span>
                            {isAlreadyPaid ? (
                              <span className="text-[9px] font-mono font-black text-emerald-400 mt-0.5">
                                ✓ #{matchingRec?.receiptNo || 'Paid'}
                              </span>
                            ) : isExempted ? (
                              <span className="text-[9px] text-rose-300">(Exempt)</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">ফি জমার তারিখ (Date)</label>
                    <input
                      type="date"
                      value={collectionDate}
                      onChange={e => setCollectionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">রশিদ নম্বর (Receipt No)</label>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={e => setReceiptNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-cyan-400 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">পেমেন্ট মোড</label>
                    <select
                      value={feePaymentMode}
                      onChange={e => setFeePaymentMode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="Cash">Cash (ক্যাশ)</option>
                      <option value="PhonePe">PhonePe</option>
                      <option value="GPay">GPay</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-cyan-300">
                    <span>আদায়কৃত ফি পরিমাণ (Custom/Default Fee Amount):</span>
                    <span className="text-[11px] text-slate-400 font-normal">কম বা বেশি ফি বসানো যাবে</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-base">₹</span>
                    <input
                      type="number"
                      value={customFeeAmount}
                      onChange={e => setCustomFeeAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-cyan-700/80 rounded-xl text-amber-400 font-mono font-black text-base focus:outline-none focus:border-amber-400"
                      placeholder="ফি এর পরিমাণ লিখুন..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button type="button" onClick={() => setIsFeeModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer">বাতিল</button>
                  <button type="submit" disabled={feeMonths.length === 0} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg disabled:opacity-50 cursor-pointer">
                    ফি জমা সম্পন্ন করুন
                  </button>
                </div>
              </form>

              {/* Paid Months & Receipts History for this Student */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    পরিশোধিত মাসের ফি ও রসিদের তালিকা ({studentReceiptsList.length}টি)
                  </h4>
                </div>

                {studentReceiptsList.length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-500 text-center">
                    এই শিক্ষার্থীর কোনো পূর্ববর্তী ফি পরিশোধের রসিদ পাওয়া যায়নি।
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {studentReceiptsList.map((rec) => (
                      <div key={rec.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-[11px]">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-cyan-400">#Rec: {rec.receiptNo}</span>
                            <span className="text-slate-400 font-mono">({rec.date})</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">{rec.paymentMode}</span>
                          </div>
                          <div className="text-slate-300 truncate">
                            মাস: <strong className="text-emerald-400">{(Array.isArray(rec.months) ? rec.months : typeof rec.months === 'string' ? [rec.months] : []).join(', ')}</strong> | পরিমাণ: <strong className="text-amber-400 font-mono">₹{rec.amount}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditReceipt(rec)}
                            className="p-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-cyan-300 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="রশিদ এডিট করুন"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>এডিট</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReceipt(rec)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="রশিদ মুছে ফেলুন"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ডিলেট</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Receipt Modal */}
      {isEditReceiptModalOpen && editingReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-800/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                রশিদ এডিট করুন (#{editingReceipt.receiptNo} - {editingReceipt.studentName})
              </h3>
              <button onClick={() => setIsEditReceiptModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditedReceipt} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">রশিদ নম্বর (Receipt No)</label>
                  <input
                    type="text"
                    required
                    value={editReceiptFormData.receiptNo}
                    onChange={e => setEditReceiptFormData({ ...editReceiptFormData, receiptNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-cyan-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">তারিখ (Date)</label>
                  <input
                    type="date"
                    required
                    value={editReceiptFormData.date}
                    onChange={e => setEditReceiptFormData({ ...editReceiptFormData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">আদায়কৃত ফি (Amount ৳)</label>
                  <input
                    type="number"
                    required
                    value={editReceiptFormData.amount}
                    onChange={e => setEditReceiptFormData({ ...editReceiptFormData, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 font-mono font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">পেমেন্ট মোড</label>
                  <select
                    value={editReceiptFormData.paymentMode}
                    onChange={e => setEditReceiptFormData({ ...editReceiptFormData, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="Cash">Cash (ক্যাশ)</option>
                    <option value="PhonePe">PhonePe</option>
                    <option value="GPay">GPay</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">অন্তর্ভুক্ত মাসসমূহ:</label>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-cyan-300">
                  {editReceiptFormData.months.join(', ')}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsEditReceiptModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer">বাতিল</button>
                <button type="submit" className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer">
                  রশিদ সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-pink-800/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-pink-400" />
                নতুন ব্যয় / খরচ নথিভুক্তকরণ
              </h3>
              <button onClick={() => setIsAddExpenseModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer font-bold">✕</button>
            </div>

            <form 
              onSubmit={e => {
                e.preventDefault();
                if (!newExpenseData.title || !newExpenseData.amount) return;
                const newExp: ExpenseItem = {
                  id: Date.now().toString(),
                  voucherNo: newExpenseData.voucherNo || `V-${101 + expenses.length}`,
                  date: newExpenseData.date,
                  title: newExpenseData.title,
                  category: newExpenseData.category,
                  paymentMode: newExpenseData.paymentMode,
                  amount: Number(newExpenseData.amount)
                };
                setExpenses([newExp, ...expenses]);
                saveExpenseSingleToFirestore(school.schoolId, newExp).catch(() => {});
                setIsAddExpenseModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-300 mb-1">ভাউচার নং (Voucher No)</label>
                <input
                  type="text"
                  required
                  value={newExpenseData.voucherNo}
                  onChange={e => setNewExpenseData({ ...newExpenseData, voucherNo: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-cyan-400 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">খাত / খরচের বিবরণ (Expense Title)</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: শিক্ষকদের মে মাসের সম্মাননা"
                  value={newExpenseData.title}
                  onChange={e => setNewExpenseData({ ...newExpenseData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">ক্যাটাগরি</label>
                  <select
                    value={newExpenseData.category}
                    onChange={e => setNewExpenseData({ ...newExpenseData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="Teacher Salary">Teacher Salary (শিক্ষক বেতন)</option>
                    <option value="Electricity/Bills">Electricity/Bills (বিদ্যুৎ বিল)</option>
                    <option value="Maintenance">Maintenance (মেরামত)</option>
                    <option value="Vehicle Fuel">Vehicle Fuel (গাড়ির তেল)</option>
                    <option value="Office Supplies">Office Supplies (অফিস খরচ)</option>
                    <option value="Others">Others (অন্যান্য)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">পেমেন্ট মোড</label>
                  <select
                    value={newExpenseData.paymentMode}
                    onChange={e => setNewExpenseData({ ...newExpenseData, paymentMode: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="Cash">Cash (ক্যাশ)</option>
                    <option value="PhonePe">PhonePe</option>
                    <option value="GPay">GPay</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">টাকা (Amount ৳)</label>
                  <input
                    type="number"
                    required
                    value={newExpenseData.amount || ''}
                    onChange={e => setNewExpenseData({ ...newExpenseData, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-rose-400 font-mono font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">তারিখ</label>
                  <input
                    type="date"
                    required
                    value={newExpenseData.date}
                    onChange={e => setNewExpenseData({ ...newExpenseData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsAddExpenseModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer">
                  বাতিল
                </button>
                <button type="submit" className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl shadow-lg cursor-pointer">
                  খরচ সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blank Receipt Modal */}
      {isBlankReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-800/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                ✨ ফাঁকা রসিদ ও কাস্টম ফি জমা
              </h3>
              <button onClick={() => setIsBlankReceiptModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer font-bold">✕</button>
            </div>

            <form 
              onSubmit={e => {
                e.preventDefault();
                if (!blankReceiptData.studentName || !blankReceiptData.amount) return;

                const newRec: FeeReceipt = {
                  id: Date.now().toString(),
                  receiptNo: blankReceiptData.receiptNo || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
                  date: blankReceiptData.date,
                  studentName: blankReceiptData.studentName.toUpperCase(),
                  studentClass: blankReceiptData.studentClass,
                  roll: Number(blankReceiptData.roll),
                  fatherName: blankReceiptData.fatherName || 'N/A',
                  months: [blankReceiptData.note || 'Custom Fee'],
                  amount: Number(blankReceiptData.amount),
                  paymentMode: 'Cash'
                };

                setFeeReceipts([newRec, ...feeReceipts]);
                saveFeeReceiptSingleToFirestore(school.schoolId, newRec).catch(() => {});
                updateFeeTotalsOnReceiptSave(school.schoolId, newRec.amount, newRec.date).catch(() => {});
                setIsBlankReceiptModalOpen(false);
                alert('ফাঁকা রসিদ সফলভাবে এন্ট্রি হয়েছে!');
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">রসিদ নম্বর (Receipt No)</label>
                  <input
                    type="text"
                    required
                    value={blankReceiptData.receiptNo}
                    onChange={e => setBlankReceiptData({ ...blankReceiptData, receiptNo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">তারিখ</label>
                  <input
                    type="date"
                    required
                    value={blankReceiptData.date}
                    onChange={e => setBlankReceiptData({ ...blankReceiptData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">ছাত্র/ছাত্রীর নাম</label>
                <input
                  type="text"
                  required
                  placeholder="E.G. ABDUL MALIK"
                  value={blankReceiptData.studentName}
                  onChange={e => setBlankReceiptData({ ...blankReceiptData, studentName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold tracking-wide uppercase"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">শ্রেণি</label>
                  <select
                    value={blankReceiptData.studentClass}
                    onChange={e => setBlankReceiptData({ ...blankReceiptData, studentClass: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">রোল</label>
                  <input
                    type="number"
                    required
                    value={blankReceiptData.roll}
                    onChange={e => setBlankReceiptData({ ...blankReceiptData, roll: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">টাকা ৳</label>
                  <input
                    type="number"
                    required
                    value={blankReceiptData.amount || ''}
                    onChange={e => setBlankReceiptData({ ...blankReceiptData, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">মন্তব্য / খরচের বিবরণ (Note)</label>
                <input
                  type="text"
                  placeholder="যেমন: ভর্তি ফি / সেশন চার্জ"
                  value={blankReceiptData.note}
                  onChange={e => setBlankReceiptData({ ...blankReceiptData, note: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsBlankReceiptModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer">
                  বাতিল
                </button>
                <button type="submit" className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl shadow-lg cursor-pointer">
                  রসিদ সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
