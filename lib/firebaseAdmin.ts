import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY missing');

  let credentials: any;

  // Raw JSON string
  if (raw.trim().startsWith('{')) {
    credentials = JSON.parse(raw);
  } else {
    // Base64?
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      if (decoded.trim().startsWith('{')) {
        credentials = JSON.parse(decoded);
      }
    } catch {/* ignore */}
  }

  // File path
  if (!credentials) {
    const filePath = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Service account file not found at ${filePath}`);
    }
    credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // Replace escaped \n in privateKey if needed
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
    }),
  });
  console.log('Firebase Admin initialized successfully');
}

export const adminAuth = admin.auth();
