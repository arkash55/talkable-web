'use client';

import LoginForm from '@/app/forms/LoginForm';
import { loginUser } from '@/services/authService';
import { useRouter } from 'next/navigation';
import { useState } from 'react';


export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setError('');

    try {
      await loginUser(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginForm
      error={error}
      setError={setError}
      handleSubmit={handleLogin}
      isLoading={isLoading}
    />
  );
}
