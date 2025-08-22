'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import RegisterForm, { RegisterPayload } from '@/app/forms/RegisterForm';
import { signupUser } from '@/services/authService';
import { addUser } from '@/services/firestoreService';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (payload: RegisterPayload) => {
    setIsLoading(true);
    setError('');
    try {
      const cred = await signupUser(payload.email, payload.password);
      const uid = cred.user.uid;

      await addUser(uid, {
        firstName: payload.firstName.trim(),
        lastName : payload.lastName.trim(),
        pronouns : '', // optional
        tone     : payload.tone.trim(),
        voice    : payload.voice.trim(),
        description: payload.description.trim(),
        email    : payload.email.trim(),
      });

      router.replace('/home');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RegisterForm
      error={error}
      setError={setError}
      handleSubmit={handleRegister}
      isLoading={isLoading}
    />
  );
}
