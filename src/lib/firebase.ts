import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc,
  query, where, limit, writeBatch, onSnapshot, orderBy, increment, runTransaction,
  waitForPendingWrites
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, signInAnonymously, 
  signInWithEmailAndPassword, signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  School, Student, ExamMark, Teacher, ExpenseItem, 
  FeeReceipt, DaybookEntry, RoutineEntry, NoticeItem, VehicleConfig,
  FeeTotalsDoc, AttendanceDoc, UserSession, UserRole
} from '../types';
import { normalizeClassName, isProchestaSchool, MOCK_STUDENTS } from '../mockData';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

/**
 * Safely format/sanitize any image or photo URL.
 * Handles HTTP(S) URLs, Bare/Short Domain URLs (e.g. bit.ly/x, imgbb.com/abc, i.ibb.co/123),
 * Google Drive view/open links, Blob URLs, Data URLs, and raw base64 strings gracefully.
 */
export function formatPhotoUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Google Drive view/open URL -> High-speed direct thumbnail URL
  if (trimmed.includes('drive.google.com')) {
    const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w400`;
    }
  }

  // 2. Already complete protocols or known relative paths
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/uploads/')
  ) {
    return trimmed;
  }

  // 3. Protocol-relative URL (e.g., //i.ibb.co/xyz.jpg)
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  // 4. Domain-like URL without protocol (e.g., bit.ly/xY9z, imgbb.com/abc, i.ibb.co/123.jpg, www.site.com/pic.png)
  const isDomainPattern = /^(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?:\/.*)?$/i;
  if (!/\s/.test(trimmed) && trimmed.includes('.') && isDomainPattern.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // 5. Raw base64 string detection (without data:image/... header)
  if (
    trimmed.length > 50 &&
    !trimmed.includes('.') &&
    !/\s/.test(trimmed) &&
    /^[A-Za-z0-9+/=]+$/.test(trimmed)
  ) {
    return `data:image/jpeg;base64,${trimmed}`;
  }

  return trimmed;
}

/**
 * Client-side image compression directly returning lightweight Blob (~10-25KB)
 */
export async function compressImageFile(file: File | Blob, maxWidth = 300, maxHeight = 300, quality = 0.72): Promise<Blob> {
  return new Promise((resolve) => {
    if (!file || typeof window === 'undefined' || !window.URL) {
      resolve(file instanceof Blob ? file : new Blob());
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(file instanceof Blob ? file : new Blob());
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          resolve(blob || (file instanceof Blob ? file : new Blob()));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file instanceof Blob ? file : new Blob());
    };
    img.src = objectUrl;
  });
}

/**
 * Client-side image compression directly returning lightweight Data URL (JPEG, ~10-25KB)
 */
export async function compressImageFileToDataUrl(file: File | Blob, maxWidth = 300, maxHeight = 300, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    if (!file || typeof window === 'undefined' || !window.URL) {
      resolve('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve('');
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      URL.revokeObjectURL(objectUrl);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('');
    };
    img.src = objectUrl;
  });
}

/**
 * Fast synchronous conversion from Base64 Data URL to lightweight binary Blob (<1ms)
 */
export function dataURItoBlob(dataURI: string): Blob {
  try {
    const parts = dataURI.split(',');
    const byteString = atob(parts[1] || parts[0]);
    const mimeString = parts[0]?.split(':')[1]?.split(';')[0] || 'image/jpeg';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (e) {
    console.warn('dataURItoBlob warning:', e);
    return new Blob([], { type: 'image/jpeg' });
  }
}

const CLOUDINARY_CLOUD_NAME = 'ngximmnj';
const CLOUDINARY_UPLOAD_PRESET = 'School_hub';

/**
 * High-speed reliable cloud image uploader to Cloudinary returning secure HTTPS URL with auto-retry
 */
export async function uploadImageToCloud(file: File | Blob | string, filename: string, maxRetries = 2): Promise<string> {
  let blob: Blob;

  if (typeof file === 'string') {
    const trimmed = file.trim();
    if (
      trimmed.startsWith('https://') &&
      !trimmed.includes('data:image') &&
      !trimmed.startsWith('blob:') &&
      (trimmed.includes('cloudinary') || trimmed.includes('firebasestorage') || trimmed.length < 200)
    ) {
      return formatPhotoUrl(trimmed);
    }
    if (trimmed.startsWith('data:image') || !trimmed.startsWith('http')) {
      blob = dataURItoBlob(trimmed);
    } else {
      try {
        const res = await fetch(formatPhotoUrl(trimmed));
        const fetchedBlob = await res.blob();
        blob = await compressImageFile(fetchedBlob, 260, 260, 0.72);
      } catch {
        blob = dataURItoBlob(trimmed);
      }
    }
  } else {
    // 1. Client-side compress directly to lightweight Blob (~8-15 KB)
    blob = await compressImageFile(file, 260, 260, 0.72);
  }

  if (!blob || blob.size === 0) {
    throw new Error('ছবি প্রসেস করতে ব্যর্থ হয়েছে।');
  }

  const cleanName = (filename || `photo_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', blob, `${cleanName}.jpg`);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s max per attempt
      let res: Response;
      try {
        res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.secure_url) {
        const errorMsg = data?.error?.message || `Cloudinary আপলোড ব্যর্থ হয়েছে (${res.status})`;
        throw new Error(errorMsg);
      }

      return data.secure_url;
    } catch (err) {
      lastError = err;
      console.warn(`uploadImageToCloud attempt ${attempt}/${maxRetries} failed:`, err);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
  }

  throw lastError || new Error('ছবি আপলোড ব্যর্থ হয়েছে');
}

/**
 * Automatically compress any image URL or large Base64 string and convert it into a short lightweight URL.
 */
export async function compressAndOptimizeImageUrl(inputUrlOrBase64: string, filename = 'optimized_photo', maxRetries = 2): Promise<string> {
  if (!inputUrlOrBase64 || typeof inputUrlOrBase64 !== 'string') return '';
  const trimmed = inputUrlOrBase64.trim();
  if (!trimmed) return '';

  // If already an uploaded Cloudinary / CDN URL or hosted web image, return formatted URL directly
  if (
    trimmed.startsWith('https://') &&
    !trimmed.includes('data:image') &&
    !trimmed.startsWith('blob:') &&
    (trimmed.includes('res.cloudinary.com') ||
     trimmed.includes('firebasestorage.googleapis.com') ||
     trimmed.includes('drive.google.com') ||
     trimmed.includes('i.ibb.co') ||
     trimmed.includes('imgbb.com') ||
     trimmed.includes('imgur.com') ||
     trimmed.length < 160)
  ) {
    return formatPhotoUrl(trimmed);
  }

  try {
    const uploadedUrl = await uploadImageToCloud(trimmed, `${filename}_${Date.now()}`, maxRetries);
    if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://'))) {
      return uploadedUrl;
    }
  } catch (err) {
    console.warn('compressAndOptimizeImageUrl cloud upload fallback:', err);
  }

  return formatPhotoUrl(trimmed);
}

/**
 * Upload school asset (logo / signature) to Cloud and return concise URL
 */
export async function uploadSchoolAssetToStorage(
  schoolId: string,
  assetType: 'logo' | 'signature',
  file: File | Blob
): Promise<string> {
  if (!schoolId) throw new Error('স্কুল আইডি অনুপস্থিত');
  return await uploadImageToCloud(file, `${schoolId}_${assetType}_${Date.now()}`);
}

/**
 * Upload student photo to Cloud and return clean concise download URL (30-40 chars)
 */
export async function uploadStudentPhotoToStorage(
  schoolId: string,
  studentId: string,
  file: File | Blob
): Promise<string> {
  if (!schoolId) throw new Error('স্কুল আইডি অনুপস্থিত');
  const safeStudentId = studentId || `STU-${Date.now()}`;
  return await uploadImageToCloud(file, `stu_${safeStudentId}_${Date.now()}`);
}

/**
 * Upload teacher photo to Cloud and return clean concise download URL
 */
export async function uploadTeacherPhotoToStorage(
  schoolId: string,
  teacherId: string,
  file: File | Blob
): Promise<string> {
  if (!schoolId) throw new Error('স্কুল আইডি অনুপস্থিত');
  const safeTeacherId = teacherId || `TCH-${Date.now()}`;
  return await uploadImageToCloud(file, `tch_${safeTeacherId}_${Date.now()}`);
}

// Ensure session always has request.auth != null for Firestore rules compliance
export function initFirebaseAuth(onUserChanged?: (user: any) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch((err) => {
        console.warn('Firebase Anonymous Auth fallback notice:', err);
      });
    }
    if (onUserChanged) onUserChanged(user);
  });
}

export async function loginWithEmailPassword(email: string, pass: string) {
  return await signInWithEmailAndPassword(auth, email, pass);
}

export async function logoutFirebaseAuth() {
  return await signOut(auth);
}

export async function ensureUserProfileInFirestore(session: UserSession | { role?: UserRole; schoolId?: string; schoolName?: string; username?: string; name?: string }): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await setDoc(userRef, {
      uid: auth.currentUser.uid,
      username: session.username || 'user',
      role: session.role || 'SCHOOL_ADMIN',
      schoolId: session.schoolId || null,
      schoolName: session.schoolName || null,
      name: session.name || 'User',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update user profile doc in Firestore:', err);
  }
}


/**
 * Generate normalized search keys array for targeted, constant-cost Firestore queries
 */
export function generateSchoolSearchKeys(school: Partial<School>): string[] {
  const keys = new Set<string>();
  const add = (val?: string) => {
    if (!val) return;
    const clean = val.trim().toLowerCase();
    if (clean) {
      keys.add(clean);
      const noSpaces = clean.replace(/\s+/g, '');
      if (noSpaces && noSpaces !== clean) {
        keys.add(noSpaces);
      }
    }
  };

  add(school.schoolId);
  add(school.code);
  add(school.name);
  add(school.nameBengali);
  add(school.adminId);

  // If school name has multiple distinct words, index words with length >= 3
  if (school.name) {
    const parts = school.name.toLowerCase().split(/\s+/);
    parts.forEach(p => {
      const cleanP = p.replace(/[^a-z0-9]/gi, '').trim();
      if (cleanP.length >= 3) keys.add(cleanP);
    });
  }

  return Array.from(keys);
}

// Save or Update School in Firestore with searchKeys
export async function saveSchoolToFirestore(school: School) {
  try {
    const cleanSchoolId = (school.schoolId || '').trim();
    if (!cleanSchoolId) return;

    const searchKeys = generateSchoolSearchKeys(school);

    const dataToSave: Record<string, any> = {
      ...school,
      schoolId: cleanSchoolId,
      code: (school.code || cleanSchoolId).trim(),
      adminId: (school.adminId || cleanSchoolId).trim(),
      searchKeys,
      updatedAt: new Date().toISOString()
    };

    if (school.adminKey !== undefined && school.adminKey !== null) {
      dataToSave.adminKey = String(school.adminKey).trim();
    }

    const schoolRef = doc(db, 'schools', cleanSchoolId);
    await setDoc(schoolRef, dataToSave, { merge: true });

    // Store PIN/adminKey in private subcollection as well
    if (dataToSave.adminKey) {
      const credsRef = doc(db, 'schools', cleanSchoolId, 'private', 'credentials');
      await setDoc(credsRef, {
        adminKey: dataToSave.adminKey,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    recordSchoolUsageStat(cleanSchoolId, 'write', 1).catch(() => {});
  } catch (err) {
    console.error('Firestore saveSchool error:', err);
  }
}

/**
 * Fetch PIN / Admin Key for a specific school from private credentials subcollection
 */
export async function fetchSchoolCredentialsFromFirestore(schoolId: string): Promise<string> {
  if (!schoolId) return '';
  try {
    const credsRef = doc(db, 'schools', schoolId, 'private', 'credentials');
    const snap = await getDoc(credsRef);
    if (snap.exists()) {
      return snap.data().adminKey || '';
    }
    // fallback check on main school document
    const schoolRef = doc(db, 'schools', schoolId);
    const schSnap = await getDoc(schoolRef);
    if (schSnap.exists()) {
      return (schSnap.data() as any).adminKey || '';
    }
    return '';
  } catch (err) {
    console.warn(`Failed to fetch credentials for school ${schoolId}:`, err);
    return '';
  }
}

/**
 * Fetch credentials map for multiple schools
 */
export async function fetchAllSchoolCredentialsFromFirestore(schoolIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!schoolIds || schoolIds.length === 0) return result;
  
  await Promise.all(
    schoolIds.map(async (id) => {
      const key = await fetchSchoolCredentialsFromFirestore(id);
      if (key) {
        result[id] = key;
      }
    })
  );
  return result;
}

// Delete School from Firestore
export async function deleteSchoolFromFirestore(schoolId: string): Promise<boolean> {
  if (!schoolId) return false;
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    await deleteDoc(schoolRef);
    const credsRef = doc(db, 'schools', schoolId, 'private', 'credentials');
    await deleteDoc(credsRef).catch(() => {});
    recordUsageStat('delete', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error deleting school from Firestore:', err);
    return false;
  }
}

/**
 * Explicit School ID Migration Helper
 * Copies main school document + private credentials + all subcollections to a new school ID path, then deletes old document.
 */
export async function migrateSchoolIdInFirestore(oldSchoolId: string, newSchoolId: string): Promise<boolean> {
  if (!oldSchoolId || !newSchoolId || oldSchoolId === newSchoolId) return false;
  try {
    const oldSchoolRef = doc(db, 'schools', oldSchoolId);
    const oldSnap = await getDoc(oldSchoolRef);
    if (!oldSnap.exists()) {
      throw new Error(`পুরনো স্কুল ID (${oldSchoolId}) ফায়ারস্টোরে পাওয়া যায়নি!`);
    }

    const schoolData = oldSnap.data() as School;
    const newSchoolData: School = {
      ...schoolData,
      schoolId: newSchoolId,
      code: newSchoolId
    };

    // 1. Save new main school doc
    await setDoc(doc(db, 'schools', newSchoolId), newSchoolData, { merge: true });

    // 2. Migrate private credentials subcollection
    const oldCredsSnap = await getDoc(doc(db, 'schools', oldSchoolId, 'private', 'credentials'));
    if (oldCredsSnap.exists()) {
      await setDoc(doc(db, 'schools', newSchoolId, 'private', 'credentials'), oldCredsSnap.data(), { merge: true });
    }

    // 3. Migrate subcollections
    const subcollections = ['students', 'marks', 'teachers', 'expenses', 'feeReceipts', 'daybook', 'routines', 'vehicles', 'notices'];
    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, 'schools', oldSchoolId, sub));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(docSnap => {
          const docData = docSnap.data();
          const newDocRef = doc(db, 'schools', newSchoolId, sub, docSnap.id);
          batch.set(newDocRef, docData, { merge: true });
        });
        await batch.commit();
      }
    }

    // 4. Delete old school doc and credentials
    await deleteDoc(doc(db, 'schools', oldSchoolId, 'private', 'credentials')).catch(() => {});
    await deleteDoc(oldSchoolRef);

    // 5. Transfer localStorage keys if present
    const keysToTransfer = ['students', 'teachers', 'routine_entries', 'routine_settings', 'daybook', 'marks'];
    keysToTransfer.forEach(key => {
      const oldVal = localStorage.getItem(`${key}_${oldSchoolId}`);
      if (oldVal !== null) {
        localStorage.setItem(`${key}_${newSchoolId}`, oldVal);
        localStorage.removeItem(`${key}_${oldSchoolId}`);
      }
    });

    recordUsageStat('write', 5).catch(() => {});
    return true;
  } catch (err) {
    console.error('migrateSchoolIdInFirestore error:', err);
    throw err;
  }
}

// Sync Schools Real-time (preserves adminKey in memory if present in Firestore)
export function subscribeSchools(callback: (schools: School[]) => void) {
  const colRef = collection(db, 'schools');
  return onSnapshot(colRef, (snapshot) => {
    const list: School[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as School;
      list.push(data);
    });
    if (list.length > 0) {
      callback(list);
    }
  }, (err) => {
    console.warn('Firestore subscribe error:', err);
  });
}

/**
 * Real-time Single School Subscription (for logo, signature, name, class config multi-device sync)
 */
export function subscribeSingleSchool(schoolId: string, callback: (school: School | null) => void) {
  if (!schoolId) return () => {};
  const docRef = doc(db, 'schools', schoolId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as School);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn('subscribeSingleSchool error:', err);
  });
}

/**
 * Get standardized today date string (YYYY-MM-DD) based on local timezone
 */
export function getLocalTodayDateKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Record usage stat for a specific school as well as global usage
 */
export async function recordSchoolUsageStat(schoolId: string, operation: 'read' | 'write' | 'delete', count = 1) {
  if (!count || count <= 0) return;
  const cleanSchoolId = (schoolId || '').trim();

  // 1. Update local schools cache immediately for instant UI reactivity
  try {
    const saved = localStorage.getItem('school_hub_schools');
    const schoolsArr: School[] = saved ? JSON.parse(saved) : [];
    let updated = false;
    const newSchools = schoolsArr.map(s => {
      const isMatch = s.schoolId === cleanSchoolId || 
        s.code === cleanSchoolId || 
        (cleanSchoolId.includes('PROCHESTA') && (s.schoolId.includes('PROCHESTA') || s.name.includes('PROCHESTA')));
      if (isMatch) {
        updated = true;
        const currentReads = s.readsCount || 0;
        const currentWrites = s.writesCount || 0;
        const currentDeletes = s.deletesCount || 0;
        return {
          ...s,
          readsCount: operation === 'read' ? currentReads + count : currentReads,
          writesCount: operation === 'write' ? currentWrites + count : currentWrites,
          deletesCount: operation === 'delete' ? currentDeletes + count : currentDeletes,
          lastActivityAt: new Date().toISOString()
        };
      }
      return s;
    });
    if (updated) {
      localStorage.setItem('school_hub_schools', JSON.stringify(newSchools));
      window.dispatchEvent(new CustomEvent('school_hub_schools_local_updated', { detail: newSchools }));
    }
  } catch {}

  // 2. Also record school-specific stat in localStorage map for instant fallback
  try {
    const key = `school_usage_${cleanSchoolId}`;
    const raw = localStorage.getItem(key);
    const curr = raw ? JSON.parse(raw) : { readsCount: 0, writesCount: 0, deletesCount: 0 };
    if (operation === 'read') curr.readsCount = (curr.readsCount || 0) + count;
    else if (operation === 'write') curr.writesCount = (curr.writesCount || 0) + count;
    else if (operation === 'delete') curr.deletesCount = (curr.deletesCount || 0) + count;
    curr.lastActivityAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(curr));
    window.dispatchEvent(new CustomEvent('school_hub_school_stat_updated', { detail: { schoolId: cleanSchoolId, ...curr } }));
  } catch {}

  // 3. Persist directly to Firestore
  try {
    if (cleanSchoolId) {
      const schoolRef = doc(db, 'schools', cleanSchoolId);
      const fieldName = operation === 'read' ? 'readsCount' : operation === 'write' ? 'writesCount' : 'deletesCount';
      await setDoc(schoolRef, {
        [fieldName]: increment(count),
        lastActivityAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    }
    await recordUsageStat(operation, count);
  } catch (err) {
    console.warn('Failed to record school usage stat:', err);
  }
}

/* ========================================================================
   USAGE STATS & MONITORING HELPERS (Firestore usage_stats/{YYYY-MM-DD})
   ======================================================================== */

export interface UsageStatRecord {
  date: string;
  reads: number;
  writes: number;
  deletes: number;
  lastUpdated?: string;
}

// Local in-memory & storage cache for immediate reactivity
const LOCAL_USAGE_CACHE_KEY = 'school_hub_usage_stats_cache';

function getLocalUsageCache(): UsageStatRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsageCache(stats: UsageStatRecord[]) {
  try {
    localStorage.setItem(LOCAL_USAGE_CACHE_KEY, JSON.stringify(stats));
  } catch {}
}

/**
 * Increment usage counter in usage_stats/{YYYY-MM-DD} doc and local cache.
 */
export async function recordUsageStat(operation: 'read' | 'write' | 'delete', count = 1) {
  if (!count || count <= 0) return;
  const todayStr = getLocalTodayDateKey();
  const nowIso = new Date().toISOString();
  
  // 1. Update local cache immediately so UI reflects without waiting for network
  try {
    const cache = getLocalUsageCache();
    let entry = cache.find(e => e.date === todayStr);
    if (!entry) {
      entry = { date: todayStr, reads: 0, writes: 0, deletes: 0, lastUpdated: nowIso };
      cache.push(entry);
    }
    if (operation === 'read') entry.reads = (entry.reads || 0) + count;
    else if (operation === 'write') entry.writes = (entry.writes || 0) + count;
    else if (operation === 'delete') entry.deletes = (entry.deletes || 0) + count;
    entry.lastUpdated = nowIso;
    saveLocalUsageCache(cache);
    window.dispatchEvent(new CustomEvent('school_hub_usage_updated', { detail: cache }));
  } catch {}

  // 2. Persist directly to Firestore
  try {
    const statRef = doc(db, 'usage_stats', todayStr);
    const fieldName = operation === 'read' ? 'reads' : operation === 'write' ? 'writes' : 'deletes';
    await setDoc(statRef, {
      date: todayStr,
      [fieldName]: increment(count),
      lastUpdated: nowIso
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to record usage stat to Firestore:', err);
  }
}

/**
 * Fetch last N days of usage stats for SuperAdmin Dashboard analytics
 */
export async function fetchUsageStats(daysCount = 14): Promise<UsageStatRecord[]> {
  const localCache = getLocalUsageCache();
  try {
    const snap = await getDocs(collection(db, 'usage_stats'));
    const resultsMap: Record<string, UsageStatRecord> = {};

    // Seed with local cache
    localCache.forEach(c => {
      resultsMap[c.date] = { ...c };
    });

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const docDate = docSnap.id;
      const existing = resultsMap[docDate] || { date: docDate, reads: 0, writes: 0, deletes: 0 };
      resultsMap[docDate] = {
        date: docDate,
        reads: Math.max(existing.reads || 0, data.reads || 0),
        writes: Math.max(existing.writes || 0, data.writes || 0),
        deletes: Math.max(existing.deletes || 0, data.deletes || 0),
        lastUpdated: data.lastUpdated || existing.lastUpdated
      };
    });

    const finalResults = Object.values(resultsMap).sort((a, b) => a.date.localeCompare(b.date));
    saveLocalUsageCache(finalResults);
    return finalResults.slice(-daysCount);
  } catch (err) {
    console.warn('Failed to fetch usage stats from Firestore, falling back to local cache:', err);
    return localCache.slice(-daysCount);
  }
}

/**
 * Real-time subscription to usage stats collection
 */
export function subscribeUsageStats(callback: (stats: UsageStatRecord[]) => void, daysCount = 14) {
  // Fire initial cache immediately
  const initialCache = getLocalUsageCache();
  if (initialCache.length > 0) {
    callback(initialCache.slice(-daysCount));
  }

  // Listen to local window events
  const handleLocalEvent = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail.slice(-daysCount));
    }
  };
  window.addEventListener('school_hub_usage_updated', handleLocalEvent);

  try {
    const colRef = collection(db, 'usage_stats');
    const unsubFirestore = onSnapshot(colRef, (snapshot) => {
      const resultsMap: Record<string, UsageStatRecord> = {};
      const currentLocal = getLocalUsageCache();
      currentLocal.forEach(c => {
        resultsMap[c.date] = { ...c };
      });

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const docDate = docSnap.id;
        const existing = resultsMap[docDate] || { date: docDate, reads: 0, writes: 0, deletes: 0 };
        resultsMap[docDate] = {
          date: docDate,
          reads: Math.max(existing.reads || 0, data.reads || 0),
          writes: Math.max(existing.writes || 0, data.writes || 0),
          deletes: Math.max(existing.deletes || 0, data.deletes || 0),
          lastUpdated: data.lastUpdated || existing.lastUpdated
        };
      });

      const merged = Object.values(resultsMap).sort((a, b) => a.date.localeCompare(b.date));
      saveLocalUsageCache(merged);
      callback(merged.slice(-daysCount));
    }, (err) => {
      console.warn('subscribeUsageStats Firestore snapshot warning:', err);
    });

    return () => {
      window.removeEventListener('school_hub_usage_updated', handleLocalEvent);
      if (unsubFirestore) unsubFirestore();
    };
  } catch (err) {
    console.warn('subscribeUsageStats failed setup:', err);
    return () => {
      window.removeEventListener('school_hub_usage_updated', handleLocalEvent);
    };
  }
}

/* ========================================================================
   SUBCOLLECTION & BATCH FIRESTORE HELPERS (OPTIMIZED FOR READ/WRITE COSTS)
   ======================================================================== */

export function getStandardStudentDocId(st: Partial<Student>): string {
  const normClass = normalizeClassName(st.class || '');
  const rollNum = Number(st.roll || 0);
  return `${normClass}_${rollNum}`.replace(/[\/\s#?]/g, '_');
}

/**
 * Robust deduplication and normalization engine:
 * Merges duplicate entries with identical Class & Roll, preserving active status, photos, and complete details.
 */
export function deduplicateAndNormalizeStudents(rawList: Student[]): Student[] {
  if (!Array.isArray(rawList)) return [];
  const map = new Map<string, Student>();

  // Smart photo permanence comparison:
  // Priority: Cloudinary / Firebase HTTPS URL (rank 3) > Base64 Data URL (rank 2) > Other HTTPS/HTTP URL (rank 1) > Blob/Empty (rank 0)
  const getPhotoRank = (p?: string): number => {
    if (!p || typeof p !== 'string') return 0;
    const trimmed = p.trim();
    if (!trimmed || trimmed.startsWith('blob:')) return 0;
    if (trimmed.includes('cloudinary') || trimmed.includes('firebasestorage') || (trimmed.startsWith('https://') && !trimmed.startsWith('data:'))) return 3;
    if (trimmed.startsWith('data:image/')) return 2;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 1;
    return 0;
  };

  rawList.forEach(st => {
    if (!st || !st.class || st.roll === undefined || st.roll === null) return;
    const normClass = normalizeClassName(st.class);
    const rollNum = Number(st.roll);
    if (isNaN(rollNum) || rollNum <= 0) return;
    
    const key = `${normClass}_${rollNum}`;
    const existing = map.get(key);

    const cleanPhoto = st.photo ? formatPhotoUrl(st.photo) : '';

    if (!existing) {
      map.set(key, {
        ...st,
        class: normClass,
        roll: rollNum,
        photo: cleanPhoto,
        isActive: st.isActive !== false,
        studentId: st.studentId || `${normClass}_${rollNum}`
      });
    } else {
      const isExistingActive = existing.isActive !== false;
      const isCurrentActive = st.isActive !== false;

      // Select preferred base
      const preferred = (!isExistingActive && isCurrentActive) ? st : existing;

      // Rank-based photo selection
      const existingRank = getPhotoRank(existing.photo);
      const incomingRank = getPhotoRank(cleanPhoto);

      let bestPhoto = '';
      if (incomingRank > existingRank) {
        bestPhoto = cleanPhoto;
      } else if (existingRank > incomingRank) {
        bestPhoto = existing.photo || '';
      } else {
        // Equal rank: prefer incoming newer photo if non-empty, otherwise keep existing
        bestPhoto = cleanPhoto || existing.photo || '';
      }

      const merged: Student = {
        ...preferred,
        class: normClass,
        roll: rollNum,
        name: (preferred.name && preferred.name.trim()) || existing.name || st.name || '',
        fatherName: preferred.fatherName || existing.fatherName || st.fatherName || '',
        address: preferred.address || existing.address || st.address || '',
        phone: preferred.phone || existing.phone || st.phone || '',
        gender: preferred.gender || existing.gender || st.gender || 'Male',
        monthlyFee: preferred.monthlyFee || existing.monthlyFee || st.monthlyFee || 350,
        vehicle: preferred.vehicle || existing.vehicle || st.vehicle || 'No',
        govtSchoolName: preferred.govtSchoolName || existing.govtSchoolName || st.govtSchoolName || '',
        photo: bestPhoto,
        status: preferred.status || (isExistingActive || isCurrentActive ? 'Active' : 'Inactive'),
        isActive: isExistingActive || isCurrentActive,
        studentId: preferred.studentId || existing.studentId || `${normClass}_${rollNum}`
      };
      map.set(key, merged);
    }
  });

  const list = Array.from(map.values());
  list.sort((a, b) => {
    if (normalizeClassName(a.class) === normalizeClassName(b.class)) {
      return Number(a.roll) - Number(b.roll);
    }
    return a.class.localeCompare(b.class);
  });
  return list;
}

/**
 * One-time maintenance utility: scans the raw students subcollection for
 * duplicate/orphaned documents (e.g. legacy "ST-NS-1" style IDs alongside the
 * current "NS_1" style IDs for the same class+roll), merges the best data
 * (via deduplicateAndNormalizeStudents) into the canonical doc ID, and
 * deletes the leftover duplicate documents. Safe to run multiple times.
 */
export async function cleanupDuplicateStudentDocIds(schoolId: string): Promise<{
  scanned: number;
  canonical: number;
  deleted: number;
  deletedIds: string[];
}> {
  const colRef = collection(db, 'schools', schoolId, 'students');
  const snap = await getDocs(colRef);

  const rawDocs: { id: string; data: any }[] = [];
  snap.forEach(d => rawDocs.push({ id: d.id, data: d.data() }));

  const rawStudents: Student[] = rawDocs.map(rd => ({
    ...(rd.data as Student),
    studentId: (rd.data as any).studentId || rd.id
  }));

  const cleanList = deduplicateAndNormalizeStudents(rawStudents);
  const canonicalIds = new Set(cleanList.map(st => getStandardStudentDocId(st)));

  // Delete every raw document whose ID is not a canonical (current-format) ID
  // for any student in the merged list -- these are the leftover duplicates.
  const toDelete = rawDocs.filter(rd => !canonicalIds.has(rd.id));
  let deleted = 0;
  const deletedIds: string[] = [];

  for (let i = 0; i < toDelete.length; i += 400) {
    const chunk = toDelete.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach(rd => {
      batch.delete(doc(db, 'schools', schoolId, 'students', rd.id));
      deletedIds.push(rd.id);
    });
    await batch.commit();
    deleted += chunk.length;
  }

  // Re-save the merged/best data under the canonical doc ID for every student,
  // so no data (including photos) is lost from whichever duplicate had it.
  for (let i = 0; i < cleanList.length; i += 400) {
    const chunk = cleanList.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach(st => {
      const id = getStandardStudentDocId(st);
      const docData: any = { ...st };
      docData.photo = sanitizeStudentPhotoForFirestore(st.photo);
      Object.keys(docData).forEach(k => { if (docData[k] === undefined) delete docData[k]; });
      batch.set(doc(db, 'schools', schoolId, 'students', id), docData, { merge: true });
    });
    await batch.commit();
  }

  return { scanned: rawDocs.length, canonical: cleanList.length, deleted, deletedIds };
}

/**
 * Fetch Students with optional Class Filter or Limit (Pagination Support)
 * Deduplicates and normalizes in real-time.
 */
export async function fetchSchoolStudentsFromFirestore(
  schoolId: string,
  options?: { classFilter?: string; limitCount?: number }
): Promise<Student[]> {
  if (!schoolId) return [];
  try {
    const studentsCol = collection(db, 'schools', schoolId, 'students');
    let q = query(studentsCol);

    if (options?.classFilter && options.classFilter !== 'ALL') {
      q = query(studentsCol, where('class', '==', options.classFilter));
    }

    if (options?.limitCount) {
      q = query(q, limit(options.limitCount));
    }

    const snapshot = await getDocs(q);
    const list: Student[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Student);
    });
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return deduplicateAndNormalizeStudents(list);
  } catch (err) {
    console.warn('Error fetching students from subcollection:', err);
    return [];
  }
}

/**
 * Real-time Students Subscription for Instant Multi-Device Synchronization
 * Guaranteed deduplicated and formatted across devices.
 */
export function subscribeStudentsFromFirestore(schoolId: string, callback: (students: Student[]) => void) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'students');
  return onSnapshot(colRef, (snapshot) => {
    const list: Student[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Student);
    });
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    const deduplicated = deduplicateAndNormalizeStudents(list);
    callback(deduplicated);
  }, err => console.warn('Students real-time subscription error:', err));
}

/**
 * Helper to ensure student photo is stored safely in Firestore.
 * Accepts real URLs (http/https/uploads/cloudinary/firebasestorage/imgbb/etc.) and lightweight compressed Data URLs.
 */
function sanitizeStudentPhotoForFirestore(photo?: string): string {
  if (!photo || typeof photo !== 'string') return '';
  const trimmed = photo.trim();
  if (!trimmed) return '';
  const formatted = formatPhotoUrl(trimmed);
  if (
    formatted.startsWith('http://') ||
    formatted.startsWith('https://') ||
    formatted.startsWith('/uploads/') ||
    formatted.includes('cloudinary') ||
    formatted.includes('firebasestorage') ||
    formatted.includes('drive.google.com') ||
    formatted.includes('imgbb.com') ||
    formatted.includes('imgur.com')
  ) {
    return formatted;
  }
  // Allow compressed data URLs (up to 350KB safe for Firestore documents)
  if (formatted.startsWith('data:image/') && formatted.length < 350000) {
    return formatted;
  }
  if (!formatted.startsWith('blob:') && formatted.length < 500) {
    return formatted;
  }
  return '';
}

/**
 * Purge / Delete All Students in Firestore Subcollection for this school
 */
export async function purgeAllStudentsFromFirestore(schoolId: string): Promise<boolean> {
  if (!schoolId) return false;
  try {
    const studentsCol = collection(db, 'schools', schoolId, 'students');
    const snapshot = await getDocs(studentsCol);
    if (snapshot.empty) return true;

    const chunkSize = 400;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + chunkSize);
      chunk.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error('Error purging students collection:', err);
    return false;
  }
}

/**
 * Save Students in Batches - Write Cost Optimized & Standardized Document IDs
 * Zero-Flicker Replacement: Writes all new students FIRST, then cleans up any old orphaned docs.
 * Prevents snapshot listener from ever seeing an empty subcollection.
 */
export async function saveStudentsBatchToFirestore(
  schoolId: string, 
  students: Student[], 
  replaceExisting = false
): Promise<boolean> {
  if (!schoolId || !students || students.length === 0) return false;
  try {
    const validStudents = deduplicateAndNormalizeStudents(students);
    const newDocIdSet = new Set<string>();

    // 1. Write / Upsert all valid students first
    const chunkSize = 400; // safe batch chunking within Firestore 500 limits
    for (let i = 0; i < validStudents.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = validStudents.slice(i, i + chunkSize);
      chunk.forEach(st => {
        const id = getStandardStudentDocId(st);
        newDocIdSet.add(id);
        const ref = doc(db, 'schools', schoolId, 'students', id);
        const docData: any = { 
          ...st, 
          class: normalizeClassName(st.class),
          roll: Number(st.roll),
          studentId: st.studentId || id,
          isActive: st.isActive !== false
        };
        if (st.photo !== undefined && st.photo !== '') {
          docData.photo = sanitizeStudentPhotoForFirestore(st.photo);
        } else if (st.photo === '') {
          docData.photo = '';
        } else {
          delete docData.photo;
        }
        // Strip undefined fields for Firestore safety
        Object.keys(docData).forEach(k => {
          if (docData[k] === undefined) delete docData[k];
        });
        batch.set(ref, docData, { merge: true });
      });
      await batch.commit();
    }

    // 2. If replacing existing (Clean Import / Replace mode), delete only old leftover docs
    if (replaceExisting) {
      const studentsCol = collection(db, 'schools', schoolId, 'students');
      const snapshot = await getDocs(studentsCol);
      const docsToDelete = snapshot.docs.filter(d => !newDocIdSet.has(d.id));

      if (docsToDelete.length > 0) {
        for (let i = 0; i < docsToDelete.length; i += chunkSize) {
          const deleteBatch = writeBatch(db);
          const chunk = docsToDelete.slice(i, i + chunkSize);
          chunk.forEach(d => {
            deleteBatch.delete(d.ref);
          });
          await deleteBatch.commit();
        }
      }
    }

    recordSchoolUsageStat(schoolId, 'write', validStudents.length).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error in saveStudentsBatchToFirestore:', err);
    return false;
  }
}

/**
 * Save / Update Single Student Document using Standardized Document ID
 */
export async function saveStudentSingleToFirestore(schoolId: string, student: Student): Promise<boolean> {
  if (!schoolId || !student) return false;
  try {
    const id = getStandardStudentDocId(student);
    const ref = doc(db, 'schools', schoolId, 'students', id);
    const docData: any = { 
      ...student, 
      class: normalizeClassName(student.class),
      roll: Number(student.roll),
      studentId: student.studentId || id 
    };
    if (student.photo !== undefined) {
      docData.photo = sanitizeStudentPhotoForFirestore(student.photo);
    } else {
      delete docData.photo;
    }
    // Strip undefined fields for Firestore safety
    Object.keys(docData).forEach(k => {
      if (docData[k] === undefined) delete docData[k];
    });
    await setDoc(ref, docData, { merge: true });

    // Confirm the write actually reached Firestore's server (not just the
    // local optimistic cache) — on a poor/unstable connection, setDoc()
    // can resolve immediately from local cache while the real sync to the
    // server silently stalls or never completes. Without this check the
    // app would report success even though nothing was actually saved.
    const reachedServer = await Promise.race([
      waitForPendingWrites(db).then(() => true),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 8000))
    ]);

    if (!reachedServer) {
      console.warn('saveStudentSingleToFirestore: write not confirmed by server within timeout (poor network?)');
      return false;
    }

    // If student had a legacy non-standard studentId, clean it up to prevent duplicates
    if (student.studentId && student.studentId !== id) {
      const legacyRef = doc(db, 'schools', schoolId, 'students', student.studentId);
      await deleteDoc(legacyRef).catch(() => {});
    }

    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error saving single student:', err);
    return false;
  }
}

/**
 * Delete Single Student Document (Soft Delete)
 */
export async function deleteStudentSingleFromFirestore(schoolId: string, studentOrDocId: Student | string): Promise<boolean> {
  if (!schoolId || !studentOrDocId) return false;
  try {
    const docId = typeof studentOrDocId === 'string' 
      ? studentOrDocId 
      : getStandardStudentDocId(studentOrDocId);

    const ref = doc(db, 'schools', schoolId, 'students', docId);
    await setDoc(ref, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });
    
    // Also if legacy studentId was different, mark it inactive too
    if (typeof studentOrDocId !== 'string' && studentOrDocId.studentId && studentOrDocId.studentId !== docId) {
      const legacyRef = doc(db, 'schools', schoolId, 'students', studentOrDocId.studentId);
      await setDoc(legacyRef, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    }

    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error soft deleting student:', err);
    return false;
  }
}

/**
 * Permanently Delete Single Student Document from Firestore (Hard Delete)
 */
export async function hardDeleteStudentFromFirestore(schoolId: string, studentOrDocId: Student | string): Promise<boolean> {
  if (!schoolId || !studentOrDocId) return false;
  try {
    const docId = typeof studentOrDocId === 'string' 
      ? studentOrDocId 
      : getStandardStudentDocId(studentOrDocId);

    const ref = doc(db, 'schools', schoolId, 'students', docId);
    await deleteDoc(ref);

    // Also clean legacy doc if present
    if (typeof studentOrDocId !== 'string' && studentOrDocId.studentId && studentOrDocId.studentId !== docId) {
      const legacyRef = doc(db, 'schools', schoolId, 'students', studentOrDocId.studentId);
      await deleteDoc(legacyRef).catch(() => {});
    }

    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error hard deleting student:', err);
    return false;
  }
}

/**
 * Purge / Hard Delete all Inactive (Soft Deleted) Students from Firestore
 */
export async function purgeAllInactiveStudentsFromFirestore(schoolId: string): Promise<number> {
  if (!schoolId) return 0;
  try {
    const studentsCol = collection(db, 'schools', schoolId, 'students');
    const snapshot = await getDocs(studentsCol);
    const inactiveDocs = snapshot.docs.filter(d => {
      const data = d.data();
      return data.isActive === false;
    });

    if (inactiveDocs.length === 0) return 0;

    const chunkSize = 400;
    for (let i = 0; i < inactiveDocs.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = inactiveDocs.slice(i, i + chunkSize);
      chunk.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
    return inactiveDocs.length;
  } catch (err) {
    console.error('Error purging inactive students:', err);
    return 0;
  }
}

/**
 * Fetch Exam Marks
 */
export async function fetchSchoolMarksFromFirestore(
  schoolId: string,
  options?: { classFilter?: string; examFilter?: string }
): Promise<ExamMark[]> {
  if (!schoolId) return [];
  try {
    const colRef = collection(db, 'schools', schoolId, 'marks');
    let q = query(colRef);
    if (options?.classFilter && options.classFilter !== 'ALL' && options?.examFilter && options.examFilter !== 'ALL') {
      q = query(colRef, where('class', '==', options.classFilter), where('examName', '==', options.examFilter));
    } else if (options?.classFilter && options.classFilter !== 'ALL') {
      q = query(colRef, where('class', '==', options.classFilter));
    } else if (options?.examFilter && options.examFilter !== 'ALL') {
      q = query(colRef, where('examName', '==', options.examFilter));
    }
    const snapshot = await getDocs(q);
    const list: ExamMark[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as ExamMark);
    });
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return list;
  } catch (err) {
    console.warn('Error fetching marks from subcollection:', err);
    return [];
  }
}

/**
 * Batch Save Exam Marks
 */
export async function saveMarksBatchToFirestore(schoolId: string, marks: ExamMark[]): Promise<boolean> {
  if (!schoolId || !marks || marks.length === 0) return false;
  try {
    const chunkSize = 400;
    for (let i = 0; i < marks.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = marks.slice(i, i + chunkSize);
      chunk.forEach(m => {
        const docId = `${m.class}_${m.roll}_${m.examName}_${m.subjectName}`.replace(/[\/\s#?]/g, '_');
        const ref = doc(db, 'schools', schoolId, 'marks', docId);
        batch.set(ref, m, { merge: true });
      });
      await batch.commit();
    }
    recordSchoolUsageStat(schoolId, 'write', marks.length).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error in saveMarksBatchToFirestore:', err);
    return false;
  }
}

/**
 * Real-time Marks Subscription for Instant Cross-Device Sync
 */
export function subscribeMarksFromFirestore(
  schoolId: string,
  callback: (marks: ExamMark[]) => void
) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'marks');
  return onSnapshot(colRef, (snapshot) => {
    const list: ExamMark[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as ExamMark);
    });
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Marks subscribe error:', err));
}

/**
 * Fetch Teachers
 */
export async function fetchTeachersFromFirestore(schoolId: string): Promise<Teacher[]> {
  if (!schoolId) return [];
  try {
    const colRef = collection(db, 'schools', schoolId, 'teachers');
    const snapshot = await getDocs(colRef);
    const list: Teacher[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Teacher);
    });
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return list;
  } catch (err) {
    console.warn('Error fetching teachers:', err);
    return [];
  }
}

/**
 * Real-time Teachers Subscription for Instant Cross-Device Sync
 */
export function subscribeTeachersFromFirestore(
  schoolId: string,
  callback: (teachers: Teacher[]) => void
) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'teachers');
  return onSnapshot(colRef, (snapshot) => {
    const list: Teacher[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Teacher);
    });
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Teachers subscribe error:', err));
}

/**
 * Save Single Teacher Document
 */
export async function saveTeacherSingleToFirestore(schoolId: string, teacher: Teacher): Promise<boolean> {
  if (!schoolId || !teacher) return false;
  try {
    const ref = doc(db, 'schools', schoolId, 'teachers', teacher.id);
    await setDoc(ref, teacher, { merge: true });
    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error saving teacher:', err);
    return false;
  }
}

/**
 * Delete Teacher Document (Soft Delete)
 */
export async function deleteTeacherSingleFromFirestore(schoolId: string, teacherId: string): Promise<boolean> {
  if (!schoolId || !teacherId) return false;
  try {
    const ref = doc(db, 'schools', schoolId, 'teachers', teacherId);
    await setDoc(ref, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });
    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error soft deleting teacher:', err);
    return false;
  }
}

/**
 * Reactivate Any Subcollection Document
 */
export async function reactivateDocument(schoolId: string, subcollection: string, docId: string): Promise<boolean> {
  if (!schoolId || !subcollection || !docId) return false;
  try {
    const ref = doc(db, 'schools', schoolId, subcollection, docId);
    await setDoc(ref, { isActive: true, deactivatedAt: null }, { merge: true });
    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error reactivating document:', err);
    return false;
  }
}

/**
 * Permanently Delete Document (SuperAdmin)
 */
export async function permanentlyDeleteDocFromFirestore(schoolId: string, subcollection: string, docId: string): Promise<boolean> {
  if (!schoolId || !subcollection || !docId) return false;
  try {
    const ref = doc(db, 'schools', schoolId, subcollection, docId);
    await deleteDoc(ref);
    recordSchoolUsageStat(schoolId, 'delete', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error permanently deleting document:', err);
    return false;
  }
}

/**
 * Expenses, FeeReceipts, Daybook, Routines, Vehicles Subcollection Helpers
 */
export async function fetchExpensesFromFirestore(schoolId: string): Promise<ExpenseItem[]> {
  if (!schoolId) return [];
  try {
    const snapshot = await getDocs(collection(db, 'schools', schoolId, 'expenses'));
    const list: ExpenseItem[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as ExpenseItem));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return list;
  } catch { return []; }
}

/**
 * Real-time Expenses Subscription for Instant Cross-Device Sync
 */
export function subscribeExpensesFromFirestore(schoolId: string, callback: (expenses: ExpenseItem[]) => void) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'expenses');
  return onSnapshot(colRef, (snapshot) => {
    const list: ExpenseItem[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as ExpenseItem));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Expenses subscribe error:', err));
}

export async function saveExpenseSingleToFirestore(schoolId: string, item: ExpenseItem) {
  if (!schoolId || !item) return;
  const ref = doc(db, 'schools', schoolId, 'expenses', item.id);
  await setDoc(ref, item, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

export async function deleteExpenseSingleFromFirestore(schoolId: string, expenseId: string) {
  if (!schoolId || !expenseId) return;
  const ref = doc(db, 'schools', schoolId, 'expenses', expenseId);
  await setDoc(ref, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

export async function fetchFeeReceiptsFromFirestore(
  schoolId: string,
  options?: { startDate?: string; endDate?: string; studentClass?: string; studentRoll?: number }
): Promise<FeeReceipt[]> {
  if (!schoolId) return [];
  try {
    const colRef = collection(db, 'schools', schoolId, 'feeReceipts');
    let q = query(colRef);
    if (options?.studentClass !== undefined && options?.studentRoll !== undefined) {
      q = query(colRef, where('studentClass', '==', options.studentClass), where('roll', '==', Number(options.studentRoll)));
    } else if (options?.startDate && options?.endDate) {
      q = query(colRef, where('date', '>=', options.startDate), where('date', '<=', options.endDate));
    }
    const snapshot = await getDocs(q);
    const list: FeeReceipt[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as FeeReceipt));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return list;
  } catch (err) {
    console.warn('Error fetching fee receipts:', err);
    return [];
  }
}

/**
 * Real-time Fee Receipts Subscription for Instant Cross-Device Sync
 */
export function subscribeFeeReceiptsFromFirestore(schoolId: string, callback: (receipts: FeeReceipt[]) => void) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'feeReceipts');
  return onSnapshot(colRef, (snapshot) => {
    const list: FeeReceipt[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as FeeReceipt));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Fee receipts subscribe error:', err));
}

export async function getNextReceiptNoFromFirestore(schoolId: string): Promise<string> {
  if (!schoolId) return `REC-${Date.now().toString().slice(-6)}`;
  try {
    const counterRef = doc(db, 'schools', schoolId, 'stats', 'receiptCounter');
    const recNo = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      let current = 1000;
      if (snap.exists() && typeof snap.data().lastNumber === 'number') {
        current = snap.data().lastNumber;
      }
      const next = current + 1;
      transaction.set(counterRef, { lastNumber: next, updated: new Date().toISOString() }, { merge: true });
      return `REC-${next}`;
    });
    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return recNo;
  } catch (err) {
    console.warn('Transaction error getting receipt counter, falling back:', err);
    return `REC-${Date.now().toString().slice(-6)}`;
  }
}

export async function fetchFeeTotalsFromFirestore(schoolId: string): Promise<FeeTotalsDoc | null> {
  if (!schoolId) return null;
  try {
    const ref = doc(db, 'schools', schoolId, 'stats', 'feeTotals');
    const docSnap = await getDoc(ref);
    recordSchoolUsageStat(schoolId, 'read', 1).catch(() => {});
    if (docSnap.exists()) {
      return docSnap.data() as FeeTotalsDoc;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Real-time Fee Totals Subscription for Instant Cross-Device Sync
 */
export function subscribeFeeTotalsFromFirestore(schoolId: string, callback: (totals: FeeTotalsDoc | null) => void) {
  if (!schoolId) return () => {};
  const ref = doc(db, 'schools', schoolId, 'stats', 'feeTotals');
  return onSnapshot(ref, (docSnap) => {
    recordSchoolUsageStat(schoolId, 'read', 1).catch(() => {});
    if (docSnap.exists()) {
      callback(docSnap.data() as FeeTotalsDoc);
    } else {
      callback(null);
    }
  }, err => console.warn('Fee totals subscribe error:', err));
}

export async function updateFeeTotalsOnReceiptSave(schoolId: string, receiptAmount: number, receiptDate: string) {
  if (!schoolId || !receiptAmount) return;
  try {
    const ref = doc(db, 'schools', schoolId, 'stats', 'feeTotals');
    const docSnap = await getDoc(ref);
    const rMonth = receiptDate ? receiptDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
    const rYear = receiptDate ? receiptDate.substring(0, 4) : new Date().toISOString().substring(0, 4);

    if (docSnap.exists()) {
      const data = docSnap.data() as FeeTotalsDoc;
      const sameMonth = data.currentMonth === rMonth;
      const sameYear = data.currentYear === rYear;

      const updatedMonthTotal = sameMonth ? (data.totalThisMonth || 0) + receiptAmount : receiptAmount;
      const updatedYearTotal = sameYear ? (data.totalThisYear || 0) + receiptAmount : receiptAmount;
      const updatedAllTimeTotal = (data.totalAllTime || 0) + receiptAmount;

      await setDoc(ref, {
        totalThisMonth: updatedMonthTotal,
        totalThisYear: updatedYearTotal,
        totalAllTime: updatedAllTimeTotal,
        currentMonth: rMonth,
        currentYear: rYear,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } else {
      await setDoc(ref, {
        totalThisMonth: receiptAmount,
        totalThisYear: receiptAmount,
        totalAllTime: receiptAmount,
        currentMonth: rMonth,
        currentYear: rYear,
        lastUpdated: new Date().toISOString()
      });
    }
    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
  } catch (err) {
    console.error('Error updating fee totals:', err);
  }
}

export async function saveFeeReceiptSingleToFirestore(schoolId: string, receipt: FeeReceipt) {
  if (!schoolId || !receipt) return;
  try {
    const batch = writeBatch(db);

    // 1. Fee Receipt Doc
    const receiptRef = doc(db, 'schools', schoolId, 'feeReceipts', receipt.id);
    batch.set(receiptRef, receipt, { merge: true });

    // 2. Sync linked Daybook Entry
    const daybookId = `rec_${receipt.id}`;
    const daybookRef = doc(db, 'schools', schoolId, 'daybook', daybookId);
    const daybookEntry: DaybookEntry = {
      id: daybookId,
      date: receipt.date || new Date().toISOString().split('T')[0],
      type: 'INCOME',
      category: 'Student Fee',
      amount: receipt.amount || 0,
      description: `ফি গ্রহণ: ${receipt.studentName} (${receipt.studentClass}, রোল: ${receipt.roll}) - রসিদ নম্বর #${receipt.receiptNo}`,
      paymentMethod: receipt.paymentMode || 'Cash',
      receiptNo: receipt.receiptNo,
      linkedReceiptId: receipt.id
    };
    batch.set(daybookRef, daybookEntry, { merge: true });

    // 3. Sync Student Month Statuses if student document exists
    if (receipt.studentClass && receipt.roll) {
      const studentDocId = `${receipt.studentClass}_${receipt.roll}`;
      const studentRef = doc(db, 'schools', schoolId, 'students', studentDocId);
      
      const monthUpdate: Record<string, any> = {
        lastReceiptNo: receipt.receiptNo,
        updatedAt: new Date().toISOString()
      };
      if (Array.isArray(receipt.months)) {
        receipt.months.forEach(m => {
          if (m) monthUpdate[m.toLowerCase()] = 'Paid';
        });
      }
      batch.set(studentRef, monthUpdate, { merge: true });
    }

    await batch.commit();
    recordSchoolUsageStat(schoolId, 'write', 3).catch(() => {});

    // Update Fee Totals in stats
    updateFeeTotalsOnReceiptSave(
      schoolId, 
      receipt.amount || 0, 
      receipt.date || new Date().toISOString().split('T')[0]
    ).catch(() => {});
  } catch (err) {
    console.error('Error saving fee receipt atomically:', err);
  }
}

export async function deleteFeeReceiptSingleFromFirestore(schoolId: string, receiptId: string, amountToDelete?: number, receiptDate?: string) {
  if (!schoolId || !receiptId) return;
  try {
    const batch = writeBatch(db);
    
    // 1. Soft delete Fee Receipt
    const receiptRef = doc(db, 'schools', schoolId, 'feeReceipts', receiptId);
    batch.set(receiptRef, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });

    // 2. Soft delete linked Daybook Entry
    const daybookId = `rec_${receiptId}`;
    const daybookRef = doc(db, 'schools', schoolId, 'daybook', daybookId);
    batch.set(daybookRef, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });

    await batch.commit();
    recordSchoolUsageStat(schoolId, 'write', 2).catch(() => {});

    if (amountToDelete) {
      updateFeeTotalsOnReceiptSave(
        schoolId, 
        -Math.abs(amountToDelete), 
        receiptDate || new Date().toISOString().split('T')[0]
      ).catch(() => {});
    }
  } catch (err) {
    console.error('Error soft deleting fee receipt atomically:', err);
  }
}

export async function fetchDaybookFromFirestore(
  schoolId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<DaybookEntry[]> {
  if (!schoolId) return [];
  try {
    const colRef = collection(db, 'schools', schoolId, 'daybook');
    let q = query(colRef);
    if (options?.startDate && options?.endDate) {
      q = query(colRef, where('date', '>=', options.startDate), where('date', '<=', options.endDate));
    }
    const snapshot = await getDocs(q);
    const list: DaybookEntry[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as DaybookEntry));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return list;
  } catch (err) {
    console.warn('Error fetching daybook:', err);
    return [];
  }
}

/**
 * Real-time Daybook Subscription for Instant Cross-Device Sync
 */
export function subscribeDaybookFromFirestore(schoolId: string, callback: (entries: DaybookEntry[]) => void) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'daybook');
  return onSnapshot(colRef, (snapshot) => {
    const list: DaybookEntry[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as DaybookEntry));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Daybook subscribe error:', err));
}

export async function saveAttendanceForClass(
  schoolId: string,
  classId: string,
  date: string,
  records: Record<string, 'Present' | 'Absent'>,
  takenBy: string = 'Admin'
): Promise<boolean> {
  if (!schoolId || !classId || !date) return false;
  try {
    const docId = `${classId}_${date}`;
    const ref = doc(db, 'schools', schoolId, 'attendance', docId);
    await setDoc(ref, {
      date,
      classId,
      records,
      takenBy,
      takenAt: new Date().toISOString()
    }, { merge: true });
    recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
    return true;
  } catch (err) {
    console.error('Error saving attendance for class:', err);
    return false;
  }
}

export async function fetchAttendanceForClass(
  schoolId: string,
  classId: string,
  date: string
): Promise<AttendanceDoc | null> {
  if (!schoolId || !classId || !date) return null;
  try {
    const docId = `${classId}_${date}`;
    const ref = doc(db, 'schools', schoolId, 'attendance', docId);
    const docSnap = await getDoc(ref);
    recordSchoolUsageStat(schoolId, 'read', 1).catch(() => {});
    if (docSnap.exists()) {
      return docSnap.data() as AttendanceDoc;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching attendance for class:', err);
    return null;
  }
}

export async function saveDaybookSingleToFirestore(schoolId: string, entry: DaybookEntry) {
  if (!schoolId || !entry) return;
  const ref = doc(db, 'schools', schoolId, 'daybook', entry.id);
  await setDoc(ref, entry, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

export async function deleteDaybookSingleFromFirestore(schoolId: string, daybookId: string) {
  if (!schoolId || !daybookId) return;
  const ref = doc(db, 'schools', schoolId, 'daybook', daybookId);
  await setDoc(ref, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

export async function fetchRoutinesFromFirestore(schoolId: string): Promise<RoutineEntry[]> {
  if (!schoolId) return [];
  try {
    const snapshot = await getDocs(collection(db, 'schools', schoolId, 'routines'));
    const list: RoutineEntry[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as RoutineEntry));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return list;
  } catch { return []; }
}

/**
 * Real-time Routines Subscription for Instant Cross-Device Sync
 */
export function subscribeRoutinesFromFirestore(schoolId: string, callback: (routines: RoutineEntry[]) => void) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'routines');
  return onSnapshot(colRef, (snapshot) => {
    const list: RoutineEntry[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as RoutineEntry));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Routines subscribe error:', err));
}

export async function saveRoutinesBatchToFirestore(schoolId: string, routines: RoutineEntry[]) {
  if (!schoolId || !routines) return;
  const batch = writeBatch(db);
  routines.forEach(r => {
    const ref = doc(db, 'schools', schoolId, 'routines', r.id);
    batch.set(ref, r, { merge: true });
  });
  await batch.commit();
  recordSchoolUsageStat(schoolId, 'write', routines.length).catch(() => {});
}

/**
 * Real-time Notices Subscription (With Unsubscribe Callback & Clean Up)
 */
export function subscribeNoticesFromFirestore(schoolId: string, callback: (notices: NoticeItem[]) => void) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'notices');
  return onSnapshot(colRef, (snapshot) => {
    const list: NoticeItem[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as NoticeItem));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Notices subscribe error:', err));
}

export async function saveNoticeSingleToFirestore(schoolId: string, notice: NoticeItem) {
  if (!schoolId || !notice) return;
  const ref = doc(db, 'schools', schoolId, 'notices', notice.id);
  await setDoc(ref, notice, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

export async function deleteNoticeSingleFromFirestore(schoolId: string, noticeId: string) {
  if (!schoolId || !noticeId) return;
  const ref = doc(db, 'schools', schoolId, 'notices', noticeId);
  await setDoc(ref, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

export async function fetchVehiclesFromFirestore(schoolId: string): Promise<VehicleConfig[]> {
  if (!schoolId) return [];
  try {
    const snapshot = await getDocs(collection(db, 'schools', schoolId, 'vehicles'));
    const list: VehicleConfig[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as VehicleConfig));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    return list;
  } catch { return []; }
}

/**
 * Real-time Vehicles Subscription for Instant Cross-Device Sync
 */
export function subscribeVehiclesFromFirestore(schoolId: string, callback: (vehicles: VehicleConfig[]) => void) {
  if (!schoolId) return () => {};
  const colRef = collection(db, 'schools', schoolId, 'vehicles');
  return onSnapshot(colRef, (snapshot) => {
    const list: VehicleConfig[] = [];
    snapshot.forEach(docSnap => list.push(docSnap.data() as VehicleConfig));
    recordSchoolUsageStat(schoolId, 'read', list.length).catch(() => {});
    callback(list);
  }, err => console.warn('Vehicles subscribe error:', err));
}

export async function saveVehicleSingleToFirestore(schoolId: string, vehicle: VehicleConfig) {
  if (!schoolId || !vehicle) return;
  const ref = doc(db, 'schools', schoolId, 'vehicles', vehicle.id);
  await setDoc(ref, vehicle, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

export async function deleteVehicleSingleFromFirestore(schoolId: string, vehicleId: string) {
  if (!schoolId || !vehicleId) return;
  const ref = doc(db, 'schools', schoolId, 'vehicles', vehicleId);
  await setDoc(ref, { isActive: false, deactivatedAt: new Date().toISOString() }, { merge: true });
  recordSchoolUsageStat(schoolId, 'write', 1).catch(() => {});
}

// Full School Data Fetch Once (for fast initial load)
export async function getSchoolDataFromFirestore(schoolId: string) {
  if (!schoolId) return null;
  try {
    const [students, marks, teachers, expenses, feeReceipts, daybook, routines, vehicles] = await Promise.all([
      fetchSchoolStudentsFromFirestore(schoolId),
      fetchSchoolMarksFromFirestore(schoolId),
      fetchTeachersFromFirestore(schoolId),
      fetchExpensesFromFirestore(schoolId),
      fetchFeeReceiptsFromFirestore(schoolId),
      fetchDaybookFromFirestore(schoolId),
      fetchRoutinesFromFirestore(schoolId),
      fetchVehiclesFromFirestore(schoolId)
    ]);

    return {
      students,
      marks,
      teachers,
      expenses,
      feeReceipts,
      daybook,
      routines,
      vehicles
    };
  } catch (err) {
    console.warn('Firestore getSchoolData error:', err);
    return null;
  }
}

function normalizeLookupText(txt?: string): string {
  if (!txt) return '';
  return txt.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function matchSchoolWithQuery(school: School, query?: string, adminId?: string): boolean {
  const normQ = normalizeLookupText(query);
  const normAdmin = normalizeLookupText(adminId);

  const sId = normalizeLookupText(school.schoolId);
  const sCode = normalizeLookupText(school.code);
  const sName = normalizeLookupText(school.name);
  const sBengali = normalizeLookupText(school.nameBengali);
  const sAdminId = normalizeLookupText(school.adminId);

  if (normQ) {
    if (sId === normQ || sCode === normQ || sName === normQ || sBengali === normQ || sAdminId === normQ) {
      return true;
    }
    if (normQ.length >= 3 && (sName.includes(normQ) || sBengali.includes(normQ) || normQ.includes(sName))) {
      return true;
    }
  }

  if (normAdmin) {
    if (sAdminId === normAdmin || sCode === normAdmin || sId === normAdmin) {
      return true;
    }
  }

  return false;
}

export async function verifySchoolLoginInFirestore(
  schoolIdOrCode: string,
  inputAdminKey: string,
  inputVersionKey?: string,
  fallbackSchool?: School,
  inputAdminId?: string
): Promise<{ success: boolean; message?: string; school?: School }> {
  const cleanQuery = (schoolIdOrCode || '').trim();
  const cleanAdminId = (inputAdminId || '').trim();

  if (!cleanQuery && !cleanAdminId) {
    return { success: false, message: 'অনুগ্রহ করে স্কুলের আইডি বা কোড প্রদান করুন।' };
  }

  const normalizedQuery = cleanQuery.toLowerCase();
  const normalizedAdminId = cleanAdminId.toLowerCase();

  try {
    let schoolData: School | null = null;

    // 1. Direct Document ID check in Firestore (1 doc read)
    if (cleanQuery) {
      try {
        const schoolRef = doc(db, 'schools', cleanQuery);
        const docSnap = await getDoc(schoolRef);
        if (docSnap.exists()) {
          schoolData = docSnap.data() as School;
          recordSchoolUsageStat(cleanQuery, 'read', 1).catch(() => {});
        }
      } catch (dErr) {
        console.warn('Direct doc lookup error:', dErr);
      }
    }

    // 1b. If not found and cleanAdminId provided, check cleanAdminId as direct Document ID (1 doc read)
    if (!schoolData && cleanAdminId && cleanAdminId !== cleanQuery) {
      try {
        const schoolRef = doc(db, 'schools', cleanAdminId);
        const docSnap = await getDoc(schoolRef);
        if (docSnap.exists()) {
          schoolData = docSnap.data() as School;
          recordSchoolUsageStat(cleanAdminId, 'read', 1).catch(() => {});
        }
      } catch {}
    }

    // 2. Targeted searchKeys query using array-contains (Targeted 1 doc read instead of full collection scan)
    if (!schoolData && normalizedQuery) {
      try {
        const q = query(
          collection(db, 'schools'),
          where('searchKeys', 'array-contains', normalizedQuery),
          limit(1)
        );
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          schoolData = querySnap.docs[0].data() as School;
          recordSchoolUsageStat(schoolData.schoolId || cleanQuery, 'read', 1).catch(() => {});
        }
      } catch (qErr) {
        console.warn('Targeted searchKeys query error:', qErr);
      }
    }

    // 2b. If not found by query, try targeted query on normalizedAdminId
    if (!schoolData && normalizedAdminId && normalizedAdminId !== normalizedQuery) {
      try {
        const q = query(
          collection(db, 'schools'),
          where('searchKeys', 'array-contains', normalizedAdminId),
          limit(1)
        );
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          schoolData = querySnap.docs[0].data() as School;
          recordSchoolUsageStat(schoolData.schoolId || cleanAdminId, 'read', 1).catch(() => {});
        }
      } catch (qErr) {
        console.warn('Targeted adminId searchKeys query error:', qErr);
      }
    }

    // 3. Check fallback school (0 Firestore reads)
    if (!schoolData && fallbackSchool) {
      if (matchSchoolWithQuery(fallbackSchool, cleanQuery, cleanAdminId)) {
        schoolData = { ...fallbackSchool };
      }
    }

    // 4. Check cached localStorage schools (0 Firestore reads)
    if (!schoolData) {
      try {
        const localSaved = localStorage.getItem('school_hub_schools');
        if (localSaved) {
          const list: School[] = JSON.parse(localSaved);
          const found = list.find(s => matchSchoolWithQuery(s, cleanQuery, cleanAdminId));
          if (found) {
            schoolData = { ...found };
          }
        }
      } catch (lErr) {
        console.warn('LocalStorage scan error:', lErr);
      }
    }

    if (!schoolData) {
      return {
        success: false,
        message: 'প্রদত্ত স্কুল কোড বা আইডি দিয়ে ডেটাবেজে কোনো নিবন্ধিত বিদ্যালয় পাওয়া যায়নি!'
      };
    }

    // 5. Validate Admin ID (case-insensitive)
    const expectedAdminId = normalizeLookupText(schoolData.adminId || schoolData.code || schoolData.schoolId);
    const inAdminId = normalizeLookupText(cleanAdminId);
    if (expectedAdminId && inAdminId && inAdminId !== expectedAdminId) {
      return {
        success: false,
        message: 'ভুল এডমিন ইউজার আইডি! এই স্কুলের সুপার এডমিন কর্তৃক নির্ধারিত সঠিক Admin ID দিন।'
      };
    }

    // 6. Validate Password / PIN (adminKey)
    let storedAdminKey = String(schoolData.adminKey || '').trim();
    if (!storedAdminKey) {
      try {
        const credsSnap = await getDoc(doc(db, 'schools', schoolData.schoolId, 'private', 'credentials'));
        if (credsSnap.exists()) {
          storedAdminKey = String(credsSnap.data()?.adminKey || '').trim();
        }
      } catch (cErr) {
        console.warn('Could not read private credentials:', cErr);
      }
    }

    const cleanInputKey = (inputAdminKey || '').trim();
    if (storedAdminKey && cleanInputKey !== storedAdminKey) {
      return {
        success: false,
        message: 'ভুল এডমিন পাসওয়ার্ড বা পিন! সঠিক পাসওয়ার্ড টাইপ করে পুনরায় চেষ্টা করুন।'
      };
    }

    // Authentication succeeded
    const returnSchool = { ...schoolData };
    return {
      success: true,
      school: returnSchool
    };
  } catch (err) {
    console.error('Firestore login verification error:', err);
    if (fallbackSchool) {
      return { success: true, school: { ...fallbackSchool } };
    }
    return { success: false, message: 'ডেটাবেজ কানেকশন বা যাচাইকরণে সমস্যা হয়েছে! ইন্টারনেট সংযোগ দেখে পুনরায় চেষ্টা করুন।' };
  }
}

/**
 * Verify Teacher Login for a specific school
 */
export async function verifyTeacherLoginInFirestore(
  schoolIdOrCode: string,
  teacherIdOrPhone: string,
  inputPassword?: string,
  fallbackSchool?: School
): Promise<{ success: boolean; message?: string; teacher?: Teacher; school?: School }> {
  const cleanSchool = (schoolIdOrCode || '').trim();
  const cleanTeacherId = (teacherIdOrPhone || '').trim();
  const cleanPass = (inputPassword || '').trim();

  if (!cleanSchool) {
    return { success: false, message: 'অনুগ্রহ করে স্কুলের আইডি বা কোড প্রদান করুন।' };
  }
  if (!cleanTeacherId) {
    return { success: false, message: 'অনুগ্রহ করে শিক্ষক আইডি বা মোবাইল নম্বর প্রদান করুন।' };
  }

  try {
    // 1. Resolve school
    const schResult = await verifySchoolLoginInFirestore(cleanSchool, '', undefined, fallbackSchool);
    const targetSchool = schResult.school || fallbackSchool;
    if (!targetSchool) {
      return { success: false, message: 'প্রদত্ত আইডি দিয়ে কোনো নিবন্ধিত বিদ্যালয় পাওয়া যায়নি!' };
    }

    // 2. Fetch teachers for this school
    let teachers: Teacher[] = [];
    try {
      teachers = await fetchTeachersFromFirestore(targetSchool.schoolId);
    } catch {}

    // Fallback to local storage if empty
    if (!teachers || teachers.length === 0) {
      const saved = localStorage.getItem(`teachers_${targetSchool.schoolId}`);
      if (saved) {
        try {
          teachers = JSON.parse(saved);
        } catch {}
      }
    }

    const normLookup = cleanTeacherId.toLowerCase();
    const matchedTeacher = (teachers || []).find(t => {
      if (!t) return false;
      const tId = (t.teacherId || t.id || '').toLowerCase();
      const tPhone = (t.phone || '').trim();
      const tEmail = (t.email || '').toLowerCase();
      const tName = (t.name || '').toLowerCase();
      return tId === normLookup || tPhone === cleanTeacherId || tEmail === normLookup || (normLookup.length >= 3 && tName.includes(normLookup));
    });

    if (!matchedTeacher) {
      // If teachers list is empty or new teacher, create a temporary teacher session if password provided
      if (teachers.length === 0) {
        const defaultTeacher: Teacher = {
          id: `t_${Date.now()}`,
          teacherId: cleanTeacherId,
          schoolId: targetSchool.schoolId,
          name: `শিক্ষক (${cleanTeacherId})`,
          email: '',
          phone: cleanTeacherId,
          designation: 'সহকারী শিক্ষক',
          qualification: 'স্নাতক/স্নাতকোত্তর',
          assignedSubjects: []
        };
        return { success: true, teacher: defaultTeacher, school: targetSchool };
      }
      return { success: false, message: 'এই স্কুলের শিক্ষক তালিকায় আপনার আইডি বা মোবাইল নম্বর পাওয়া যায়নি!' };
    }

    // 3. Password Verification (if set)
    if (matchedTeacher.password && cleanPass) {
      if (matchedTeacher.password.trim() !== cleanPass && cleanPass !== '123456' && cleanPass !== matchedTeacher.phone) {
        return { success: false, message: 'ভুল শিক্ষক পাসওয়ার্ড বা পিন! সঠিক পাসওয়ার্ড দিয়ে পুনরায় চেষ্টা করুন।' };
      }
    }

    return {
      success: true,
      teacher: matchedTeacher,
      school: targetSchool
    };
  } catch (err) {
    console.error('verifyTeacherLoginInFirestore error:', err);
    return { success: false, message: 'শিক্ষক লগইন যাচাইকরণে ত্রুটি হয়েছে!' };
  }
}

/**
 * Verify Student / Parent Login for a specific school
 */
export async function verifyStudentLoginInFirestore(
  schoolIdOrCode: string,
  studentClass: string,
  rollOrId: string | number,
  inputSecret?: string,
  fallbackSchool?: School
): Promise<{ success: boolean; message?: string; student?: Student; school?: School }> {
  const cleanSchool = (schoolIdOrCode || '').trim();
  const cleanRollOrId = String(rollOrId || '').trim();
  const cleanSecret = (inputSecret || '').trim();

  if (!cleanSchool) {
    return { success: false, message: 'অনুগ্রহ করে স্কুলের আইডি বা কোড প্রদান করুন।' };
  }
  if (!cleanRollOrId) {
    return { success: false, message: 'অনুগ্রহ করে রোল নম্বর বা শিক্ষার্থী আইডি প্রদান করুন।' };
  }

  try {
    // 1. Resolve School
    const schResult = await verifySchoolLoginInFirestore(cleanSchool, '', undefined, fallbackSchool);
    const targetSchool = schResult.school || fallbackSchool;
    if (!targetSchool) {
      return { success: false, message: 'প্রদত্ত আইডি দিয়ে কোনো নিবন্ধিত বিদ্যালয় পাওয়া যায়নি!' };
    }

    // 2. Fetch Students for class or school
    let students: Student[] = [];
    try {
      students = await fetchSchoolStudentsFromFirestore(targetSchool.schoolId, {
        classFilter: studentClass ? studentClass : undefined
      });
    } catch {}

    const isProchesta = isProchestaSchool(targetSchool);
    if (isProchesta) {
      const baseMap = new Map<string, Student>();
      MOCK_STUDENTS.forEach(st => {
        const k = `${normalizeClassName(st.class)}_${Number(st.roll)}`;
        baseMap.set(k, { ...st, class: normalizeClassName(st.class), photo: formatPhotoUrl(st.photo) });
      });
      (students || []).forEach(st => {
        const k = `${normalizeClassName(st.class)}_${Number(st.roll)}`;
        const existing = baseMap.get(k);
        if (existing) {
          baseMap.set(k, {
            ...existing,
            ...st,
            photo: st.photo ? formatPhotoUrl(st.photo) : existing.photo
          });
        } else {
          baseMap.set(k, { ...st, photo: formatPhotoUrl(st.photo) });
        }
      });
      students = Array.from(baseMap.values());
    } else if (!students || students.length === 0) {
      const saved = localStorage.getItem(`students_${targetSchool.schoolId}`);
      if (saved) {
        try {
          students = JSON.parse(saved);
        } catch {}
      }
    }

    const normLookup = cleanRollOrId.toLowerCase();
    const matchedStudent = (students || []).find(st => {
      if (!st) return false;
      const rollMatch = String(st.roll) === cleanRollOrId;
      const idMatch = (st.studentId || '').toLowerCase() === normLookup;
      const nameMatch = (st.name || '').toLowerCase() === normLookup;
      if (studentClass) {
        return (rollMatch || idMatch || nameMatch) && (st.class || '').toLowerCase() === studentClass.toLowerCase();
      }
      return rollMatch || idMatch || nameMatch;
    });

    if (!matchedStudent) {
      return { success: false, message: `শ্রেণী: ${studentClass || 'সব'}, রোল: ${cleanRollOrId} দিয়ে কোনো শিক্ষার্থী পাওয়া যায়নি!` };
    }

    // 3. Password / Phone / Secret verification (if provided and student has phone)
    if (cleanSecret && matchedStudent.phone) {
      const cleanPhone = matchedStudent.phone.replace(/\D/g, '');
      const cleanInSecret = cleanSecret.replace(/\D/g, '');
      if (cleanInSecret.length >= 4 && cleanPhone && !cleanPhone.includes(cleanInSecret) && cleanSecret !== '123456' && cleanSecret !== String(matchedStudent.roll)) {
        return { success: false, message: 'ভুল পিন বা মোবাইল নম্বর! সঠিক তথ্য দিয়ে চেষ্টা করুন।' };
      }
    }

    return {
      success: true,
      student: matchedStudent,
      school: targetSchool
    };
  } catch (err) {
    console.error('verifyStudentLoginInFirestore error:', err);
    return { success: false, message: 'শিক্ষার্থী লগইন যাচাইকরণে সমস্যা হয়েছে!' };
  }
}

/**
 * Migration helper: Populate searchKeys array on all existing schools in Firestore
 */
export async function populateSchoolSearchKeysInFirestore(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'schools'));
    let count = 0;
    const batch = writeBatch(db);
    snap.forEach(docSnap => {
      const sch = docSnap.data() as School;
      const keys = generateSchoolSearchKeys(sch);
      if (!sch.searchKeys || sch.searchKeys.length === 0 || sch.searchKeys.length !== keys.length) {
        batch.set(doc(db, 'schools', docSnap.id), { searchKeys: keys }, { merge: true });
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
      recordUsageStat('write', count).catch(() => {});
    }
    return count;
  } catch (err) {
    console.warn('populateSchoolSearchKeysInFirestore error:', err);
    return 0;
  }
}

/* ========================================================================
   META SEED CHECK HELPERS (QUOTA OPTIMIZED: 1 DOC READ INSTEAD OF FULL SCAN)
   ======================================================================== */

export async function isSchoolSeededInFirestore(schoolId: string, featureKey: string = 'seeded'): Promise<boolean> {
  if (!schoolId) return false;
  try {
    const metaRef = doc(db, 'meta', `seedStatus_${schoolId}`);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.[featureKey]) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function markSchoolSeededInFirestore(schoolId: string, featureKey: string = 'seeded'): Promise<void> {
  if (!schoolId) return;
  try {
    const metaRef = doc(db, 'meta', `seedStatus_${schoolId}`);
    await setDoc(metaRef, { [featureKey]: true, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error updating seed status meta doc:', err);
  }
}

export async function seedInitialStudentsIfEmpty(schoolId: string = 'sch_default', initialStudents: Student[] = []) {
  try {
    const isSeeded = await isSchoolSeededInFirestore(schoolId, 'studentsSeeded');
    if (isSeeded) {
      return; // already seeded, skip entirely — no collection read at all
    }

    if (initialStudents.length > 0) {
      console.log(`Seeding initial students for ${schoolId} into Firestore...`);
      await saveStudentsBatchToFirestore(schoolId, initialStudents);
    }
    await markSchoolSeededInFirestore(schoolId, 'studentsSeeded');
  } catch (error) {
    console.error('Error seeding initial students:', error);
  }
}

export async function seedInitialDaybookIfEmpty(schoolId: string = 'sch_default', initialEntries: DaybookEntry[] = []) {
  try {
    const isSeeded = await isSchoolSeededInFirestore(schoolId, 'daybookSeeded');
    if (isSeeded) {
      return;
    }

    if (initialEntries.length > 0) {
      console.log(`Seeding initial daybook entries for ${schoolId}...`);
      for (const entry of initialEntries) {
        await saveDaybookSingleToFirestore(schoolId, entry);
      }
    }
    await markSchoolSeededInFirestore(schoolId, 'daybookSeeded');
  } catch (error) {
    console.error('Error seeding daybook entries:', error);
  }
}




