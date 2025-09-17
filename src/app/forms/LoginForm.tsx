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
  Stack,
  Alert,
} from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';
import { requestPasswordReset } from '@/services/authService';
import { KeyRound } from 'lucide-react'; // icon for the header badge

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

  // Helper to trigger reset (manual send from dialog)
  const doSendReset = async (email: string) => {
    setResetErr(null);
    setResetMsg(null);
    setResetLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setResetMsg('If an account exists for that email, we’ve sent a reset link.');
    } catch (e: any) {
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
    } finally {
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
              Don’t have an account? Register here!
            </Button>


              <Button
              
                    variant="text"
                    fullWidth
                    disabled={isLoading}
                onClick={() => {
                  setResetMsg(null);
                  setResetErr(null);
                  setResetEmail(values.email || '');
                  setResetOpen(true);
                }}
              >
                Forgot password? 
              </Button>
  


          </Form>
        )}
      </Formik>

      {/* Forgot Password Dialog — styled to match delete popup */}
      <Dialog
        open={resetOpen}
        onClose={() => !resetLoading && setResetOpen(false)}
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        keepMounted
        PaperProps={{
          sx: {
            width: 480,
            borderRadius: 3,
            p: 1,
            border: (t) => `1px solid ${t.palette.divider}`,
          },
        }}
      >
        <DialogTitle id="reset-title" sx={{ pb: 1 }}>
          <Stack alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => t.palette.primary.main,
                color: (t) => t.palette.common.white,
              }}
            >
              <KeyRound size={28} />
            </Box>

            <Typography variant="h6" align="center" sx={{ fontWeight: 700 }}>
              Reset your password
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent id="reset-desc" dividers sx={{ borderTop: 'none', borderBottom: 'none' }}>
          <Typography align="center" color="text.secondary">
            Enter your account email and we’ll send you a reset link.
          </Typography>

          {resetErr && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'center' }} onClose={() => setResetErr(null)}>
              {resetErr}
            </Alert>
          )}

          {resetMsg && (
            <Alert severity="success" sx={{ mt: 2, textAlign: 'center' }}>
              {resetMsg}
            </Alert>
          )}

          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            disabled={resetLoading}
            sx={{ mt: 2 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'center' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            width="100%"
          >
            <Button
              variant="outlined"
              sx={BIG_BUTTON_SX}
              onClick={() => setResetOpen(false)}
              disabled={resetLoading}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              sx={BIG_BUTTON_SX}
              onClick={() => doSendReset(resetEmail)}
              disabled={resetLoading || !resetEmail}
            >
              {resetLoading ? <CircularProgress size={22} /> : 'Send link'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoginForm;
