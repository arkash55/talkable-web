'use client';

import { Box, Button, TextField, Typography } from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';

interface AuthFormProps {
  isSignup: boolean;
  onSubmit: (email: string, password: string) => void;
  error: string;
  setError: (msg: string) => void;
}

const AuthForm = ({ isSignup, onSubmit, error, setError }: AuthFormProps) => {
  const initialValues = { email: '', password: '' };

  const validationSchema = Yup.object({
    email: Yup.string().email('Invalid email').required('Required'),
    password: Yup.string().min(6, 'At least 6 characters').required('Required'),
  });

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 10, p: 4 }}>
      <Typography variant="h5" gutterBottom>
        {isSignup ? 'Sign Up' : 'Log In'}
      </Typography>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={async (values) => {
          setError('');
          try {
            await onSubmit(values.email, values.password);
          } catch (err: any) {
            setError(err.message);
          }
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
            />

            {error && (
              <Typography color="error" mt={1}>
                {error}
              </Typography>
            )}

            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
              {isSignup ? 'Create Account' : 'Log In'}
            </Button>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default AuthForm;
