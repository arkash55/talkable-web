'use client';

import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Stack,
  Paper,
  IconButton,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import Grid from '@mui/material/Grid'; // MUI v6 Grid (v2 API)
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';
import { useState } from 'react';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tone: string;
  voice: string;
  description: string;
};

interface RegisterFormProps {
  error: string;
  setError: (msg: string) => void;
  handleSubmit: (data: RegisterPayload) => void | Promise<void>;
  isLoading: boolean;
}

// Tone options
const TONES: { key: string; label: string; hint: string }[] = [
  { key: 'friendly',     label: 'Friendly',     hint: 'warm & upbeat' },
  { key: 'confident',    label: 'Confident',    hint: 'clear & steady' },
  { key: 'cheerful',     label: 'Cheerful',     hint: 'bright & lively' },
  { key: 'calm',         label: 'Calm',         hint: 'slow & relaxed' },
  { key: 'enthusiastic', label: 'Enthusiastic', hint: 'energetic' },
  { key: 'serious',      label: 'Serious',      hint: 'formal' },
  { key: 'sad',          label: 'Sad',          hint: 'soft & low' },
  { key: 'angry',        label: 'Angry',        hint: 'firm & fast' },
];

// Example Google TTS voices
const VOICES: { id: string; label: string; hint?: string }[] = [
  { id: 'en-GB-Standard-A', label: 'Standard A', hint: 'Female' },
  { id: 'en-GB-Standard-B', label: 'Standard B', hint: 'Male' },
  { id: 'en-GB-Standard-C', label: 'Standard C', hint: 'Female' },
  { id: 'en-GB-Standard-D', label: 'Standard D', hint: 'Male' },
  { id: 'en-GB-Neural2-A',  label: 'Neural2 A',  hint: 'Female (neural)' },
  { id: 'en-GB-Neural2-B',  label: 'Neural2 B',  hint: 'Male (neural)' },
];

const step1Schema = Yup.object({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(6, 'Minimum 6 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

const step2Schema = Yup.object({
  firstName: Yup.string().required('First name is required'),
  lastName:  Yup.string().required('Last name is required'),
  description: Yup.string().required('Self description is required'),
});

const step3Schema = Yup.object({
  tone:  Yup.string().oneOf(TONES.map(t => t.key)).required('Tone is required'),
  voice: Yup.string().oneOf(VOICES.map(v => v.id)).required('Voice is required'),
});

function SelectCard({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <Paper
      onClick={onClick}
      elevation={selected ? 4 : 1}
      sx={{
        p: 1.5,                // reduced padding
        borderRadius: 1.5,
        cursor: 'pointer',
        border: theme => `2px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        minHeight: 80,         // reduced height
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0.25,             // reduced gap
        transition: 'all .15s ease',
        '&:hover': { elevation: 3 },
      }}
    >
      <Typography fontWeight={600} fontSize={14} textAlign="center">{title}</Typography>
      {subtitle && <Typography variant="caption" color="text.secondary" textAlign="center">{subtitle}</Typography>}
    </Paper>
  );
}

const RegisterForm = ({ error, setError, handleSubmit, isLoading }: RegisterFormProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [previewText, setPreviewText] = useState('Hello! This is my voice.');

  const initialValues = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    tone: '',
    voice: '',
    description: '',
  };

  const onNext1 = async (
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
      e.inner?.forEach((err: any) => { if (err.path) formErrors[err.path] = err.message; });
      helpers.setTouched(Object.keys(formErrors).reduce((a: any, k) => ((a[k] = true), a), {}), false);
      helpers.setErrors(formErrors);
    }
  };

  const onNext2 = async (
    values: typeof initialValues,
    helpers: FormikHelpers<typeof initialValues>
  ) => {
    setError('');
    try {
      await step2Schema.validate(
        { firstName: values.firstName, lastName: values.lastName, description: values.description },
        { abortEarly: false }
      );
      setStep(3);
    } catch (e: any) {
      const formErrors: Record<string, string> = {};
      e.inner?.forEach((err: any) => { if (err.path) formErrors[err.path] = err.message; });
      helpers.setTouched(Object.keys(formErrors).reduce((a: any, k) => ((a[k] = true), a), {}), false);
      helpers.setErrors(formErrors);
    }
  };

  const onFinish = async (
    values: typeof initialValues,
    setErrors: any,
    setTouched: any
  ) => {
    setError('');
    try {
      await step3Schema.validate(
        { tone: values.tone, voice: values.voice },
        { abortEarly: false }
      );
      await handleSubmit({
        firstName: values.firstName,
        lastName : values.lastName,
        email    : values.email,
        password : values.password,
        tone     : values.tone,
        voice    : values.voice,
        description: values.description,
      });
    } catch (e: any) {
      const formErrors: Record<string, string> = {};
      e.inner?.forEach((err: any) => { if (err.path) formErrors[err.path] = err.message; });
      setTouched(Object.keys(formErrors).reduce((a: any, k) => ((a[k] = true), a), {}), false);
      setErrors(formErrors);
    }
  };

  // Combined TTS preview (tone + voice)
  const previewSelection = (vals: { tone?: string; voice?: string; firstName?: string }) => {
    const tone = vals.tone || 'calm';
    const voice = vals.voice || 'en-GB-Standard-A';
    speakWithGoogleTTSClient(previewText || 'Hello!', tone, voice, vals.firstName);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 2, p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" gutterBottom>Register</Typography>
        <Typography variant="body2" color="text.secondary">Step {step} of 3</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Formik initialValues={initialValues} onSubmit={() => {}}>
          {({ errors, touched, values, setFieldValue, setErrors, setTouched }) => (
            <Form style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* STEP 1 - unchanged */}
              {step === 1 && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Field
                    as={TextField}
                    label="Email"
                    name="email"
                    fullWidth
                    size="small"
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
                    size="small"
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
                    size="small"
                    error={touched.confirmPassword && !!errors.confirmPassword}
                    helperText={touched.confirmPassword && errors.confirmPassword}
                    disabled={isLoading}
                  />

                  {error && <Typography color="error" variant="body2">{error}</Typography>}

                  <Box sx={{ mt: 'auto', pt: 2 }}>
                    <Button
                      type="button"
                      variant="contained"
                      fullWidth
                      disabled={isLoading}
                      onClick={() => onNext1(values, { setErrors, setTouched } as any)}
                    >
                      Continue
                    </Button>
                    <Button
                      component={Link}
                      href="/login"
                      variant="text"
                      fullWidth
                      sx={{ mt: 1 }}
                    >
                      Already have an account? Log in
                    </Button>
                  </Box>
                </Box>
              )}

              {/* STEP 2 - compact */}
              {step === 2 && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Field
                        as={TextField}
                        label="First Name"
                        name="firstName"
                        fullWidth
                        size="small"
                        error={touched.firstName && !!errors.firstName}
                        helperText={touched.firstName && errors.firstName}
                        disabled={isLoading}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Field
                        as={TextField}
                        label="Last Name"
                        name="lastName"
                        fullWidth
                        size="small"
                        error={touched.lastName && !!errors.lastName}
                        helperText={touched.lastName && errors.lastName}
                        disabled={isLoading}
                      />
                    </Grid>
                  </Grid>

                  <Field
                    as={TextField}
                    label="Self Description"
                    name="description"
                    fullWidth
                    multiline
                    rows={3}          // reduced from minRows={4}
                    size="small"
                    error={touched.description && !!errors.description}
                    helperText={touched.description && errors.description}
                    disabled={isLoading}
                  />

                  {error && <Typography color="error" variant="body2">{error}</Typography>}

                  <Box sx={{ mt: 'auto', pt: 2 }}>
                    <Stack direction="row" spacing={2}>
                      <Button variant="outlined" fullWidth onClick={() => setStep(1)}>Back</Button>
                      <Button variant="contained" fullWidth onClick={() => onNext2(values, { setErrors, setTouched } as any)}>Continue</Button>
                    </Stack>
                  </Box>
                </Box>
              )}

              {/* STEP 3 - most compact */}
              {step === 3 && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Tone selection - compact */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Preferred tone</Typography>
                    <Grid container spacing={1}>
                      {TONES.map((t) => (
                        <Grid size={{ xs: 3, sm: 3, md: 3 }} key={t.key}>
                          <SelectCard
                            title={t.label}
                            subtitle={t.hint}
                            selected={values.tone === t.key}
                            onClick={() => setFieldValue('tone', t.key)}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    {touched.tone && errors.tone && (
                      <Typography color="error" variant="caption">{errors.tone}</Typography>
                    )}
                  </Box>

                  {/* Voice selection - compact */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Voice</Typography>
                    <Grid container spacing={1}>
                      {VOICES.map((v) => (
                        <Grid size={{ xs: 4, sm: 4, md: 4 }} key={v.id}>
                          <SelectCard
                            title={v.label}
                            subtitle={v.hint}
                            selected={values.voice === v.id}
                            onClick={() => setFieldValue('voice', v.id)}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    {touched.voice && errors.voice && (
                      <Typography color="error" variant="caption">{errors.voice}</Typography>
                    )}
                  </Box>

                  {/* Preview - inline and compact */}
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        placeholder="Preview text..."
                        sx={{ flex: 1 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VolumeUpIcon />}
                        onClick={() => previewSelection({ tone: values.tone, voice: values.voice, firstName: values.firstName })}
                        disabled={!values.voice || !values.tone}
                      >
                        Listen
                      </Button>
                    </Stack>
                  </Box>

                  {error && <Typography color="error" variant="body2">{error}</Typography>}

                  <Box sx={{ mt: 'auto', pt: 1 }}>
                    <Stack direction="row" spacing={2}>
                      <Button variant="outlined" fullWidth onClick={() => setStep(2)}>Back</Button>
                      <Button 
                        variant="contained" 
                        fullWidth 
                        onClick={() => onFinish(values, setErrors, setTouched)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Creating…' : 'Create account'}
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              )}
            </Form>
          )}
        </Formik>
      </Box>
    </Box>
  );
};

export default RegisterForm;
