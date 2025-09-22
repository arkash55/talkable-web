import { auth } from '../../lib/fireBaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser as authDeleteUser,
  sendPasswordResetEmail,
} from 'firebase/auth';



export const loginUser = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const signupUser = async (email: string, password: string) => {
  return await createUserWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  return await signOut(auth);
};

export async function requestPasswordReset(email: string): Promise<void> {
  
  const clean = (email || '').trim();
  if (!clean) throw Object.assign(new Error('auth/invalid-email'), { code: 'auth/invalid-email' });

  await sendPasswordResetEmail(auth, clean);
}

export async function ensureEmailAvailable(email: string) {
  const res = await fetch('/api/auth/check-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    throw new Error('Email check failed. Please try again.');
  }
  const data = await res.json();
  if (!data?.available) {
    throw new Error('Email already in use');
  }
}

export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'wrong-old-password'
        | 'weak-password'
        | 'requires-recent-login'
        | 'too-many-requests'
        | 'no-current-user'
        | 'unknown';
      message: string;
    };

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const a = getAuth();
  const user = a.currentUser;

  if (!user || !user.email) {
    return {
      ok: false,
      code: 'no-current-user',
      message: 'You must be signed in to change your password.',
    };
  }

  
  try {
    const cred = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, cred);
  } catch (err: any) {
    const code = err?.code ?? 'unknown';
    const WRONG_SET = new Set([
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/invalid-login-credentials',
    ]);
    if (WRONG_SET.has(code)) {
      return {
        ok: false,
        code: 'wrong-old-password',
        message: 'Old password is incorrect.',
      };
    }
    if (code === 'auth/too-many-requests') {
      return {
        ok: false,
        code: 'too-many-requests',
        message: 'Too many attempts. Try again later.',
      };
    }
    if (code === 'auth/user-mismatch' || code === 'auth/user-not-found') {
      return {
        ok: false,
        code: 'no-current-user',
        message: 'Please sign in again and retry.',
      };
    }
    return { ok: false, code: 'unknown', message: 'Reauthentication failed.' };
  }

  
  try {
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (err: any) {
    const code = err?.code ?? 'unknown';
    if (code === 'auth/weak-password') {
      return {
        ok: false,
        code: 'weak-password',
        message: 'New password is too weak.',
      };
    }
    if (code === 'auth/requires-recent-login') {
      return {
        ok: false,
        code: 'requires-recent-login',
        message: 'Please sign in again and retry.',
      };
    }
    return { ok: false, code: 'unknown', message: 'Could not update password.' };
  }
}

export type ReauthResult =
  | { ok: true }
  | { ok: false; code: 'wrong-old-password' | 'no-current-user' | 'unknown'; message: string };

export async function reauthWithPassword(oldPassword: string): Promise<ReauthResult> {
  const a = getAuth();
  const user = a.currentUser;
  if (!user || !user.email) {
    return { ok: false, code: 'no-current-user', message: 'You must be signed in.' };
  }
  try {
    const cred = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, cred);
    return { ok: true };
  } catch (err: any) {
    const code = err?.code ?? 'unknown';
    if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(code)) {
      return { ok: false, code: 'wrong-old-password', message: 'Old password is incorrect.' };
    }
    return { ok: false, code: 'unknown', message: 'Reauthentication failed.' };
  }
}

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: 'no-current-user' | 'requires-recent-login' | 'unknown'; message: string };

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const a = getAuth();
  const user = a.currentUser;
  if (!user) return { ok: false, code: 'no-current-user', message: 'You must be signed in.' };
  try {
    await authDeleteUser(user);
    return { ok: true };
  } catch (err: any) {
    const code = err?.code ?? 'unknown';
    if (code === 'auth/requires-recent-login') {
      return { ok: false, code: 'requires-recent-login', message: 'Please sign in again to confirm deletion.' };
    }
    return { ok: false, code: 'unknown', message: 'Could not delete account.' };
  }
}


export async function deleteAccountWithPassword(oldPassword: string): Promise<DeleteAccountResult> {
  const r = await reauthWithPassword(oldPassword);
  if (!r.ok) {
    
    return { ok: false, code: r.code === 'no-current-user' ? 'no-current-user' : 'unknown', message: r.message };
  }
  return deleteAccount();
}

export function authErrorToMessage(e: any): string {
  const code = e?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Password is incorrect.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
