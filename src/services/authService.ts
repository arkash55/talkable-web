import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../lib/fireBaseConfig';
import { error } from 'console';
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