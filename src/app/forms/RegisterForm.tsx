'use client';

import { Box, Button, TextField, Typography } from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';

interface RegisterFormProps {
  error: string;
  setError: (msg: string) => void;
  handleSubmit: (email: string, password: string) => void;
}

const RegisterForm = ({ error, setError, handleSubmit }: RegisterFormProps) => {
  const initialValues = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  };

  const validationSchema = Yup.object({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    password: Yup.string().min(6, 'Minimum 6 characters').required('Password is required'),
  });

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 10, p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Register
      </Typography>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={async (values) => {
          setError('');
          await handleSubmit(values.email, values.password); // only use email/password for now
        }}
      >
        {({ errors, touched }) => (
          <Form>
            <Field
              as={TextField}
              label="First Name"
              name="firstName"
              fullWidth
              margin="normal"
              error={touched.firstName && !!errors.firstName}
              helperText={touched.firstName && errors.firstName}
            />

            <Field
              as={TextField}
              label="Last Name"
              name="lastName"
              fullWidth
              margin="normal"
              error={touched.lastName && !!errors.lastName}
              helperText={touched.lastName && errors.lastName}
            />

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
              Register
            </Button>

            <Button
              component={Link}
              href="/login"
              variant="text"
              fullWidth
              sx={{ mt: 2 }}
            >
              Already have an account? Log in
            </Button>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default RegisterForm;
