export type PrintDocType = 'marksheet' | 'idcard' | 'admit' | 'dailyCollection' | 'general';
export type PageSize = 'A4' | 'A5';
export type PageOrientation = 'portrait' | 'landscape';

export type MarksheetStyle = 'styleA' | 'styleB' | 'styleC' | 'styleD';
export type MarksheetColor = 'emerald' | 'navy' | 'maroon' | 'charcoal';

export interface DocPrintConfig {
  size: PageSize;
  orientation: PageOrientation;
}

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface UserSession {
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  username: string;
  name: string;
  phone?: string;
  studentClass?: string;
  studentRoll?: number;
}

export interface ClassConfig {
  name: string;
  sections: string[];
  order: number;
}

export interface School {
  schoolId: string;
  name: string;
  nameBengali?: string;
  bengaliName?: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  tagline?: string;
  logo?: string;
  signature?: string;
  headmasterSignature?: string;
  regNo?: string;
  registrationNo?: string;
  headmasterName?: string;
  designation?: string;
  defaultMarksheetTemplate?: string;
  defaultAdmitCardTemplate?: string;
  webAppUrl?: string;
  spreadsheetId?: string;
  status?: 'ONLINE' | 'OFFLINE' | 'SYNCING';
  totalStudents?: number;
  totalTeachers?: number;
  currentAcademicYear?: string;
  classConfig?: ClassConfig[];
  active?: boolean;
  saasStatus?: 'Active' | 'Trial' | 'Suspended';
  adminKey?: string;
  versionKey?: string;
  adminId?: string;
  readsCount?: number;
  writesCount?: number;
  deletesCount?: number;
  storageMB?: number;
  lastActivityAt?: string;
  searchKeys?: string[];
}

export interface Student {
  studentId?: string;
  class: string;
  section?: string;
  roll: number;
  name: string;
  fatherName: string;
  govtSchoolName?: string;
  gender: string;
  address: string;
  phone: string;
  monthlyFee: number;
  dob?: string;
  bloodGroup?: string;
  photo?: string;
  status: 'Active' | 'Inactive' | string;
  vehicle?: string;
  vehicleRoute?: string;
  january?: string;
  february?: string;
  march?: string;
  april?: string;
  may?: string;
  june?: string;
  july?: string;
  august?: string;
  september?: string;
  october?: string;
  november?: string;
  december?: string;
  totalCollection?: number;
  lastReceiptNo?: string;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface ExamMark {
  class: string;
  section?: string;
  roll: number;
  studentName: string;
  examName: string;
  subjectName: string;
  markObtain: number;
  totalMark: number;
  grade?: string;
  remarks?: string;
  date?: string;
  rank?: number;
  academicYear?: string;
}

export interface FeeTotalsDoc {
  totalThisMonth: number;
  totalThisYear: number;
  totalAllTime: number;
  currentMonth: string;
  currentYear: string;
  lastUpdated?: string;
}

export interface AttendanceDoc {
  date: string;
  classId: string;
  records: Record<string, 'Present' | 'Absent'>;
  takenBy?: string;
  takenAt?: string;
}

export interface DaybookEntry {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  paymentMethod: string;
  receiptNo?: string;
  linkedReceiptId?: string;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface TeacherAssignedSubject {
  class: string;
  subject: string;
}

export interface Teacher {
  id: string;
  teacherId?: string;
  schoolId?: string;
  password?: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  qualification: string;
  assignedClasses?: string[];
  assignedSubjects: TeacherAssignedSubject[];
  photo?: string;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  date: string;
  targetGroup: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category?: string;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface SyllabusItem {
  id: string;
  class: string;
  subject: string;
  title: string;
  fileUrl?: string;
  updatedDate: string;
}

export interface RoutineSettings {
  totalPeriods: number; // e.g. 5, 6, 7, 8
  periodDurationMins: number; // e.g. 40, 45
  startTime: string; // e.g. "10:00"
  tiffinAfterPeriod: number; // e.g. 3 or 4
  tiffinDurationMins: number; // e.g. 30
  tiffinTimeLabel?: string;
}

export interface RoutineEntry {
  id: string;
  class: string;
  day: string;
  period: number | string;
  subject: string;
  teacher: string;
  time?: string;
  timeSlot?: string;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface VehicleConfig {
  id: string;
  vehicleName: string;
  phone: string;
  route: string;
  vehicleNo?: string;
  busNo?: string;
  seats?: number;
  driverName?: string;
  driverPhone?: string;
  monthlyCharge?: number;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface ExpenseItem {
  id: string;
  voucherNo: string;
  date: string;
  title: string;
  category: string;
  paymentMode: string;
  amount: number;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface FeeReceipt {
  id: string;
  receiptNo: string;
  date: string;
  studentName: string;
  studentClass: string;
  studentSection?: string;
  roll: number;
  fatherName: string;
  months: string[];
  amount: number;
  paymentMode: string;
  academicYear?: string;
  isActive?: boolean;
  deactivatedAt?: string;
}

export interface DataBackupSnapshot {
  id: string;
  timestamp: string;
  formattedTime: string;
  actionReason: string;
  studentCount: number;
  markCount: number;
  students: Student[];
  marks: ExamMark[];
}

export interface AutoBackupRecord {
  sl: number;
  timestamp: string;
  fileName: string;
  fileSize: string;
  downloadUrl: string;
  fileId: string;
  status: string;
}
