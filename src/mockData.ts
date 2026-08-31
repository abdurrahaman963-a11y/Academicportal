import { School, Student, ExamMark, DaybookEntry, Teacher, NoticeItem, SyllabusItem, RoutineEntry, ClassConfig } from './types';

export const DEFAULT_CLASS_CONFIG: ClassConfig[] = [
  { name: "NS", sections: [], order: 1 },
  { name: "LKG", sections: [], order: 2 },
  { name: "UKG", sections: [], order: 3 },
  { name: "Class I", sections: [], order: 4 },
  { name: "Class II", sections: [], order: 5 },
  { name: "Class III", sections: [], order: 6 },
  { name: "Class IV", sections: [], order: 7 },
  { name: "Class V", sections: [], order: 8 },
  { name: "Class VI", sections: [], order: 9 },
  { name: "Class VII", sections: [], order: 10 },
  { name: "Class VIII", sections: [], order: 11 },
  { name: "Class IX", sections: [], order: 12 },
  { name: "Class X", sections: [], order: 13 },
  { name: "Class XI", sections: [], order: 14 },
  { name: "Class XII", sections: [], order: 15 },
];

export const CLASSES = DEFAULT_CLASS_CONFIG.map(c => c.name);

export const SUBJECTS = [
  "Bengali (বাংলা)",
  "English (ইংরেজি)",
  "Mathematics (গণিত)",
  "EVS (পরিবেশ)",
  "Health & Physical Education",
  "Art & Craft (শিল্পকলা)"
];

export const CLASS_SHEET_MAP: Record<string, string> = {
  "NS": "NURSERY",
  "LKG": "LKG",
  "UKG": "UKG",
  "Class I": "ONE",
  "Class II": "TWO",
  "Class III": "III",
  "Class IV": "IV",
  "Class V": "V",
  "Class VI": "VI",
  "Class VII": "VII",
  "Class VIII": "VIII",
  "Class IX": "IX",
  "Class X": "X",
  "Class XI": "XI",
  "Class XII": "XII"
};

export function normalizeClassName(rawClass: any): string {
  if (!rawClass) return "Class I";
  const str = String(rawClass).trim();
  // Clean zero-width chars and non-breaking spaces
  const cleanStr = str.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ');
  const lower = cleanStr.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Convert Bangla numbers to English digits for matching
  const bnDigits: Record<string, string> = {
    '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5',
    '৬': '6', '৭': '7', '৮': '8', '৯': '9', '০': '0'
  };
  const convertedLower = cleanStr.toLowerCase().split('').map(ch => bnDigits[ch] || ch).join('').replace(/[^a-z0-9]/g, "");

  if (["ns", "nursery", "nur", "nurseryclass"].includes(lower) || cleanStr.includes("নার্সারি") || cleanStr.includes("নার্সারী")) return "NS";
  if (["lkg", "lowerkg", "lower", "lkgclass"].includes(lower) || cleanStr.includes("এলকেজি")) return "LKG";
  if (["ukg", "upperkg", "upper", "ukgclass"].includes(lower) || cleanStr.includes("ইউকেজি")) return "UKG";

  if (["1", "01", "one", "i", "1st", "class1", "classi", "classone", "class1st"].includes(convertedLower) || cleanStr.includes("প্রথম")) return "Class I";
  if (["2", "02", "two", "ii", "2nd", "class2", "classii", "classtwo", "class2nd"].includes(convertedLower) || cleanStr.includes("দ্বিতীয়")) return "Class II";
  if (["3", "03", "three", "iii", "3rd", "class3", "classiii", "classthree", "class3rd"].includes(convertedLower) || cleanStr.includes("তৃতীয়")) return "Class III";
  if (["4", "04", "four", "iv", "4th", "class4", "classiv", "classfour", "class4th"].includes(convertedLower) || cleanStr.includes("চতুর্থ")) return "Class IV";
  if (["5", "05", "five", "v", "5th", "class5", "classv", "classfive", "class5th"].includes(convertedLower) || cleanStr.includes("পঞ্চম")) return "Class V";
  if (["6", "06", "six", "vi", "6th", "class6", "classvi", "classsix", "class6th"].includes(convertedLower) || cleanStr.includes("ষষ্ঠ")) return "Class VI";
  if (["7", "07", "seven", "vii", "7th", "class7", "classvii", "classseven", "class7th"].includes(convertedLower) || cleanStr.includes("সপ্তম")) return "Class VII";
  if (["8", "08", "eight", "viii", "8th", "class8", "classviii", "classeight", "class8th"].includes(convertedLower) || cleanStr.includes("অষ্টম")) return "Class VIII";
  if (["9", "09", "nine", "ix", "9th", "class9", "classix", "classnine", "class9th"].includes(convertedLower) || cleanStr.includes("নবম")) return "Class IX";
  if (["10", "ten", "x", "10th", "class10", "classx", "classten", "class10th"].includes(convertedLower) || cleanStr.includes("দশম")) return "Class X";
  if (["11", "eleven", "xi", "11th", "class11", "classxi", "classeleven", "class11th"].includes(convertedLower) || cleanStr.includes("একাদশ")) return "Class XI";
  if (["12", "twelve", "xii", "12th", "class12", "classxii", "classtwelve", "class12th"].includes(convertedLower) || cleanStr.includes("দ্বাদশ")) return "Class XII";

  for (let k = 0; k < CLASSES.length; k++) {
    if (CLASSES[k].toLowerCase() === cleanStr.toLowerCase() || CLASSES[k].toLowerCase().replace(/[^a-z0-9]/g, "") === lower) {
      return CLASSES[k];
    }
  }

  return cleanStr;
}

export function safeLocalStorageSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`LocalStorage quota exceeded for key "${key}". Cleaning backup history...`, err);
    try {
      // Clear large backup histories to free up quota
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('backup_history_') || k.includes('autobackups_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(key, value);
    } catch {
      // Catch safely to prevent throwing uncaught DOMExceptions that crash React
    }
  }
}

export const INITIAL_SCHOOLS: School[] = [
  {
    schoolId: "PROCHESTA VIDYAPITH",
    name: "PROCHESTA VIDYAPITH",
    nameBengali: "প্রচেষ্টা বিদ্যাপীঠ",
    code: "PV2026",
    address: "Madna, Raghunathpur, Suti, Murshidabad, West Bengal - 742223",
    phone: "+91 9876543210",
    email: "prochesta.vidyapith@gmail.com",
    regNo: "Reg. No-IV-1226-00009",
    headmasterName: "Palash Sk",
    logo: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=150&auto=format&fit=crop&q=80",
    signature: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&auto=format&fit=crop&q=80",
    defaultMarksheetTemplate: "১. প্রচেষ্টা অফিসিয়াল (Default Classic Frame)",
    defaultAdmitCardTemplate: "১. প্রচেষ্টা অফিসিয়াল (Default Classic Table)",
    status: "ONLINE",
    saasStatus: "Active",
    adminId: "PV2026",
    adminKey: "PV2025/@",
    versionKey: "V2026-001",
    totalStudents: 387,
    totalTeachers: 18,
    currentAcademicYear: "2026",
    active: true
  },
  {
    schoolId: "SCH002",
    name: "Model Public High School",
    nameBengali: "মডেল পাবলিক হাই স্কুল",
    code: "SCH002",
    address: "Baharampur, Murshidabad, West Bengal - 742101",
    phone: "+91 9830011223",
    email: "modelpublic@gmail.com",
    regNo: "Reg. No-WB-8871-2021",
    headmasterName: "Anupam Das",
    logo: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=150&auto=format&fit=crop&q=80",
    status: "ONLINE",
    saasStatus: "Trial",
    adminId: "model2026",
    adminKey: "1234",
    versionKey: "V2026-002",
    totalStudents: 0,
    totalTeachers: 0,
    currentAcademicYear: "2026",
    active: true
  },
  {
    schoolId: "SCH003",
    name: "Aurantangabad Public School",
    nameBengali: "ঔরঙ্গাবাদ পাবলিক স্কুল",
    code: "SCH003",
    address: "Aurangabad, Suti-II, Murshidabad, West Bengal - 742201",
    phone: "+91 9732009988",
    email: "aurangabadpublic@gmail.com",
    regNo: "Reg. No-WB-4432-2019",
    headmasterName: "Md. Alamgir",
    logo: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=150&auto=format&fit=crop&q=80",
    status: "ONLINE",
    saasStatus: "Active",
    adminId: "aurangabad2026",
    adminKey: "1234",
    versionKey: "V2026-003",
    totalStudents: 0,
    totalTeachers: 0,
    currentAcademicYear: "2026",
    active: true
  }
];

export function isProchestaSchool(school?: Partial<School> | null): boolean {
  if (!school) return false;
  const sId = (school.schoolId || '').trim().toUpperCase();
  const code = (school.code || '').trim().toUpperCase();
  const adminId = (school.adminId || '').trim().toUpperCase();
  const name = (school.name || '').trim().toUpperCase();
  const nameBn = (school.nameBengali || '').trim();
  const email = (school.email || '').trim().toLowerCase();

  return (
    sId === 'PROCHESTA VIDYAPITH' ||
    sId === 'PV2026' ||
    sId === 'SCH001' ||
    sId.includes('PROCHESTA') ||
    code === 'PV2026' ||
    code.includes('PROCHESTA') ||
    adminId === 'PV2026' ||
    adminId.includes('PROCHESTA') ||
    name.includes('PROCHESTA') ||
    nameBn.includes('প্রচেষ্টা') ||
    email.includes('prochesta')
  );
}

export function ensureSanitizedSchools(schoolsList: School[]): School[] {
  if (!schoolsList || schoolsList.length === 0) return INITIAL_SCHOOLS;
  return schoolsList.map(sch => {
    const isProchesta = isProchestaSchool(sch);

    if (isProchesta) {
      const validStudentCount = Math.max(sch.totalStudents || 0, 387);
      return {
        ...sch,
        schoolId: 'PROCHESTA VIDYAPITH',
        name: sch.name || 'PROCHESTA VIDYAPITH',
        nameBengali: sch.nameBengali || 'প্রচেষ্টা বিদ্যাপীঠ',
        code: sch.code || 'PV2026',
        adminId: sch.adminId || 'PV2026',
        adminKey: sch.adminKey || 'PV2025/@',
        readsCount: sch.readsCount ?? 0,
        writesCount: sch.writesCount ?? 0,
        deletesCount: sch.deletesCount ?? 0,
        totalStudents: validStudentCount,
        totalTeachers: sch.totalTeachers || 18
      };
    } else {
      return {
        ...sch,
        readsCount: sch.readsCount ?? 0,
        writesCount: sch.writesCount ?? 0,
        deletesCount: sch.deletesCount ?? 0,
        totalStudents: sch.totalStudents ?? 0
      };
    }
  });
}

export const MOCK_STUDENTS: Student[] = [
  {
    studentId: "ST-NS-1",
    class: "NS",
    roll: 1,
    name: "ARISKA ALI",
    fatherName: "HAIDAR ALI",
    address: "GABGACHI",
    phone: "9126313339",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-2",
    class: "NS",
    roll: 2,
    name: "JOHIR RAIHAN",
    fatherName: "NURUL ISLAM",
    address: "PRASADPUR",
    phone: "9735995340",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-3",
    class: "NS",
    roll: 3,
    name: "MUHAYMIN RAHAMAN",
    fatherName: "MUKLESHUR RAHAMAN",
    address: "LAKSHMIPUR",
    phone: "9641596477",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-4",
    class: "NS",
    roll: 4,
    name: "ROSHNI KHATUN",
    fatherName: "MOTAHAR SK",
    address: "MADNA",
    phone: "9564539753",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-5",
    class: "NS",
    roll: 5,
    name: "MOSARAF ALI",
    fatherName: "YEAKUB ALI",
    address: "CHANDRAPARA",
    phone: "8617862529",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-6",
    class: "NS",
    roll: 6,
    name: "TAMANNA ISLAM",
    fatherName: "TOHIDUL ISLAM",
    address: "RAGHUNATHPUR",
    phone: "9674332145",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-7",
    class: "NS",
    roll: 7,
    name: "KISMAT SK",
    fatherName: "MADIN SK",
    address: "MADNA",
    phone: "9126173994",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-8",
    class: "NS",
    roll: 8,
    name: "AFSANA KHATUN",
    fatherName: "BABUL SK",
    address: "MADNA",
    phone: "9614718803",
    monthlyFee: 400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-9",
    class: "NS",
    roll: 9,
    name: "MAHIYA AHAMEDI",
    fatherName: "SELIM AHAMEDI",
    address: "KHANPUR",
    phone: "8167823528",
    monthlyFee: 1450,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-10",
    class: "NS",
    roll: 10,
    name: "AFIYA KHATUN",
    fatherName: "MUSTAKIM SK",
    address: "MADNA",
    phone: "9083318534",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-11",
    class: "NS",
    roll: 11,
    name: "AHANAAZ KHATUN",
    fatherName: "RABBAN SK",
    address: "ISLAMPUR",
    phone: "8436234799",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-12",
    class: "NS",
    roll: 12,
    name: "JUNIYAN KHAN",
    fatherName: "WAHEDUR KHAN",
    address: "BAROGHORIYA",
    phone: "6294707460",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-13",
    class: "NS",
    roll: 13,
    name: "JAGADISH DAS",
    fatherName: "SUNANDA PRAMANIK",
    address: "MADNA",
    phone: "9733831562",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-14",
    class: "NS",
    roll: 14,
    name: "JANNAT KHATUN",
    fatherName: "RUBEL HOSSAIN",
    address: "MADNA",
    phone: "8436139118",
    monthlyFee: 1250,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-15",
    class: "NS",
    roll: 15,
    name: "ARISHFA PARVEEN",
    fatherName: "ALAMGIR SK",
    address: "BAMUHA",
    phone: "7001007363",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-16",
    class: "NS",
    roll: 16,
    name: "AYESHA FATEMA",
    fatherName: "RAFIKUL ISLAM",
    address: "MADNA",
    phone: "9732343873",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-17",
    class: "NS",
    roll: 17,
    name: "MIJHAJ ISLAM",
    fatherName: "MONIRUL ISLAM",
    address: "LAKSHMIPUR",
    phone: "8926896924",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-18",
    class: "NS",
    roll: 18,
    name: "ARHAM ISLAM",
    fatherName: "ALIUL ISLAM",
    address: "MADNA",
    phone: "7866943937",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-19",
    class: "NS",
    roll: 19,
    name: "FARHAN AHAMED",
    fatherName: "ALI NAOYAJ",
    address: "ISLAMPUR",
    phone: "8436670718",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-20",
    class: "NS",
    roll: 20,
    name: "SURAIYA KHATUN",
    fatherName: "IMRAN SHEIKH",
    address: "MADNA",
    phone: "9641758964",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-21",
    class: "NS",
    roll: 21,
    name: "OSMAN SK",
    fatherName: "IMRAN SK",
    address: "MADNA",
    phone: "9641758964",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-22",
    class: "NS",
    roll: 22,
    name: "ANISA KHATUN",
    fatherName: "MD BOKUL SK",
    address: "MADNA",
    phone: "9735455235",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-23",
    class: "NS",
    roll: 23,
    name: "TOHID ALI",
    fatherName: "AKBAR ALI",
    address: "GABGACHI",
    phone: "6297740710",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-24",
    class: "NS",
    roll: 24,
    name: "HABIBULLAH ROSID",
    fatherName: "HARUN AL ROSID",
    address: "MADNA",
    phone: "",
    monthlyFee: 400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-25",
    class: "NS",
    roll: 25,
    name: "SAFIYA KHATUN",
    fatherName: "ROBJUL SK",
    address: "ALILASKARPUR",
    phone: "6380634602",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-26",
    class: "NS",
    roll: 26,
    name: "MAFAZ AHAMED",
    fatherName: "MANIRUL ISLAM",
    address: "FATEPUR",
    phone: "7602593599",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-27",
    class: "NS",
    roll: 27,
    name: "SAJIDA KHATUN",
    fatherName: "MEJARUL ISLAM",
    address: "KHANPUR",
    phone: "8972866204",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-28",
    class: "NS",
    roll: 28,
    name: "SADIA RAHAMAN",
    fatherName: "OBAIDUR RAHAMAN",
    address: "KHIDIRPUR",
    phone: "7478131550",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-29",
    class: "NS",
    roll: 29,
    name: "JIYANA AKHTAR",
    fatherName: "JAHIRUL ISLAM",
    address: "KHIDIRPUR",
    phone: "9641347009",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-30",
    class: "NS",
    roll: 30,
    name: "AYAN SK",
    fatherName: "BANI SK",
    address: "MADANPUR",
    phone: "7029455120",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-31",
    class: "NS",
    roll: 31,
    name: "AYAN ALI",
    fatherName: "MOBARAK HOSSAIN",
    address: "BOROKAKRAMARI",
    phone: "9932165533",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-32",
    class: "NS",
    roll: 32,
    name: "AFIYA SULTANA",
    fatherName: "ABDUR RAJJAK",
    address: "IMAMNAGAR",
    phone: "9932556819",
    monthlyFee: 1450,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-33",
    class: "NS",
    roll: 33,
    name: "AHANAF HOQUE",
    fatherName: "ISMAIL HOQUE",
    address: "KHIDIRPUR",
    phone: "8101279028",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-34",
    class: "NS",
    roll: 34,
    name: "MD AJMAUL SK",
    fatherName: "ASRAFUL SK",
    address: "MADNA",
    phone: "",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-35",
    class: "NS",
    roll: 35,
    name: "TANISHA KHATUN",
    fatherName: "MOBARAK SK",
    address: "KUMARPARA",
    phone: "8016519656",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-36",
    class: "NS",
    roll: 36,
    name: "JUNAID ALAM",
    fatherName: "JAHANGIR ALAM",
    address: "IMAMNAGAR",
    phone: "8391012636",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-37",
    class: "NS",
    roll: 37,
    name: "SURAIYA KHATUN",
    fatherName: "ASIKAL ISLAM",
    address: "KHANPUR",
    phone: "7595934333",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-38",
    class: "NS",
    roll: 38,
    name: "ASIF AHAMED",
    fatherName: "NASIRUL ISLAM",
    address: "GABGHACHI",
    phone: "7478809030",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-39",
    class: "NS",
    roll: 39,
    name: "AFSANA KHATUN",
    fatherName: "SAKLEEN MOSTAK",
    address: "MADNA",
    phone: "8609622679",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-40",
    class: "NS",
    roll: 40,
    name: "RAIHANA RAHAMAN",
    fatherName: "UKIL SHAIKH",
    address: "RAGHUNATHPUR",
    phone: "8609036193",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-41",
    class: "NS",
    roll: 41,
    name: "SAMIMA SULTANA",
    fatherName: "AJIMUSHWON SK",
    address: "KHANPUR",
    phone: "8101271882",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-42",
    class: "NS",
    roll: 42,
    name: "SIFAD ISLAM",
    fatherName: "SELIM SK",
    address: "MADNA",
    phone: "8927180805",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-43",
    class: "NS",
    roll: 43,
    name: "ABDUR ROUNAK",
    fatherName: "ABDUL KAHAR",
    address: "ISLAMPUR",
    phone: "9734893014",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-44",
    class: "NS",
    roll: 44,
    name: "SABIHA ALI",
    fatherName: "SABER ALI",
    address: "KHANPUR",
    phone: "8016348643",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-45",
    class: "NS",
    roll: 45,
    name: "SARMIN KHATUN",
    fatherName: "TARIK AZIZ",
    address: "MADNA",
    phone: "7679226621",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-46",
    class: "NS",
    roll: 46,
    name: "RAISHA RANI",
    fatherName: "BADIRUL ISLAM",
    address: "MADNA",
    phone: "9749667048",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-47",
    class: "NS",
    roll: 47,
    name: "SANVER AZIZ",
    fatherName: "TARIK AZIZ",
    address: "MADNA",
    phone: "8617550321",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-48",
    class: "NS",
    roll: 48,
    name: "ISHAN SEIKH",
    fatherName: "ISMASIL SEIKH",
    address: "KHANPUR",
    phone: "9510811697",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-49",
    class: "NS",
    roll: 49,
    name: "ASLIHAN SULTANA",
    fatherName: "AKIL SK",
    address: "BOROKAKRAMARI",
    phone: "7866033717",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-50",
    class: "NS",
    roll: 50,
    name: "AFIYA IYASMIN",
    fatherName: "ABU TAHER",
    address: "MADNA",
    phone: "9647171790",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-51",
    class: "NS",
    roll: 51,
    name: "ARPITA SINGHA",
    fatherName: "GOUTAM SINGHA",
    address: "CHHABGHATI",
    phone: "7063437063",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-52",
    class: "NS",
    roll: 52,
    name: "ALISA ANSARI",
    fatherName: "SARIFUL ISLAM",
    address: "SULTANPUR",
    phone: "6294341308",
    monthlyFee: 1250,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-53",
    class: "NS",
    roll: 53,
    name: "NISHAT PARVIN",
    fatherName: "NEFAUR RAHAMAN",
    address: "MADNA",
    phone: "9851313054",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-54",
    class: "NS",
    roll: 54,
    name: "MAFUJA SULTANA",
    fatherName: "MOSTAKIM HOSSAIN",
    address: "MADNA",
    phone: "7797343857",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-55",
    class: "NS",
    roll: 55,
    name: "NUR FATAME",
    fatherName: "ABU TAHER",
    address: "MADNA",
    phone: "9734543086",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-56",
    class: "NS",
    roll: 56,
    name: "NUSRAT KHATUN",
    fatherName: "MD ABU TAHIR",
    address: "GABGACHI",
    phone: "7029339884",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-57",
    class: "NS",
    roll: 57,
    name: "ABDUL RAHAMAN",
    fatherName: "JIYARUL HOQUE",
    address: "GABGACHI",
    phone: "9852820009",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-3",
    class: "LKG",
    roll: 3,
    name: "JUBAID SK",
    fatherName: "RINKU SK",
    address: "RAGHUNATHPUR",
    phone: "8250352981",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-4",
    class: "LKG",
    roll: 4,
    name: "FARHAN IMROSE",
    fatherName: "SAHARUK ALAM",
    address: "KHANPUR",
    phone: "9126707053",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-5",
    class: "LKG",
    roll: 5,
    name: "IRAJ HOSSAIN",
    fatherName: "ASIKUL ISLAM",
    address: "KHANPUR",
    phone: "7679867131",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-8",
    class: "LKG",
    roll: 8,
    name: "SADIA YEASMIN",
    fatherName: "ANOWAR HOSSAIN",
    address: "MADNA",
    phone: "9332732147",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-9",
    class: "LKG",
    roll: 9,
    name: "ALISHA KHATUN",
    fatherName: "UMAN ALI",
    address: "MADNA",
    phone: "6295532408",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-10",
    class: "LKG",
    roll: 10,
    name: "RAYAN RAHAMAN",
    fatherName: "OHIDUR RAHAMAN",
    address: "GOTHA",
    phone: "7908123571",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-11",
    class: "LKG",
    roll: 11,
    name: "REHAN ALAM",
    fatherName: "OHIDUL ALAM",
    address: "ISLAMPUR",
    phone: "9732463438",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-12",
    class: "LKG",
    roll: 12,
    name: "TANIYA ISLAM",
    fatherName: "MEHEJUL ISLAM",
    address: "KHIDIRPUR",
    phone: "7063837845",
    monthlyFee: 1450,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-13",
    class: "LKG",
    roll: 13,
    name: "MAHID SK",
    fatherName: "BABULAL SK",
    address: "ISLAMPUR",
    phone: "7583986643",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-14",
    class: "LKG",
    roll: 14,
    name: "PRIYAMDEEP DAS",
    fatherName: "PIJUS KUMAR DAS",
    address: "VAIRABPUR",
    phone: "8918491315",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-15",
    class: "LKG",
    roll: 15,
    name: "RAHIL HOSAIN",
    fatherName: "BASIR HOSSAIN",
    address: "KHANPUR",
    phone: "9735570932",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-16",
    class: "LKG",
    roll: 16,
    name: "USMAN SK",
    fatherName: "REKAUL SK",
    address: "CHOHUTPUR",
    phone: "9144050844",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-17",
    class: "LKG",
    roll: 17,
    name: "MD AMANUDDIN",
    fatherName: "MD TARIKUDDIN",
    address: "KANKRAMARI",
    phone: "9734664201",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-18",
    class: "LKG",
    roll: 18,
    name: "MIZAN SK",
    fatherName: "KAJEM ALI",
    address: "MADNA",
    phone: "9609721903",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-19",
    class: "LKG",
    roll: 19,
    name: "MARWAN AHAMED",
    fatherName: "MONIRUL ISLAM",
    address: "RAGHUNATHPUR",
    phone: "8710043975",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-20",
    class: "LKG",
    roll: 20,
    name: "SANAYA ISLAM",
    fatherName: "BANIRUL ISLAM",
    address: "MADNA",
    phone: "9734025700",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-21",
    class: "LKG",
    roll: 21,
    name: "SADIA HOSSAIN",
    fatherName: "IKBAL HOSSAIN",
    address: "MADNA",
    phone: "9851813643",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-22",
    class: "LKG",
    roll: 22,
    name: "SARFARAZ SHAIKH",
    fatherName: "TUTUL SK",
    address: "KHANPUR",
    phone: "7908627460",
    monthlyFee: 501,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-23",
    class: "LKG",
    roll: 23,
    name: "MIHAN ANAM",
    fatherName: "MD MEHEBUB RAHAMAN",
    address: "ARAJIRAMAKANTAPUR",
    phone: "9735510540",
    monthlyFee: 1000,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-24",
    class: "LKG",
    roll: 24,
    name: "SONALI KHATUN",
    fatherName: "MD BOKUL SK",
    address: "MADNA",
    phone: "9735455235",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-25",
    class: "LKG",
    roll: 25,
    name: "RAFIKA YEASMIN",
    fatherName: "MOSTOFA SK",
    address: "MADNA",
    phone: "6295755802",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-26",
    class: "LKG",
    roll: 26,
    name: "AFRIN KHATUN",
    fatherName: "HARUN SK",
    address: "MADNA",
    phone: "8001956004",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-27",
    class: "LKG",
    roll: 27,
    name: "ASMAUL HOSSAIN",
    fatherName: "ALAMGIR HOSSAIN",
    address: "KHIDIRPUR",
    phone: "8436606503",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-28",
    class: "LKG",
    roll: 28,
    name: "AL HASHIB",
    fatherName: "ASIK IKBAL",
    address: "KHANPUR",
    phone: "8145412115",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-29",
    class: "LKG",
    roll: 29,
    name: "ASFIA ALBIN",
    fatherName: "NAIMUL HOQUE",
    address: "KHIDIRPUR",
    phone: "7384756151",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-30",
    class: "LKG",
    roll: 30,
    name: "NAHIDUL SK",
    fatherName: "TASIKUL SK",
    address: "MADNA",
    phone: "9083608865",
    monthlyFee: 400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-33",
    class: "LKG",
    roll: 33,
    name: "AHAMED ISLAM",
    fatherName: "SENTU SK",
    address: "MADNA",
    phone: "9641384228",
    monthlyFee: 400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-34",
    class: "LKG",
    roll: 34,
    name: "MIZANUR RAHAMAN",
    fatherName: "RAHUL SEIKH",
    address: "MADNA",
    phone: "7432835575",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-35",
    class: "LKG",
    roll: 35,
    name: "SAFIYAN ALAM",
    fatherName: "MD NUR ALAM",
    address: "CHANDNICHACKHAT",
    phone: "6295999259",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-36",
    class: "LKG",
    roll: 36,
    name: "ARIBA KHATUN",
    fatherName: "SOHEL SHAIKH",
    address: "MADNA",
    phone: "7679262804",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-37",
    class: "LKG",
    roll: 37,
    name: "YASMIN KHATUN",
    fatherName: "ISMAIL SEIKH",
    address: "KHANPUR",
    phone: "9510811697",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-38",
    class: "LKG",
    roll: 38,
    name: "RAHAD SEIKH",
    fatherName: "MAIDUL SK",
    address: "SULTANPUR",
    phone: "8193164438",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-39",
    class: "LKG",
    roll: 39,
    name: "SAFIUR ISLAM",
    fatherName: "SOHIDUL ISLAM",
    address: "HASANPUR",
    phone: "7699732728",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-LKG-40",
    class: "LKG",
    roll: 40,
    name: "RIJUAN SK",
    fatherName: "MAIDUL ISLAM",
    address: "MAHENDRAPUR",
    phone: "7718609159",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-1",
    class: "UKG",
    roll: 1,
    name: "MAHID ALI",
    fatherName: "JABED ALI",
    address: "MADNA",
    phone: "9609785976",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-2",
    class: "UKG",
    roll: 2,
    name: "RIZWANUR RAHAMAN",
    fatherName: "ASIKUL RAHAMAN",
    address: "MADNA",
    phone: "7384096862",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-3",
    class: "UKG",
    roll: 3,
    name: "ALEMA KHATUN",
    fatherName: "SOLEMAN SK",
    address: "GABGHACHI",
    phone: "8016555695",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-4",
    class: "UKG",
    roll: 4,
    name: "JIHAD SK",
    fatherName: "MEMARUL SK",
    address: "MADNA",
    phone: "9083965828",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-5",
    class: "UKG",
    roll: 5,
    name: "MOBARAK HOSSAIN",
    fatherName: "MITUL SK",
    address: "MOMINTOLA",
    phone: "9083965828",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-6",
    class: "UKG",
    roll: 6,
    name: "ABU SUFIAN",
    fatherName: "JANIK ALI",
    address: "CHANDRAPARA",
    phone: "7872981886",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-7",
    class: "UKG",
    roll: 7,
    name: "MAHIRA BISWAS",
    fatherName: "HASAN BISWAS",
    address: "GOTHA",
    phone: "629582191",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-8",
    class: "UKG",
    roll: 8,
    name: "MD AJMAUL SK",
    fatherName: "ASRAFUL SK",
    address: "MADNA",
    phone: "MADNA",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-9",
    class: "UKG",
    roll: 9,
    name: "ASMAUL ISLAM",
    fatherName: "SARIKUL ISLAM",
    address: "MADNA",
    phone: "9647541090",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-10",
    class: "UKG",
    roll: 10,
    name: "SAHID ISLAM",
    fatherName: "ROFIKUL ISLAM",
    address: "GABGHACHI",
    phone: "8969612175",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-11",
    class: "UKG",
    roll: 11,
    name: "AJMAUL SK",
    fatherName: "ANARUL SK",
    address: "KHANPUR",
    phone: "7872282631",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-12",
    class: "UKG",
    roll: 12,
    name: "ARIFA KHATUN",
    fatherName: "SAMIUL SK",
    address: "KUMARPARA",
    phone: "7364007994",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-13",
    class: "UKG",
    roll: 13,
    name: "OSMAN SK",
    fatherName: "INJAMAMUL HOQUE",
    address: "MADNA",
    phone: "9593847924",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-14",
    class: "UKG",
    roll: 14,
    name: "TANIYA HOQUE",
    fatherName: "MORFUL HOQUE",
    address: "KHANPUR",
    phone: "9735714425",
    monthlyFee: 1250,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-15",
    class: "UKG",
    roll: 15,
    name: "RAHID SK",
    fatherName: "KARIM SK",
    address: "MADNA",
    phone: "8789600414",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-16",
    class: "UKG",
    roll: 16,
    name: "ASFIYA PARVIN",
    fatherName: "EAJAJ AHAMED",
    address: "ISLAMPUR",
    phone: "7029274451",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-17",
    class: "UKG",
    roll: 17,
    name: "AIRA PARVIN",
    fatherName: "ISTIAK AHAMEED",
    address: "ISLAMPUR",
    phone: "9851737902",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-18",
    class: "UKG",
    roll: 18,
    name: "RUBINA KHATUN",
    fatherName: "RITON SK",
    address: "RAGHUNATHPUR",
    phone: "6361218840",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-19",
    class: "UKG",
    roll: 19,
    name: "AHIL AHAMED",
    fatherName: "SARIFUL SK",
    address: "MADNA",
    phone: "8328792711",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-20",
    class: "UKG",
    roll: 20,
    name: "MASUMA KHATUN",
    fatherName: "MOSTAKIM HOSAIN",
    address: "MADNA",
    phone: "7797343857",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-21",
    class: "UKG",
    roll: 21,
    name: "RUSDA PARVIN",
    fatherName: "MD NAJIMUDDIN",
    address: "MAHESHAIL",
    phone: "9064931522",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-22",
    class: "UKG",
    roll: 22,
    name: "SIRAJUL ISLAM",
    fatherName: "JOHIRUL ISLAM",
    address: "MADNA",
    phone: "9339986383",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-23",
    class: "UKG",
    roll: 23,
    name: "ANSIYA PARVIN",
    fatherName: "ARIF MAHAMMAD",
    address: "KHANPUR",
    phone: "9046963438",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-24",
    class: "UKG",
    roll: 24,
    name: "ATIF AHAMMED",
    fatherName: "TUTUL SK",
    address: "KHANPUR",
    phone: "9564237806",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-25",
    class: "UKG",
    roll: 25,
    name: "MD RAHAT ISLAM",
    fatherName: "MD ROFIKUL ISLAM",
    address: "KHIDIRPUR",
    phone: "8768285551",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-26",
    class: "UKG",
    roll: 26,
    name: "RAMIJ SK",
    fatherName: "REJAUL KARIM",
    address: "HASANPUR",
    phone: "6296337411",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-1",
    class: "Class I",
    roll: 1,
    name: "ARIFA RAHAMAN",
    fatherName: "MOSTAFIJUR RAHAMAN",
    address: "KHIDIRPUR",
    phone: "9051338418",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-2",
    class: "Class I",
    roll: 2,
    name: "FARHAN SHAIKH",
    fatherName: "ASIKUL ISLAM",
    address: "MADNA",
    phone: "8945866197",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-3",
    class: "Class I",
    roll: 3,
    name: "FAISAL HAMIM",
    fatherName: "SAHIDUL ISLAM",
    address: "ISLAMPUR",
    phone: "8001362238",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-4",
    class: "Class I",
    roll: 4,
    name: "NARGIS KHATUN",
    fatherName: "ROSNA BIBI",
    address: "MADNA",
    phone: "8001105502",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-5",
    class: "Class I",
    roll: 5,
    name: "HASIN RAIHAN",
    fatherName: "NURUL ISLAM",
    address: "PRASADPUR",
    phone: "9735995340",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-6",
    class: "Class I",
    roll: 6,
    name: "SAFIYAN ALAM",
    fatherName: "MD NUR ALAM",
    address: "CHANDNICHAK",
    phone: "9064058447",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-7",
    class: "Class I",
    roll: 7,
    name: "SWITY KHATUN",
    fatherName: "TARIK AZIZ",
    address: "MADNA",
    phone: "7679226621",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-8",
    class: "Class I",
    roll: 8,
    name: "SAHIDA KHATUN",
    fatherName: "BABAR SK",
    address: "MADNA",
    phone: "6294630995",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-9",
    class: "Class I",
    roll: 9,
    name: "MAHIR ISLAM",
    fatherName: "MAIDUL ISLAM",
    address: "MADNA",
    phone: "9832211313",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-10",
    class: "Class I",
    roll: 10,
    name: "USMAN SK",
    fatherName: "MORSALIM SK",
    address: "MADNA",
    phone: "9547113426",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-11",
    class: "Class I",
    roll: 11,
    name: "JAHID ALI HASAN",
    fatherName: "SELIM AHMED",
    address: "KHANPUR",
    phone: "8167823528",
    monthlyFee: 1450,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-12",
    class: "Class I",
    roll: 12,
    name: "SOLEMAN ISLAM",
    fatherName: "RAFIKUL ISLAM",
    address: "GABGHACHI",
    phone: "8969612175",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-13",
    class: "Class I",
    roll: 13,
    name: "AYAAT ENAYA",
    fatherName: "JAHANGIR ALAM",
    address: "MADNA",
    phone: "9831415815",
    monthlyFee: 630,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-14",
    class: "Class I",
    roll: 14,
    name: "SUHANA HOSSAIN",
    fatherName: "JAHANGIR HOSSAIN",
    address: "PRASADPUR",
    phone: "9832735184",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-15",
    class: "Class I",
    roll: 15,
    name: "ASIFA KHATUN",
    fatherName: "ABU TALEB",
    address: "ARAJIRAMAKANTAPUR",
    phone: "9647572815",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-16",
    class: "Class I",
    roll: 16,
    name: "TANISHA KHATUN",
    fatherName: "JAHIR SK",
    address: "ARAJIRAMAKANTAPUR",
    phone: "8617576169",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-17",
    class: "Class I",
    roll: 17,
    name: "MD ABDUL AHAD",
    fatherName: "ALIUL SK",
    address: "GABGACHI",
    phone: "8145140162",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-18",
    class: "Class I",
    roll: 18,
    name: "IMTIAZ ALAM",
    fatherName: "ASHIKUL ALAM",
    address: "GABGACHI",
    phone: "9733837590",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-19",
    class: "Class I",
    roll: 19,
    name: "TOUHID ISLAM",
    fatherName: "MD BANIRUL ISLAM",
    address: "CHHABGHATI",
    phone: "7908543950",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-20",
    class: "Class I",
    roll: 20,
    name: "ASIUR RAHAMAN",
    fatherName: "ATIBUL RAHAMAN",
    address: "KHANPUR",
    phone: "6297601774",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-21",
    class: "Class I",
    roll: 21,
    name: "AYAJ SK",
    fatherName: "RABBAN SK",
    address: "ISLAMPUR",
    phone: "8436234799",
    monthlyFee: 1250,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-22",
    class: "Class I",
    roll: 22,
    name: "NAHID SK",
    fatherName: "MANJARUL HOQUE",
    address: "MADNA",
    phone: "6295104410",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-23",
    class: "Class I",
    roll: 23,
    name: "SHIBAY SAHA",
    fatherName: "SUSIL SAHA",
    address: "KHANPUR",
    phone: "9563739140",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-24",
    class: "Class I",
    roll: 24,
    name: "EBRAN SK",
    fatherName: "AJAJUL SK",
    address: "KHANPUR",
    phone: "6295234949",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-25",
    class: "Class I",
    roll: 25,
    name: "RAYAN ALI",
    fatherName: "KABIR ALI",
    address: "GOPALGANJ",
    phone: "9733591737",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-26",
    class: "Class I",
    roll: 26,
    name: "MAHID ALAM",
    fatherName: "MEHEBUB ALAM",
    address: "GOPALGANJ",
    phone: "9734585041",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-27",
    class: "Class I",
    roll: 27,
    name: "SAYEM ALI",
    fatherName: "SABIR ALI",
    address: "GOPALGANJ",
    phone: "9647701170",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-28",
    class: "Class I",
    roll: 28,
    name: "AMAN RAHAMAN",
    fatherName: "HABIBUR RAHAMAN",
    address: "MADNA",
    phone: "8436842002",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-29",
    class: "Class I",
    roll: 29,
    name: "ENJAMUL HOSSAIN",
    fatherName: "EMAM HOSSAIN",
    address: "MADNA",
    phone: "9732884730",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-30",
    class: "Class I",
    roll: 30,
    name: "ANABIYA KHATUN",
    fatherName: "ASIK IKBAL",
    address: "KHANPUR",
    phone: "8145412115",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-31",
    class: "Class I",
    roll: 31,
    name: "RISHBA HOSSAIN",
    fatherName: "BABLU HOSSAIN",
    address: "KHIDIRPUR",
    phone: "8172008086",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-32",
    class: "Class I",
    roll: 32,
    name: "MD AAHIL AHAMMED",
    fatherName: "MD MOSTAIN",
    address: "SULTANPUR",
    phone: "9382500084",
    monthlyFee: 1250,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-33",
    class: "Class I",
    roll: 33,
    name: "TAMIJ ISLAM",
    fatherName: "MIJANUR ISLAM",
    address: "MERUPUR",
    phone: "9932767524",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-34",
    class: "Class I",
    roll: 34,
    name: "SNEHA PARVIN",
    fatherName: "BANI SK",
    address: "MADANPUR",
    phone: "7029455120",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-35",
    class: "Class I",
    roll: 35,
    name: "SORIFA KHATUN",
    fatherName: "JIARUL SK",
    address: "CHANDAMARI",
    phone: "9735537014",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-36",
    class: "Class I",
    roll: 36,
    name: "NABIL ISLAM",
    fatherName: "ROBIUL ISLAM",
    address: "KHIDIRPUR",
    phone: "9547584871",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-37",
    class: "Class I",
    roll: 37,
    name: "AFRIN SULTANA",
    fatherName: "MD IMRAN ALI",
    address: "ISLAMPUR",
    phone: "6294286310",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-38",
    class: "Class I",
    roll: 38,
    name: "JUNAIED ISLAM",
    fatherName: "TARIKUL ISLAM",
    address: "MADNA",
    phone: "9614922434",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-39",
    class: "Class I",
    roll: 39,
    name: "JISAN HOQUE",
    fatherName: "BASIRUL HOQUE",
    address: "KHIDIRPUR",
    phone: "8513947929",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-40",
    class: "Class I",
    roll: 40,
    name: "RITIKA DAS",
    fatherName: "RUPNARAYAN DAS",
    address: "SARBESWARPUR",
    phone: "9547877419",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassI-41",
    class: "Class I",
    roll: 41,
    name: "RESMI KHATUN",
    fatherName: "SARIFUL ISLAM",
    address: "KHANPUR",
    phone: "7384239859",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-1",
    class: "Class II",
    roll: 1,
    name: "SABIL AKTAR",
    fatherName: "SABAD AKTAR",
    address: "KHIDIRPUR",
    phone: "9732607908",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-2",
    class: "Class II",
    roll: 2,
    name: "NAJIFA YESMIN",
    fatherName: "AZAD HOSSAIN",
    address: "KHANPUR",
    phone: "9046873384",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-3",
    class: "Class II",
    roll: 3,
    name: "SANIYA KHATUN",
    fatherName: "MEJARUL HOQUE",
    address: "MADNA",
    phone: "7024592019",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-4",
    class: "Class II",
    roll: 4,
    name: "AREEBA ISLAM",
    fatherName: "SOFIKUL ISLAM",
    address: "MADNA",
    phone: "9647168851",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-5",
    class: "Class II",
    roll: 5,
    name: "SAHID ALAM",
    fatherName: "SABIR ALI",
    address: "KUMARPARA",
    phone: "6294938363",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-6",
    class: "Class II",
    roll: 6,
    name: "REJUAN HOSSAIN",
    fatherName: "MALEK SK",
    address: "MADNA",
    phone: "9083784619",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-7",
    class: "Class II",
    roll: 7,
    name: "TAMIM ISLAM",
    fatherName: "TOHIDUL ISLAM",
    address: "RAGHUNATHPUR",
    phone: "9474332145",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-8",
    class: "Class II",
    roll: 8,
    name: "HABIBA SULTANA",
    fatherName: "HARUN AL RASID",
    address: "MADNA",
    phone: "7872154643",
    monthlyFee: 400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-9",
    class: "Class II",
    roll: 9,
    name: "SARFARAJ ANSARY",
    fatherName: "MONIRUL ISLAM MOMIN",
    address: "SULTANPUR",
    phone: "9547627402",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-10",
    class: "Class II",
    roll: 10,
    name: "ABDUR RAHAMAN",
    fatherName: "ABBAS ALI",
    address: "MADNA",
    phone: "9732017704",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-11",
    class: "Class II",
    roll: 11,
    name: "RIMA KHATUN",
    fatherName: "SABBIR ALI",
    address: "MADNA",
    phone: "9907707065",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-13",
    class: "Class II",
    roll: 13,
    name: "MEHEKA AFRIN",
    fatherName: "NAJIR SK",
    address: "MADNA",
    phone: "8927231504",
    monthlyFee: 550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-14",
    class: "Class II",
    roll: 14,
    name: "SAKIL ALAM",
    fatherName: "SAMIUL ALAM",
    address: "GOPALGANJ",
    phone: "7797405977",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-15",
    class: "Class II",
    roll: 15,
    name: "TAMIM AHAMED",
    fatherName: "ALI NAOYAJ",
    address: "ISLAMPUR",
    phone: "8436670718",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-16",
    class: "Class II",
    roll: 16,
    name: "MIZAN HOSSAIN",
    fatherName: "NAJIR HOSSAIN",
    address: "KHANPUR",
    phone: "9564124026",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-17",
    class: "Class II",
    roll: 17,
    name: "NAJMIN SULTANA",
    fatherName: "MOBARAK HOSSAIN",
    address: "BOROKAKRAMARI",
    phone: "7679420443",
    monthlyFee: 1250,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-18",
    class: "Class II",
    roll: 18,
    name: "SHAHI ASHFIL",
    fatherName: "ALIUL ISLAM",
    address: "KHANPUR",
    phone: "9064359933",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-19",
    class: "Class II",
    roll: 19,
    name: "PAPIYA SULTANA",
    fatherName: "ABDUR RAJJAK",
    address: "KHIDIRPUR",
    phone: "9932556819",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-20",
    class: "Class II",
    roll: 20,
    name: "ANANYA DAS",
    fatherName: "ARUN DAS",
    address: "SARBESERPUR",
    phone: "9735295547",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-21",
    class: "Class II",
    roll: 21,
    name: "MAHIMA KHATUN",
    fatherName: "BASIRUL ISLAM",
    address: "BAROGHORIA",
    phone: "7076624212",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-22",
    class: "Class II",
    roll: 22,
    name: "NASRIN KHATUN",
    fatherName: "MOBARAK SESK",
    address: "KUMARPARA",
    phone: "8016519656",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-23",
    class: "Class II",
    roll: 23,
    name: "TANSILA KHATUN",
    fatherName: "ASIKUL ISLAM",
    address: "KHANPUR",
    phone: "7595934333",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-24",
    class: "Class II",
    roll: 24,
    name: "TAMIM ISLAM",
    fatherName: "MD TARIKUL ISLAM",
    address: "KHIDIRPUR",
    phone: "9732974016",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-26",
    class: "Class II",
    roll: 26,
    name: "SUMITA SAHA",
    fatherName: "SUJIT KR SAHA",
    address: "MURALIPUKUR",
    phone: "8617030231",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-27",
    class: "Class II",
    roll: 27,
    name: "SRISHTI DAS",
    fatherName: "BAPAN DAS",
    address: "MURALIPUKUR",
    phone: "9933493080",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-28",
    class: "Class II",
    roll: 28,
    name: "MEHEDI RAIHAN",
    fatherName: "KHALEKUL SK",
    address: "ISLAMPUR",
    phone: "8481829192",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-29",
    class: "Class II",
    roll: 29,
    name: "MD ABANUDDIN",
    fatherName: "MD TARIKUDDIN",
    address: "KANKRAMARI",
    phone: "9734664201",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-30",
    class: "Class II",
    roll: 30,
    name: "MD SAMIUL",
    fatherName: "ALIUL ISLAM",
    address: "KHANPUR",
    phone: "7430958915",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassII-31",
    class: "Class II",
    roll: 31,
    name: "IRFAN SK",
    fatherName: "ISMAIL SEIKH",
    address: "KHANPUR",
    phone: "9510811697",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-1",
    class: "Class III",
    roll: 1,
    name: "MD AYAZ RAHAMAN",
    fatherName: "MD HABIBUR RAHAMAN",
    address: "MADNA",
    phone: "9851524690",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-3",
    class: "Class III",
    roll: 3,
    name: "ABDUL WAHID",
    fatherName: "MD ALI JINNA",
    address: "KHIDIRPUR",
    phone: "9932500275",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-4",
    class: "Class III",
    roll: 4,
    name: "RUHINA KHATUN",
    fatherName: "REJUAN SK",
    address: "LAKSHMIPUR",
    phone: "8392095640",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-5",
    class: "Class III",
    roll: 5,
    name: "EBRAHIM SK",
    fatherName: "JANIK ALI",
    address: "CHANDRAPARA",
    phone: "7872981886",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-6",
    class: "Class III",
    roll: 6,
    name: "TASNIN HOQUE ANAM",
    fatherName: "MAIDUL HOQUE",
    address: "KHANPUR",
    phone: "7001329206",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-7",
    class: "Class III",
    roll: 7,
    name: "FARHANA PARVIN",
    fatherName: "NA",
    address: "NA",
    phone: "",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-9",
    class: "Class III",
    roll: 9,
    name: "AJFAR SK",
    fatherName: "MOTAHAR SK",
    address: "MADNA",
    phone: "9564539753",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-10",
    class: "Class III",
    roll: 10,
    name: "FATIMA PARVIN",
    fatherName: "ABBASUDDIN SK",
    address: "KHANPUR",
    phone: "9851238458",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-11",
    class: "Class III",
    roll: 11,
    name: "ZUBAIR SK",
    fatherName: "ASLAM SHAIKH",
    address: "MADNA",
    phone: "9735684210",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-12",
    class: "Class III",
    roll: 12,
    name: "ATIF HASAN",
    fatherName: "MD MEHEDI HASAN",
    address: "SHYAMPUR",
    phone: "8617529580",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-13",
    class: "Class III",
    roll: 13,
    name: "MD IMTIYAZ HOQUE",
    fatherName: "ASRAFUL HOQUE",
    address: "ISLAMPUR",
    phone: "9564521089",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-14",
    class: "Class III",
    roll: 14,
    name: "IMTIYAZ ALAM",
    fatherName: "ASIKUL SK",
    address: "KHIDIRPUR",
    phone: "8116258995",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-15",
    class: "Class III",
    roll: 15,
    name: "ANJUM NAHAJ",
    fatherName: "ROMJAN ALI",
    address: "KHIDIRPUR",
    phone: "7001266605",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-16",
    class: "Class III",
    roll: 16,
    name: "AHAMMED HASAN",
    fatherName: "ANARUL HOQUE",
    address: "ISLAMPUR",
    phone: "6295014062",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-17",
    class: "Class III",
    roll: 17,
    name: "AJMAUL HOSSAIN",
    fatherName: "ALAMGIR HOSSAIN",
    address: "KHIDIRPUR",
    phone: "8436606503",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-18",
    class: "Class III",
    roll: 18,
    name: "ZAYAS HIZQEEL",
    fatherName: "MASIUL MOMIN",
    address: "SULTANPUR",
    phone: "8918673947",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-19",
    class: "Class III",
    roll: 19,
    name: "SAYDAH SULTAN",
    fatherName: "MD MOTIUR RAHAMAN",
    address: "PROSADPUR",
    phone: "9800619588",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-20",
    class: "Class III",
    roll: 20,
    name: "FAIJANOOR",
    fatherName: "IMTIAJ HOSSAIN",
    address: "MADNA",
    phone: "9242903670",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-21",
    class: "Class III",
    roll: 21,
    name: "SAHEL SK",
    fatherName: "LALTU SK",
    address: "BAMUHA",
    phone: "7894995690",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-22",
    class: "Class III",
    roll: 22,
    name: "YEMID ISLAM",
    fatherName: "BASIRUL ISLAM",
    address: "BAROGHORIA",
    phone: "7076624212",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-23",
    class: "Class III",
    roll: 23,
    name: "FAIZAL AHAMED",
    fatherName: "BENJIR BABU",
    address: "MADNA",
    phone: "9832420391",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-24",
    class: "Class III",
    roll: 24,
    name: "FARHAD AHAMMED",
    fatherName: "RAHIM SK",
    address: "LAKSHMIPUR",
    phone: "8926747421",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-25",
    class: "Class III",
    roll: 25,
    name: "TAHAMINA PARVIN",
    fatherName: "HASNAT ALI",
    address: "MADNA",
    phone: "9046351941",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIII-26",
    class: "Class III",
    roll: 26,
    name: "NUR HASAN",
    fatherName: "SOFIKUL ISLAM",
    address: "KHIDIRPUR",
    phone: "7585931603",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-1",
    class: "Class IV",
    roll: 1,
    name: "AHAN BISWAS",
    fatherName: "ABU KALAM",
    address: "CHHABGHATI",
    phone: "96294008232",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-2",
    class: "Class IV",
    roll: 2,
    name: "AMINA RAHAMAN",
    fatherName: "ASHADUL HOQUE",
    address: "MANGALJAN",
    phone: "7585966737",
    monthlyFee: 400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-4",
    class: "Class IV",
    roll: 4,
    name: "MIRAJ ISLAM",
    fatherName: "MAIDUL ISLAM",
    address: "MADNA",
    phone: "9832211313",
    monthlyFee: 350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-5",
    class: "Class IV",
    roll: 5,
    name: "MAHIMA ANJUM",
    fatherName: "MD MEHEBUB RAHAMAN",
    address: "ARAJIRAMAKANTAPUR",
    phone: "9735510540",
    monthlyFee: 1200,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-6",
    class: "Class IV",
    roll: 6,
    name: "ASHIK IKBAL",
    fatherName: "MOSARAF HOSSAIN",
    address: "ISLAMPUR",
    phone: "7001330257",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-8",
    class: "Class IV",
    roll: 8,
    name: "ATIKA YEASMIN",
    fatherName: "ATIBUL RAHAMAN",
    address: "KHANPUR",
    phone: "6297601774",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-9",
    class: "Class IV",
    roll: 9,
    name: "ASIFA KHATUN",
    fatherName: "MOTIUR SEKH",
    address: "KHANPUR",
    phone: "9851238458",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-10",
    class: "Class IV",
    roll: 10,
    name: "EFRAJ RAHAMAN",
    fatherName: "ABDUR RAHAMAN",
    address: "MADNA",
    phone: "9609446495",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-11",
    class: "Class IV",
    roll: 11,
    name: "JABED FARHAN",
    fatherName: "ASLAM SHAIKH",
    address: "MADNA",
    phone: "9735684210",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-12",
    class: "Class IV",
    roll: 12,
    name: "MARUFA KHATUN",
    fatherName: "UMAR ALI",
    address: "MADNA",
    phone: "6295532408",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-13",
    class: "Class IV",
    roll: 13,
    name: "AFIA  SULTANA",
    fatherName: "ALAMGIR ISLAM",
    address: "FATEPUR",
    phone: "9732947556",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-14",
    class: "Class IV",
    roll: 14,
    name: "AYESA JULEKHA",
    fatherName: "MADIN SK",
    address: "MADNA",
    phone: "9126173994",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-15",
    class: "Class IV",
    roll: 15,
    name: "MEHTAB ALAM",
    fatherName: "MEHEBUB ALAM",
    address: "GOPALGANJ",
    phone: "8768645155",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-17",
    class: "Class IV",
    roll: 17,
    name: "FARHANA PARVIN",
    fatherName: "UJJAL SK",
    address: "PRASADPUR",
    phone: "7864917158",
    monthlyFee: 1100,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-18",
    class: "Class IV",
    roll: 18,
    name: "AAHIL ISLAM",
    fatherName: "ASIKUL SHAIKH",
    address: "ISLAMPUR",
    phone: "9733995865",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-19",
    class: "Class IV",
    roll: 19,
    name: "MAHID ANSARY",
    fatherName: "MEHEBUB ALAM",
    address: "MALOPARA",
    phone: "8536986762",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-20",
    class: "Class IV",
    roll: 20,
    name: "MD SARJIL SHAIKH",
    fatherName: "SORIF SK",
    address: "ISLAMPUR",
    phone: "8918371595",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-21",
    class: "Class IV",
    roll: 21,
    name: "NAJME ALAM",
    fatherName: "SADDAM HOSSAIN",
    address: "KHAPUR",
    phone: "9635457256",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-22",
    class: "Class IV",
    roll: 22,
    name: "MAHIUDDIN ZIAN",
    fatherName: "MAIDUL HOSSAIN",
    address: "MADNA",
    phone: "7001834562",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-23",
    class: "Class IV",
    roll: 23,
    name: "NAJEA SULTANA",
    fatherName: "ABDUR RAJJAK",
    address: "KHIDIRPUR",
    phone: "9932556819",
    monthlyFee: 1500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-24",
    class: "Class IV",
    roll: 24,
    name: "FARHAN REZA",
    fatherName: "SARKAR HASAN REZA",
    address: "ISLAMPUR",
    phone: "9932710289",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-25",
    class: "Class IV",
    roll: 25,
    name: "FARHAN AKTAR",
    fatherName: "MD NAJIMUDDIN SK",
    address: "MAHESHAIL",
    phone: "9064931522",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-26",
    class: "Class IV",
    roll: 26,
    name: "KAZI LIYANA ARFA",
    fatherName: "LIPI KHATUN",
    address: "KHIDIRPUR",
    phone: "9163641345",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-27",
    class: "Class IV",
    roll: 27,
    name: "ISHAN AHAMED",
    fatherName: "MD IMRAN ALI",
    address: "ISLAMPUR",
    phone: "6297606939",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-28",
    class: "Class IV",
    roll: 28,
    name: "UMME SALMA",
    fatherName: "SAMIUL SK",
    address: "GOTHA",
    phone: "7797080310",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-29",
    class: "Class IV",
    roll: 29,
    name: "JISAN SK",
    fatherName: "LALTU SK",
    address: "MADNA",
    phone: "9749359719",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-1",
    class: "Class V",
    roll: 1,
    name: "SUHAN ISLAM",
    fatherName: "BANIRUL ISLAM",
    address: "MADNA",
    phone: "9734025700",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-2",
    class: "Class V",
    roll: 2,
    name: "SHOIB ALI",
    fatherName: "WAHIDUL HOQUE",
    address: "KHANPUR",
    phone: "9732343873",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-3",
    class: "Class V",
    roll: 3,
    name: "FARHAN ISLAM",
    fatherName: "ANIKUL ISLAM",
    address: "KHANPUR",
    phone: "9126173935",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-4",
    class: "Class V",
    roll: 4,
    name: "ABDUL KAHAR",
    fatherName: "ASIKUL RAHAMAN",
    address: "MADNA",
    phone: "7384096862",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-5",
    class: "Class V",
    roll: 5,
    name: "JOSIM RAJA",
    fatherName: "WAHIDUR RAHAMAN",
    address: "KHANPUR",
    phone: "9732313137",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-6",
    class: "Class V",
    roll: 6,
    name: "AFRA SADIA",
    fatherName: "MAHFUJUR RAHAMAN",
    address: "NATUN SARAIPRA",
    phone: "7908613700",
    monthlyFee: 1800,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-7",
    class: "Class V",
    roll: 7,
    name: "JUNAID ISLAM",
    fatherName: "JAHIRUDDIN ISLAM",
    address: "LAKSHMIPUR",
    phone: "9609043450",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-8",
    class: "Class V",
    roll: 8,
    name: "SANAM HOQUE",
    fatherName: "MORFUL HOQUE",
    address: "KHANPUR",
    phone: "9735714425",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-9",
    class: "Class V",
    roll: 9,
    name: "SAKIL KHAN",
    fatherName: "MEJARUL HOQUE",
    address: "MADNA",
    phone: "7024592019",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-10",
    class: "Class V",
    roll: 10,
    name: "HAMIDUL SK",
    fatherName: "MAIMUL HOQUE",
    address: "ISLAMPUR",
    phone: "7797356171",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-11",
    class: "Class V",
    roll: 11,
    name: "RIHAN ISLAM",
    fatherName: "RAKIBUL ISLAM",
    address: "DHARAMPUR",
    phone: "8001311974",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-12",
    class: "Class V",
    roll: 12,
    name: "ISHRAT JAHAN",
    fatherName: "MD KAMARUZZAMAN",
    address: "PAKALPARA",
    phone: "8116007947",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-13",
    class: "Class V",
    roll: 13,
    name: "BEAUTY PARVIN",
    fatherName: "BABAR SK",
    address: "MADNA",
    phone: "6294630995",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-14",
    class: "Class V",
    roll: 14,
    name: "MOSTAKIM SEKH",
    fatherName: "TORIKUL ALOM",
    address: "KHANPUR",
    phone: "7602555748",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-15",
    class: "Class V",
    roll: 15,
    name: "ALISHA PARVIN",
    fatherName: "ABBASUDDIN SEKH",
    address: "KHANPUR",
    phone: "9851238458",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-16",
    class: "Class V",
    roll: 16,
    name: "SAHIL HOSSAIN",
    fatherName: "BASIR HOSSAIN",
    address: "KHANPUR",
    phone: "9735570932",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-17",
    class: "Class V",
    roll: 17,
    name: "ELINA SULTANA",
    fatherName: "APEL SEKH",
    address: "ISLAMPUR",
    phone: "9547086613",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-18",
    class: "Class V",
    roll: 18,
    name: "JENIFA YEASMIN",
    fatherName: "NAJIR HOSSAIN",
    address: "KHANPUR",
    phone: "9735570932",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-19",
    class: "Class V",
    roll: 19,
    name: "MOSAROF HOSSAIN",
    fatherName: "ASIKUL ISLAM",
    address: "KHANPUR",
    phone: "7679867131",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-20",
    class: "Class V",
    roll: 20,
    name: "ANIFA SULTANA",
    fatherName: "OBAIDUR RAHAMAN",
    address: "MADNA",
    phone: "6295544939",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-21",
    class: "Class V",
    roll: 21,
    name: "PRODIP KUMAR SAHA",
    fatherName: "SUJIT KUMAR SAHA",
    address: "MADNA",
    phone: "9564124282",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-22",
    class: "Class V",
    roll: 22,
    name: "AMINUL ISLAM",
    fatherName: "ALIUL ISLAM",
    address: "GABGACHHI",
    phone: "9126214710",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-23",
    class: "Class V",
    roll: 23,
    name: "ISHAN ALAM",
    fatherName: "MD MEHEBUB ALAM",
    address: "MADNA",
    phone: "9932956740",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-24",
    class: "Class V",
    roll: 24,
    name: "RAKIB SK",
    fatherName: "RAJIB SK",
    address: "CHHOTOKANKRAMARI",
    phone: "8637520719",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-25",
    class: "Class V",
    roll: 25,
    name: "NUSRAT JAHAN HOQUE",
    fatherName: "AMTAHERUL HOQUE",
    address: "KHIDIRPUR",
    phone: "9775000016",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-26",
    class: "Class V",
    roll: 26,
    name: "ARAB ISLAM",
    fatherName: "ASHADUL ISLAM",
    address: "MALOPARA",
    phone: "8116028087",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-27",
    class: "Class V",
    roll: 27,
    name: "SAKIBUL ISLAM",
    fatherName: "SORIF SK",
    address: "ISLAMPUR",
    phone: "8918371595",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-28",
    class: "Class V",
    roll: 28,
    name: "TAHMEED ISLAM",
    fatherName: "MASDADUL ISLAM",
    address: "MERUPUR",
    phone: "7001256230",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-29",
    class: "Class V",
    roll: 29,
    name: "AHANA YEASMIN",
    fatherName: "MD MOSTAIN",
    address: "SULTANPUR",
    phone: "9382500084",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-30",
    class: "Class V",
    roll: 30,
    name: "JABED AKTHAR SIDDIK",
    fatherName: "ABU BAKKAR SIDDIK",
    address: "KHIDIRPUR",
    phone: "9883497972",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-31",
    class: "Class V",
    roll: 31,
    name: "MINHAJUL ISLAM",
    fatherName: "ABDUL JABBAR",
    address: "PRASADPUR",
    phone: "9064100589",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-32",
    class: "Class V",
    roll: 32,
    name: "AMINUL ISLAM",
    fatherName: "MD SERAJUL ISLAM",
    address: "GOTHA",
    phone: "7001127237",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-33",
    class: "Class V",
    roll: 33,
    name: "ALEENA ISLAM",
    fatherName: "MOZAHIRUL ISLAM",
    address: "GOPALGANJ",
    phone: "9933618995",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-34",
    class: "Class V",
    roll: 34,
    name: "NASIRUL ISLAM",
    fatherName: "SAHA ALAM",
    address: "KHANPUR",
    phone: "6294135774",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-35",
    class: "Class V",
    roll: 35,
    name: "MD TAMEEM IKBAL",
    fatherName: "SAHADAT ALI",
    address: "SULTANPUR",
    phone: "8145930508",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-36",
    class: "Class V",
    roll: 36,
    name: "ZISHAN HOQUE",
    fatherName: "JIAUL HOQUE",
    address: "HASANPUR",
    phone: "9733789011",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-37",
    class: "Class V",
    roll: 37,
    name: "SAMIMA KHATUN",
    fatherName: "NEKBOR SK",
    address: "KHANPUR",
    phone: "9382837558",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-38",
    class: "Class V",
    roll: 38,
    name: "FAIJAL AHAMMED",
    fatherName: "RAHIM SK",
    address: "LAKSHMIPUR",
    phone: "8926747421",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-39",
    class: "Class V",
    roll: 39,
    name: "RIMI SULTANA",
    fatherName: "SADIKUL ALAM",
    address: "MADNA",
    phone: "8617699167",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-40",
    class: "Class V",
    roll: 40,
    name: "RANBIR KAPOR ROY",
    fatherName: "RANJIT ROY",
    address: "SULTANPUR",
    phone: "9126705102",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-41",
    class: "Class V",
    roll: 41,
    name: "ABDUL SATTAR",
    fatherName: "ABU TAHER",
    address: "KHANPUR",
    phone: "7602555748",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-42",
    class: "Class V",
    roll: 42,
    name: "RANA SK",
    fatherName: "FAINUS SK",
    address: "RAGHUNATHPUR",
    phone: "9064175032",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-43",
    class: "Class V",
    roll: 43,
    name: "MONIRUL HOQUE",
    fatherName: "FEKARUL HOQUE",
    address: "ISLAMPUR",
    phone: "9749166286",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-44",
    class: "Class V",
    roll: 44,
    name: "MOJAFFAR SK",
    fatherName: "MIRZA MUSTAFA",
    address: "MADNA",
    phone: "6295755802",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-45",
    class: "Class V",
    roll: 45,
    name: "MD ASMAUL SK",
    fatherName: "ASRAFUL SK",
    address: "MADNA",
    phone: "8535852472",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-46",
    class: "Class V",
    roll: 46,
    name: "SAKIBUL HASAN",
    fatherName: "SOLEMAN SEKH",
    address: "GABGACHHI",
    phone: "8016555695",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassV-47",
    class: "Class V",
    roll: 47,
    name: "SUBHRAJIT SARKAR",
    fatherName: "SUBRATA SARKAR",
    address: "KHANPUR",
    phone: "7908792286",
    monthlyFee: 1250,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-1",
    class: "Class VI",
    roll: 1,
    name: "MOSIUR RAHAMAN",
    fatherName: "MOSTAFIJUR RAHAMAN",
    address: "KHIDIRPUR",
    phone: "9051338418",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-2",
    class: "Class VI",
    roll: 2,
    name: "ARNNA SINGHA",
    fatherName: "JADAN SINGH",
    address: "SADIKPUR",
    phone: "9064792595",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-3",
    class: "Class VI",
    roll: 3,
    name: "ABDUL AZIZ",
    fatherName: "ABIR SEKH",
    address: "ISLAMPUR",
    phone: "7363098083",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-4",
    class: "Class VI",
    roll: 4,
    name: "SOMERUN ISLAM",
    fatherName: "SENTU SK",
    address: "MADNA",
    phone: "9641384228",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-5",
    class: "Class VI",
    roll: 5,
    name: "SAHIDA YASMIN",
    fatherName: "MANSUR RAHAMAN",
    address: "MONGOLJON",
    phone: "9547196226",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-6",
    class: "Class VI",
    roll: 6,
    name: "ROHIDA RAHAMAN",
    fatherName: "ASHADUL HOQUE",
    address: "MONGOLJON",
    phone: "7585966737",
    monthlyFee: 500,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-7",
    class: "Class VI",
    roll: 7,
    name: "KARIMA KHATUN",
    fatherName: "AYAM ALI",
    address: "HASANPUR",
    phone: "9749031959",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-8",
    class: "Class VI",
    roll: 8,
    name: "FARUK HOSSAIN",
    fatherName: "MALEK SK",
    address: "MADNA",
    phone: "9083784619",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-9",
    class: "Class VI",
    roll: 9,
    name: "SAJAHAN SK",
    fatherName: "MINTU SK",
    address: "SULTANPUR",
    phone: "9046471845",
    monthlyFee: 1350,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-10",
    class: "Class VI",
    roll: 10,
    name: "RIJUYAN ISLAM",
    fatherName: "ABDUL RAHIM",
    address: "MADNA",
    phone: "9064480879",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-11",
    class: "Class VI",
    roll: 11,
    name: "SAKIB AL HASAN",
    fatherName: "SELIM AHMED",
    address: "KHANPUR",
    phone: "8467823528",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-12",
    class: "Class VI",
    roll: 12,
    name: "MANIKUL SK",
    fatherName: "SELIM SK",
    address: "MADNA",
    phone: "8482062480",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-13",
    class: "Class VI",
    roll: 13,
    name: "RUHINA KHATUN",
    fatherName: "INJAMAMUL HOQUE",
    address: "MADNA",
    phone: "9593847924",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-14",
    class: "Class VI",
    roll: 14,
    name: "NAHID ISLAM",
    fatherName: "NURUL ISLAM",
    address: "LAKSHMIPUR",
    phone: "7074475571",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-15",
    class: "Class VI",
    roll: 15,
    name: "NAFISA YEASMIN",
    fatherName: "ABU TALEB",
    address: "ARAJIRAMAKANTAPUR",
    phone: "9647572815",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-16",
    class: "Class VI",
    roll: 16,
    name: "JAHIDA KHATUN",
    fatherName: "AKASH UDDIN SK",
    address: "KHANPUR",
    phone: "9851238458",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-17",
    class: "Class VI",
    roll: 17,
    name: "AMANULLAH",
    fatherName: "FAKRUL HOQUE",
    address: "KHANPUR",
    phone: "9734656025",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-18",
    class: "Class VI",
    roll: 18,
    name: "FARHAN REJA",
    fatherName: "JAMIRUL ISLAM",
    address: "ISLAMPUR",
    phone: "8001979944",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-19",
    class: "Class VI",
    roll: 19,
    name: "MD IMRAN KHAN",
    fatherName: "FALKESH SK",
    address: "GAJIPUR",
    phone: "9126772121",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-20",
    class: "Class VI",
    roll: 20,
    name: "MD SAMSUL HOGUE",
    fatherName: "EALKESH SK",
    address: "GAJIPUR",
    phone: "9126772121",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-21",
    class: "Class VI",
    roll: 21,
    name: "RIHAN SK",
    fatherName: "MERAJUL HOQUE",
    address: "KHANPUR",
    phone: "9126173994",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-22",
    class: "Class VI",
    roll: 22,
    name: "SAHID ALAM",
    fatherName: "SOHEL RANA",
    address: "GOTHA",
    phone: "8597050561",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-23",
    class: "Class VI",
    roll: 23,
    name: "MD ESAN ALI",
    fatherName: "MD MASUD ALI",
    address: "ISLAMPUR",
    phone: "9832420032",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-24",
    class: "Class VI",
    roll: 24,
    name: "FARHAN HOSSAIN",
    fatherName: "SAHADAT HOSSAIN",
    address: "IMAMNAGAR",
    phone: "8016238647",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-25",
    class: "Class VI",
    roll: 25,
    name: "MD ASIF",
    fatherName: "MD SELIM",
    address: "MADNA",
    phone: "9064067271",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-26",
    class: "Class VI",
    roll: 26,
    name: "ARIYAN HOQUE",
    fatherName: "ASRAFUL HOQUE",
    address: "ISLAMPUR",
    phone: "9564521089",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-27",
    class: "Class VI",
    roll: 27,
    name: "MISRINA KHATUN",
    fatherName: "ALIMUDDIN SK",
    address: "MADNA",
    phone: "9064067271",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-28",
    class: "Class VI",
    roll: 28,
    name: "TAMIMA TABASSUM",
    fatherName: "AMIRUL ISLAM",
    address: "KHIDIRPUR",
    phone: "9734618122",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-29",
    class: "Class VI",
    roll: 29,
    name: "JUBIN ISLAM",
    fatherName: "ROBIUL ISLAM",
    address: "IMAMNAGAR",
    phone: "9932515151",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-30",
    class: "Class VI",
    roll: 30,
    name: "KASHIN SHAIKH",
    fatherName: "MITHUN SK",
    address: "HASANPUR",
    phone: "9593551073",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-31",
    class: "Class VI",
    roll: 31,
    name: "MD AHIL HOSSAIN",
    fatherName: "MD ROBIUL ISLAM",
    address: "SULTANPUR",
    phone: "8370800017",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-32",
    class: "Class VI",
    roll: 32,
    name: "WASIM SK",
    fatherName: "RABBAN SK",
    address: "ISLAMPUR",
    phone: "7679740604",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-33",
    class: "Class VI",
    roll: 33,
    name: "HAMED ALI",
    fatherName: "ALIUL ISLAM",
    address: "KHANPUR",
    phone: "7430958915",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-34",
    class: "Class VI",
    roll: 34,
    name: "SHAH RUKH KHAN",
    fatherName: "AABU TALEB",
    address: "RAGHUNATHPUR",
    phone: "6296518758",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-35",
    class: "Class VI",
    roll: 35,
    name: "SAHANARA KHATUN",
    fatherName: "REJAUL MOMIN",
    address: "SULTANPUR",
    phone: "9126984842",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-36",
    class: "Class VI",
    roll: 36,
    name: "ANISA ISLAM",
    fatherName: "ANIKUL ISLAM",
    address: "KHANPUR",
    phone: "8670306307",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-37",
    class: "Class VI",
    roll: 37,
    name: "TABASSUM PARVIN",
    fatherName: "HASNAT ALI",
    address: "MADNA",
    phone: "6046351941",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-38",
    class: "Class VI",
    roll: 38,
    name: "RANIT DAS",
    fatherName: "RUPNARAYAN DAS",
    address: "SARBESWARPUR",
    phone: "9547877419",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-39",
    class: "Class VI",
    roll: 39,
    name: "BARIK SK",
    fatherName: "SAFIKUL SK",
    address: "CHHOTO KANKRAMARI",
    phone: "7872170805",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-40",
    class: "Class VI",
    roll: 40,
    name: "MD AJIJ HOSSAIN",
    fatherName: "SOFIKUL ISLAM",
    address: "KHIDIRPUR",
    phone: "7585931603",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-41",
    class: "Class VI",
    roll: 41,
    name: "PURBASHA CHOUDHURY",
    fatherName: "PRITHWIRAJ CHOUDHURY",
    address: "LAKSHMIPUR",
    phone: "9153194997",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-2",
    class: "Class VII",
    roll: 2,
    name: "ISHITA MOUSAM",
    fatherName: "MASUM RAHMAN",
    address: "ARAZI RAMAKANTAPUR",
    phone: "7031721150",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-3",
    class: "Class VII",
    roll: 3,
    name: "MORIUN NESHA",
    fatherName: "ASIKUL RAHAMAN",
    address: "MADNA",
    phone: "7384096862",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-4",
    class: "Class VII",
    roll: 4,
    name: "MD KAMRUJJAMAN",
    fatherName: "SAMSUL HOQUE",
    address: "MADNA",
    phone: "9674384495",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-5",
    class: "Class VII",
    roll: 5,
    name: "TAHMID HOQUE AFIF",
    fatherName: "MAIDUL HOQUE",
    address: "KHANPUR",
    phone: "7001329206",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-6",
    class: "Class VII",
    roll: 6,
    name: "SURAIYA SULTANA",
    fatherName: "MANIRUL ISLAM",
    address: "LAKSHMIPUR",
    phone: "9800583095",
    monthlyFee: 550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-7",
    class: "Class VII",
    roll: 7,
    name: "NAOWAJ SORIF",
    fatherName: "SAHIMUDDDIN SK",
    address: "MADNA",
    phone: "8101125340",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-8",
    class: "Class VII",
    roll: 8,
    name: "ABDUR RAHAMAN",
    fatherName: "SAMIUL SK",
    address: "KUMARPARA",
    phone: "7364007994",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-9",
    class: "Class VII",
    roll: 9,
    name: "MARUFA BEGAM",
    fatherName: "SABIR ALI",
    address: "KUMARPARA",
    phone: "6294938363",
    monthlyFee: 1400,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-10",
    class: "Class VII",
    roll: 10,
    name: "RIHAN ISLAM",
    fatherName: "SAFIKUL ISLAM",
    address: "MADNA",
    phone: "9647168851",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-11",
    class: "Class VII",
    roll: 11,
    name: "ASIP HOSSAIN",
    fatherName: "AMIR HOSSAIN",
    address: "PRASADPUR",
    phone: "9064143161",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-12",
    class: "Class VII",
    roll: 12,
    name: "MINHAJ HOSSAIN",
    fatherName: "JAKIR HOSSAIN",
    address: "MAHENDRAPUR",
    phone: "8926307595",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-13",
    class: "Class VII",
    roll: 13,
    name: "MIJANUR ISLAM",
    fatherName: "AMIRUL ISLAM",
    address: "MADNA",
    phone: "8413042999",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-14",
    class: "Class VII",
    roll: 14,
    name: "ARIYAN HOSSAIN",
    fatherName: "NASIRUDDIN SK",
    address: "MADNA",
    phone: "9883743470",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-15",
    class: "Class VII",
    roll: 15,
    name: "SUHANA PARVIN",
    fatherName: "MONIRUL ISLAM MOMIN",
    address: "SULTANPUR",
    phone: "9547627402",
    monthlyFee: 1600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-16",
    class: "Class VII",
    roll: 16,
    name: "MD SAMIM",
    fatherName: "MIYARUL ISLAM",
    address: "LAKSHMIPUR",
    phone: "9016577075",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-17",
    class: "Class VII",
    roll: 17,
    name: "SUHANA PARVIN",
    fatherName: "SAHADAT HOSSAIN",
    address: "KHIDIRPUR",
    phone: "",
    monthlyFee: 1150,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-18",
    class: "Class VII",
    roll: 18,
    name: "NAYEMA SULTANA",
    fatherName: "APEL SEKH",
    address: "ISLAMPUR",
    phone: "9547086613",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-19",
    class: "Class VII",
    roll: 19,
    name: "SANJIDA SULTANA",
    fatherName: "MONIRUL ISLAM",
    address: "LAKSHMIPUR",
    phone: "8926896924",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-20",
    class: "Class VII",
    roll: 20,
    name: "DIP KUMAR SAHA",
    fatherName: "SUJIT KUMAR SAHA",
    address: "MADNA",
    phone: "9564124282",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-21",
    class: "Class VII",
    roll: 21,
    name: "NAJMIN SULTANA",
    fatherName: "ALIUL ISLAM",
    address: "MADNA",
    phone: "9733631215",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-22",
    class: "Class VII",
    roll: 22,
    name: "MIJANUR RAHAMAN",
    fatherName: "ALIUL ISLAM",
    address: "GABGACHHI",
    phone: "9126214710",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-23",
    class: "Class VII",
    roll: 23,
    name: "MIJANUR RAHAMAN",
    fatherName: "RAJIB SK",
    address: "CHHOTO KANKRAMARI",
    phone: "8637820719",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-24",
    class: "Class VII",
    roll: 24,
    name: "DIYA SINGHA",
    fatherName: "RUP KUMAR SINGHA",
    address: "LAKSHMIPUR",
    phone: "8420799651",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-25",
    class: "Class VII",
    roll: 25,
    name: "LIMA KHATUN",
    fatherName: "JIYARUL HOQUE",
    address: "GABGACHHI",
    phone: "7431904735",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-26",
    class: "Class VII",
    roll: 26,
    name: "MD SADID REJA",
    fatherName: "SELIM REJA",
    address: "KHIDIRPUR",
    phone: "7908894352",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-27",
    class: "Class VII",
    roll: 27,
    name: "MARUFA KHATUN",
    fatherName: "JIARUL SK",
    address: "CHANDAMARI",
    phone: "9735537014",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-28",
    class: "Class VII",
    roll: 28,
    name: "ASFAK RAJA",
    fatherName: "MITUL HOSSAIN",
    address: "KHANPUR",
    phone: "9083808938",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-29",
    class: "Class VII",
    roll: 29,
    name: "ANAS MOLLAH",
    fatherName: "MOZAMMEL MOLLAH",
    address: "KHANPUR",
    phone: "9734363838",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-30",
    class: "Class VII",
    roll: 30,
    name: "AMAN SK",
    fatherName: "RUBEL SK",
    address: "KHANPUR",
    phone: "8016576135",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-31",
    class: "Class VII",
    roll: 31,
    name: "RAHAMAT SK",
    fatherName: "SIDU SK",
    address: "KHANPUR",
    phone: "9091958900",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-32",
    class: "Class VII",
    roll: 32,
    name: "RIHAN HOSSAIN",
    fatherName: "MERAJUL HOQUE",
    address: "KHANPUR",
    phone: "9734341662",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-33",
    class: "Class VII",
    roll: 33,
    name: "ARIYAN ANSARI",
    fatherName: "NAZIR HOSSAIN",
    address: "KHANPUR",
    phone: "8509543836",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-34",
    class: "Class VII",
    roll: 34,
    name: "SAHIL SK",
    fatherName: "JOHORUL SK",
    address: "KHANPUR",
    phone: "7063805107",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-35",
    class: "Class VII",
    roll: 35,
    name: "ISTIYAK AHAMMED",
    fatherName: "MOSARAF HOSSAIN",
    address: "ISLAMPUR",
    phone: "7001330257",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVII-36",
    class: "Class VII",
    roll: 36,
    name: "MASUMA KHATUN",
    fatherName: "MAJARUL ISLAM",
    address: "ISLAMPUR",
    phone: "9732214577",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-1",
    class: "Class VIII",
    roll: 1,
    name: "ANUSHA PARVIN",
    fatherName: "ABU KALAM",
    address: "CHHABGHATI",
    phone: "6294008232",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-2",
    class: "Class VIII",
    roll: 2,
    name: "SAKIM SK",
    fatherName: "SOIDUL SK",
    address: "BORO KANKRAMARI",
    phone: "7384674476",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-3",
    class: "Class VIII",
    roll: 3,
    name: "MD MAYAN",
    fatherName: "SARIUL ISLAM",
    address: "KHANPUR",
    phone: "8343841117",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-4",
    class: "Class VIII",
    roll: 4,
    name: "AZMAIL AHAMED",
    fatherName: "BULLA RAHAMAN",
    address: "KHANPUR",
    phone: "8509543836",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-5",
    class: "Class VIII",
    roll: 5,
    name: "MD MONIRUJJAMAN",
    fatherName: "AKBAR ALI",
    address: "MADNA",
    phone: "7029222785",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-6",
    class: "Class VIII",
    roll: 6,
    name: "MIRON ISLAM",
    fatherName: "SOHIDUL ISLAM",
    address: "KHANPUR",
    phone: "9126170894",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-7",
    class: "Class VIII",
    roll: 7,
    name: "ITU SINGHA",
    fatherName: "NOKUL SINGHA",
    address: "KHIDIRPUR",
    phone: "8609015921",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-8",
    class: "Class VIII",
    roll: 8,
    name: "RIMA SINGHA",
    fatherName: "JADAB KUMAR SINGHA",
    address: "SADIKPUR",
    phone: "9064792595",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-9",
    class: "Class VIII",
    roll: 9,
    name: "AJMAIL SK",
    fatherName: "SADIKUL ALAM",
    address: "KHANPUR",
    phone: "9126150122",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-10",
    class: "Class VIII",
    roll: 10,
    name: "JESMIN KHATUN",
    fatherName: "JAHIR SK",
    address: "ARAZI RAMAKANTAPUR",
    phone: "8617576169",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-11",
    class: "Class VIII",
    roll: 11,
    name: "WASIM RAJA",
    fatherName: "WAHIDUR RAHAMAN",
    address: "MADNA",
    phone: "9732313137",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-12",
    class: "Class VIII",
    roll: 12,
    name: "JISAN SK",
    fatherName: "TASIRUDDIN SK",
    address: "ARAZI RAMAKANTAPUR",
    phone: "9593519201",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-13",
    class: "Class VIII",
    roll: 13,
    name: "MD SAMIM",
    fatherName: "HASIB SK",
    address: "MADNA",
    phone: "6064067271",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-14",
    class: "Class VIII",
    roll: 14,
    name: "ZAEED FARHAN",
    fatherName: "ASLAM SHAIKH",
    address: "MADNA",
    phone: "9735684210",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-15",
    class: "Class VIII",
    roll: 15,
    name: "NISHAN AJMAT",
    fatherName: "NIHARUL ISLAM",
    address: "BORO KANKRAMARI",
    phone: "9083104527",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-16",
    class: "Class VIII",
    roll: 16,
    name: "RIZWAN ALI",
    fatherName: "KABIR ALI",
    address: "GOPALGANJ",
    phone: "9733591737",
    monthlyFee: 1550,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-17",
    class: "Class VIII",
    roll: 17,
    name: "RISHBA KHATUN",
    fatherName: "RABIUL ISLAM",
    address: "GOPALGANJ",
    phone: "8768644511",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-18",
    class: "Class VIII",
    roll: 18,
    name: "MASHUMA YEASMIN",
    fatherName: "ROFIKUL HOSSAIN",
    address: "GOPALGANJ",
    phone: "7076350411",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-19",
    class: "Class VIII",
    roll: 19,
    name: "MIEN SK",
    fatherName: "MORSALIM SK",
    address: "RAGHUNATHPUR",
    phone: "7718432336",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-20",
    class: "Class VIII",
    roll: 20,
    name: "ANSARUL RAHAMAN",
    fatherName: "HABIBUR RAHAMAN",
    address: "MADNA",
    phone: "7489574935",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVIII-21",
    class: "Class VIII",
    roll: 21,
    name: "SIDDIKA BEGUM",
    fatherName: "TOHIDUL ISLAM",
    address: "MANGALJAN",
    phone: "7407143580",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassVI-42",
    class: "Class VI",
    roll: 42,
    name: "ABDUL HAMID",
    fatherName: "KURBAN ALI",
    address: "RAGHUNATHPUR",
    phone: "8016610725",
    monthlyFee: 700,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-ClassIV-30",
    class: "Class IV",
    roll: 30,
    name: "MUSKAN KHATUN",
    fatherName: "AKBAR ALI",
    address: "MADNA",
    phone: "",
    monthlyFee: 650,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-58",
    class: "NS",
    roll: 58,
    name: "JULFIKAR ISLAM MOMIN",
    fatherName: "JAHIDUL ISLAM MOMIN",
    address: "SULTANPUR",
    phone: "9474107434",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-59",
    class: "NS",
    roll: 59,
    name: "ALLAR SLAM MOMIN",
    fatherName: "JAWSAR ALAM MOMIN",
    address: "SULTANPUR",
    phone: "6294957852",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-NS-60",
    class: "NS",
    roll: 60,
    name: "FAYAZ RAHAMAN",
    fatherName: "MIZANUR RAHAMAN",
    address: "GHOTA",
    phone: "8536821893",
    monthlyFee: 1300,
    gender: "Male",
    status: "Active",
    isActive: true
  },
  {
    studentId: "ST-UKG-27",
    class: "UKG",
    roll: 27,
    name: "MAHIR FAISAL",
    fatherName: "HASANUR JAMAN",
    address: "MADNA",
    phone: "9735402253",
    monthlyFee: 600,
    gender: "Male",
    status: "Active",
    isActive: true
  }
];

export const MOCK_MARKS: ExamMark[] = [
  {
    class: "Class I",
    roll: 1,
    studentName: "Ananya Ghosh",
    examName: "1st Summative Evaluation",
    subjectName: "Bengali",
    markObtain: 45,
    totalMark: 50,
    grade: "A+",
    rank: 1
  },
  {
    class: "Class I",
    roll: 2,
    studentName: "Debayan Dutta",
    examName: "1st Summative Evaluation",
    subjectName: "Bengali",
    markObtain: 40,
    totalMark: 50,
    grade: "A",
    rank: 2
  }
];

export const APPS_SCRIPT_CODE = `/**
 * Enterprise Production-Ready Google Apps Script WebApp Backend for School Hub Portal
 * Version: 2.0.0 (Enterprise Architectural Edition)
 * 
 * Includes 12 Core Database Tabs:
 * 1. Students (S/L No, Roll, Class, Student Name, Father Name, Phone, Address, Photo, Gov. School, Status, Vehicles Yes/No, Vehicle Name/Driver)
 * 2. Fee (S/L No, Class, Roll, Student Name, Father Name, Individual Fee, 12 Months Due/Paid with Receipt No, Total, Last Receipt No)
 * 3. Attendance (S/L No, Date, Class, Roll, Student Name, Status (Present/Absent), Remarks)
 * 4. Teacher (S/L No, Teacher Name, Designation, Phone, Assigned Class for Attendance, Assigned Subject for Mark Entry, Status)
 * 5. FullMark (S/L No, Class, Subject, 1st Summative, 2nd Summative, 3rd Summative)
 * 6. Result (S/L No, Class, Roll, Student Name, Exam, Subject, Mark Obtained / AB, Total Mark)
 * 7. School (School ID, School Name, Address, Phone, EIIN / Reg No, Logo URL, Established, Default Monthly Fee)
 * 8. FeeTransaction (Receipt No, Date, Class, Roll, Student Name, Paid Months, Amount, Payment Mode)
 * 9. AuditLog (Timestamp, Action / Event, User / Session, Details)
 * 10. daybook (S/L No, Date, Type (Income/Expense), Category, Amount, Description, Payment Method, Receipt No)
 * 11. Routine (S/L No, Class, Day, Period, Time Slot, Subject, Teacher, Last Updated)
 * 12. AutoBackup (S/L No, Backup Date & Time, File Name, File Size, Google Drive Download Link, File ID, Status)
 */

var CLASS_SHEET_MAP = {
  "NS": "NURSERY",
  "LKG": "LKG",
  "UKG": "UKG",
  "Class I": "ONE",
  "Class II": "TWO",
  "Class III": "III",
  "Class IV": "IV",
  "Class V": "V",
  "Class VI": "VI",
  "Class VII": "VII",
  "Class VIII": "VIII",
  "Class IX": "IX",
  "Class X": "X",
  "Class XI": "XI",
  "Class XII": "XII"
};

var STD_CLASSES = [
  "NS", "LKG", "UKG", "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII", "Class IX", "Class X", "Class XI", "Class XII"
];

// 11. Header Recovery & Tab Setup
function setupDatabaseTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabsConfig = [
    {
      name: "Students",
      headers: ["S/L No", "Roll", "Class", "Student Name", "Father Name", "Phone", "Address", "Photo", "Gov. School", "Status (Active/Inactive)", "Vehicles (Yes/No)", "Vehicle Name (Driver Name)"]
    },
    {
      name: "Fee",
      headers: ["S/L No", "Class", "Roll", "Student Name", "Father Name", "Individual Fee", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Total", "Last Receipt No"]
    },
    {
      name: "Attendance",
      headers: ["S/L No", "Date", "Class", "Roll", "Student Name", "Status (Present/Absent)", "Remarks"]
    },
    {
      name: "Teacher",
      headers: ["S/L No", "Teacher Name", "Designation", "Phone", "Assigned Class for Attendance", "Assigned Subject for Mark Entry", "Status"]
    },
    {
      name: "FullMark",
      headers: ["S/L No", "Class", "Subject", "1st Summative", "2nd Summative", "3rd Summative"]
    },
    {
      name: "Result",
      headers: ["S/L No", "Class", "Roll", "Student Name", "Exam", "Subject", "Mark Obtained (AB)", "Total Mark"]
    },
    {
      name: "School",
      headers: ["School ID", "School Name", "Address", "Phone", "EIIN / Reg No", "Logo URL", "Established", "Default Monthly Fee"]
    },
    {
      name: "FeeTransaction",
      headers: ["Receipt No", "Date", "Class", "Roll", "Student Name", "Paid Months", "Amount", "Payment Mode"]
    },
    {
      name: "AuditLog",
      headers: ["Timestamp", "Action / Event", "User / Session", "Details"]
    },
    {
      name: "daybook",
      headers: ["S/L No", "Date", "Type (Income/Expense)", "Category", "Amount", "Description", "Payment Method", "Receipt No"]
    },
    {
      name: "Routine",
      headers: ["S/L No", "Class", "Day", "Period", "Time Slot", "Subject", "Teacher", "Last Updated"]
    },
    {
      name: "AutoBackup",
      headers: ["S/L No", "Backup Date & Time", "File Name", "File Size", "Google Drive Download Link", "File ID", "Status"]
    }
  ];

  for (var i = 0; i < tabsConfig.length; i++) {
    var conf = tabsConfig[i];
    var sheet = ss.getSheetByName(conf.name);
    if (!sheet) {
      sheet = ss.insertSheet(conf.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(conf.headers);
      sheet.getRange(1, 1, 1, conf.headers.length)
        .setFontWeight("bold")
        .setBackground("#0f172a")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    } else {
      // Header Recovery: Restore corrupted/deleted headers
      var firstRow = sheet.getRange(1, 1, 1, conf.headers.length).getValues()[0];
      if (!firstRow[0] || String(firstRow[0]).trim() === "") {
        sheet.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers])
          .setFontWeight("bold")
          .setBackground("#0f172a")
          .setFontColor("#ffffff");
      }
    }
  }
}

// 7. Audit Log Implementation
function logAudit(ss, action, user, details) {
  try {
    var sheet = ss.getSheetByName("AuditLog");
    if (!sheet) {
      setupDatabaseTabs();
      sheet = ss.getSheetByName("AuditLog");
    }
    var timeZone = Session.getScriptTimeZone() || "GMT+6";
    var timestamp = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    var userStr = user ? String(user) : "System / Web API";
    var detailsStr = (typeof details === "object") ? JSON.stringify(details) : String(details || "");
    
    sheet.appendRow([timestamp, action, userStr, detailsStr]);
  } catch (err) {
    Logger.log("Audit log failed: " + err.toString());
  }
}

// 13. Class Name Standardization
function normalizeClassName(rawClass) {
  if (!rawClass) return "Class I";
  var str = String(rawClass).trim().replace(/[\\u200B-\\u200D\\uFEFF]/g, '').replace(/\\u00A0/g, ' ');
  var lower = str.toLowerCase().replace(/[^a-z0-9]/g, "");

  var bnDigits = { '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9', '০': '0' };
  var convertedLower = str.toLowerCase().split('').map(function(ch){ return bnDigits[ch] || ch; }).join('').replace(/[^a-z0-9]/g, "");

  if (["ns", "nursery", "nur", "nurseryclass"].indexOf(lower) !== -1 || str.indexOf("নার্সারি") !== -1 || str.indexOf("নার্সারী") !== -1) return "NS";
  if (["lkg", "lowerkg", "lower", "lkgclass"].indexOf(lower) !== -1 || str.indexOf("এলকেজি") !== -1) return "LKG";
  if (["ukg", "upperkg", "upper", "ukgclass"].indexOf(lower) !== -1 || str.indexOf("ইউকেজি") !== -1) return "UKG";

  if (["1", "01", "one", "i", "1st", "class1", "classi", "classone", "class1st"].indexOf(convertedLower) !== -1 || str.indexOf("প্রথম") !== -1) return "Class I";
  if (["2", "02", "two", "ii", "2nd", "class2", "classii", "classtwo", "class2nd"].indexOf(convertedLower) !== -1 || str.indexOf("দ্বিতীয়") !== -1) return "Class II";
  if (["3", "03", "three", "iii", "3rd", "class3", "classiii", "classthree", "class3rd"].indexOf(convertedLower) !== -1 || str.indexOf("তৃতীয়") !== -1) return "Class III";
  if (["4", "04", "four", "iv", "4th", "class4", "classiv", "classfour", "class4th"].indexOf(convertedLower) !== -1 || str.indexOf("চতুর্থ") !== -1) return "Class IV";
  if (["5", "05", "five", "v", "5th", "class5", "classv", "classfive", "class5th"].indexOf(convertedLower) !== -1 || str.indexOf("পঞ্চম") !== -1) return "Class V";
  if (["6", "06", "six", "vi", "6th", "class6", "classvi", "classsix", "class6th"].indexOf(convertedLower) !== -1 || str.indexOf("ষষ্ঠ") !== -1) return "Class VI";
  if (["7", "07", "seven", "vii", "7th", "class7", "classvii", "classseven", "class7th"].indexOf(convertedLower) !== -1 || str.indexOf("সপ্তম") !== -1) return "Class VII";
  if (["8", "08", "eight", "viii", "8th", "class8", "classviii", "classeight", "class8th"].indexOf(convertedLower) !== -1 || str.indexOf("অষ্টম") !== -1) return "Class VIII";
  if (["9", "09", "nine", "ix", "9th", "class9", "classix", "classnine", "class9th"].indexOf(convertedLower) !== -1 || str.indexOf("নবম") !== -1) return "Class IX";
  if (["10", "ten", "x", "10th", "class10", "classx", "classten", "class10th"].indexOf(convertedLower) !== -1 || str.indexOf("দশম") !== -1) return "Class X";
  if (["11", "eleven", "xi", "11th", "class11", "classxi", "classeleven", "class11th"].indexOf(convertedLower) !== -1 || str.indexOf("একাদশ") !== -1) return "Class XI";
  if (["12", "twelve", "xii", "12th", "class12", "classxii", "classtwelve", "class12th"].indexOf(convertedLower) !== -1 || str.indexOf("দ্বাদশ") !== -1) return "Class XII";

  for (var k = 0; k < STD_CLASSES.length; k++) {
    if (STD_CLASSES[k].toLowerCase() === str.toLowerCase() || STD_CLASSES[k].toLowerCase().replace(/[^a-z0-9]/g, "") === lower) {
      return STD_CLASSES[k];
    }
  }

  return str;
}

// 9. Photo Upload Fix & 10. Image Extension Fix
function savePhotoToDrive(photoData, studentName) {
  if (!photoData) return "";
  if (photoData.indexOf("http") === 0) return photoData;

  if (photoData.indexOf("data:image") === 0 || photoData.length > 300) {
    try {
      var folderName = "School_Student_Photos";
      var folders = DriveApp.getFoldersByName(folderName);
      var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

      var contentType = "image/jpeg";
      var ext = ".jpg";
      var base64 = photoData;

      if (photoData.indexOf("data:image") === 0) {
        var header = photoData.substring(5, photoData.indexOf(";"));
        contentType = header || "image/jpeg";
        base64 = photoData.substring(photoData.indexOf(",") + 1);

        if (contentType.indexOf("png") !== -1) ext = ".png";
        else if (contentType.indexOf("webp") !== -1) ext = ".webp";
        else if (contentType.indexOf("gif") !== -1) ext = ".gif";
        else ext = ".jpg";
      }

      var sanitizedName = (studentName || "Student").replace(/[^a-zA-Z0-9]/g, "_");
      var fileName = sanitizedName + "_" + Date.now() + ext;
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), contentType, fileName);
      var file = folder.createFile(blob);

      return "https://drive.google.com/uc?export=view&id=" + file.getId();
    } catch (e) {
      Logger.log("Drive Save Error: " + e.toString());
      if (photoData.indexOf("data:image") === 0) return photoData;
      if (photoData.indexOf("http") === 0) return photoData;
      return "data:image/jpeg;base64," + photoData;
    }
  }
  return photoData;
}

// 8. Backup Security & 12. Backup Optimization (Enterprise Edition)
function getBackupFolder() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("BACKUP_FOLDER_ID");
  var folder = null;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
      if (folder.isTrashed()) {
        folder = null;
      }
    } catch (e) {
      folder = null;
    }
  }
  if (!folder) {
    var folderName = "School_Database_Backups";
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    props.setProperty("BACKUP_FOLDER_ID", folder.getId());
  }
  return folder;
}

function ensureAutoBackupHeaders(sheet) {
  var requiredHeaders = ["S/L No", "Backup Date & Time", "File Name", "File Size", "Google Drive Download Link", "File ID", "Status"];
  var lastRow = sheet.getLastRow();
  var needsHeaders = false;

  if (lastRow === 0) {
    needsHeaders = true;
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, 7).getValues()[0];
    if (String(currentHeaders[0]) !== "S/L No" || String(currentHeaders[1]) !== "Backup Date & Time" || String(currentHeaders[4]) !== "Google Drive Download Link") {
      needsHeaders = true;
    }
  }

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, 7).setValues([requiredHeaders]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
}

function performAutoBackup() {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return {
        success: false,
        error: "অন্য একটি ব্যাকআপ প্রক্রিয়া চলমান রয়েছে, অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।"
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var fileId = ss.getId();
    var file = DriveApp.getFileById(fileId);

    var folder = getBackupFolder();
    var timeZone = Session.getScriptTimeZone() || "GMT+6";
    var formattedDate = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd_HH-mm-ss_SSS");
    var backupFileName = (ss.getName() || "School_Hub_Database") + "_Backup_" + formattedDate;
    
    // Copy file in Google Drive safely
    var fileCopy = file.makeCopy(backupFileName, folder);
    var backupId = fileCopy.getId();
    var backupUrl = "https://drive.google.com/file/d/" + backupId + "/view";
    var fileSizeKb = (fileCopy.getSize() / 1024).toFixed(1) + " KB";
    var timestamp = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd hh:mm:ss a");

    var sheet = ss.getSheetByName("AutoBackup");
    if (!sheet) {
      setupDatabaseTabs();
      sheet = ss.getSheetByName("AutoBackup");
    }
    ensureAutoBackupHeaders(sheet);

    // Batch Read existing rows to calculate S/L No
    var data = sheet.getDataRange().getValues();
    var currentRowsCount = data.length > 1 ? data.length - 1 : 0;
    var nextSl = currentRowsCount + 1;

    // Batch Write row (Avoid appendRow)
    var newRow = [nextSl, timestamp, backupFileName, fileSizeKb, backupUrl, backupId, "Active"];
    var targetRowIndex = sheet.getLastRow() + 1;
    sheet.getRange(targetRowIndex, 1, 1, newRow.length).setValues([newRow]);

    // Handle Max 10 Backups Overflow & Safe Delete
    var maxBackups = 10;
    var updatedData = sheet.getDataRange().getValues();
    var totalBackups = updatedData.length - 1;

    if (totalBackups > maxBackups) {
      var overflowCount = totalBackups - maxBackups;
      if (overflowCount > 0) {
        // Delete old files from Drive
        for (var i = 1; i <= overflowCount; i++) {
          var oldFileId = updatedData[i][5];
          if (oldFileId) {
            try {
              DriveApp.getFileById(oldFileId).setTrashed(true);
            } catch (driveErr) {
              Logger.log("Old backup trash error: " + driveErr.toString());
            }
          }
        }
        // Safe delete overflow rows from sheet
        sheet.deleteRows(2, overflowCount);

        // Re-index S/L No column via Batch Write
        var reindexData = sheet.getDataRange().getValues();
        if (reindexData.length > 1) {
          var slCol = [];
          for (var r = 1; r < reindexData.length; r++) {
            slCol.push([r]);
          }
          sheet.getRange(2, 1, slCol.length, 1).setValues(slCol);
        }
      }
    }

    logAudit(ss, "Backup", "System", "AutoBackup created: " + backupFileName);

    var freshBackups = readAutoBackups(ss);

    return {
      success: true,
      message: "অটো ব্যাকআপ সফল হয়েছে! গুগল ড্রাইভে সিকিউরড ব্যাকআপ সংরক্ষণ করা হয়েছে।",
      backupUrl: backupUrl,
      fileName: backupFileName,
      timestamp: timestamp,
      backups: freshBackups
    };

  } catch (err) {
    Logger.log("AutoBackup Error: " + err.toString());
    try {
      var ssErr = SpreadsheetApp.getActiveSpreadsheet();
      logAudit(ssErr, "Backup", "System", "AutoBackup Failed: " + err.toString());
    } catch (auditErr) {}
    return {
      success: false,
      error: "অটো ব্যাকআপ ব্যর্থ হয়েছে: " + err.toString()
    };
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (lockErr) {}
    }
  }
}

function setupBackupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "performAutoBackup") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("performAutoBackup")
    .timeBased()
    .everyHours(6)
    .create();
}

function readAutoBackups(ss) {
  try {
    var sheet = ss.getSheetByName("AutoBackup");
    if (!sheet) return [];
    ensureAutoBackupHeaders(sheet);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    var backups = [];
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] || data[i][1] || data[i][2]) {
        backups.push({
          sl: data[i][0] || (backups.length - i + 1),
          timestamp: String(data[i][1] || ''),
          fileName: String(data[i][2] || ''),
          fileSize: String(data[i][3] || ''),
          downloadUrl: String(data[i][4] || ''),
          fileId: String(data[i][5] || ''),
          status: String(data[i][6] || 'Active')
        });
      }
    }
    return backups;
  } catch (err) {
    Logger.log("readAutoBackups Error: " + err.toString());
    return [];
  }
}

// 16. School Settings Loader
function readSchoolSettings(ss) {
  var sheet = ss.getSheetByName("School");
  var defaultSchool = {
    schoolId: "SCH001",
    schoolName: "School Hub Academy",
    address: "Kolkata, West Bengal",
    phone: "9876543210",
    eiin: "100200",
    logoUrl: "",
    established: "2010",
    defaultMonthlyFee: 350
  };

  if (!sheet) return defaultSchool;

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    sheet.appendRow([
      defaultSchool.schoolId,
      defaultSchool.schoolName,
      defaultSchool.address,
      defaultSchool.phone,
      defaultSchool.eiin,
      defaultSchool.logoUrl,
      defaultSchool.established,
      defaultSchool.defaultMonthlyFee
    ]);
    return defaultSchool;
  }

  var row = data[1];
  var feeVal = Number(row[7]);
  return {
    schoolId: String(row[0] || "SCH001"),
    schoolName: String(row[1] || "School Hub Academy"),
    address: String(row[2] || ""),
    phone: String(row[3] || ""),
    eiin: String(row[4] || ""),
    logoUrl: String(row[5] || ""),
    established: String(row[6] || "2010"),
    defaultMonthlyFee: (!isNaN(feeVal) && row[7] !== "") ? feeVal : 350
  };
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// HTTP GET Handler
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getInitialData";
    var page = e && e.parameter && e.parameter.page ? Number(e.parameter.page) : null;
    var limit = e && e.parameter && e.parameter.limit ? Number(e.parameter.limit) : null;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupDatabaseTabs();

    if (action === "ping") {
      logAudit(ss, "API Access", "Client", "Ping action received");
      return responseJSON({ status: "ONLINE", message: "Connected successfully with 12 tabs", timestamp: new Date().toISOString() });
    }

    if (action === "triggerBackup") {
      var backupRes = performAutoBackup();
      return responseJSON(backupRes);
    }

    if (action === "getInitialData") {
      var schoolInfo = readSchoolSettings(ss);
      var students = readStudents(ss, page, limit);
      var marks = readMarks(ss, page, limit);
      var teachers = readTeachers(ss, page, limit);
      var expenses = readExpenses(ss, page, limit);
      var feeReceipts = readFeeReceipts(ss, page, limit);
      var daybook = readDaybook(ss, page, limit);
      var routines = readRoutine(ss);
      var backups = readAutoBackups(ss);

      logAudit(ss, "API Access", "Client", "getInitialData requested");

      return responseJSON({
        success: true,
        schoolInfo: schoolInfo,
        students: students,
        marks: marks,
        teachers: teachers,
        expenses: expenses,
        feeReceipts: feeReceipts,
        daybook: daybook,
        routines: routines,
        backups: backups,
        timestamp: new Date().toISOString()
      });
    }

    return responseJSON({ success: false, error: "Invalid action" });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

// HTTP POST Handler with LockService, Validation & Security
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(10000);

    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, error: "Empty POST body" });
    }

    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    setupDatabaseTabs();

    if (action === "triggerBackup") {
      var res = performAutoBackup();
      return responseJSON(res);
    }

    if (action === "saveStudent") {
      var st = postData.student;
      if (!st || !st.name || st.roll === undefined || !st.class) {
        return responseJSON({ success: false, error: "Validation Error: Student name, class and roll are required." });
      }
      saveStudentRow(ss, st);
      logAudit(ss, "Save Student", "User", { class: st.class, roll: st.roll, name: st.name });
      return responseJSON({ success: true, message: "Student saved successfully" });
    }

    if (action === "deleteStudent") {
      if (!postData.className || postData.roll === undefined) {
        return responseJSON({ success: false, error: "Validation Error: Class and roll required for deletion." });
      }
      deleteStudentRow(ss, postData.className, postData.roll);
      logAudit(ss, "Delete Student", "User", { class: postData.className, roll: postData.roll });
      return responseJSON({ success: true, message: "Student deleted" });
    }

    if (action === "saveMarks") {
      if (!postData.marks || !Array.isArray(postData.marks)) {
        return responseJSON({ success: false, error: "Validation Error: Marks list expected." });
      }
      saveMarksRows(ss, postData.marks);
      logAudit(ss, "Save Marks", "User", { count: postData.marks.length });
      return responseJSON({ success: true, message: "Marks saved successfully" });
    }

    if (action === "saveAttendance") {
      if (!postData.attendance || !Array.isArray(postData.attendance)) {
        return responseJSON({ success: false, error: "Validation Error: Attendance list expected." });
      }
      saveAttendanceRows(ss, postData.attendance);
      logAudit(ss, "Save Attendance", "User", { count: postData.attendance.length });
      return responseJSON({ success: true, message: "Attendance saved" });
    }

    if (action === "saveTeacher") {
      var tch = postData.teacher;
      if (!tch || !tch.name) {
        return responseJSON({ success: false, error: "Validation Error: Teacher name is required." });
      }
      saveTeacherRow(ss, tch);
      logAudit(ss, "Save Teacher", "User", { teacherId: tch.teacherId || tch.id, name: tch.name });
      return responseJSON({ success: true, message: "Teacher saved" });
    }

    if (action === "deleteTeacher") {
      deleteTeacherRow(ss, postData.teacherId, postData.name);
      logAudit(ss, "Delete Teacher", "User", { teacherId: postData.teacherId, name: postData.name });
      return responseJSON({ success: true, message: "Teacher deleted" });
    }

    if (action === "syncTeachers") {
      if (postData.teachers && Array.isArray(postData.teachers)) {
        syncTeachersRows(ss, postData.teachers);
        logAudit(ss, "Sync Teachers", "User", { count: postData.teachers.length });
      }
      return responseJSON({ success: true, message: "Teachers synced" });
    }

    if (action === "saveFeeTransaction") {
      if (postData.student) {
        saveStudentRow(ss, postData.student);
      }
      var txn = postData.transaction || postData.receipt;
      if (txn) {
        saveFeeTransactionRow(ss, txn);
        logAudit(ss, "Save Fee", "User", { receiptNo: txn.receiptNo, amount: txn.amount });
      }
      return responseJSON({ success: true, message: "Fee transaction and student fee status saved" });
    }

    if (action === "syncFeeReceipts") {
      if (postData.feeReceipts && Array.isArray(postData.feeReceipts)) {
        syncFeeReceiptsRows(ss, postData.feeReceipts);
        logAudit(ss, "Sync Fee Receipts", "User", { count: postData.feeReceipts.length });
      }
      return responseJSON({ success: true, message: "Fee receipts synced" });
    }

    if (action === "saveExpense") {
      if (postData.expense) {
        saveExpenseRow(ss, postData.expense);
        logAudit(ss, "Save Expense", "User", { voucherNo: postData.expense.voucherNo, amount: postData.expense.amount });
      }
      return responseJSON({ success: true, message: "Expense saved" });
    }

    if (action === "syncExpenses") {
      if (postData.expenses && Array.isArray(postData.expenses)) {
        syncExpensesRows(ss, postData.expenses);
        logAudit(ss, "Sync Expenses", "User", { count: postData.expenses.length });
      }
      return responseJSON({ success: true, message: "Expenses synced" });
    }

    if (action === "saveDaybook") {
      var dbEntry = postData.entry || postData.daybook;
      if (dbEntry) {
        saveDaybookRow(ss, dbEntry);
        logAudit(ss, "Save Daybook", "User", { amount: dbEntry.amount, type: dbEntry.type });
      }
      return responseJSON({ success: true, message: "Daybook entry saved" });
    }

    if (action === "syncDaybook") {
      if (postData.daybookEntries && Array.isArray(postData.daybookEntries)) {
        syncDaybookRows(ss, postData.daybookEntries);
        logAudit(ss, "Sync Daybook", "User", { count: postData.daybookEntries.length });
      }
      return responseJSON({ success: true, message: "Daybook synced" });
    }

    if (action === "saveRoutine") {
      saveRoutineRows(ss, postData.routine || postData.routines);
      logAudit(ss, "Save Routine", "User", "Routine updated");
      return responseJSON({ success: true, message: "Routine saved" });
    }

    return responseJSON({ success: false, error: "Unknown POST action" });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// 17. Duplicate Key Prevention & Read Students
function readStudents(ss, page, limit) {
  var studentsMap = {};
  var orderKeys = [];
  var schoolSettings = readSchoolSettings(ss);
  var defaultFee = schoolSettings.defaultMonthlyFee;

  var stSheet = ss.getSheetByName("Students");
  if (stSheet) {
    var stData = stSheet.getDataRange().getValues();
    if (stData.length > 1) {
      for (var i = 1; i < stData.length; i++) {
        var r = stData[i];
        if (!r[1] && !r[3]) continue;

        var rollNum = Number(r[1] || 1);
        var normClass = normalizeClassName(r[2]);
        var key = normClass + "_" + rollNum;

        var vehVal = String(r[10] || 'No');
        var vehName = String(r[11] || '');
        var finalVeh = (vehVal === 'Yes' && vehName) ? vehName : (vehVal === 'Yes' ? 'Yes' : (vehName || vehVal));

        if (!studentsMap[key]) {
          studentsMap[key] = {
            class: normClass,
            roll: rollNum,
            name: String(r[3] || ''),
            fatherName: String(r[4] || ''),
            phone: String(r[5] || ''),
            address: String(r[6] || ''),
            photo: String(r[7] || ''),
            govtSchoolName: String(r[8] || ''),
            status: String(r[9] || 'Active'),
            vehicle: finalVeh,
            monthlyFee: defaultFee,
            january: 'Due', february: 'Due', march: 'Due', april: 'Due',
            may: 'Due', june: 'Due', july: 'Due', august: 'Due',
            september: 'Due', october: 'Due', november: 'Due', december: 'Due',
            totalCollection: 0, lastReceiptNo: ''
          };
          orderKeys.push(key);
        } else {
          var existing = studentsMap[key];
          if (r[3]) existing.name = String(r[3]);
          if (r[4]) existing.fatherName = String(r[4]);
          if (r[5]) existing.phone = String(r[5]);
          if (r[6]) existing.address = String(r[6]);
          if (r[7]) existing.photo = String(r[7]);
          if (r[8]) existing.govtSchoolName = String(r[8]);
          if (r[9]) existing.status = String(r[9]);
          if (finalVeh) existing.vehicle = finalVeh;
        }
      }
    }
  }

  var feeSheet = ss.getSheetByName("Fee");
  if (feeSheet) {
    var feeData = feeSheet.getDataRange().getValues();
    if (feeData.length > 1) {
      for (var f = 1; f < feeData.length; f++) {
        var fr = feeData[f];
        if (!fr[1] && !fr[3]) continue;

        var fClass = normalizeClassName(fr[1]);
        var fRoll = Number(fr[2] || 1);
        var fKey = fClass + "_" + fRoll;

        var parsedFee = Number(fr[5]);
        var mFee = (!isNaN(parsedFee) && fr[5] !== "" && fr[5] !== null) ? parsedFee : defaultFee;

        if (!studentsMap[fKey]) {
          studentsMap[fKey] = {
            class: fClass,
            roll: fRoll,
            name: String(fr[3] || ''),
            fatherName: String(fr[4] || ''),
            phone: '', address: '', photo: '', govtSchoolName: '',
            status: 'Active', vehicle: 'No',
            monthlyFee: mFee,
            january: String(fr[6] || 'Due'), february: String(fr[7] || 'Due'), march: String(fr[8] || 'Due'),
            april: String(fr[9] || 'Due'), may: String(fr[10] || 'Due'), june: String(fr[11] || 'Due'),
            july: String(fr[12] || 'Due'), august: String(fr[13] || 'Due'), september: String(fr[14] || 'Due'),
            october: String(fr[15] || 'Due'), november: String(fr[16] || 'Due'), december: String(fr[17] || 'Due'),
            totalCollection: Number(fr[18] || 0), lastReceiptNo: String(fr[19] || '')
          };
          orderKeys.push(fKey);
        } else {
          var st = studentsMap[fKey];
          st.monthlyFee = mFee;
          if (fr[6]) st.january = String(fr[6]);
          if (fr[7]) st.february = String(fr[7]);
          if (fr[8]) st.march = String(fr[8]);
          if (fr[9]) st.april = String(fr[9]);
          if (fr[10]) st.may = String(fr[10]);
          if (fr[11]) st.june = String(fr[11]);
          if (fr[12]) st.july = String(fr[12]);
          if (fr[13]) st.august = String(fr[13]);
          if (fr[14]) st.september = String(fr[14]);
          if (fr[15]) st.october = String(fr[15]);
          if (fr[16]) st.november = String(fr[16]);
          if (fr[17]) st.december = String(fr[17]);
          st.totalCollection = Number(fr[18] || st.totalCollection || 0);
          st.lastReceiptNo = String(fr[19] || st.lastReceiptNo || '');
        }
      }
    }
  }

  var resultList = [];
  for (var k = 0; k < orderKeys.length; k++) {
    resultList.push(studentsMap[orderKeys[k]]);
  }

  if (page && limit && page > 0 && limit > 0) {
    var startIdx = (page - 1) * limit;
    return resultList.slice(startIdx, startIdx + limit);
  }

  return resultList;
}

// 6. Result Sheet Bug Fix & Read Marks
function readMarks(ss, page, limit) {
  var sheet = ss.getSheetByName("Result");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var fullMarkMap = {};
  var fmSheet = ss.getSheetByName("FullMark");
  if (fmSheet) {
    var fmData = fmSheet.getDataRange().getValues();
    for (var f = 1; f < fmData.length; f++) {
      var fRow = fmData[f];
      var fmClass = normalizeClassName(fRow[1]);
      var fmSubj = String(fRow[2] || "").trim().toLowerCase();
      if (fmClass && fmSubj) {
        fullMarkMap[fmClass + "_" + fmSubj] = {
          "1st Summative Evaluation": Number(fRow[3] || 50),
          "2nd Summative Evaluation": Number(fRow[4] || 50),
          "3rd Summative Evaluation": Number(fRow[5] || 100)
        };
      }
    }
  }

  var marks = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[1] && !r[3]) continue;

    var cls = normalizeClassName(r[1] || r[0]);
    var subj = String(r[5] || r[7] || '').trim();
    var exam = String(r[4] || r[6] || '3rd Summative Evaluation').trim();

    var rawMark = r[6];
    var isAB = (String(rawMark).toUpperCase() === 'AB');
    var markNum = isAB ? 'AB' : Number(rawMark || 0);

    var totalMark = Number(r[7]);
    if (isNaN(totalMark) || !totalMark) {
      var fmObj = fullMarkMap[cls + "_" + subj.toLowerCase()];
      if (fmObj && fmObj[exam]) {
        totalMark = fmObj[exam];
      } else {
        totalMark = (exam.indexOf("3rd") !== -1) ? 100 : 50;
      }
    }

    marks.push({
      class: cls,
      roll: Number(r[2] || r[1]),
      studentName: String(r[3] || r[2]),
      examName: exam,
      subjectName: subj,
      markObtain: markNum,
      totalMark: totalMark
    });
  }

  if (page && limit && page > 0 && limit > 0) {
    var startIdx = (page - 1) * limit;
    return marks.slice(startIdx, startIdx + limit);
  }

  return marks;
}

// 2. Save Student Row (Updates existing row if Class + Roll matches)
function saveStudentRow(ss, student) {
  if (!student) return;

  var stSheet = ss.getSheetByName("Students");
  var feeSheet = ss.getSheetByName("Fee");
  var schoolSettings = readSchoolSettings(ss);

  var normClass = normalizeClassName(student.class);
  var rollNum = Number(student.roll);
  var vehName = student.vehicle || 'No';
  var isVehYes = (vehName && vehName !== 'No') ? 'Yes' : 'No';

  if (stSheet) {
    var stData = stSheet.getDataRange().getValues();
    var foundIndex = -1;
    for (var i = 1; i < stData.length; i++) {
      if (normalizeClassName(stData[i][2]) === normClass && Number(stData[i][1]) === rollNum) {
        foundIndex = i + 1;
        break;
      }
    }

    var processedPhotoUrl = savePhotoToDrive(student.photo, student.name);

    var stRowValues = [
      foundIndex > 0 ? foundIndex - 1 : (stSheet.getLastRow() > 0 ? stSheet.getLastRow() : 1),
      rollNum,
      normClass,
      student.name,
      student.fatherName || '',
      student.phone || '',
      student.address || '',
      processedPhotoUrl || '',
      student.govtSchoolName || '',
      student.status || 'Active',
      isVehYes,
      vehName
    ];

    if (foundIndex > 0) {
      stSheet.getRange(foundIndex, 1, 1, stRowValues.length).setValues([stRowValues]);
    } else {
      stSheet.appendRow(stRowValues);
    }
  }

  if (feeSheet) {
    var feeData = feeSheet.getDataRange().getValues();
    var feeFoundIndex = -1;
    for (var f = 1; f < feeData.length; f++) {
      if (normalizeClassName(feeData[f][1]) === normClass && Number(feeData[f][2]) === rollNum) {
        feeFoundIndex = f + 1;
        break;
      }
    }

    var mFee = (student.monthlyFee !== undefined && student.monthlyFee !== null) ? Number(student.monthlyFee) : schoolSettings.defaultMonthlyFee;

    var feeRowValues = [
      feeFoundIndex > 0 ? feeFoundIndex - 1 : (feeSheet.getLastRow() > 0 ? feeSheet.getLastRow() : 1),
      normClass,
      rollNum,
      student.name,
      student.fatherName || '',
      mFee,
      student.january || 'Due', student.february || 'Due', student.march || 'Due',
      student.april || 'Due', student.may || 'Due', student.june || 'Due',
      student.july || 'Due', student.august || 'Due', student.september || 'Due',
      student.october || 'Due', student.november || 'Due', student.december || 'Due',
      student.totalCollection || 0,
      student.lastReceiptNo || ''
    ];

    if (feeFoundIndex > 0) {
      feeSheet.getRange(feeFoundIndex, 1, 1, feeRowValues.length).setValues([feeRowValues]);
    } else {
      feeSheet.appendRow(feeRowValues);
    }
  }
}

// 3. Duplicate Marks Prevention
function saveMarksRows(ss, marks) {
  if (!marks || !Array.isArray(marks) || marks.length === 0) return;
  var sheet = ss.getSheetByName("Result");
  if (!sheet) return;

  var existingData = sheet.getDataRange().getValues();

  for (var m = 0; m < marks.length; m++) {
    var mk = marks[m];
    var normClass = normalizeClassName(mk.class);
    var rollNum = Number(mk.roll);
    var examName = String(mk.examName || '').trim();
    var subjectName = String(mk.subjectName || '').trim();
    var markVal = (mk.markObtain === 'AB' || String(mk.markObtain).toUpperCase() === 'AB') ? 'AB' : Number(mk.markObtain || 0);
    var totalM = Number(mk.totalMark || 100);

    var foundRowIndex = -1;
    for (var i = 1; i < existingData.length; i++) {
      var r = existingData[i];
      if (normalizeClassName(r[1]) === normClass &&
          Number(r[2]) === rollNum &&
          String(r[4] || '').trim().toLowerCase() === examName.toLowerCase() &&
          String(r[5] || '').trim().toLowerCase() === subjectName.toLowerCase()) {
        foundRowIndex = i + 1;
        break;
      }
    }

    var rowVals = [
      foundRowIndex > 0 ? foundRowIndex - 1 : (sheet.getLastRow() > 0 ? sheet.getLastRow() : 1),
      normClass,
      rollNum,
      mk.studentName || '',
      examName,
      subjectName,
      markVal,
      totalM
    ];

    if (foundRowIndex > 0) {
      sheet.getRange(foundRowIndex, 1, 1, rowVals.length).setValues([rowVals]);
    } else {
      sheet.appendRow(rowVals);
      existingData.push([existingData.length, normClass, rollNum, mk.studentName, examName, subjectName, markVal, totalM]);
    }
  }
}

// 4. Duplicate Attendance Prevention
function saveAttendanceRows(ss, attendanceList) {
  if (!attendanceList || !Array.isArray(attendanceList) || attendanceList.length === 0) return;
  var sheet = ss.getSheetByName("Attendance");
  if (!sheet) return;

  var existingData = sheet.getDataRange().getValues();

  for (var a = 0; a < attendanceList.length; a++) {
    var att = attendanceList[a];
    var attDate = att.date || new Date().toISOString().split('T')[0];
    var normClass = normalizeClassName(att.class);
    var rollNum = Number(att.roll);

    var foundRowIndex = -1;
    for (var i = 1; i < existingData.length; i++) {
      var r = existingData[i];
      var rDate = (r[1] instanceof Date) ? Utilities.formatDate(r[1], Session.getScriptTimeZone() || "GMT+6", "yyyy-MM-dd") : String(r[1]).split('T')[0];
      if (rDate === attDate && normalizeClassName(r[2]) === normClass && Number(r[3]) === rollNum) {
        foundRowIndex = i + 1;
        break;
      }
    }

    var rowVals = [
      foundRowIndex > 0 ? foundRowIndex - 1 : (sheet.getLastRow() > 0 ? sheet.getLastRow() : 1),
      attDate,
      normClass,
      rollNum,
      att.studentName || '',
      att.status || 'Present',
      att.remarks || ''
    ];

    if (foundRowIndex > 0) {
      sheet.getRange(foundRowIndex, 1, 1, rowVals.length).setValues([rowVals]);
    } else {
      sheet.appendRow(rowVals);
      existingData.push([existingData.length, attDate, normClass, rollNum, att.studentName, att.status, att.remarks]);
    }
  }
}

function readTeachers(ss, page, limit) {
  var sheet = ss.getSheetByName("Teacher");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var teachers = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[1]) continue;

    var assignedClsStr = String(r[4] || '');
    var assignedCls = assignedClsStr ? assignedClsStr.split(',').map(function(c){ return c.trim(); }).filter(Boolean) : [];

    var assignedSubjStr = String(r[5] || '');
    var assignedSubj = [];
    if (assignedSubjStr) {
      var parts = assignedSubjStr.split(',');
      for (var p = 0; p < parts.length; p++) {
        var pair = parts[p].split(':');
        if (pair.length >= 2) {
          assignedSubj.push({ class: pair[0].trim(), subject: pair[1].trim() });
        } else if (pair.length === 1 && pair[0].trim()) {
          assignedSubj.push({ class: 'NURSERY', subject: pair[0].trim() });
        }
      }
    }

    teachers.push({
      id: "tch-" + i,
      teacherId: String(r[0] || ("TCH-" + (100 + i))),
      name: String(r[1]),
      designation: String(r[2] || 'Assistant Teacher (সহকারী শিক্ষক)'),
      phone: String(r[3] || ''),
      assignedClasses: assignedCls,
      assignedSubjects: assignedSubj,
      status: String(r[6] || 'Active')
    });
  }

  if (page && limit && page > 0 && limit > 0) {
    var startIdx = (page - 1) * limit;
    return teachers.slice(startIdx, startIdx + limit);
  }

  return teachers;
}

function saveTeacherRow(ss, teacher) {
  if (!teacher) return;
  var sheet = ss.getSheetByName("Teacher");
  if (!sheet) {
    setupDatabaseTabs();
    sheet = ss.getSheetByName("Teacher");
  }

  var data = sheet.getDataRange().getValues();
  var foundIndex = -1;
  var targetTeacherId = teacher.teacherId || teacher.id || "";
  var targetName = teacher.name || "";

  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][0]).trim();
    var rowName = String(data[i][1]).trim();
    if ((targetTeacherId && rowId === String(targetTeacherId).trim()) || (targetName && rowName.toLowerCase() === String(targetName).trim().toLowerCase())) {
      foundIndex = i + 1;
      break;
    }
  }

  var clsStr = (teacher.assignedClasses && Array.isArray(teacher.assignedClasses)) ? teacher.assignedClasses.join(', ') : '';
  var subjStr = (teacher.assignedSubjects && Array.isArray(teacher.assignedSubjects))
    ? teacher.assignedSubjects.map(function(s){ return (s.class || '') + ':' + (s.subject || ''); }).join(', ')
    : '';

  var rowVals = [
    targetTeacherId || ("TCH-" + (foundIndex > 0 ? (foundIndex - 1) : (sheet.getLastRow() > 0 ? sheet.getLastRow() : 1))),
    teacher.name || '',
    teacher.designation || 'Assistant Teacher (সহকারী শিক্ষক)',
    teacher.phone || '',
    clsStr,
    subjStr,
    teacher.status || 'Active'
  ];

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
  }
}

function deleteTeacherRow(ss, teacherId, name) {
  var sheet = ss.getSheetByName("Teacher");
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var tIdStr = teacherId ? String(teacherId).trim() : "";
  var nameStr = name ? String(name).trim() : "";

  for (var i = data.length - 1; i >= 1; i--) {
    var rowId = String(data[i][0]).trim();
    var rowName = String(data[i][1]).trim();
    if ((tIdStr && rowId === tIdStr) || (nameStr && rowName.toLowerCase() === nameStr.toLowerCase())) {
      sheet.deleteRow(i + 1);
    }
  }
}

// 19. Teacher Sync Optimization
function syncTeachersRows(ss, teacherList) {
  if (!teacherList || !Array.isArray(teacherList)) return;
  for (var i = 0; i < teacherList.length; i++) {
    saveTeacherRow(ss, teacherList[i]);
  }
}

// 5. Save Fee Transaction & Duplicate Receipt Prevention
function saveFeeTransactionRow(ss, txn) {
  if (!txn) return;
  var sheet = ss.getSheetByName("FeeTransaction");
  if (!sheet) {
    setupDatabaseTabs();
    sheet = ss.getSheetByName("FeeTransaction");
  }

  var receiptNo = String(txn.receiptNo || ('REC-' + Date.now())).trim();
  var existingData = sheet.getDataRange().getValues();
  var foundIndex = -1;

  for (var i = 1; i < existingData.length; i++) {
    if (String(existingData[i][0]).trim() === receiptNo) {
      foundIndex = i + 1;
      break;
    }
  }

  var paidMonthsStr = Array.isArray(txn.paidMonths) ? txn.paidMonths.join(', ') : String(txn.paidMonths || '');

  var rowVals = [
    receiptNo,
    txn.date || new Date().toISOString().split('T')[0],
    normalizeClassName(txn.class),
    Number(txn.roll),
    txn.studentName || '',
    paidMonthsStr,
    Number(txn.amount || 0),
    txn.paymentMode || 'Cash'
  ];

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
  }
}

// 20. Fee Receipt Sync Optimization
function syncFeeReceiptsRows(ss, receiptList) {
  if (!receiptList || !Array.isArray(receiptList)) return;
  for (var i = 0; i < receiptList.length; i++) {
    saveFeeTransactionRow(ss, receiptList[i]);
  }
}

function readExpenses(ss, page, limit) {
  var sheet = ss.getSheetByName("daybook");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var expenses = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var typeStr = String(r[2] || '').trim().toUpperCase();
    if (typeStr === 'EXPENSE' || typeStr === 'EXPENSES') {
      expenses.push({
        id: "exp-" + i,
        voucherNo: String(r[7] || ("V-" + (100 + i))),
        date: String(r[1] || new Date().toISOString().split('T')[0]),
        title: String(r[5] || ''),
        category: String(r[3] || 'General'),
        paymentMode: String(r[6] || 'Cash'),
        amount: Number(r[4] || 0)
      });
    }
  }

  if (page && limit && page > 0 && limit > 0) {
    var startIdx = (page - 1) * limit;
    return expenses.slice(startIdx, startIdx + limit);
  }

  return expenses;
}

function saveExpenseRow(ss, exp) {
  if (!exp) return;
  var dbEntry = {
    date: exp.date || new Date().toISOString().split('T')[0],
    type: 'Expense',
    category: exp.category || 'General',
    amount: Number(exp.amount || 0),
    description: exp.title || exp.description || '',
    paymentMethod: exp.paymentMode || exp.paymentMethod || 'Cash',
    receiptNo: exp.voucherNo || exp.receiptNo || ('V-' + Date.now())
  };
  saveDaybookRow(ss, dbEntry);
}

// 21. Expense Sync Optimization
function syncExpensesRows(ss, expList) {
  if (!expList || !Array.isArray(expList)) return;
  for (var i = 0; i < expList.length; i++) {
    saveExpenseRow(ss, expList[i]);
  }
}

// 1. Daybook Column Mapping Fix & Read
function readDaybook(ss, page, limit) {
  var sheet = ss.getSheetByName("daybook");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var entries = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[1] && !r[4] && !r[7]) continue;
    entries.push({
      id: "db-" + i,
      sl: Number(r[0] || i),
      date: String(r[1] || new Date().toISOString().split('T')[0]),
      type: String(r[2] || 'INCOME'),
      category: String(r[3] || 'General'),
      amount: Number(r[4] || 0),
      description: String(r[5] || ''),
      paymentMethod: String(r[6] || 'Cash'),
      receiptNo: String(r[7] || '')
    });
  }

  if (page && limit && page > 0 && limit > 0) {
    var startIdx = (page - 1) * limit;
    return entries.slice(startIdx, startIdx + limit);
  }

  return entries;
}

// 1. Save Daybook Row (Correct 8 Column Mapping)
function saveDaybookRow(ss, dbEntry) {
  if (!dbEntry) return;
  var sheet = ss.getSheetByName("daybook");
  if (!sheet) {
    setupDatabaseTabs();
    sheet = ss.getSheetByName("daybook");
  }

  var data = sheet.getDataRange().getValues();
  var receiptNo = String(dbEntry.receiptNo || '').trim();
  var foundIndex = -1;

  if (receiptNo) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][7] || '').trim() === receiptNo) {
        foundIndex = i + 1;
        break;
      }
    }
  }

  var slNo = foundIndex > 0 ? Number(data[foundIndex - 1][0] || (foundIndex - 1)) : (sheet.getLastRow() > 0 ? sheet.getLastRow() : 1);

  var rowVals = [
    slNo,
    dbEntry.date || new Date().toISOString().split('T')[0],
    dbEntry.type || 'INCOME',
    dbEntry.category || 'General',
    Number(dbEntry.amount || 0),
    dbEntry.description || '',
    dbEntry.paymentMethod || 'Cash',
    receiptNo
  ];

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
  }
}

// 22. Daybook Sync Optimization
function syncDaybookRows(ss, dbList) {
  if (!dbList || !Array.isArray(dbList)) return;
  for (var i = 0; i < dbList.length; i++) {
    saveDaybookRow(ss, dbList[i]);
  }
}

function readFeeReceipts(ss, page, limit) {
  var sheet = ss.getSheetByName("FeeTransaction");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var receipts = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[4]) continue;
    var monthsArr = String(r[5] || '').split(',').map(function(m){ return m.trim(); }).filter(Boolean);
    receipts.push({
      id: "rec-" + i,
      receiptNo: String(r[0]),
      date: String(r[1] || new Date().toISOString().split('T')[0]),
      studentClass: normalizeClassName(r[2]),
      roll: Number(r[3] || 1),
      studentName: String(r[4] || ''),
      months: monthsArr,
      amount: Number(r[6] || 0),
      paymentMode: String(r[7] || 'Cash')
    });
  }

  if (page && limit && page > 0 && limit > 0) {
    var startIdx = (page - 1) * limit;
    return receipts.slice(startIdx, startIdx + limit);
  }

  return receipts;
}

function readRoutine(ss) {
  var sheet = ss.getSheetByName("Routine");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var routines = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[1] && !r[5]) continue;
    routines.push({
      id: "rt-" + i,
      class: normalizeClassName(r[1]),
      day: String(r[2] || 'Monday'),
      period: String(r[3] || 'Period 1'),
      time: String(r[4] || ''),
      timeSlot: String(r[4] || ''),
      subject: String(r[5] || ''),
      teacher: String(r[6] || '')
    });
  }
  return routines;
}

// 18. Routine Optimization
function saveRoutineRows(ss, routineList) {
  if (!routineList || !Array.isArray(routineList) || routineList.length === 0) return;
  var sheet = ss.getSheetByName("Routine");
  if (!sheet) {
    setupDatabaseTabs();
    sheet = ss.getSheetByName("Routine");
  }

  var existingData = sheet.getDataRange().getValues();

  for (var r = 0; r < routineList.length; r++) {
    var rt = routineList[r];
    var normClass = normalizeClassName(rt.class);
    var day = String(rt.day || 'Monday').trim();
    var period = String(rt.period || 'Period 1').trim();

    var foundRowIndex = -1;
    for (var i = 1; i < existingData.length; i++) {
      var er = existingData[i];
      if (normalizeClassName(er[1]) === normClass &&
          String(er[2] || '').trim().toLowerCase() === day.toLowerCase() &&
          String(er[3] || '').trim().toLowerCase() === period.toLowerCase()) {
        foundRowIndex = i + 1;
        break;
      }
    }

    var rowVals = [
      foundRowIndex > 0 ? foundRowIndex - 1 : (sheet.getLastRow() > 0 ? sheet.getLastRow() : 1),
      normClass,
      day,
      period,
      rt.time || rt.timeSlot || '',
      rt.subject || '',
      rt.teacher || '',
      new Date().toISOString()
    ];

    if (foundRowIndex > 0) {
      sheet.getRange(foundRowIndex, 1, 1, rowVals.length).setValues([rowVals]);
    } else {
      sheet.appendRow(rowVals);
      existingData.push([existingData.length, normClass, day, period, rt.time || rt.timeSlot || '', rt.subject || '', rt.teacher || '']);
    }
  }
}

function deleteStudentRow(ss, className, roll) {
  var normClass = normalizeClassName(className);
  var rollNum = Number(roll);

  var stSheet = ss.getSheetByName("Students");
  if (stSheet) {
    var sData = stSheet.getDataRange().getValues();
    for (var i = sData.length - 1; i >= 1; i--) {
      if (normalizeClassName(sData[i][2]) === normClass && Number(sData[i][1]) === rollNum) {
        stSheet.deleteRow(i + 1);
      }
    }
  }

  var feeSheet = ss.getSheetByName("Fee");
  if (feeSheet) {
    var fData = feeSheet.getDataRange().getValues();
    for (var j = fData.length - 1; j >= 1; j--) {
      if (normalizeClassName(fData[j][1]) === normClass && Number(fData[j][2]) === rollNum) {
        feeSheet.deleteRow(j + 1);
      }
    }
  }
}
`;

