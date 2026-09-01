import { School, Student } from '../types';

/**
 * Bengali consonant / vowel to English initial phonetic mapping
 */
const BENGALI_INITIAL_MAP: Record<string, string> = {
  'অ': 'A', 'আ': 'A', 'ই': 'I', 'ঈ': 'I', 'উ': 'U', 'ঊ': 'U', 'ঋ': 'R', 'এ': 'E', 'ঐ': 'AI', 'ও': 'O', 'ঔ': 'AU',
  'ক': 'K', 'খ': 'KH', 'গ': 'G', 'ঘ': 'GH', 'ঙ': 'N',
  'চ': 'C', 'ছ': 'CH', 'জ': 'J', 'ঝ': 'JH', 'ঞ': 'N',
  'ট': 'T', 'ঠ': 'TH', 'ড': 'D', 'ঢ': 'DH', 'ণ': 'N',
  'ত': 'T', 'থ': 'TH', 'দ': 'D', 'ধ': 'DH', 'ন': 'N',
  'প': 'P', 'ফ': 'F', 'ব': 'B', 'ভ': 'V', 'ম': 'M',
  'য': 'J', 'র': 'R', 'ল': 'L', 'শ': 'S', 'ষ': 'S', 'স': 'S', 'হ': 'H',
  'ড়': 'R', 'ঢ়': 'RH', 'য়': 'Y', 'ৎ': 'T'
};

/**
 * Extract School Acronym / Initials (স্কুলের নামের প্রথম অক্ষর বা কোড)
 * e.g. "নব সৃষ্টি বিদ্যা নিকেতন" -> "NSVN"
 * e.g. "Holy Child Mission" -> "HCM"
 * e.g. "ABC High School" -> "AHS" / "ABC"
 */
export function getSchoolInitials(school?: Partial<School>): string {
  if (!school) return 'SCH';

  // 1. If school.code is defined and valid (e.g. "NSVN", "NS", "ABC", "HCMS")
  if (school.code && school.code.trim()) {
    const cleanCode = school.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length >= 2) return cleanCode;
  }

  const rawName = school.name || school.nameBengali || school.schoolId || '';
  if (!rawName.trim()) return 'SCH';

  // 2. Check if name contains English letters
  const hasEnglish = /[a-zA-Z]/.test(rawName);
  if (hasEnglish) {
    const englishWords = rawName
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0 && !/^(and|of|the|in|for)$/i.test(w));
    
    if (englishWords.length > 1) {
      return englishWords.map(w => w[0].toUpperCase()).join('').slice(0, 6);
    }
    if (englishWords.length === 1) {
      const single = englishWords[0].toUpperCase();
      return single.length <= 4 ? single : single.slice(0, 4);
    }
  }

  // 3. Check for Bengali words
  const words = rawName.split(/\s+/).filter(w => w.trim().length > 0);
  const initials: string[] = [];

  for (const word of words) {
    for (const char of word) {
      if (BENGALI_INITIAL_MAP[char]) {
        initials.push(BENGALI_INITIAL_MAP[char]);
        break;
      } else if (/[a-zA-Z0-9]/.test(char)) {
        initials.push(char.toUpperCase());
        break;
      }
    }
  }

  if (initials.length > 0) {
    return initials.join('').slice(0, 6);
  }

  // 4. Fallback from schoolId
  const fallback = (school.schoolId || 'SCH').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return fallback.slice(0, 5) || 'SCH';
}

/**
 * Get selected Academic Year from School Settings (শিক্ষাবর্ষ)
 * e.g. "2026" or "2025-2026"
 */
export function getAcademicYear(school?: Partial<School>): string {
  if (school?.currentAcademicYear && school.currentAcademicYear.trim()) {
    return school.currentAcademicYear.trim();
  }
  return String(new Date().getFullYear());
}

/**
 * Normalize Class name for standardized Student ID
 * e.g. "Class I" -> "I", "Class V" -> "V", "Nursery" -> "NUR", "Class 10" -> "10"
 */
export function getNormalizedClassCode(className?: string): string {
  if (!className) return 'C';
  const c = className.trim();

  // Roman Numerals
  const romanMatch = c.match(/^(?:class\s*)?(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)$/i);
  if (romanMatch) return romanMatch[1].toUpperCase();

  // Arabic Numerals (1 to 12)
  const numMatch = c.match(/^(?:class\s*)?(\d{1,2})$/i);
  if (numMatch) return numMatch[1];

  // Common pre-primary classes
  const lower = c.toLowerCase();
  if (lower.includes('nur') || lower.includes('নার্সারি')) return 'NUR';
  if (lower.includes('play') || lower.includes('প্লে') || lower.includes('pg')) return 'PLAY';
  if (lower.includes('lkg') || lower.includes('এলকেজি')) return 'LKG';
  if (lower.includes('ukg') || lower.includes('ইউকেজি')) return 'UKG';
  if (lower.includes('kg') || lower.includes('কেজি')) return 'KG';

  // Bengali numbers
  const bnNumMap: Record<string, string> = {
    '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5',
    '৬': '6', '৭': '7', '৮': '8', '৯': '9', '১০': '10', '১১': '11', '১২': '12',
    '১ম': '1', '২য়': '2', '৩য়': '3', '৪র্থ': '4', '৫ম': '5',
    '৬ষ্ঠ': '6', '৭ম': '7', '৮ম': '8', '৯ম': '9', '১০ম': '10',
    'প্রথম': 'I', 'দ্বিতীয়': 'II', 'তৃতীয়': 'III', 'চতুর্থ': 'IV', 'পঞ্চম': 'V',
    'ষষ্ঠ': 'VI', 'সপ্তম': 'VII', 'অষ্টম': 'VIII', 'নবম': 'IX', 'দশম': 'X'
  };
  for (const [bn, code] of Object.entries(bnNumMap)) {
    if (c.includes(bn)) return code;
  }

  // Strip 'Class ' and special characters
  const clean = c.replace(/^class\s*/i, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.slice(0, 4) || 'C';
}

/**
 * Format Student Roll (রোল)
 * Pads single-digit rolls to 2 digits (e.g. 1 -> "01", 12 -> "12")
 */
export function getFormattedRoll(roll?: number | string): string {
  const r = Number(roll) || 1;
  return String(r).padStart(2, '0');
}

/**
 * Universal Standard Student ID Generator (স্বয়ংক্রিয় স্টুডেন্ট আইডি জেনারেটর)
 * Format: [স্কুলের নামের প্রথম অক্ষর]-[শিক্ষাবর্ষ]-[ক্লাস]-[রোল]
 * Example: NSVN-2026-I-01, HCM-2025-V-15, ABC-2026-NUR-05
 */
export function generateStandardStudentId(
  school?: Partial<School> | null, 
  student?: Partial<Student> | null
): string {
  const schoolInitials = getSchoolInitials(school || undefined);
  const year = getAcademicYear(school || undefined);
  const classCode = getNormalizedClassCode(student?.class);
  const roll = getFormattedRoll(student?.roll);

  return `${schoolInitials}-${year}-${classCode}-${roll}`;
}
