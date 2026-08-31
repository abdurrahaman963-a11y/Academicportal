import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

let firebaseConfig: Record<string, any> = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Failed to parse firebase-applet-config.json:', e);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper to get GCP Access Token from Metadata Server when running on Cloud Run
async function getGcpAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      const data = await res.json();
      return data.access_token || null;
    }
  } catch {
    // Local / non-Cloud Run environment
  }
  return null;
}

// Secure Login Verification Endpoint (Runs server-side to prevent plaintext PIN leakage to client)
app.post('/api/verify-school-login', async (req, res) => {
  try {
    const { schoolId, inputAdminId, inputAdminKey } = req.body || {};
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'স্কুল আইডি প্রদান করা হয়নি!' });
    }

    const projectId = firebaseConfig.projectId;
    const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
    const token = await getGcpAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 1. Fetch public school document
    const schoolUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/schools/${encodeURIComponent(schoolId)}${token ? '' : '?key=' + firebaseConfig.apiKey}`;
    let schoolRes = await fetch(schoolUrl, { headers });
    let schoolDoc: any = null;
    let actualSchoolId = schoolId;

    if (schoolRes.ok) {
      schoolDoc = await schoolRes.json();
    } else {
      // Fallback query to match by code, schoolId, or name
      try {
        const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/schools${token ? '' : '?key=' + firebaseConfig.apiKey}`;
        const listRes = await fetch(listUrl, { headers });
        if (listRes.ok) {
          const listData = await listRes.json();
          const docs = listData.documents || [];
          const normQ = String(schoolId).replace(/\s+/g, ' ').trim().toLowerCase();
          const normAdmin = String(inputAdminId || '').replace(/\s+/g, ' ').trim().toLowerCase();

          for (const docItem of docs) {
            const f = docItem.fields || {};
            const docName = docItem.name?.split('/').pop() || '';
            const sCode = (f.code?.stringValue || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const sName = (f.name?.stringValue || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const sBengali = (f.nameBengali?.stringValue || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const sAdmin = (f.adminId?.stringValue || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const sId = (f.schoolId?.stringValue || docName).replace(/\s+/g, ' ').trim().toLowerCase();

            if (
              (normQ && (sId === normQ || sCode === normQ || sName === normQ || sBengali === normQ || sAdmin === normQ || sName.includes(normQ) || normQ.includes(sName))) ||
              (normAdmin && (sAdmin === normAdmin || sCode === normAdmin || sId === normAdmin))
            ) {
              schoolDoc = docItem;
              actualSchoolId = f.schoolId?.stringValue || docName;
              break;
            }
          }
        }
      } catch (scanErr) {
        console.warn('Server fallback scan warning:', scanErr);
      }
    }

    if (!schoolDoc) {
      return res.json({
        success: false,
        message: 'প্রদত্ত স্কুল কোড বা আইডি দিয়ে কোনো নিবন্ধিত বিদ্যালয় পাওয়া যায়নি!'
      });
    }

    const fields = schoolDoc.fields || {};

    // Parse public school object (stripping adminKey)
    const school: Record<string, any> = { schoolId: actualSchoolId };
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'adminKey') continue; // Never expose adminKey in public school object
      const val = v as any;
      if (val.stringValue !== undefined) school[k] = val.stringValue;
      else if (val.integerValue !== undefined) school[k] = Number(val.integerValue);
      else if (val.doubleValue !== undefined) school[k] = Number(val.doubleValue);
      else if (val.booleanValue !== undefined) school[k] = val.booleanValue;
      else if (val.nullValue !== undefined) school[k] = null;
    }

    // Verify Admin ID if school has adminId configured
    if (school.adminId && inputAdminId !== undefined && inputAdminId !== null) {
      const requiredAdminId = String(school.adminId).trim().toLowerCase();
      const cleanInputAdminId = String(inputAdminId).trim().toLowerCase();
      if (requiredAdminId && cleanInputAdminId && cleanInputAdminId !== requiredAdminId) {
        return res.json({
          success: false,
          message: 'ভুল এডমিন ইউজার আইডি! এই স্কুলের নির্ধারিত সঠিক এডমিন আইডি প্রদান করুন।'
        });
      }
    }

    // 2. Fetch private credentials document (stored under /schools/{schoolId}/private/credentials)
    const credsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/schools/${encodeURIComponent(actualSchoolId)}/private/credentials${token ? '' : '?key=' + firebaseConfig.apiKey}`;
    const credsRes = await fetch(credsUrl, { headers });

    let storedAdminKey = '';
    if (credsRes.ok) {
      const credsDoc = await credsRes.json();
      storedAdminKey = credsDoc.fields?.adminKey?.stringValue || '';
    } else {
      // Fallback check if adminKey was present on main doc prior to migration
      storedAdminKey = fields.adminKey?.stringValue || '';
    }

    const requiredAdminKey = storedAdminKey.trim();
    const cleanInput = (inputAdminKey || '').trim();

    if (requiredAdminKey && cleanInput !== requiredAdminKey) {
      return res.json({
        success: false,
        message: 'ভুল এডমিন পাসওয়ার্ড / পিন (Admin Password/PIN)! সঠিক পাসওয়ার্ড টাইপ করে পুনরায় চেষ্টা করুন।'
      });
    }

    return res.json({
      success: true,
      school
    });
  } catch (err) {
    console.error('API verify-school-login error:', err);
    return res.status(500).json({ success: false, message: 'সার্ভার প্রক্রিয়াকরণে ত্রুটি হয়েছে!' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
