
import { auth } from '../../lib/fireBaseConfig';
import { error } from 'console';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";


/**
 * AuthService provides methods for user authentication.
 * It uses Firebase Authentication to handle sign-in, sign-up, and logout functionalities.
 */

export const loginUser = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const signupUser = async (email: string, password: string) => {
  return await createUserWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  return await signOut(auth);
};


export async function ensureEmailAvailable(email: string) {
  const res = await fetch('/api/auth/check-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  // If the route failed, surface a generic error
  
  if (!res.ok) {
    //  console.log(error);
    throw new Error('Email check failed. Please try again.');
   
  }
  const data = await res.json();
  if (!data?.available) {
    // Throw so your Step 1 handler can show the field error and stay on Step 1
    throw new Error('Email already in use');
  }
}



export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "wrong-old-password"
        | "weak-password"
        | "requires-recent-login"
        | "too-many-requests"
        | "no-current-user"
        | "unknown";
      message: string;
    };

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user || !user.email) {
    return {
      ok: false,
      code: "no-current-user",
      message: "You must be signed in to change your password.",
    };
  }

  // 1) Reauthenticate with the OLD password
  try {
    const cred = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, cred);
  } catch (err: any) {
    const code = err?.code ?? "unknown";
    const WRONG_SET = new Set([
      "auth/wrong-password",
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
    ]);
    if (WRONG_SET.has(code)) {
      return {
        ok: false,
        code: "wrong-old-password",
        message: "Old password is incorrect.",
      };
    }
    if (code === "auth/too-many-requests") {
      return {
        ok: false,
        code: "too-many-requests",
        message: "Too many attempts. Try again later.",
      };
    }
    if (code === "auth/user-mismatch" || code === "auth/user-not-found") {
      return {
        ok: false,
        code: "no-current-user",
        message: "Please sign in again and retry.",
      };
    }
    return { ok: false, code: "unknown", message: "Reauthentication failed." };
  }

  // 2) Update to the NEW password
  try {
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (err: any) {
    const code = err?.code ?? "unknown";
    if (code === "auth/weak-password") {
      return {
        ok: false,
        code: "weak-password",
        message: "New password is too weak.",
      };
    }
    if (code === "auth/requires-recent-login") {
      return {
        ok: false,
        code: "requires-recent-login",
        message: "Please sign in again and retry.",
      };
    }
    return { ok: false, code: "unknown", message: "Could not update password." };
  }
}