'use client';

import { Box, Button, TextField, Typography, CircularProgress, Stack } from '@mui/material';
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';
import { useState } from 'react';

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  mood: string;
  description: string;
};

interface RegisterFormProps {
  error: string;
  setError: (msg: string) => void;
  handleSubmit: (data: RegisterPayload) => void | Promise<void>;
  isLoading: boolean;
}

const step1Schema = Yup.object({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(6, 'Minimum 6 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

const step2Schema = Yup.object({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  mood: Yup.string().required('Mood is required'),
  description: Yup.string().required('Self description is required'),
});

const RegisterForm = ({ error, setError, handleSubmit, isLoading }: RegisterFormProps) => {
  const [step, setStep] = useState<1 | 2>(1);

  const initialValues = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    mood: '',
    description: '',
  };

  const onNext = async (
    values: typeof initialValues,
    helpers: FormikHelpers<typeof initialValues>
  ) => {
    setError('');
    try {
      await step1Schema.validate(
        { email: values.email, password: values.password, confirmPassword: values.confirmPassword },
        { abortEarly: false }
      );
      setStep(2);
    } catch (e: any) {
      const formErrors: Record<string, string> = {};
      e.inner?.forEach((err: any) => {
        if (err.path) formErrors[err.path] = err.message;
      });
      helpers.setTouched(
        Object.keys(formErrors).reduce((acc: any, k) => ((acc[k] = true), acc), {}),
        false
      );
      helpers.setErrors(formErrors);
    }
  };

  const onFinish = async (values: typeof initialValues) => {
    setError('');
    // Validate step 2 before final submit
    await step2Schema.validate(
      { firstName: values.firstName, lastName: values.lastName, mood: values.mood, description: values.description },
      { abortEarly: false }
    );

    await handleSubmit({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      mood: values.mood,
      description: values.description,
    });
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 10, p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Register
      </Typography>

      {/* subtle step indicator */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Step {step} of 2
      </Typography>

      <Formik initialValues={initialValues} onSubmit={() => {}}>
        {({ errors, touched, values, setFieldValue, setErrors, setTouched }) => (
          <Form>
            {step === 1 ? (
              <>
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

                <Field
                  as={TextField}
                  label="Repeat Password"
                  name="confirmPassword"
                  type="password"
                  fullWidth
                  margin="normal"
                  error={touched.confirmPassword && !!errors.confirmPassword}
                  helperText={touched.confirmPassword && errors.confirmPassword}
                  disabled={isLoading}
                />

                {error && (
                  <Typography color="error" mt={1}>
                    {error}
                  </Typography>
                )}

                <Button
                  type="button"
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} /> : null}
                  onClick={() => onNext(values, { setErrors, setTouched } as any)}
                >
                  {isLoading ? 'Checking…' : 'Continue'}
                </Button>

                <Button
                  component={Link}
                  href="/login"
                  variant="text"
                  fullWidth
                  sx={{ mt: 2 }}
                  disabled={isLoading}
                >
                  Already have an account? Log in
                </Button>
              </>
            ) : (
              <>
                <Field
                  as={TextField}
                  label="First Name"
                  name="firstName"
                  fullWidth
                  margin="normal"
                  error={touched.firstName && !!errors.firstName}
                  helperText={touched.firstName && errors.firstName}
                  disabled={isLoading}
                />

                <Field
                  as={TextField}
                  label="Last Name"
                  name="lastName"
                  fullWidth
                  margin="normal"
                  error={touched.lastName && !!errors.lastName}
                  helperText={touched.lastName && errors.lastName}
                  disabled={isLoading}
                />

                <Field
                  as={TextField}
                  label="Mood"
                  name="mood"
                  fullWidth
                  margin="normal"
                  error={touched.mood && !!errors.mood}
                  helperText={touched.mood && errors.mood}
                  disabled={isLoading}
                />

                <Field
                  as={TextField}
                  label="Self Description"
                  name="description"
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={3}
                  error={touched.description && !!errors.description}
                  helperText={touched.description && errors.description}
                  disabled={isLoading}
                />

                {error && (
                  <Typography color="error" mt={1}>
                    {error}
                  </Typography>
                )}

                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    fullWidth
                    onClick={() => setStep(1)}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="contained"
                    fullWidth
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} /> : null}
                    onClick={async () => {
                      try {
                        await step2Schema.validate(
                          {
                            firstName: values.firstName,
                            lastName: values.lastName,
                            mood: values.mood,
                            description: values.description,
                          },
                          { abortEarly: false }
                        );
                        await onFinish(values);
                      } catch (e: any) {
                        const formErrors: Record<string, string> = {};
                        e.inner?.forEach((err: any) => {
                          if (err.path) formErrors[err.path] = err.message;
                        });
                        setTouched(
                          Object.keys(formErrors).reduce((acc: any, k) => ((acc[k] = true), acc), {}),
                          false
                        );
                        setErrors(formErrors);
                      }
                    }}
                  >
                    {isLoading ? 'Creating…' : 'Create account'}
                  </Button>
                </Stack>
              </>
            )}
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default RegisterForm;
