'use client';

import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Stack,
  Paper,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import Grid from '@mui/material/Grid'; // classic Grid (v1) -> use container/item
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
      elevation={selected ? 6 : 1}
      sx={{
        p: 2,
        borderRadius: 2,
        cursor: 'pointer',
        border: theme => `2px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        minHeight: 120,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 0.5,
        transition: 'box-shadow .15s ease, transform .05s ease',
        '&:hover': { boxShadow: 6 },
        userSelect: 'none',
      }}
    >
      <Typography fontWeight={700} fontSize={16}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    </Paper>
  );
}

const BIG_BUTTON_SX = { py: 1.25, fontSize: '1rem' }; // bigger buttons

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

  // Combined preview (tone + voice)
  const previewSelection = (vals: { tone?: string; voice?: string; firstName?: string }) => {
    const tone = vals.tone || 'calm';
    const voice = vals.voice || 'en-GB-Standard-A';
    speakWithGoogleTTSClient(previewText || 'Hello!', tone, voice, vals.firstName);
  };

  return (
    <Box
      sx={{
        maxWidth: 900,
        mx: 'auto',
        my: { xs: 2, md: 6 },
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 4 },
        minHeight: '80vh',
      }}
    >
<Box sx={{ textAlign: 'center', mb: 2 }}>
  <Typography variant="h5" gutterBottom>
    Register
  </Typography>
  <Typography variant="body2" color="text.secondary">
    Step {step} of 3
  </Typography>
</Box>

      <Formik initialValues={initialValues} onSubmit={() => {}}>
        {({ errors, touched, values, setFieldValue, setErrors, setTouched }) => (
          <Form>
      
      {/* STEP 1 --------------------------------------------------- */}
      {step === 1 && (
        // Center children horizontally
        <Stack spacing={2} alignItems="center">
          {/* Capped-width column */}
          <Box sx={{ width: '100%', maxWidth: 440 }}>
            <Field
              as={TextField}
              label="Email"
              name="email"
              fullWidth
              error={touched.email && !!errors.email}
              helperText={touched.email && errors.email}
              disabled={isLoading}
              margin="normal"
            />
            <Field
              as={TextField}
              label="Password"
              name="password"
              type="password"
              fullWidth
              error={touched.password && !!errors.password}
              helperText={touched.password && errors.password}
              disabled={isLoading}
              margin="normal"
            />
            <Field
              as={TextField}
              label="Repeat Password"
              name="confirmPassword"
              type="password"
              fullWidth
              error={touched.confirmPassword && !!errors.confirmPassword}
              helperText={touched.confirmPassword && errors.confirmPassword}
              disabled={isLoading}
              margin="normal"
            />

            {error && (
              <Typography color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}

            {/* Buttons stacked: Continue on top, Login below */}
            <Stack spacing={1.5} sx={{ pt: 2 }}>
              <Button
                type="button"
                variant="contained"
                fullWidth
                size="large"
                sx={BIG_BUTTON_SX}
                disabled={isLoading}
                onClick={() => onNext1(values, { setErrors, setTouched } as any)}
              >
                {isLoading ? <CircularProgress size={22} /> : 'Continue'}
              </Button>

              <Button
                component={Link}
                href="/login"
                variant="text"
                fullWidth
                size="large"
                sx={BIG_BUTTON_SX}
                disabled={isLoading}
              >
                Already have an account? Log in
              </Button>
            </Stack>
          </Box>
        </Stack>
      )}
            {/* STEP 2 --------------------------------------------------- */}
            {step === 2 && (
              <Stack spacing={2}>
                {/* Equal-length name fields */}
                <Grid container spacing={2} alignItems="stretch">
                  <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                    <Field
                      as={TextField}
                      label="First Name"
                      name="firstName"
                      fullWidth
                      error={touched.firstName && !!errors.firstName}
                      helperText={touched.firstName && errors.firstName}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                    <Field
                      as={TextField}
                      label="Last Name"
                      name="lastName"
                      fullWidth
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
                  minRows={4}
                  error={touched.description && !!errors.description}
                  helperText={touched.description && errors.description}
                  disabled={isLoading}
                />

                {error && <Typography color="error">{error}</Typography>}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    fullWidth
                    size="large"
                    sx={BIG_BUTTON_SX}
                    onClick={() => setStep(1)}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={BIG_BUTTON_SX}
                    disabled={isLoading}
                    onClick={() => onNext2(values, { setErrors, setTouched } as any)}
                  >
                    Continue
                  </Button>
                </Stack>
              </Stack>
            )}

            {/* STEP 3 --------------------------------------------------- */}
            {step === 3 && (
              <Stack spacing={3}>
                {/* Tone selection */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Preferred tone</Typography>
                  <Grid container spacing={2} alignItems="stretch">
                    {TONES.map((t) => (
                      <Grid item xs={6} sm={4} md={3} key={t.key} sx={{ display: 'flex' }}>
                        <SelectCard
                          title={t.label}
                          subtitle={t.hint}
                          selected={values.tone === t.key}
                          onClick={() => {
                            setFieldValue('tone', t.key);
                            if (values.voice) previewSelection({ tone: t.key, voice: values.voice, firstName: values.firstName });
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  {touched.tone && errors.tone && (
                    <Typography color="error" variant="caption">{errors.tone}</Typography>
                  )}
                </Box>

                {/* Voice selection */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Voice (Google TTS)</Typography>

                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    sx={{ mb: 1 }}
                  >
                    <TextField
                      size="medium"
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      placeholder="Preview phrase"
                      fullWidth
                      disabled={isLoading}
                    />
                    <Button
                      size="large"
                      variant="outlined"
                      startIcon={<VolumeUpIcon />}
                      onClick={() => previewSelection({
                        tone: values.tone,
                        voice: values.voice,
                        firstName: values.firstName,
                      })}
                      disabled={!values.voice || !values.tone || isLoading}
                      sx={{ ...BIG_BUTTON_SX, whiteSpace: 'nowrap' }}
                    >
                      Listen
                    </Button>
                  </Stack>

                  <Grid container spacing={2} alignItems="stretch">
                    {VOICES.map((v) => (
                      <Grid item xs={12} sm={6} md={4} key={v.id} sx={{ display: 'flex' }}>
                        <SelectCard
                          title={v.label}
                          subtitle={v.hint || v.id}
                          selected={values.voice === v.id}
                          onClick={() => {
                            setFieldValue('voice', v.id);
                            if (values.tone) previewSelection({ tone: values.tone, voice: v.id, firstName: values.firstName });
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  {touched.voice && errors.voice && (
                    <Typography color="error" variant="caption">{errors.voice}</Typography>
                  )}
                </Box>

                {error && <Typography color="error">{error}</Typography>}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    type="button"
                    variant="outlined"
                    fullWidth
                    size="large"
                    sx={BIG_BUTTON_SX}
                    onClick={() => setStep(2)}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={BIG_BUTTON_SX}
                    onClick={() => onFinish(values, setErrors, setTouched)}
                    disabled={isLoading}
                  >
                    {isLoading ? <CircularProgress size={22} /> : 'Create account'}
                  </Button>
                </Stack>
              </Stack>
            )}
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default RegisterForm;
