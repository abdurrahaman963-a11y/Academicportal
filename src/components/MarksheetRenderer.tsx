import React from 'react';
import { Student, ExamMark, School, MarksheetStyle, MarksheetColor, PageSize, PageOrientation } from '../types';
import { SUBJECTS, normalizeClassName } from '../mockData';
import { formatPhotoUrl } from '../lib/firebase';
import { generateStandardStudentId } from '../lib/studentIdHelper';
import { CheckCircle2, XCircle, Award, Star, ShieldCheck, GraduationCap } from 'lucide-react';

export interface MarksheetProps {
  student: Student;
  allStudents: Student[];
  allMarks: ExamMark[];
  school: School;
  examType: string; // '1st Summative Evaluation' | '2nd Summative Evaluation' | '3rd Summative Evaluation'
  styleType: MarksheetStyle; // 'styleA' | 'styleB' | 'styleC' | 'styleD'
  colorTheme: MarksheetColor; // 'emerald' | 'navy' | 'maroon' | 'charcoal'
  pageSize: PageSize; // 'A4' | 'A5'
  orientation: PageOrientation; // 'portrait' | 'landscape'
  academicYear?: string;
}

export interface ColorThemeConfig {
  id: MarksheetColor;
  name: string;
  primaryBg: string;
  primaryText: string;
  headerBg: string;
  headerText: string;
  borderMain: string;
  borderLight: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  accentBg: string;
  accentText: string;
  badgeBg: string;
  badgeText: string;
  hexPrimary: string;
}

export const COLOR_THEMES: Record<MarksheetColor, ColorThemeConfig> = {
  emerald: {
    id: 'emerald',
    name: 'Emerald Green (মরকত সবুজ)',
    primaryBg: 'bg-emerald-900',
    primaryText: 'text-emerald-950',
    headerBg: 'bg-emerald-900',
    headerText: 'text-white',
    borderMain: 'border-emerald-900',
    borderLight: 'border-emerald-200',
    tableHeaderBg: 'bg-emerald-900',
    tableHeaderText: 'text-white',
    accentBg: 'bg-emerald-50/70',
    accentText: 'text-emerald-950',
    badgeBg: 'bg-emerald-900',
    badgeText: 'text-emerald-300',
    hexPrimary: '#065f46'
  },
  navy: {
    id: 'navy',
    name: 'Royal Navy Blue (রয়েল নেভি ব্লু)',
    primaryBg: 'bg-blue-900',
    primaryText: 'text-blue-950',
    headerBg: 'bg-blue-900',
    headerText: 'text-white',
    borderMain: 'border-blue-900',
    borderLight: 'border-blue-200',
    tableHeaderBg: 'bg-blue-900',
    tableHeaderText: 'text-white',
    accentBg: 'bg-blue-50/70',
    accentText: 'text-blue-950',
    badgeBg: 'bg-blue-900',
    badgeText: 'text-blue-300',
    hexPrimary: '#1e3a8a'
  },
  maroon: {
    id: 'maroon',
    name: 'Deep Crimson Maroon (গাঢ় মেরুন)',
    primaryBg: 'bg-rose-900',
    primaryText: 'text-rose-950',
    headerBg: 'bg-rose-900',
    headerText: 'text-white',
    borderMain: 'border-rose-900',
    borderLight: 'border-rose-200',
    tableHeaderBg: 'bg-rose-900',
    tableHeaderText: 'text-white',
    accentBg: 'bg-rose-50/70',
    accentText: 'text-rose-950',
    badgeBg: 'bg-rose-900',
    badgeText: 'text-rose-300',
    hexPrimary: '#831843'
  },
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal Gold (চারকোল গোল্ড)',
    primaryBg: 'bg-slate-900',
    primaryText: 'text-slate-950',
    headerBg: 'bg-slate-900',
    headerText: 'text-amber-400',
    borderMain: 'border-slate-800',
    borderLight: 'border-slate-300',
    tableHeaderBg: 'bg-slate-900',
    tableHeaderText: 'text-white',
    accentBg: 'bg-slate-100',
    accentText: 'text-slate-950',
    badgeBg: 'bg-slate-900',
    badgeText: 'text-amber-300',
    hexPrimary: '#1f2937'
  }
};

// Grading logic helper
export const getGradeDetails = (pct: number) => {
  if (pct >= 90) return { grade: 'AA', gp: 10, remarks: 'Outstanding', remarksBengali: 'অসাধারণ' };
  if (pct >= 80) return { grade: 'A+', gp: 9, remarks: 'Excellent', remarksBengali: 'অতি উৎকৃষ্ট' };
  if (pct >= 70) return { grade: 'A', gp: 8, remarks: 'Very Good', remarksBengali: 'উত্তম' };
  if (pct >= 60) return { grade: 'B+', gp: 7, remarks: 'Good', remarksBengali: 'ভাল' };
  if (pct >= 50) return { grade: 'B', gp: 6, remarks: 'Satisfactory', remarksBengali: 'সন্তোষজনক' };
  if (pct >= 40) return { grade: 'C', gp: 5, remarks: 'Marginal', remarksBengali: 'মোটামুটি' };
  if (pct >= 30) return { grade: 'D', gp: 4, remarks: 'Unsatisfactory', remarksBengali: 'চলনসই' };
  return { grade: 'F', gp: 0, remarks: 'Fail', remarksBengali: 'অনুত্তীর্ণ' };
};

export const MarksheetRenderer = React.memo<MarksheetProps>(({
  student,
  allStudents,
  allMarks,
  school,
  examType,
  styleType,
  colorTheme,
  pageSize,
  orientation,
  academicYear
}) => {
  const theme = COLOR_THEMES[colorTheme] || COLOR_THEMES.emerald;
  const yearVal = school.currentAcademicYear || academicYear || String(new Date().getFullYear());
  const schoolLogo = school.logo || (school as any).logoUrl || '';
  const is3rdSummative = examType.includes('3rd') || examType.toLowerCase().includes('final');

  // Filter student marks
  const studentClass = student.class;
  const studentRoll = Number(student.roll);

  // Get marks for 1st, 2nd, 3rd summatives
  const marks1st = allMarks.filter(
    m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
         Number(m.roll) === studentRoll &&
         (m.examName.includes('1st') || m.examName.toLowerCase().includes('first'))
  );

  const marks2nd = allMarks.filter(
    m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
         Number(m.roll) === studentRoll &&
         (m.examName.includes('2nd') || m.examName.toLowerCase().includes('second'))
  );

  const marks3rd = allMarks.filter(
    m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
         Number(m.roll) === studentRoll &&
         (m.examName.includes('3rd') || m.examName.toLowerCase().includes('third') || m.examName.toLowerCase().includes('final'))
  );

  const currentExamMarks = allMarks.filter(
    m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
         Number(m.roll) === studentRoll &&
         m.examName === examType
  );

  // Load saved class subjects for studentClass
  const savedClassSubjects = (() => {
    try {
      const raw = localStorage.getItem(`classSubjects_${school.schoolId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normCls = normalizeClassName(studentClass);
        for (const k of Object.keys(parsed)) {
          if (k === studentClass || normalizeClassName(k) === normCls) {
            if (Array.isArray(parsed[k]) && parsed[k].length > 0) return parsed[k];
          }
        }
        if (Array.isArray(parsed['DEFAULT']) && parsed['DEFAULT'].length > 0) return parsed['DEFAULT'];
      }
    } catch {}
    return [];
  })();

  // Load saved evaluation full marks per exam
  const savedEvalFullMarks = (() => {
    try {
      const raw = localStorage.getItem(`evalFullMarks_${school.schoolId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      '1st Summative Evaluation': 40,
      '2nd Summative Evaluation': 50,
      '3rd Summative Evaluation': 100
    };
  })();

  const full1stConfigMark = savedEvalFullMarks['1st Summative Evaluation'] || 40;
  const full2ndConfigMark = savedEvalFullMarks['2nd Summative Evaluation'] || 50;
  const full3rdConfigMark = savedEvalFullMarks['3rd Summative Evaluation'] || 100;

  // Helper for subject normalization & deduplication
  const normalizeSubjectKey = (s: string): string => {
    if (!s) return '';
    const upper = s.trim().toUpperCase();
    if (upper.includes('BENGALI') || upper.includes('বাংলা')) return 'BENGALI';
    if (upper.includes('ENGLISH') || upper.includes('ইংরেজি')) return 'ENGLISH';
    if (upper.includes('MATH') || upper.includes('গণিত')) return 'MATHEMATICS';
    if (upper.includes('SCIENCE') || upper.includes('বিজ্ঞান')) return 'SCIENCE';
    if (upper.includes('ENVIRON') || upper.includes('পরিবেশ')) return 'ENVIRONMENT';
    if (upper.includes('HISTOR') || upper.includes('ইতিহাস')) return 'HISTORY';
    if (upper.includes('GEOGRAPH') || upper.includes('ভূগোল')) return 'GEOGRAPHY';
    return upper;
  };

  const deduplicateSubjects = (list: string[]): string[] => {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      if (!item || typeof item !== 'string') continue;
      const key = normalizeSubjectKey(item);
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(item.trim());
      }
    }
    return result;
  };

  // Determine subjects list for this student
  const rawSubjectListFromMarks = [
    ...currentExamMarks.map(m => m.subjectName),
    ...marks1st.map(m => m.subjectName),
    ...marks2nd.map(m => m.subjectName),
    ...marks3rd.map(m => m.subjectName)
  ].filter(Boolean);

  const cleanSavedSubjects = deduplicateSubjects(savedClassSubjects);
  const cleanMarksSubjects = deduplicateSubjects(rawSubjectListFromMarks);

  const combinedSubjectsList = cleanSavedSubjects.length > 0
    ? deduplicateSubjects([...cleanSavedSubjects, ...cleanMarksSubjects])
    : (cleanMarksSubjects.length > 0 ? cleanMarksSubjects : [
        'BENGALI',
        'ENGLISH',
        'MATHEMATICS',
        'SCIENCE',
        'ENVIRONMENT',
        'HISTORY',
        'GEOGRAPHY'
      ]);

  const activeSubjects = combinedSubjectsList.slice(0, 12);
  const subjectCount = activeSubjects.length;
  const isLandscape = orientation === 'landscape';
  const isA5 = pageSize === 'A5';

  // Compact layout modifiers when A5 or Landscape is active
  const isCompact = isA5 || isLandscape;
  const isUltraCompact = isA5 && isLandscape;

  // Auto-fit spacing dynamically based on subject count & paper format
  const tablePadding = isUltraCompact
    ? 'py-0.25 px-0.5'
    : isA5
    ? 'py-0.5 px-0.75 sm:px-1'
    : isCompact || subjectCount > 6
    ? 'py-0.5 px-1 sm:px-1.5'
    : 'py-1.5 px-2 sm:px-2.5';

  const tableFontSize = isUltraCompact
    ? 'text-[8px]'
    : isA5
    ? 'text-[8.5px] sm:text-[9px]'
    : isCompact || subjectCount > 6
    ? 'text-[9px] sm:text-[9.5px]'
    : 'text-xs';

  const gapSpacing = isUltraCompact
    ? 'space-y-0.5'
    : isA5
    ? 'space-y-0.5 sm:space-y-1'
    : isCompact || subjectCount > 6
    ? 'space-y-1'
    : 'space-y-2 sm:space-y-2.5';

  // Header Logo & Text sizing
  const logoSize = isUltraCompact
    ? 'w-7 h-7'
    : isA5
    ? 'w-8 h-8 sm:w-9 sm:h-9'
    : isCompact
    ? 'w-10 h-10'
    : 'w-14 h-14';

  const schoolTitleText = isUltraCompact
    ? 'text-xs sm:text-sm font-black'
    : isA5
    ? 'text-xs sm:text-sm font-black'
    : isCompact
    ? 'text-lg sm:text-xl font-black'
    : 'text-2xl sm:text-3xl font-black';

  const schoolSubtitleText = isUltraCompact
    ? 'text-[8px] font-bold'
    : isA5
    ? 'text-[8px] sm:text-[8.5px] font-bold'
    : isCompact
    ? 'text-[10px] sm:text-xs font-bold'
    : 'text-xs sm:text-sm font-bold';

  const schoolAddressText = isUltraCompact
    ? 'text-[7px]'
    : isA5
    ? 'text-[7px] sm:text-[7.5px]'
    : isCompact
    ? 'text-[9px] sm:text-[10px]'
    : 'text-[10px] sm:text-[11px]';

  const photoBoxSize = isUltraCompact
    ? 'w-9 h-11 text-[7px]'
    : isA5
    ? 'w-11 h-14 text-[7.5px]'
    : isCompact
    ? 'w-14 h-18 text-[8.5px]'
    : 'w-16 h-20 text-[9.5px]';

  // Badge / Pill
  const badgePillClass = isUltraCompact
    ? 'px-2 py-0.5 text-[8px]'
    : isA5
    ? 'px-3 py-0.5 text-[8.5px]'
    : isCompact
    ? 'px-4 py-1 text-[9.5px]'
    : 'px-6 py-1.5 text-xs';

  // Student Info Grid Columns & Large Typography
  const studentInfoGridCols = isUltraCompact
    ? 'grid-cols-2 gap-1 p-1'
    : isA5
    ? 'grid-cols-3 gap-1 p-1.5 sm:p-2'
    : isCompact
    ? 'grid-cols-3 sm:grid-cols-6 gap-2 p-2.5 sm:p-3'
    : 'grid-cols-3 sm:grid-cols-6 gap-3 p-3 sm:p-3.5';

  const studentLabelText = isUltraCompact
    ? 'text-[7.5px]'
    : isA5
    ? 'text-[8px]'
    : isCompact
    ? 'text-[10px] sm:text-xs'
    : 'text-xs sm:text-sm font-bold';

  const studentValueText = isUltraCompact
    ? 'text-[9px] font-black'
    : isA5
    ? 'text-[9.5px] font-black'
    : isCompact
    ? 'text-xs sm:text-sm font-black'
    : 'text-base sm:text-lg font-black tracking-tight';

  // Result Summary Cards
  const resultCardPadding = isUltraCompact
    ? 'p-0.5 px-1'
    : isA5
    ? 'p-1 text-[8px]'
    : isCompact
    ? 'p-1 sm:p-1.5'
    : 'p-2.5';

  const resultCardText = isUltraCompact
    ? 'text-[7px]'
    : isA5
    ? 'text-[7.5px]'
    : isCompact
    ? 'text-[9px]'
    : 'text-xs';

  const resultCardValueText = isUltraCompact
    ? 'text-[9.5px] font-black'
    : isA5
    ? 'text-[10px] font-black'
    : isCompact
    ? 'text-xs sm:text-sm font-black'
    : 'text-sm font-black';

  // Grading Scale Box
  const gradingScalePadding = isUltraCompact
    ? 'p-0.5 text-[6.5px]'
    : isA5
    ? 'p-0.5 text-[7px] leading-tight'
    : isCompact
    ? 'p-1 text-[8px]'
    : 'p-2 text-[9px]';

  // Signatures
  const signaturePt = isUltraCompact
    ? 'pt-1 text-[7.5px]'
    : isA5
    ? 'pt-1.5 text-[8.5px]'
    : isCompact
    ? 'pt-2 text-[9px]'
    : 'pt-4 text-xs';

  const signatureLineWidth = isUltraCompact
    ? 'w-12'
    : isA5
    ? 'w-16 sm:w-20'
    : isCompact
    ? 'w-20'
    : 'w-28';

  const signatureImgHeight = isUltraCompact
    ? 'h-3.5'
    : isA5
    ? 'h-4 sm:h-5'
    : isCompact
    ? 'h-5 sm:h-6'
    : 'h-8';

  // Compute 3rd Summative / Cumulative Subject Data
  let grand1stObtained = 0;
  let grand1stFull = 0;
  let grand2ndObtained = 0;
  let grand2ndFull = 0;
  let grand3rdObtained = 0;
  let grand3rdFull = 0;
  let grandCumulativeObtained = 0;
  let grandCumulativeFull = 0;

  let missingMarksCount = 0;

  const subjectRows = activeSubjects.map((sub) => {
    const m1 = marks1st.find(m => m.subjectName.toUpperCase() === sub.toUpperCase());
    const m2 = marks2nd.find(m => m.subjectName.toUpperCase() === sub.toUpperCase());
    const m3 = marks3rd.find(m => m.subjectName.toUpperCase() === sub.toUpperCase());
    const mCurr = currentExamMarks.find(m => m.subjectName.toUpperCase() === sub.toUpperCase());

    const is1stSummative = examType.includes('1st') || examType.toLowerCase().includes('first');
    const is2ndSummative = examType.includes('2nd') || examType.toLowerCase().includes('second');

    const obt1 = m1 ? m1.markObtain : null;
    const full1 = full1stConfigMark || (m1 ? m1.totalMark : 40);

    const obt2 = m2 ? m2.markObtain : null;
    const full2 = full2ndConfigMark || (m2 ? m2.totalMark : 50);

    const obt3 = m3 ? m3.markObtain : (mCurr && is3rdSummative ? mCurr.markObtain : null);
    const full3 = full3rdConfigMark || (m3 ? m3.totalMark : (mCurr && is3rdSummative ? mCurr.totalMark : 100));

    const singleObt = mCurr ? mCurr.markObtain : (is1stSummative ? obt1 : is2ndSummative ? obt2 : obt3);
    const singleFull = is1stSummative ? full1 : (is2ndSummative ? full2 : full3);

    if (singleObt === null) {
      missingMarksCount++;
    }

    if (obt1 !== null && full1 !== null) { grand1stObtained += obt1; grand1stFull += full1; }
    if (obt2 !== null && full2 !== null) { grand2ndObtained += obt2; grand2ndFull += full2; }
    if (obt3 !== null && full3 !== null) { grand3rdObtained += obt3; grand3rdFull += full3; }

    const hasAnyCum = (obt1 !== null) || (obt2 !== null) || (obt3 !== null);
    const cumObt = hasAnyCum ? ((obt1 || 0) + (obt2 || 0) + (obt3 || 0)) : null;
    const cumFull = hasAnyCum ? ((full1 || 0) + (full2 || 0) + (full3 || 0)) : null;

    if (cumObt !== null && cumFull !== null) {
      grandCumulativeObtained += cumObt;
      grandCumulativeFull += cumFull;
    }

    const pct = is3rdSummative
      ? (cumFull && cumFull > 0 ? Math.round((cumObt! / cumFull) * 100) : 0)
      : (singleFull && singleFull > 0 ? Math.round(((singleObt || 0) / singleFull) * 100) : 0);

    const gradeDetails = getGradeDetails(pct);

    // Fix #8: Check if remarks is ABSENT in stored mark record
    let remarks = gradeDetails.remarks;
    let grade = gradeDetails.grade;
    let gp = gradeDetails.gp;

    const currentRecord = mCurr || (is1stSummative ? m1 : is2ndSummative ? m2 : m3);
    if (currentRecord?.remarks === 'ABSENT' || m1?.remarks === 'ABSENT' || m2?.remarks === 'ABSENT' || m3?.remarks === 'ABSENT') {
      remarks = 'ABSENT';
    }

    return {
      sub,
      obt1,
      full1,
      obt2,
      full2,
      obt3,
      full3,
      singleObt,
      singleFull,
      cumObt,
      cumFull,
      pct,
      grade,
      gp,
      remarks,
      hasRealMark: singleObt !== null
    };
  });

  // Calculate Overall Class Ranks (No fake total fabrications)
  const classStudents = allStudents.filter(
    st => normalizeClassName(st.class) === normalizeClassName(studentClass) && st.isActive !== false
  );

  const studentRankTotals = classStudents.map(st => {
    const stMarks1 = allMarks.filter(
      m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
           Number(m.roll) === Number(st.roll) &&
           (m.examName.includes('1st') || m.examName.toLowerCase().includes('first'))
    );
    const stMarks2 = allMarks.filter(
      m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
           Number(m.roll) === Number(st.roll) &&
           (m.examName.includes('2nd') || m.examName.toLowerCase().includes('second'))
    );
    const stMarks3 = allMarks.filter(
      m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
           Number(m.roll) === Number(st.roll) &&
           (m.examName.includes('3rd') || m.examName.toLowerCase().includes('third') || m.examName.toLowerCase().includes('final'))
    );
    const stCurrMarks = allMarks.filter(
      m => normalizeClassName(m.class) === normalizeClassName(studentClass) &&
           Number(m.roll) === Number(st.roll) &&
           m.examName === examType
    );

    const has1 = stMarks1.length > 0;
    const has2 = stMarks2.length > 0;
    const has3 = stMarks3.length > 0;
    const hasCurr = stCurrMarks.length > 0;

    const sum1 = has1 ? stMarks1.reduce((s, m) => s + (m.markObtain || 0), 0) : 0;
    const sum2 = has2 ? stMarks2.reduce((s, m) => s + (m.markObtain || 0), 0) : 0;
    const sum3 = has3 ? stMarks3.reduce((s, m) => s + (m.markObtain || 0), 0) : 0;
    const sumCurr = hasCurr ? stCurrMarks.reduce((s, m) => s + (m.markObtain || 0), 0) : sum3;

    const cumulative = sum1 + sum2 + sum3;
    const hasAnyRealMarks = has1 || has2 || has3 || hasCurr;

    return { roll: Number(st.roll), cumulative, sum3, sumCurr, hasAnyRealMarks };
  });

  const validRankStudents = studentRankTotals.filter(s => s.hasAnyRealMarks);
  const cumRankList = [...validRankStudents].sort((a, b) => b.cumulative - a.cumulative);
  const sum3RankList = [...validRankStudents].sort((a, b) => b.sum3 - a.sum3);
  const currRankList = [...validRankStudents].sort((a, b) => b.sumCurr - a.sumCurr);

  const thisStudentHasMarks = studentRankTotals.find(s => s.roll === studentRoll)?.hasAnyRealMarks;
  const cumulativeRank = thisStudentHasMarks ? (cumRankList.findIndex(r => r.roll === studentRoll) + 1) || 'N/A' : 'N/A';
  const sum3Rank = thisStudentHasMarks ? (sum3RankList.findIndex(r => r.roll === studentRoll) + 1) || 'N/A' : 'N/A';
  const currRank = thisStudentHasMarks ? (currRankList.findIndex(r => r.roll === studentRoll) + 1) || 'N/A' : 'N/A';

  // Overall calculations
  const displayTotalObtained = is3rdSummative ? grandCumulativeObtained : subjectRows.reduce((s, r) => s + (r.singleObt || 0), 0);
  const displayTotalFull = is3rdSummative ? grandCumulativeFull : subjectRows.reduce((s, r) => s + (r.singleFull || 0), 0);
  const overallPercentage = displayTotalFull > 0 ? Math.round((displayTotalObtained / displayTotalFull) * 100) : 0;
  const overallGradeInfo = getGradeDetails(overallPercentage);
  const isPass = overallPercentage >= 30;
  const sum3Pct = grand3rdFull > 0 ? Math.round((grand3rdObtained / grand3rdFull) * 100) : 0;
  const sum3Grade = getGradeDetails(sum3Pct).grade;

  // Exact height container to auto-fill single page and avoid 2nd page spillover
  const containerSizeClass = isA5
    ? (isLandscape
        ? 'w-full max-w-[200mm] h-[130mm] min-h-[130mm] print:h-[125mm] print:min-h-[125mm] print:max-h-[125mm]'
        : 'w-full max-w-[140mm] h-[190mm] min-h-[190mm] print:h-[184mm] print:min-h-[184mm] print:max-h-[184mm]')
    : (isLandscape
        ? 'w-full max-w-[285mm] h-[188mm] min-h-[188mm] print:h-[182mm] print:min-h-[182mm] print:max-h-[182mm]'
        : 'w-full max-w-[200mm] h-[272mm] min-h-[272mm] print:h-[265mm] print:min-h-[265mm] print:max-h-[265mm]');

  const containerPaddingClass = isUltraCompact
    ? 'p-1.5 print:p-1.5'
    : isCompact
    ? 'p-2 sm:p-2.5 print:p-2'
    : 'p-3 sm:p-4 print:p-3';

  const renderGradingScale = () => {
    if (!isCompact) {
      return (
        <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
          <div className="font-black uppercase text-center text-slate-800 text-[10px] sm:text-[11px] py-0.5 bg-slate-100 border-b border-slate-300 tracking-wider">
            GRADING SCALE (মূল্যায়ন সূচক)
          </div>
          <table className="w-full text-center border-collapse text-[9.5px] sm:text-[10.5px]">
            <thead>
              <tr className={`${theme.tableHeaderBg} ${theme.tableHeaderText} font-bold uppercase text-[8.5px] sm:text-[9.5px]`}>
                <th className="py-0.5 px-1 border-r border-white/20">Marks Range (%)</th>
                <th className="py-0.5 px-1 border-r border-white/20">Grade</th>
                <th className="py-0.5 px-1 border-r border-white/20">GP</th>
                <th className="py-0.5 px-1 border-r border-slate-300">Remarks (মন্তব্য)</th>
                <th className="py-0.5 px-1 border-r border-white/20">Marks Range (%)</th>
                <th className="py-0.5 px-1 border-r border-white/20">Grade</th>
                <th className="py-0.5 px-1 border-r border-white/20">GP</th>
                <th className="py-0.5 px-1">Remarks (মন্তব্য)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
              <tr className="hover:bg-slate-50">
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">90% - 100%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-emerald-800">AA</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">10</td>
                <td className="py-0.5 px-1 border-r border-slate-300 font-medium text-emerald-900">Outstanding (অসাধারণ)</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">50% - 59%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-blue-600">B</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">6</td>
                <td className="py-0.5 px-1 font-medium text-blue-900">Satisfactory (সন্তোষজনক)</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">80% - 89%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-emerald-700">A+</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">9</td>
                <td className="py-0.5 px-1 border-r border-slate-300 font-medium text-emerald-800">Excellent (অতি উৎকৃষ্ট)</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">40% - 49%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-amber-700">C</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">5</td>
                <td className="py-0.5 px-1 font-medium text-amber-900">Marginal (চলনসই)</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">70% - 79%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-emerald-600">A</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">8</td>
                <td className="py-0.5 px-1 border-r border-slate-300 font-medium text-emerald-700">Very Good (উৎকৃষ্ট)</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">30% - 39%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-orange-700">D</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">4</td>
                <td className="py-0.5 px-1 font-medium text-orange-900">Unsatisfactory (অসন্তোষজনক)</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">60% - 69%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-blue-700">B+</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">7</td>
                <td className="py-0.5 px-1 border-r border-slate-300 font-medium text-blue-800">Good (ভালো)</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">Below 30%</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-black text-rose-600">F</td>
                <td className="py-0.5 px-1 border-r border-slate-200 font-mono font-bold">0</td>
                <td className="py-0.5 px-1 font-medium text-rose-800">Fail (অনুত্তীর্ণ)</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div className={`border border-slate-200 rounded-lg ${gradingScalePadding} bg-slate-50/50`}>
        <div className="font-black uppercase text-center text-slate-600 mb-0.5">GRADING SCALE (মূল্যায়ন সূচক)</div>
        <div className="grid grid-cols-8 gap-0.5 text-center font-mono">
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-emerald-800">AA</strong>90-100%</div>
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-emerald-700">A+</strong>80-89%</div>
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-emerald-600">A</strong>70-79%</div>
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-blue-700">B+</strong>60-69%</div>
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-blue-600">B</strong>50-59%</div>
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-amber-700">C</strong>40-49%</div>
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-orange-700">D</strong>30-39%</div>
          <div className="bg-white p-0.5 rounded border border-slate-200"><strong className="block text-rose-600">F</strong>&lt;30%</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`marksheet-page-fit bg-white text-slate-900 mx-auto shadow-2xl relative font-sans ${containerSizeClass} ${containerPaddingClass} mb-8 print:mb-0 print:shadow-none border-2 ${theme.borderMain} box-border overflow-hidden`}>
      
      {/* Background Auto-Fit Logo Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 p-6 sm:p-10 overflow-hidden">
        {schoolLogo ? (
          <img 
            src={schoolLogo} 
            alt={`${school.name} Watermark Logo`} 
            className="max-w-[55%] max-h-[55%] w-auto h-auto object-contain opacity-[0.14] print:opacity-[0.18] filter contrast-125 saturate-150 pointer-events-none" 
          />
        ) : (
          <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full border-8 border-indigo-900/15 flex flex-col items-center justify-center text-center p-4 text-indigo-950/20 pointer-events-none bg-indigo-50/10">
            <GraduationCap className="w-16 h-16 sm:w-20 sm:h-20 mb-1 text-indigo-950/20" />
            <span className="text-6xl sm:text-8xl font-black uppercase tracking-tighter leading-none">{school.name.substring(0, 1)}</span>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest mt-1 opacity-80 max-w-[80%] line-clamp-2">{school.name}</span>
          </div>
        )}
      </div>

      {/* STYLE A: MODERN GREEN BANNER STYLE */}
      {styleType === 'styleA' && (
        <div className="flex flex-col justify-between h-full relative z-10">
          {/* Header Banner */}
          <div className={`${theme.headerBg} text-white p-2 sm:p-3 rounded-xl shadow-md border ${theme.borderMain} flex items-center justify-between gap-2 sm:gap-4 relative overflow-hidden`}>
            {/* Top Multi-color accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 via-indigo-400 to-amber-400"></div>

            {/* Left Logo */}
            <div className="shrink-0">
              {schoolLogo ? (
                <img src={schoolLogo} alt="Logo" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`${logoSize} object-contain bg-white/90 p-0.5 rounded-lg border border-white/40`} />
              ) : (
                <div className={`${logoSize} bg-white/20 text-white font-black rounded-lg flex items-center justify-center text-lg border border-white/30`}>
                  {school.name.substring(0, 1)}
                </div>
              )}
            </div>

            {/* Center School Name & Details */}
            <div className="text-center flex-1 px-1">
              <h1 className={`${schoolTitleText} uppercase tracking-tight leading-tight text-white drop-shadow-sm`}>
                {school.name}
              </h1>
              <p className={`${schoolSubtitleText} text-amber-300 mt-0.5`}>
                {school.nameBengali || 'প্রচেষ্টা বিদ্যাপীঠ'}
              </p>
              <p className={`${schoolAddressText} text-slate-100 mt-0.5`}>
                {school.address} | Reg. No: {school.regNo || '7990'}
              </p>
            </div>

            {/* Right Photo Box */}
            <div className="shrink-0 text-right">
              <div className={`${photoBoxSize} border-2 border-dashed border-white/60 rounded flex flex-col items-center justify-center bg-white/10 font-bold text-slate-200 overflow-hidden`}>
                {student.photo ? (
                  <img src={formatPhotoUrl(student.photo)} alt={student.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span>PHOTO</span>
                )}
              </div>
            </div>
          </div>

          {/* Banner Title Pill */}
          <div className="text-center">
            <div className={`inline-flex items-center gap-1.5 ${badgePillClass} bg-gradient-to-r from-emerald-900 via-indigo-900 to-purple-900 text-amber-300 font-black uppercase tracking-wider rounded-full shadow-md border border-amber-400/30`}>
              <Star className="w-3 h-3 fill-current text-amber-400" />
              <span>{examType.toUpperCase()} - {yearVal}</span>
            </div>
          </div>

          {/* Student Info Grid */}
          <div className={`${theme.accentBg} ${studentInfoGridCols} rounded-xl border ${theme.borderLight} font-medium shadow-xs grid`}>
            <div>
              <span className={`text-slate-500 block ${studentLabelText} font-semibold`}>Student Name:</span>
              <strong className={`text-slate-900 font-black uppercase block ${studentValueText}`}>{student.name}</strong>
            </div>
            <div>
              <span className={`text-slate-500 block ${studentLabelText} font-semibold`}>Class:</span>
              <strong className={`${theme.primaryText} font-black block ${studentValueText}`}>{student.class}</strong>
            </div>
            <div>
              <span className={`text-slate-500 block ${studentLabelText} font-semibold`}>Roll No:</span>
              <strong className={`${theme.primaryText} font-black block ${studentValueText}`}>#{student.roll}</strong>
            </div>
            <div>
              <span className={`text-slate-500 block ${studentLabelText} font-semibold`}>Father's Name:</span>
              <strong className={`text-slate-800 font-bold block ${studentValueText}`}>{student.fatherName || 'N/A'}</strong>
            </div>
            <div>
              <span className={`text-slate-500 block ${studentLabelText} font-semibold`}>Student ID:</span>
              <strong className={`text-slate-900 font-mono font-bold block ${studentValueText}`}>{generateStandardStudentId(school, student)}</strong>
            </div>
            <div>
              <span className={`text-slate-500 block ${studentLabelText} font-semibold`}>Academic Year:</span>
              <strong className={`text-slate-900 font-mono font-bold block ${studentValueText}`}>{yearVal}</strong>
            </div>
          </div>

          {/* Subject Table */}
          <div className="overflow-hidden">
            <table className={`w-full border-collapse border ${theme.borderMain} ${tableFontSize} text-left`}>
              <thead className={`${theme.tableHeaderBg} ${theme.tableHeaderText} font-extrabold uppercase`}>
                {is3rdSummative ? (
                  <tr>
                    <th className={`border ${theme.borderMain} ${tablePadding}`}>Subject</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>1st Eval</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>2nd Eval</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>3rd Eval</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Grand Total</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>%</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Grade</th>
                  </tr>
                ) : (
                  <tr>
                    <th className={`border ${theme.borderMain} ${tablePadding}`}>Subject</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Full Marks</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Marks Obtained</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>%</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Grade</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>GP</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Remarks</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {subjectRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white/80' : 'bg-slate-50/80'}>
                    <td className={`border ${theme.borderMain} ${tablePadding} font-bold text-slate-900 uppercase`}>{row.sub}</td>
                    {is3rdSummative ? (
                      <>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{row.obt1 !== null ? `${row.obt1} / ${row.full1}` : 'N/A'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{row.obt2 !== null ? `${row.obt2} / ${row.full2}` : 'N/A'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-bold`}>{row.obt3 !== null ? `${row.obt3} / ${row.full3}` : 'N/A'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-extrabold ${theme.primaryText}`}>{row.cumObt !== null ? `${row.cumObt} / ${row.cumFull}` : 'N/A'}</td>
                      </>
                    ) : (
                      <>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono text-slate-600`}>{row.singleFull !== null ? row.singleFull : '-'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-extrabold ${theme.primaryText}`}>{row.singleObt !== null ? row.singleObt : 'N/A'}</td>
                      </>
                    )}
                    <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-bold ${row.pct < 30 ? 'text-rose-600' : 'text-slate-900'}`}>{row.pct}%</td>
                    <td className={`border ${theme.borderMain} ${tablePadding} text-center font-black ${row.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{row.grade}</td>
                    {!is3rdSummative && (
                      <>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-bold`}>{row.gp}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-semibold text-slate-700`}>{row.remarks}</td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className={`${theme.accentBg} font-black text-slate-900 border-t-2 ${theme.borderMain}`}>
                  <td className={`border ${theme.borderMain} ${tablePadding}`}>GRAND TOTAL</td>
                  {is3rdSummative ? (
                    <>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{grand1stObtained} / {grand1stFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{grand2ndObtained} / {grand2ndFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{grand3rdObtained} / {grand3rdFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono ${theme.primaryText}`}>{grandCumulativeObtained} / {grandCumulativeFull}</td>
                    </>
                  ) : (
                    <>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{displayTotalFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono ${theme.primaryText}`}>{displayTotalObtained}</td>
                    </>
                  )}
                  <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{overallPercentage}%</td>
                  <td className={`border ${theme.borderMain} ${tablePadding} text-center font-black ${overallGradeInfo.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{overallGradeInfo.grade}</td>
                  {!is3rdSummative && (
                    <>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{overallGradeInfo.gp}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center uppercase font-bold ${isPass ? 'text-emerald-700' : 'text-rose-600'}`}>{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Result Summary Bar */}
          {is3rdSummative ? (
            <div className="space-y-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-1.5 font-mono text-[10px] sm:text-xs">
                <div className="bg-blue-50/90 border border-blue-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-blue-700 block uppercase font-sans font-bold">3RD SUM TOTAL</span>
                  <strong className="text-xs sm:text-sm text-blue-950">{grand3rdObtained} / {grand3rdFull}</strong>
                </div>
                <div className="bg-purple-50/90 border border-purple-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-purple-700 block uppercase font-sans font-bold">3RD SUM %</span>
                  <strong className="text-xs sm:text-sm text-purple-950">{sum3Pct}%</strong>
                </div>
                <div className="bg-amber-50/90 border border-amber-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-amber-700 block uppercase font-sans font-bold">3RD SUM GRADE</span>
                  <strong className="text-xs sm:text-sm text-amber-900 font-extrabold">{sum3Grade}</strong>
                </div>
                <div className="bg-indigo-50/90 border border-indigo-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-indigo-700 block uppercase font-sans font-bold">3RD SUM RANK</span>
                  <strong className="text-xs sm:text-sm text-indigo-950 font-extrabold">Rank #{sum3Rank}</strong>
                </div>

                <div className="bg-sky-50/90 border border-sky-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-sky-700 block uppercase font-sans font-bold">CUMULATIVE TOTAL</span>
                  <strong className="text-xs sm:text-sm text-sky-950">{grandCumulativeObtained} / {grandCumulativeFull}</strong>
                </div>
                <div className="bg-indigo-50/90 border border-indigo-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-indigo-700 block uppercase font-sans font-bold">CUMULATIVE %</span>
                  <strong className="text-xs sm:text-sm text-indigo-950">{overallPercentage}%</strong>
                </div>
                <div className="bg-emerald-50/90 border border-emerald-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-emerald-700 block uppercase font-sans font-bold">OVERALL GRADE</span>
                  <strong className="text-xs sm:text-sm text-emerald-950 font-extrabold">{overallGradeInfo.grade}</strong>
                </div>
                <div className="bg-rose-50/90 border border-rose-200 p-1 sm:p-1.5 rounded-lg text-center">
                  <span className="text-[8px] sm:text-[9px] text-rose-700 block uppercase font-sans font-bold">OVERALL RANK</span>
                  <strong className="text-xs sm:text-sm text-rose-950 font-extrabold">Rank #{cumulativeRank}</strong>
                </div>
              </div>

              <div className={`text-xs font-bold p-1.5 rounded-lg border flex items-center justify-between ${isPass ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950' : 'bg-rose-100/90 border-rose-400 text-rose-950'}`}>
                <span className="flex items-center gap-1.5 uppercase font-black truncate">
                  {isPass ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-700 shrink-0" />}
                  <span className="truncate">Result (ফলাফল): {isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</span>
                </span>
                <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border border-emerald-300 shrink-0 ml-1">GPA: {overallGradeInfo.gp}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <div className={`${resultCardPadding} rounded-lg border text-center ${isPass ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950' : 'bg-rose-100/90 border-rose-400 text-rose-950'}`}>
                <div className={`${resultCardText} uppercase font-bold text-slate-600`}>FINAL STATUS</div>
                <div className={`flex items-center justify-center gap-1 uppercase ${resultCardValueText}`}>
                  {isPass ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />}
                  <span className="truncate">{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</span>
                </div>
              </div>

              <div className={`bg-blue-50/90 border border-blue-200 ${resultCardPadding} rounded-lg text-center`}>
                <div className={`${resultCardText} uppercase font-bold text-blue-700`}>Average (%)</div>
                <div className={`font-mono ${resultCardValueText} text-blue-950 font-extrabold`}>{overallPercentage}%</div>
              </div>

              <div className={`bg-amber-50/90 border border-amber-200 ${resultCardPadding} rounded-lg text-center`}>
                <div className={`${resultCardText} uppercase font-bold text-amber-700`}>Overall Grade</div>
                <div className={`font-mono ${resultCardValueText} text-amber-900 font-black`}>{overallGradeInfo.grade}</div>
              </div>

              <div className={`bg-purple-50/90 border border-purple-200 ${resultCardPadding} rounded-lg text-center`}>
                <div className={`${resultCardText} uppercase font-bold text-purple-700`}>Class Rank</div>
                <div className={`font-mono ${resultCardValueText} text-purple-950 font-extrabold`}>Rank #{currRank}</div>
              </div>
            </div>
          )}

          {/* Grading Scale Table */}
          {renderGradingScale()}

          {/* Signatures */}
          <div className={`${signaturePt} grid grid-cols-3 gap-2 items-end text-center font-bold text-slate-800 border-t border-slate-200 pt-2 sm:pt-3`}>
            <div>
              <div className={`${signatureLineWidth} border-b-2 border-slate-400 mx-auto mb-1`}></div>
              <span>Class Teacher Signature</span>
            </div>
            <div>
              <div className={`${signatureLineWidth} border-b-2 border-slate-400 mx-auto mb-1`}></div>
              <span>Guardian Signature</span>
            </div>
            <div>
              <div className="relative inline-block">
                {school.signature ? (
                  <img src={school.signature} alt="HM Sign" className={`${signatureImgHeight} mx-auto object-contain mb-1`} />
                ) : (
                  <div className="font-serif italic text-indigo-900 font-bold mb-0.5">Palash SK</div>
                )}
                <div className={`${signatureLineWidth} border-b-2 border-slate-400 mx-auto mb-1`}></div>
                <span>Headmaster Signature & Seal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STYLE B: CERTIFICATE SENTENCE FORMAT */}
      {styleType === 'styleB' && (
        <div className={`flex flex-col justify-between h-full bg-gradient-to-b from-[#fefcf8]/60 via-[#fbf9f0]/50 to-[#f7f3e8]/60 ${containerPaddingClass} rounded-xl relative z-10 border-2 border-amber-700/30 shadow-inner`}>
          {/* Top Multi-color gradient stripe bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-blue-500 via-purple-500 to-amber-500 rounded-full mb-1"></div>

          {/* Header */}
          <div className="text-center border-b-2 border-amber-300/60 pb-2 relative">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="shrink-0">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="Logo" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`${logoSize} object-contain`} />
                ) : (
                  <div className={`${logoSize} bg-gradient-to-br from-indigo-900 to-blue-900 text-white font-bold rounded-full flex items-center justify-center text-sm sm:text-xl shadow`}>
                    {school.name.substring(0, 1)}
                  </div>
                )}
              </div>

              <div className="text-center flex-1 px-1 sm:px-2">
                <h1 className={`${schoolTitleText} uppercase tracking-tight text-indigo-950 font-serif`}>{school.name}</h1>
                <p className={`${schoolSubtitleText} text-amber-800 font-semibold mt-0.5`}>{school.nameBengali || 'প্রচেষ্টা বিদ্যাপীঠ'}</p>
                <p className={`${schoolAddressText} text-slate-700 mt-0.5`}>{school.address} | Reg. No: {school.regNo || '7990'}</p>
              </div>

              <div className={`shrink-0 ${photoBoxSize} border border-amber-400 rounded flex items-center justify-center bg-white font-bold text-amber-800/60 shadow-xs overflow-hidden`}>
                {student.photo ? (
                  <img src={formatPhotoUrl(student.photo)} alt={student.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span>PHOTO</span>
                )}
              </div>
            </div>

            <div className={`inline-block ${badgePillClass} bg-gradient-to-r from-indigo-900 via-purple-900 to-rose-900 text-amber-300 font-black uppercase tracking-widest rounded-full shadow border border-amber-300/40 mt-1`}>
              {examType} - {yearVal}
            </div>
          </div>

          {/* Certificate Sentence Box */}
          <div className={`bg-white/90 ${isA5 ? 'p-1.5 text-[9px] leading-snug' : 'p-3 sm:p-4 text-xs sm:text-sm leading-relaxed'} rounded-xl border border-amber-300 text-slate-800 font-serif shadow-xs`}>
            This is to certify that <strong className={`uppercase ${isA5 ? 'text-[9.5px]' : 'text-sm'} text-emerald-900 font-black underline decoration-2`}>{student.name}</strong>, Son/Daughter of <strong className="text-rose-900">{student.fatherName || 'N/A'}</strong>, Class: <strong className="font-sans font-bold text-blue-900">{student.class}</strong>, Roll No: <strong className="font-sans font-bold text-purple-900">#{student.roll}</strong>, Student ID: <strong className="font-sans font-bold text-indigo-900">{generateStandardStudentId(school, student)}</strong>, Academic Year: <strong className="text-amber-900">{yearVal}</strong> has secured the following marks and grades in the Evaluation.
          </div>

          {/* Subject Table */}
          <div className="overflow-hidden">
            <table className={`w-full border-collapse border ${theme.borderMain} ${tableFontSize} text-left bg-white`}>
              <thead className={`${theme.tableHeaderBg} ${theme.tableHeaderText} font-extrabold uppercase`}>
                {is3rdSummative ? (
                  <tr>
                    <th className={`border ${theme.borderMain} ${tablePadding}`}>Subject</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>1st Eval</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>2nd Eval</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>3rd Eval</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Grand Total</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>%</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Grade</th>
                  </tr>
                ) : (
                  <tr>
                    <th className={`border ${theme.borderMain} ${tablePadding}`}>Subject</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Full Marks</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Marks Obtained</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>%</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Grade</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>GP</th>
                    <th className={`border ${theme.borderMain} ${tablePadding} text-center`}>Remarks</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {subjectRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white/80' : 'bg-amber-50/40'}>
                    <td className={`border ${theme.borderMain} ${tablePadding} font-bold text-slate-900 uppercase`}>{row.sub}</td>
                    {is3rdSummative ? (
                      <>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{row.obt1 !== null ? `${row.obt1} / ${row.full1}` : 'N/A'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{row.obt2 !== null ? `${row.obt2} / ${row.full2}` : 'N/A'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-bold`}>{row.obt3 !== null ? `${row.obt3} / ${row.full3}` : 'N/A'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-extrabold ${theme.primaryText}`}>{row.cumObt !== null ? `${row.cumObt} / ${row.cumFull}` : 'N/A'}</td>
                      </>
                    ) : (
                      <>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono text-slate-600`}>{row.singleFull !== null ? row.singleFull : '-'}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-extrabold ${theme.primaryText}`}>{row.singleObt !== null ? row.singleObt : 'N/A'}</td>
                      </>
                    )}
                    <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-bold ${row.pct < 30 ? 'text-rose-600' : 'text-slate-900'}`}>{row.pct}%</td>
                    <td className={`border ${theme.borderMain} ${tablePadding} text-center font-black ${row.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{row.grade}</td>
                    {!is3rdSummative && (
                      <>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono font-bold`}>{row.gp}</td>
                        <td className={`border ${theme.borderMain} ${tablePadding} text-center font-semibold text-slate-700`}>{row.remarks}</td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="bg-amber-100/60 font-black text-slate-900 border-t-2 border-slate-400">
                  <td className={`border ${theme.borderMain} ${tablePadding}`}>GRAND TOTAL</td>
                  {is3rdSummative ? (
                    <>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{grand1stObtained} / {grand1stFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{grand2ndObtained} / {grand2ndFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{grand3rdObtained} / {grand3rdFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono ${theme.primaryText}`}>{grandCumulativeObtained} / {grandCumulativeFull}</td>
                    </>
                  ) : (
                    <>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{displayTotalFull}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono ${theme.primaryText}`}>{displayTotalObtained}</td>
                    </>
                  )}
                  <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{overallPercentage}%</td>
                  <td className={`border ${theme.borderMain} ${tablePadding} text-center font-black ${overallGradeInfo.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{overallGradeInfo.grade}</td>
                  {!is3rdSummative && (
                    <>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center font-mono`}>{overallGradeInfo.gp}</td>
                      <td className={`border ${theme.borderMain} ${tablePadding} text-center uppercase font-bold ${isPass ? 'text-emerald-700' : 'text-rose-600'}`}>{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Result Tiles */}
          {is3rdSummative ? (
            <div className="space-y-0.5">
              <div className="grid grid-cols-4 gap-1 sm:gap-1.5 font-mono">
                <div className={`bg-blue-50/90 border border-blue-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-blue-700 block uppercase font-sans font-bold`}>3RD SUM TOTAL</span>
                  <strong className={`${resultCardValueText} text-blue-950`}>{grand3rdObtained} / {grand3rdFull}</strong>
                </div>
                <div className={`bg-purple-50/90 border border-purple-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-purple-700 block uppercase font-sans font-bold`}>3RD SUM %</span>
                  <strong className={`${resultCardValueText} text-purple-950`}>{sum3Pct}%</strong>
                </div>
                <div className={`bg-amber-50/90 border border-amber-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-amber-700 block uppercase font-sans font-bold`}>3RD SUM GRADE</span>
                  <strong className={`${resultCardValueText} text-amber-900 font-black`}>{sum3Grade}</strong>
                </div>
                <div className={`bg-indigo-50/90 border border-indigo-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-indigo-700 block uppercase font-sans font-bold`}>3RD SUM RANK</span>
                  <strong className={`${resultCardValueText} text-indigo-950 font-black`}>Rank #{sum3Rank}</strong>
                </div>

                <div className={`bg-sky-50/90 border border-sky-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-sky-700 block uppercase font-sans font-bold`}>CUMULATIVE TOTAL</span>
                  <strong className={`${resultCardValueText} text-sky-950`}>{grandCumulativeObtained} / {grandCumulativeFull}</strong>
                </div>
                <div className={`bg-indigo-50/90 border border-indigo-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-indigo-700 block uppercase font-sans font-bold`}>CUMULATIVE %</span>
                  <strong className={`${resultCardValueText} text-indigo-950`}>{overallPercentage}%</strong>
                </div>
                <div className={`bg-emerald-50/90 border border-emerald-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-emerald-700 block uppercase font-sans font-bold`}>OVERALL GRADE</span>
                  <strong className={`${resultCardValueText} text-emerald-950 font-black`}>{overallGradeInfo.grade}</strong>
                </div>
                <div className={`bg-rose-50/90 border border-rose-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-rose-700 block uppercase font-sans font-bold`}>OVERALL RANK</span>
                  <strong className={`${resultCardValueText} text-rose-950 font-black`}>Rank #{cumulativeRank}</strong>
                </div>
              </div>
              <div className={`${isA5 ? 'text-[8.5px] p-1' : 'text-xs p-1.5'} font-bold rounded border flex items-center justify-between ${isPass ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-rose-100 border-rose-400 text-rose-950'}`}>
                <span className="truncate">Result (ফলাফল): <strong className="uppercase font-black">{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</strong></span>
                <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-emerald-300 shrink-0 ml-1">Overall GPA: {overallGradeInfo.gp}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              <div className={`${resultCardPadding} rounded border text-center font-bold ${isPass ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950' : 'bg-rose-100/90 border-rose-400 text-rose-950'}`}>
                <div className={`${resultCardText} uppercase text-slate-600`}>FINAL RESULT</div>
                <div className={`font-extrabold ${resultCardValueText} truncate`}>{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</div>
              </div>
              <div className={`${resultCardPadding} bg-blue-50/90 rounded border border-blue-300 text-center`}>
                <div className={`${resultCardText} uppercase text-blue-700`}>Average (%)</div>
                <div className={`font-mono font-extrabold ${resultCardValueText} text-blue-950`}>{overallPercentage}%</div>
              </div>
              <div className={`${resultCardPadding} bg-amber-50/90 rounded border border-amber-300 text-center`}>
                <div className={`${resultCardText} uppercase text-amber-700`}>Overall Grade</div>
                <div className={`font-mono font-extrabold ${resultCardValueText} text-amber-900`}>{overallGradeInfo.grade}</div>
              </div>
              <div className={`${resultCardPadding} bg-purple-50/90 rounded border border-purple-300 text-center`}>
                <div className={`${resultCardText} uppercase text-purple-700`}>Class Rank</div>
                <div className={`font-mono font-extrabold ${resultCardValueText} text-purple-950`}>#{currRank}</div>
              </div>
            </div>
          )}

          {/* Grading Scale Table */}
          {renderGradingScale()}

          {/* Signatures */}
          <div className={`${signaturePt} grid grid-cols-3 gap-2 items-end text-center font-bold text-slate-800 border-t border-slate-300 pt-2 sm:pt-3`}>
            <div>
              <div className={`${signatureLineWidth} border-b border-slate-400 mx-auto mb-1`}></div>
              <span>Class Teacher Signature</span>
            </div>
            <div>
              <div className={`${signatureLineWidth} border-b border-slate-400 mx-auto mb-1`}></div>
              <span>Guardian Signature</span>
            </div>
            <div>
              {school.signature ? (
                <img src={school.signature} alt="Sign" className={`${signatureImgHeight} mx-auto object-contain mb-1`} />
              ) : (
                <div className="font-serif italic text-indigo-900 font-bold mb-1">Palash SK</div>
              )}
              <div className={`${signatureLineWidth} border-b border-slate-400 mx-auto mb-1`}></div>
              <span>Headmaster / Principal</span>
            </div>
          </div>
        </div>
      )}

      {/* STYLE C: CLASSIC DOUBLE BORDER STYLE */}
      {styleType === 'styleC' && (
        <div className={`flex flex-col justify-between h-full border-4 border-double ${theme.borderMain} ${containerPaddingClass} rounded-xl relative z-10 bg-white/40`}>
          {/* Header */}
          <div className="text-center border-b-2 border-slate-800 pb-2 relative">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="shrink-0">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="Logo" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`${logoSize} object-contain`} />
                ) : (
                  <div className={`${logoSize} bg-indigo-950 text-white font-bold rounded-full flex items-center justify-center text-sm sm:text-2xl shadow`}>
                    {school.name.substring(0, 1)}
                  </div>
                )}
              </div>

              <div className="text-center flex-1 px-1 sm:px-2">
                <h1 className={`${schoolTitleText} uppercase tracking-tight ${theme.primaryText}`}>{school.name}</h1>
                <p className={`${schoolSubtitleText} text-amber-800 font-semibold mt-0.5`}>{school.nameBengali || 'প্রচেষ্টা বিদ্যাপীঠ'}</p>
                <p className={`${schoolAddressText} text-slate-700 mt-0.5`}>{school.address} | Reg. No: {school.regNo || '7990'}</p>
              </div>

              <div className={`shrink-0 ${photoBoxSize} border-2 border-indigo-900/40 rounded-lg flex flex-col items-center justify-center bg-indigo-50/50 font-bold text-indigo-900/60 overflow-hidden`}>
                {student.photo ? (
                  <img src={formatPhotoUrl(student.photo)} alt={student.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span>PASSPORT</span>
                    <span>PHOTO</span>
                  </>
                )}
              </div>
            </div>

            <div className={`inline-block ${badgePillClass} bg-gradient-to-r from-indigo-900 via-blue-900 to-purple-900 text-amber-300 font-black uppercase tracking-widest rounded-full shadow border border-amber-300/30`}>
              {examType} - {yearVal}
            </div>
          </div>

          {/* Student Info Box */}
          <div className={`border-2 border-indigo-900/30 rounded-lg grid ${studentInfoGridCols} bg-gradient-to-r from-blue-50/70 via-purple-50/50 to-amber-50/50`}>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold`}>Student Name:</span> <strong className={`block text-emerald-950 uppercase font-black ${studentValueText}`}>{student.name}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold`}>Class:</span> <strong className={`block text-blue-900 font-black ${studentValueText}`}>{student.class}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold`}>Roll No:</span> <strong className={`block text-purple-900 font-black ${studentValueText}`}>#{student.roll}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold`}>Father's Name:</span> <strong className={`block text-rose-900 font-bold ${studentValueText}`}>{student.fatherName || 'N/A'}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold`}>Student ID:</span> <strong className={`block text-indigo-900 font-mono font-bold ${studentValueText}`}>{generateStandardStudentId(school, student)}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold`}>Academic Year:</span> <strong className={`block text-amber-900 font-mono font-bold ${studentValueText}`}>{yearVal}</strong></div>
          </div>

          {/* Subject Table */}
          <div className="overflow-hidden">
            <table className={`w-full border-collapse border-2 border-slate-800 ${tableFontSize} text-left`}>
              <thead className={`${theme.tableHeaderBg} ${theme.tableHeaderText} font-extrabold uppercase`}>
                {is3rdSummative ? (
                  <tr>
                    <th className={`border-2 border-slate-800 ${tablePadding}`}>Subject</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>1st Eval</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>2nd Eval</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>3rd Eval</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>Grand Total</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>%</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>Grade</th>
                  </tr>
                ) : (
                  <tr>
                    <th className={`border-2 border-slate-800 ${tablePadding}`}>Subject</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>Full Marks</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>Marks Obtained</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>%</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>Grade</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>GP</th>
                    <th className={`border-2 border-slate-800 ${tablePadding} text-center`}>Remarks</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {subjectRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white/80' : 'bg-slate-50/80'}>
                    <td className={`border-2 border-slate-800 ${tablePadding} font-bold text-slate-900 uppercase`}>{row.sub}</td>
                    {is3rdSummative ? (
                      <>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{row.obt1 !== null ? `${row.obt1} / ${row.full1}` : 'N/A'}</td>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{row.obt2 !== null ? `${row.obt2} / ${row.full2}` : 'N/A'}</td>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono font-bold`}>{row.obt3 !== null ? `${row.obt3} / ${row.full3}` : 'N/A'}</td>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono font-black ${theme.primaryText}`}>{row.cumObt !== null ? `${row.cumObt} / ${row.cumFull}` : 'N/A'}</td>
                      </>
                    ) : (
                      <>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono text-slate-600`}>{row.singleFull !== null ? row.singleFull : '-'}</td>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono font-black ${theme.primaryText}`}>{row.singleObt !== null ? row.singleObt : 'N/A'}</td>
                      </>
                    )}
                    <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono font-bold ${row.pct < 30 ? 'text-rose-600' : 'text-slate-900'}`}>{row.pct}%</td>
                    <td className={`border-2 border-slate-800 ${tablePadding} text-center font-black ${row.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{row.grade}</td>
                    {!is3rdSummative && (
                      <>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono font-bold`}>{row.gp}</td>
                        <td className={`border-2 border-slate-800 ${tablePadding} text-center font-semibold text-slate-700`}>{row.remarks}</td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-800">
                  <td className={`border-2 border-slate-800 ${tablePadding}`}>GRAND TOTAL</td>
                  {is3rdSummative ? (
                    <>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{grand1stObtained} / {grand1stFull}</td>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{grand2ndObtained} / {grand2ndFull}</td>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{grand3rdObtained} / {grand3rdFull}</td>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono ${theme.primaryText}`}>{grandCumulativeObtained} / {grandCumulativeFull}</td>
                    </>
                  ) : (
                    <>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{displayTotalFull}</td>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono ${theme.primaryText}`}>{displayTotalObtained}</td>
                    </>
                  )}
                  <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{overallPercentage}%</td>
                  <td className={`border-2 border-slate-800 ${tablePadding} text-center font-black ${overallGradeInfo.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{overallGradeInfo.grade}</td>
                  {!is3rdSummative && (
                    <>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center font-mono`}>{overallGradeInfo.gp}</td>
                      <td className={`border-2 border-slate-800 ${tablePadding} text-center uppercase font-bold ${isPass ? 'text-emerald-800' : 'text-rose-700'}`}>{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Result Summary Tiles */}
          {is3rdSummative ? (
            <div className="space-y-0.5">
              <div className="grid grid-cols-4 gap-1 sm:gap-1.5 font-mono">
                <div className={`bg-slate-100 border-2 border-slate-800 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-slate-600 block uppercase font-sans font-bold`}>3RD SUM TOTAL</span>
                  <strong className={`${resultCardValueText} text-slate-900`}>{grand3rdObtained} / {grand3rdFull}</strong>
                </div>
                <div className={`bg-blue-50/90 border-2 border-blue-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-blue-700 block uppercase font-sans font-bold`}>3RD SUM %</span>
                  <strong className={`${resultCardValueText} text-blue-950`}>{sum3Pct}%</strong>
                </div>
                <div className={`bg-amber-50/90 border-2 border-amber-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-amber-700 block uppercase font-sans font-bold`}>3RD SUM GRADE</span>
                  <strong className={`${resultCardValueText} text-amber-900 font-black`}>{sum3Grade}</strong>
                </div>
                <div className={`bg-indigo-50/90 border-2 border-indigo-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-indigo-700 block uppercase font-sans font-bold`}>3RD SUM RANK</span>
                  <strong className={`${resultCardValueText} text-indigo-950 font-black`}>Rank #{sum3Rank}</strong>
                </div>

                <div className={`bg-sky-50/90 border-2 border-sky-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-sky-700 block uppercase font-sans font-bold`}>CUMULATIVE TOTAL</span>
                  <strong className={`${resultCardValueText} text-sky-950`}>{grandCumulativeObtained} / {grandCumulativeFull}</strong>
                </div>
                <div className={`bg-indigo-50/90 border-2 border-indigo-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-indigo-700 block uppercase font-sans font-bold`}>CUMULATIVE %</span>
                  <strong className={`${resultCardValueText} text-indigo-950`}>{overallPercentage}%</strong>
                </div>
                <div className={`bg-emerald-50/90 border-2 border-emerald-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-emerald-700 block uppercase font-sans font-bold`}>OVERALL GRADE</span>
                  <strong className={`${resultCardValueText} text-emerald-950 font-black`}>{overallGradeInfo.grade}</strong>
                </div>
                <div className={`bg-rose-50/90 border-2 border-rose-300 ${resultCardPadding} rounded text-center`}>
                  <span className={`${resultCardText} text-rose-700 block uppercase font-sans font-bold`}>OVERALL RANK</span>
                  <strong className={`${resultCardValueText} text-rose-950 font-black`}>Rank #{cumulativeRank}</strong>
                </div>
              </div>
              <div className={`${isA5 ? 'text-[8.5px] p-1' : 'text-xs p-1.5'} font-bold rounded border-2 flex items-center justify-between ${isPass ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-rose-100 border-rose-400 text-rose-950'}`}>
                <span className="truncate">Result (ফলাফল): <strong className="uppercase font-black">{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</strong></span>
                <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-emerald-300 shrink-0 ml-1">Overall GPA: {overallGradeInfo.gp}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              <div className={`${resultCardPadding} rounded border-2 text-center font-bold ${isPass ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950' : 'bg-rose-100/90 border-rose-400 text-rose-950'}`}>
                <div className={`${resultCardText} uppercase text-slate-600`}>FINAL RESULT</div>
                <div className={`font-extrabold ${resultCardValueText} truncate`}>{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</div>
              </div>
              <div className={`${resultCardPadding} bg-blue-50/90 rounded border-2 border-blue-300 text-center`}>
                <div className={`${resultCardText} uppercase text-blue-700`}>Average (%)</div>
                <div className={`font-mono font-extrabold ${resultCardValueText} text-blue-950`}>{overallPercentage}%</div>
              </div>
              <div className={`${resultCardPadding} bg-amber-50/90 rounded border-2 border-amber-300 text-center`}>
                <div className={`${resultCardText} uppercase text-amber-700`}>Overall Grade</div>
                <div className={`font-mono font-extrabold ${resultCardValueText} text-amber-900`}>{overallGradeInfo.grade}</div>
              </div>
              <div className={`${resultCardPadding} bg-purple-50/90 rounded border-2 border-purple-300 text-center`}>
                <div className={`${resultCardText} uppercase text-purple-700`}>Class Rank</div>
                <div className={`font-mono font-extrabold ${resultCardValueText} text-purple-950`}>#{currRank}</div>
              </div>
            </div>
          )}

          {/* Grading Scale Table */}
          {renderGradingScale()}

          {/* Signatures */}
          <div className={`${signaturePt} grid grid-cols-3 gap-2 items-end text-center font-bold text-slate-900 border-t-2 border-slate-800 pt-2 sm:pt-3`}>
            <div>
              <div className={`${signatureLineWidth} border-b-2 border-slate-800 mx-auto mb-1`}></div>
              <span>Class Teacher Signature</span>
            </div>
            <div>
              <div className={`${signatureLineWidth} border-b-2 border-slate-800 mx-auto mb-1`}></div>
              <span>Guardian Signature</span>
            </div>
            <div>
              {school.signature ? (
                <img src={school.signature} alt="Sign" className={`${signatureImgHeight} mx-auto object-contain mb-1`} />
              ) : (
                <div className="font-serif italic text-slate-900 font-bold mb-1">Palash SK</div>
              )}
              <div className={`${signatureLineWidth} border-b-2 border-slate-800 mx-auto mb-1`}></div>
              <span>HM Signature & Seal</span>
            </div>
          </div>
        </div>
      )}

      {/* STYLE D: FORMAL MASTER LEDGER STYLE */}
      {styleType === 'styleD' && (
        <div className={`flex flex-col justify-between h-full border-2 ${theme.borderMain} ${containerPaddingClass} rounded-xl relative z-10 bg-white/40`}>
          {/* Master Ledger Header */}
          <div className="text-center border-b-2 border-slate-800 pb-2">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="shrink-0">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="Logo" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`${logoSize} object-contain`} />
                ) : (
                  <div className={`${logoSize} bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white font-bold rounded-full flex items-center justify-center text-sm sm:text-xl shadow`}>
                    {school.name.substring(0, 1)}
                  </div>
                )}
              </div>

              <div className="text-center flex-1 px-1 sm:px-2">
                <h1 className={`${schoolTitleText} uppercase tracking-tight ${theme.primaryText}`}>{school.name}</h1>
                <p className={`${schoolSubtitleText} text-amber-800 font-semibold mt-0.5`}>{school.nameBengali || 'প্রচেষ্টা বিদ্যাপীঠ'}</p>
                <p className={`${schoolAddressText} text-slate-700 mt-0.5`}>{school.address} | Reg. No: {school.regNo || '7990'}</p>
              </div>

              <div className={`shrink-0 ${photoBoxSize} border border-indigo-900/40 rounded flex flex-col items-center justify-center bg-indigo-50/40 font-bold text-indigo-900/60 overflow-hidden`}>
                {student.photo ? (
                  <img src={formatPhotoUrl(student.photo)} alt={student.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span>PHOTO</span>
                )}
              </div>
            </div>

            <div className={`inline-block ${badgePillClass} bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-amber-300 font-black uppercase tracking-widest rounded-md shadow-md border-b-2 border-amber-400 mt-1`}>
              MARKSHEET - {examType} - {yearVal}
            </div>
          </div>

          {/* Student Info Bar */}
          <div className={`border border-indigo-300 rounded-lg grid ${studentInfoGridCols} bg-gradient-to-r from-slate-50 via-indigo-50/60 to-blue-50/60 font-mono`}>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold font-sans`}>Student Name:</span> <strong className={`text-emerald-950 uppercase font-sans font-black block ${studentValueText}`}>{student.name}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold font-sans`}>Class:</span> <strong className={`text-blue-900 font-black block ${studentValueText}`}>{student.class}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold font-sans`}>Roll No:</span> <strong className={`text-purple-900 font-black block ${studentValueText}`}>#{student.roll}</strong></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold font-sans`}>Father's Name:</span> <span className={`text-rose-900 font-bold block font-sans ${studentValueText}`}>{student.fatherName || 'N/A'}</span></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold font-sans`}>Student ID:</span> <span className={`block text-indigo-900 font-bold ${studentValueText}`}>{generateStandardStudentId(school, student)}</span></div>
            <div><span className={`text-slate-600 block ${studentLabelText} font-bold font-sans`}>Academic Year:</span> <span className={`block text-amber-900 font-bold ${studentValueText}`}>{yearVal}</span></div>
          </div>

          {/* Master Subject Table */}
          <div className="overflow-hidden">
            <table className={`w-full border-collapse border border-slate-800 ${tableFontSize} text-left`}>
              <thead className={`${theme.tableHeaderBg} ${theme.tableHeaderText} font-extrabold uppercase`}>
                {is3rdSummative ? (
                  <tr>
                    <th className={`border border-slate-800 ${tablePadding}`}>Subject</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>1st Sum</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>2nd Sum</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>3rd Sum</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Grand Total</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Percentage</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Grade</th>
                  </tr>
                ) : (
                  <tr>
                    <th className={`border border-slate-800 ${tablePadding}`}>Subject</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Full Marks</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Marks Obtained</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Percentage</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Grade</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>GP</th>
                    <th className={`border border-slate-800 ${tablePadding} text-center`}>Remarks</th>
                  </tr>
                )}
              </thead>
              <tbody className="font-mono">
                {subjectRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white/80' : 'bg-slate-50/80'}>
                    <td className={`border border-slate-800 ${tablePadding} font-sans font-bold text-slate-900 uppercase`}>{row.sub}</td>
                    {is3rdSummative ? (
                      <>
                        <td className={`border border-slate-800 ${tablePadding} text-center`}>{row.obt1 !== null ? `${row.obt1} / ${row.full1}` : 'N/A'}</td>
                        <td className={`border border-slate-800 ${tablePadding} text-center`}>{row.obt2 !== null ? `${row.obt2} / ${row.full2}` : 'N/A'}</td>
                        <td className={`border border-slate-800 ${tablePadding} text-center font-bold`}>{row.obt3 !== null ? `${row.obt3} / ${row.full3}` : 'N/A'}</td>
                        <td className={`border border-slate-800 ${tablePadding} text-center font-extrabold ${theme.primaryText}`}>{row.cumObt !== null ? `${row.cumObt} / ${row.cumFull}` : 'N/A'}</td>
                      </>
                    ) : (
                      <>
                        <td className={`border border-slate-800 ${tablePadding} text-center text-slate-600`}>{row.singleFull !== null ? row.singleFull : '-'}</td>
                        <td className={`border border-slate-800 ${tablePadding} text-center font-black ${theme.primaryText}`}>{row.singleObt !== null ? row.singleObt : 'N/A'}</td>
                      </>
                    )}
                    <td className={`border border-slate-800 ${tablePadding} text-center font-bold ${row.pct < 30 ? 'text-rose-600' : 'text-slate-900'}`}>{row.pct}%</td>
                    <td className={`border border-slate-800 ${tablePadding} text-center font-black ${row.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{row.grade}</td>
                    {!is3rdSummative && (
                      <>
                        <td className={`border border-slate-800 ${tablePadding} text-center font-bold`}>{row.gp}</td>
                        <td className={`border border-slate-800 ${tablePadding} text-center font-semibold text-slate-700 font-sans`}>{row.remarks}</td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="bg-slate-200 font-extrabold text-slate-900 border-t-2 border-slate-800 font-mono">
                  <td className={`border border-slate-800 ${tablePadding} font-sans font-black`}>TOTAL / সর্বমোট</td>
                  {is3rdSummative ? (
                    <>
                      <td className={`border border-slate-800 ${tablePadding} text-center`}>{grand1stObtained} / {grand1stFull}</td>
                      <td className={`border border-slate-800 ${tablePadding} text-center`}>{grand2ndObtained} / {grand2ndFull}</td>
                      <td className={`border border-slate-800 ${tablePadding} text-center`}>{grand3rdObtained} / {grand3rdFull}</td>
                      <td className={`border border-slate-800 ${tablePadding} text-center ${theme.primaryText}`}>{grandCumulativeObtained} / {grandCumulativeFull}</td>
                    </>
                  ) : (
                    <>
                      <td className={`border border-slate-800 ${tablePadding} text-center`}>{displayTotalFull}</td>
                      <td className={`border border-slate-800 ${tablePadding} text-center ${theme.primaryText}`}>{displayTotalObtained}</td>
                    </>
                  )}
                  <td className={`border border-slate-800 ${tablePadding} text-center`}>{overallPercentage}%</td>
                  <td className={`border border-slate-800 ${tablePadding} text-center font-black ${overallGradeInfo.grade === 'F' ? 'text-rose-600' : 'text-emerald-700'}`}>{overallGradeInfo.grade}</td>
                  {!is3rdSummative && (
                    <>
                      <td className={`border border-slate-800 ${tablePadding} text-center`}>{overallGradeInfo.gp}</td>
                      <td className={`border border-slate-800 ${tablePadding} text-center font-black ${isPass ? 'text-emerald-700' : 'text-rose-600'}`}>{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Tiles Grid */}
          {is3rdSummative ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-1.5 font-mono text-xs">
              <div className={`bg-blue-50/90 border border-blue-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-blue-700 block uppercase font-sans font-bold`}>3RD SUM TOTAL</span>
                <strong className={`${resultCardValueText} text-blue-950`}>{grand3rdObtained} / {grand3rdFull}</strong>
              </div>
              <div className={`bg-purple-50/90 border border-purple-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-purple-700 block uppercase font-sans font-bold`}>3RD SUM %</span>
                <strong className={`${resultCardValueText} text-purple-950`}>{grand3rdFull > 0 ? Math.round((grand3rdObtained / grand3rdFull) * 100) : 0}%</strong>
              </div>
              <div className={`bg-amber-50/90 border border-amber-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-amber-700 block uppercase font-sans font-bold`}>3RD SUM GRADE</span>
                <strong className={`${resultCardValueText} text-amber-900 font-black`}>{getGradeDetails(grand3rdFull > 0 ? Math.round((grand3rdObtained / grand3rdFull) * 100) : 0).grade}</strong>
              </div>
              <div className={`bg-indigo-50/90 border border-indigo-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-indigo-700 block uppercase font-sans font-bold`}>3RD SUM POSITION</span>
                <strong className={`${resultCardValueText} text-indigo-950 font-black`}>Rank #{sum3Rank}</strong>
              </div>

              <div className={`bg-sky-50/90 border border-sky-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-sky-700 block uppercase font-sans font-bold`}>CUMULATIVE TOTAL</span>
                <strong className={`${resultCardValueText} text-sky-950`}>{grandCumulativeObtained} / {grandCumulativeFull}</strong>
              </div>
              <div className={`bg-indigo-50/90 border border-indigo-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-indigo-700 block uppercase font-sans font-bold`}>CUMULATIVE %</span>
                <strong className={`${resultCardValueText} text-indigo-950`}>{overallPercentage}%</strong>
              </div>
              <div className={`bg-emerald-50/90 border border-emerald-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-emerald-700 block uppercase font-sans font-bold`}>CUMULATIVE GRADE</span>
                <strong className={`${resultCardValueText} text-emerald-950 font-black`}>{overallGradeInfo.grade}</strong>
              </div>
              <div className={`bg-rose-50/90 border border-rose-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-rose-700 block uppercase font-sans font-bold`}>OVERALL POSITION</span>
                <strong className={`${resultCardValueText} text-rose-950 font-black`}>Rank #{cumulativeRank}</strong>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-1.5 font-mono text-xs">
              <div className={`bg-blue-50/90 border border-blue-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-blue-700 block uppercase font-sans font-bold`}>TOTAL OBTAINED</span>
                <strong className={`${resultCardValueText} text-blue-950`}>{displayTotalObtained} / {displayTotalFull}</strong>
              </div>
              <div className={`bg-purple-50/90 border border-purple-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-purple-700 block uppercase font-sans font-bold`}>PERCENTAGE</span>
                <strong className={`${resultCardValueText} text-purple-950`}>{overallPercentage}%</strong>
              </div>
              <div className={`bg-amber-50/90 border border-amber-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-amber-700 block uppercase font-sans font-bold`}>OVERALL GRADE</span>
                <strong className={`${resultCardValueText} text-amber-900 font-black`}>{overallGradeInfo.grade}</strong>
              </div>
              <div className={`bg-indigo-50/90 border border-indigo-300 ${resultCardPadding} rounded text-center`}>
                <span className={`${resultCardText} text-indigo-700 block uppercase font-sans font-bold`}>CLASS RANK</span>
                <strong className={`${resultCardValueText} text-indigo-950 font-black`}>Rank #{currRank}</strong>
              </div>
            </div>
          )}

          <div className={`${isA5 ? 'text-[8.5px] p-1' : 'text-xs p-1.5'} font-bold rounded border flex items-center justify-between ${isPass ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950' : 'bg-rose-100/90 border-rose-400 text-rose-950'}`}>
            <span className="truncate">Result (ফলাফল): <span className={isPass ? 'text-emerald-800 font-black' : 'text-rose-700 font-black'}>{isPass ? `PASSED (${overallGradeInfo.remarks})` : `FAILED (${overallGradeInfo.remarks})`}</span></span>
            <span className="text-slate-600 text-[10px] font-mono shrink-0 ml-1">* PV Computer Generated Academic Record</span>
          </div>

          {/* Grading Scale Table */}
          {renderGradingScale()}

          {/* Signatures */}
          <div className={`${signaturePt} grid grid-cols-3 gap-2 items-end text-center font-bold text-slate-900 border-t border-slate-300 pt-2 sm:pt-3`}>
            <div>
              <div className={`${signatureLineWidth} border-b border-slate-400 mx-auto mb-1`}></div>
              <span>Guardian's Signature</span>
            </div>
            <div>
              <div className={`${signatureLineWidth} border-b border-slate-400 mx-auto mb-1`}></div>
              <span>Class Teacher</span>
            </div>
            <div>
              <div className="relative inline-block">
                {school.signature ? (
                  <img src={school.signature} alt="Sign" className={`${signatureImgHeight} mx-auto object-contain mb-0.5`} />
                ) : (
                  <div className="font-serif italic text-indigo-900 font-bold">Palash SK</div>
                )}
                <div className={`${signatureLineWidth} border-b border-slate-400 mx-auto mb-1`}></div>
                <span>HM / Office</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
