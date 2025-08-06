'use client';

import { Box, Button, TextField, Typography, CircularProgress } from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';

interface LoginFormProps {
  error: string;
  setError: (msg: string) => void;
  handleSubmit: (email: string, password: string) => void;
  isLoading: boolean;
}

const LoginForm = ({ error, setError, handleSubmit, isLoading }: LoginFormProps) => {
  const initialValues = { email: '', password: '' };

  const validationSchema = Yup.object({
    email: Yup.string().email('Invalid email').required('Email is required'),
    password: Yup.string().min(6, 'Minimum 6 characters').required('Password is required'),
  });

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
        {({ errors, touched }) => (
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
              sx={{ mt: 2 }}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
            >
              {isLoading ? 'Logging in...' : 'Log In'}
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
    </Box>
  );
};

export default LoginForm;
