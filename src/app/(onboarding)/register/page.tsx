'use client';

import RegisterForm from '@/app/forms/RegisterForm';
import { signupUser } from '@/services/authService';
import { useRouter } from 'next/navigation';
import { useState } from 'react';


export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (email: string, password: string) => {
    setIsLoading(true);
    setError('');

    try {
      await signupUser(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
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
