'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Box, Button, TextField, Typography } from '@mui/material';
import { auth } from '../../../../lib/fireBaseConfig';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 10, p: 4 }}>
      <Typography variant="h5" gutterBottom>
        {isSignup ? 'Sign Up' : 'Log In'}
      </Typography>

      <TextField
        label="Email"
        fullWidth
        sx={{ my: 2 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <TextField
        label="Password"
        type="password"
        fullWidth
        sx={{ mb: 2 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <Typography color="error" mb={2}>
          {error}
        </Typography>
      )}

      <Button variant="contained" fullWidth onClick={handleSubmit}>
        {isSignup ? 'Create Account' : 'Log In'}
      </Button>

      <Button
        variant="text"
        fullWidth
        onClick={() => setIsSignup(!isSignup)}
        sx={{ mt: 2 }}
      >
        {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </Button>
    </Box>
  );
}
