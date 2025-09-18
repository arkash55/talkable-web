// src/services/authService.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1) Mock FIRST — before any imports that might pull firebase/auth
vi.mock('firebase/auth', () => {
  const fns = {
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    updatePassword: vi.fn(),
    reauthenticateWithCredential: vi.fn(),
    deleteUser: vi.fn(),
  };
  let currentUser: any = null;
  return {
    ...fns,
    getAuth: vi.fn(() => ({ currentUser })),
    EmailAuthProvider: {
      credential: vi.fn((email: string, password: string) => ({ email, password })),
    },
    __setCurrentUser: (u: any) => { currentUser = u; },
  };
});

// 2) Now import the mocked module and your service (same module instance!)
import * as FirebaseAuth from 'firebase/auth';
import {
  loginUser, signupUser, logoutUser, requestPasswordReset, ensureEmailAvailable,
  changePassword, reauthWithPassword, deleteAccount, deleteAccountWithPassword,
  authErrorToMessage,
} from './authService';

beforeEach(() => {
  vi.clearAllMocks();
});

// ------- TESTS -------
describe('authService (unit)', () => {
  describe('loginUser', () => {
    it('calls signInWithEmailAndPassword with auth + credentials', async () => {
      (FirebaseAuth.signInWithEmailAndPassword as any).mockResolvedValue({ user: { uid: 'u1' } });

      const res = await loginUser('a@b.com', 'pw');

      expect(FirebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
      expect((FirebaseAuth.signInWithEmailAndPassword as any).mock.calls[0][1]).toBe('a@b.com');
      expect((FirebaseAuth.signInWithEmailAndPassword as any).mock.calls[0][2]).toBe('pw');
      expect(res.user.uid).toBe('u1');
    });
  });

  describe('signupUser', () => {
    it('calls createUserWithEmailAndPassword', async () => {
      (FirebaseAuth.createUserWithEmailAndPassword as any).mockResolvedValue({ user: { uid: 'new' } });

      const res = await signupUser('x@y.com', 'pw');
      expect(FirebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalled();
      expect(res.user.uid).toBe('new');
    });
  });

  describe('logoutUser', () => {
    it('calls signOut', async () => {
      (FirebaseAuth.signOut as any).mockResolvedValue(undefined);

      await expect(logoutUser()).resolves.toBeUndefined();
      expect(FirebaseAuth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestPasswordReset', () => {
    it('trims email and calls sendPasswordResetEmail', async () => {
      (FirebaseAuth.sendPasswordResetEmail as any).mockResolvedValue(undefined);

      await requestPasswordReset('  user@example.com  ');

      expect(FirebaseAuth.sendPasswordResetEmail)
        .toHaveBeenCalledWith(expect.anything(), 'user@example.com');
    });

    it('throws invalid-email when empty after trim', async () => {
      await expect(requestPasswordReset('   ')).rejects.toMatchObject({ message: 'auth/invalid-email' });
    });
  });

  describe('ensureEmailAvailable', () => {
    it('throws when /api/auth/check-email !ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false });
      await expect(ensureEmailAvailable('a@b.com')).rejects.toThrow(/Email check failed/i);
    });

    it('throws when available=false', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: false }) });
      await expect(ensureEmailAvailable('a@b.com')).rejects.toThrow(/already in use/i);
    });

    it('resolves when available=true', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true }) });
      await expect(ensureEmailAvailable('a@b.com')).resolves.toBeUndefined();
    });
  });

  describe('changePassword', () => {
    it('returns no-current-user when not signed in', async () => {
      (FirebaseAuth as any).__setCurrentUser(null);
      const r = await changePassword('old', 'new');
      expect(r).toEqual({ ok: false, code: 'no-current-user', message: expect.any(String) });
    });

    it('maps reauth wrong-password to wrong-old-password', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockRejectedValue({ code: 'auth/wrong-password' });

      const r = await changePassword('badold', 'newpw');
      expect(r).toEqual({ ok: false, code: 'wrong-old-password', message: expect.any(String) });
    });

    it('updates password on success', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockResolvedValue(undefined);
      (FirebaseAuth.updatePassword as any).mockResolvedValue(undefined);

      const r = await changePassword('old', 'new');
      expect(FirebaseAuth.reauthenticateWithCredential).toHaveBeenCalled();
      expect(FirebaseAuth.updatePassword).toHaveBeenCalledWith({ email: 'a@b.com' }, 'new');
      expect(r).toEqual({ ok: true });
    });

    it('maps updatePassword weak password', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockResolvedValue(undefined);
      (FirebaseAuth.updatePassword as any).mockRejectedValue({ code: 'auth/weak-password' });

      const r = await changePassword('old', 'short');
      expect(r).toEqual({ ok: false, code: 'weak-password', message: expect.any(String) });
    });

    it('maps requires-recent-login', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockResolvedValue(undefined);
      (FirebaseAuth.updatePassword as any).mockRejectedValue({ code: 'auth/requires-recent-login' });

      const r = await changePassword('old', 'new');
      expect(r).toEqual({ ok: false, code: 'requires-recent-login', message: expect.any(String) });
    });
  });

  describe('reauthWithPassword', () => {
    it('no current user', async () => {
      (FirebaseAuth as any).__setCurrentUser(null);
      const r = await reauthWithPassword('x');
      expect(r).toEqual({ ok: false, code: 'no-current-user', message: expect.any(String) });
    });

    it('wrong password maps correctly', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockRejectedValue({ code: 'auth/invalid-credential' });

      const r = await reauthWithPassword('bad');
      expect(r).toEqual({ ok: false, code: 'wrong-old-password', message: expect.any(String) });
    });

    it('success yields ok=true', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockResolvedValue(undefined);

      const r = await reauthWithPassword('good');
      expect(r).toEqual({ ok: true });
    });
  });

  describe('deleteAccount', () => {
    it('no current user → no-current-user', async () => {
      (FirebaseAuth as any).__setCurrentUser(null);
      const r = await deleteAccount();
      expect(r).toEqual({ ok: false, code: 'no-current-user', message: expect.any(String) });
    });

    it('requires recent login mapped', async () => {
      (FirebaseAuth as any).__setCurrentUser({ uid: '1' });
      (FirebaseAuth.deleteUser as any).mockRejectedValue({ code: 'auth/requires-recent-login' });

      const r = await deleteAccount();
      expect(r).toEqual({ ok: false, code: 'requires-recent-login', message: expect.any(String) });
    });

    it('success deletes', async () => {
      (FirebaseAuth as any).__setCurrentUser({ uid: '1' });
      (FirebaseAuth.deleteUser as any).mockResolvedValue(undefined);

      const r = await deleteAccount();
      expect(FirebaseAuth.deleteUser).toHaveBeenCalled();
      expect(r).toEqual({ ok: true });
    });
  });

  describe('deleteAccountWithPassword', () => {
    it('bubbles up reauth failure', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockRejectedValue({ code: 'auth/wrong-password' });

      const r = await deleteAccountWithPassword('bad');
      expect(r.ok).toBe(false);
    });

    it('reauth ok → calls deleteAccount', async () => {
      (FirebaseAuth as any).__setCurrentUser({ email: 'a@b.com', uid: '1' });
      (FirebaseAuth.reauthenticateWithCredential as any).mockResolvedValue(undefined);
      (FirebaseAuth.deleteUser as any).mockResolvedValue(undefined);

      const r = await deleteAccountWithPassword('good');
      expect(FirebaseAuth.reauthenticateWithCredential).toHaveBeenCalled();
      expect(FirebaseAuth.deleteUser).toHaveBeenCalled();
      expect(r).toEqual({ ok: true });
    });
  });

  describe('authErrorToMessage', () => {
    it('maps known codes and defaults', () => {
      expect(authErrorToMessage({ code: 'auth/wrong-password' })).toMatch(/incorrect/i);
      expect(authErrorToMessage({ code: 'auth/user-not-found' })).toMatch(/no account/i);
      expect(authErrorToMessage({ code: 'auth/network-request-failed' })).toMatch(/network/i);
      expect(authErrorToMessage({ code: 'something-else' })).toMatch(/sign-in failed/i);
    });
  });
});
