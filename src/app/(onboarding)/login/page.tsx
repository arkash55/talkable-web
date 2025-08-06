'use client';

import LoginForm from '@/app/forms/LoginForm';
import { loginUser } from '@/services/authService';
import { useRouter } from 'next/navigation';
import { useState } from 'react';


export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const handleLogin = async (email: string, password: string) => {
    try {
      await loginUser(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return <LoginForm error={error} setError={setError} handleSubmit={handleLogin} />;
}
