'use client';

import RegisterForm from '@/app/forms/RegisterForm';
import { signupUser } from '@/services/authService';
import { useRouter } from 'next/navigation';
import { useState } from 'react';


export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const handleRegister = async (email: string, password: string) => {
    try {
      await signupUser(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return <RegisterForm error={error} setError={setError} handleSubmit={handleRegister} />;
}
