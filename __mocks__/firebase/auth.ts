// __mocks__/firebase/auth.ts
// Vitest manual mock for Firebase Auth (modular v9 API)

import { vi } from "vitest";

export const signInWithEmailAndPassword = vi.fn();
export const createUserWithEmailAndPassword = vi.fn();
export const signOut = vi.fn();
export const reauthenticateWithCredential = vi.fn();
export const updatePassword = vi.fn();
export const deleteUser = vi.fn(); // your service imports: `deleteUser as authDeleteUser`
export const sendPasswordResetEmail = vi.fn();

// simple currentUser holder for getAuth()
let _currentUser: any = null;

export const getAuth = vi.fn(() => ({ currentUser: _currentUser }));

export const EmailAuthProvider = {
  credential: vi.fn((email: string, password: string) => ({ email, password })),
};

// ----- test helpers -----
export const __setCurrentUser = (u: any) => {
  _currentUser = u;
};
