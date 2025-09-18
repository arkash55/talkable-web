import { vi } from "vitest";

// test/mocks/firebaseAuth.ts
export const signInWithEmailAndPassword = vi.fn();
export const createUserWithEmailAndPassword = vi.fn();
export const signOut = vi.fn();
export const sendPasswordResetEmail = vi.fn();
export const updatePassword = vi.fn();

let _currentUser: any = null;

export const getAuth = vi.fn(() => ({ currentUser: _currentUser }));
export const __setCurrentUser = (u: any) => { _currentUser = u; };

export const EmailAuthProvider = {
  credential: vi.fn((email: string, password: string) => ({ email, password })),
};

export const reauthenticateWithCredential = vi.fn();
export const deleteUser = vi.fn(); // alias for authDeleteUser in your code
