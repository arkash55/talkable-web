'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';
import { requestPasswordReset } from '@/services/authService';
 // ← adjust path if needed

interface LoginFormProps {
  error: string;
  setError: (msg: string) => void;
  handleSubmit: (email: string, password: string) => void;
  isLoading: boolean;
}

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(6, 'Minimum 6 characters').required('Password is required'),
});

const LoginForm = ({ error, setError, handleSubmit, isLoading }: LoginFormProps) => {
  const initialValues = { email: '', password: '' };

  // Forgot-password dialog state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

  // Helper to trigger reset (shared by inline and dialog flows)
  const doSendReset = async (email: string) => {
    setResetErr(null);
    setResetMsg(null);
    setResetLoading(true);
    try {
      await requestPasswordReset(email);
      setResetMsg('If an account exists for that email, we’ve sent a reset link.');
      // If opened via dialog, you can close after success:
      setTimeout(() => {
        setResetOpen(false);
        setResetEmail('');
        setResetLoading(false);
      }, 800);
    } catch (e: any) {
      console.warn('Password reset error:', e); // look for e.code like "auth/invalid-continue-uri"

      const code: string = e?.code || '';
      if (code === 'auth/invalid-continue-uri' || code === 'auth/domain-not-whitelisted') {
        setResetErr('Return URL is not allowed. Check Authorized domains in Firebase.');
      } else if (code === 'auth/invalid-email') {
        setResetErr('Please enter a valid email.');
      } else if (code === 'auth/too-many-requests') {
        setResetErr('Too many attempts. Try again later.');
      } else {
        setResetErr("Couldn't send the link. Please try again.");
      }
      setResetLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 10, p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Log In
      </Typography>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={async (values) => {
          setError('');
          await handleSubmit(values.email, values.password);
        }}
      >
        {({ errors, touched, values }) => (
          <Form>
            <Field
              as={TextField}
              label="Email"
              name="email"
              fullWidth
              margin="normal"
              error={touched.email && !!errors.email}
              helperText={touched.email && errors.email}
              disabled={isLoading}
            />

            <Field
              as={TextField}
              label="Password"
              name="password"
              type="password"
              fullWidth
              margin="normal"
              error={touched.password && !!errors.password}
              helperText={touched.password && errors.password}
              disabled={isLoading}
            />

            {/* Forgot password link */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <Button
                type="button"
                variant="text"
                size="small"
                disabled={isLoading}
                onClick={async () => {
                  // If email field is present and not invalid, send directly
                  const hasValidEmail =
                    !!values.email && !Yup.string().email().isValidSync
                      ? // fallback, but Yup string().email().isValidSync isn't a fn—do a quick regex instead
                        false
                      : true;

                  // Quick email regex (keeps UI snappy without re-validating Formik)
                  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email || '');
                  if (values.email && emailLooksValid) {
                    setResetOpen(true); // open to show feedback quickly
                    setResetEmail(values.email);
                    await doSendReset(values.email);
                  } else {
                    // Open dialog to collect an email
                    setResetEmail('');
                    setResetOpen(true);
                    setResetMsg(null);
                    setResetErr(null);
                  }
                }}
              >
                Forgot password?
              </Button>
            </Box>

            {error && (
              <Typography color="error" mt={1}>
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ ...BIG_BUTTON_SX, ...{ mt: 2 } }}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={22} /> : 'Log In'}
            </Button>

            <Button
              component={Link}
              href="/register"
              variant="text"
              fullWidth
              sx={{ mt: 2 }}
              disabled={isLoading}
            >
              Don’t have an account? Register
            </Button>
          </Form>
        )}
      </Formik>

      {/* Forgot Password Dialog */}
      <Dialog open={resetOpen} onClose={() => !resetLoading && setResetOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reset your password</DialogTitle>
        <DialogContent>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            disabled={resetLoading}
          />
          {resetErr && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {resetErr}
            </Typography>
          )}
          {resetMsg && (
            <Typography color="success.main" variant="body2" sx={{ mt: 1 }}>
              {resetMsg}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => doSendReset(resetEmail)}
            disabled={resetLoading || !resetEmail}
          >
            {resetLoading ? <CircularProgress size={20} /> : 'Send link'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoginForm;
