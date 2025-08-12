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
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';
import { useState } from 'react';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';

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

/* ========================== Tweak these to fit tighter/looser ========================== */
// Equal card height (smaller values => shorter page)
const CARD_HEIGHT = { xs: 84, sm: 96, md: 100 };
// Grid gaps (px). Smaller => tighter rows/cols
const GRID_GAP = 2;
// Column min widths (px). Smaller => more columns per row inside each side column
const VOICE_MIN_COL = 160; // Voice (left) – typically 2 per row in half width
const TONE_MIN_COL  = 140; // Tone  (right) – typically 3 per row in half width
/* ====================================================================================== */

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

// Google TTS voices (examples)
const VOICES: { id: string; label: string; hint?: string }[] = [
  { id: 'en-GB-Standard-A', label: 'Standard A', hint: 'Female' },
  { id: 'en-GB-Standard-B', label: 'Standard B', hint: 'Male' },
  { id: 'en-GB-Standard-C', label: 'Standard C', hint: 'Female' },
  { id: 'en-GB-Standard-D', label: 'Standard D', hint: 'Male' },
  { id: 'en-GB-Neural2-A',  label: 'Neural2 A',  hint: 'Female (neural)' },
  { id: 'en-GB-Neural2-B',  label: 'Neural2 B',  hint: 'Male (neural)' },
];

// Validation
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

/* ========================== UI helpers ========================== */
function SelectCard({
  selected,
  onClick,
  onPreview,
  title,
  subtitle,
  height = CARD_HEIGHT,
}: {
  selected: boolean;
  onClick: () => void;
  onPreview?: () => void;
  title: string;
  subtitle?: string;
  height?: { xs: number; sm: number; md: number };
}) {
  return (
    <Paper
      onClick={onClick}
      elevation={selected ? 6 : 1}
      sx={{
        p: 1.25,
        borderRadius: 2,
        cursor: 'pointer',
        border: (t) => `2px solid ${selected ? t.palette.primary.main : 'transparent'}`,
        height,                       // 🔒 identical height
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 0.5,
        transition: 'box-shadow .15s ease',
        '&:hover': { boxShadow: 6 },
        userSelect: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} fontSize={15} noWrap>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          )}
        </Box>
        {onPreview && (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            aria-label={`Preview ${title}`}
          >
            <VolumeUpIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* selection indicator */}
      <Box
        sx={{
          height: 4,
          borderRadius: 10,
          bgcolor: selected ? 'primary.main' : 'action.hover',
          opacity: selected ? 1 : 0.6,
        }}
      />
    </Paper>
  );
}

function SectionGrid({
  children,
  minColWidth,
  gap = GRID_GAP,
}: {
  children: React.ReactNode;
  minColWidth: number;
  gap?: number;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        justifyContent: 'center', // center the last row
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',                // phones: 2 per row
          sm: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
        },
        gap,
        alignItems: 'stretch',
      }}
    >
      {children}
    </Box>
  );
}
/* =============================================================== */

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
        maxWidth: 980,
        mx: 'auto',
        my: { xs: 2, md: 4 },
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 3 },
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
              <Stack spacing={2} alignItems="center">
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
              <Stack spacing={2} alignItems="center">
                <Box sx={{ width: '100%', maxWidth: 980 }}>
                  <Stack spacing={2}>
                    <Field
                      as={TextField}
                      label="First Name"
                      name="firstName"
                      fullWidth
                      error={touched.firstName && !!errors.firstName}
                      helperText={touched.firstName && errors.firstName}
                      disabled={isLoading}
                    />
                    <Field
                      as={TextField}
                      label="Last Name"
                      name="lastName"
                      fullWidth
                      error={touched.lastName && !!errors.lastName}
                      helperText={touched.lastName && errors.lastName}
                      disabled={isLoading}
                    />
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
                  </Stack>
                </Box>

                {error && <Typography color="error">{error}</Typography>}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, width: '100%' }}>
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
              <Stack spacing={2} sx={{ overflow: 'hidden' /* no scroll */ }}>

 {/* Compact listen row (full width) */}
                 <Box sx={{ width: '100%', mt: 1 }}>
                  <Stack
                    direction={{ xs: 'column', lg: 'row' }}
                    spacing={1.25}
                    alignItems={{ xs: 'stretch', lg: 'center' }}
                    justifyContent="center"
                    sx={{ width: '100%', alignSelf: 'stretch' }}
                  >
                    <TextField
                      size="small"
                      fullWidth
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      placeholder="Preview phrase"
                      disabled={isLoading}
                    />
                    <Button
                      size="medium"
                      variant="outlined"
                      startIcon={<VolumeUpIcon />}
                      onClick={() =>
                        previewSelection({
                          tone: values.tone,
                          voice: values.voice,
                          firstName: values.firstName,
                        })
                      }
                      disabled={!values.voice || !values.tone || isLoading}
                      sx={{ px: 3, minWidth: { md: 160 }, flexShrink: 0 }}
                    >
                      Listen
                    </Button>
                  </Stack>
                </Box>


                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 7,
                    alignItems: 'stretch',
                  }}
                >
                  {/* LEFT: Voice */}
                  <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" textAlign="center">
                      Voice Selection
                    </Typography>

                   

                    <SectionGrid minColWidth={VOICE_MIN_COL} gap={GRID_GAP}>
                      {VOICES.map((v) => (
                        <Box key={v.id}>
                          <SelectCard
                            title={v.label}
                            subtitle={v.hint || v.id}
                            selected={values.voice === v.id}
                            onClick={() => setFieldValue('voice', v.id)}
                            onPreview={() =>
                              previewSelection({
                                tone: values.tone || 'calm',
                                voice: v.id,
                                firstName: values.firstName,
                              })
                            }
                            height={CARD_HEIGHT}
                          />
                        </Box>
                      ))}
                    </SectionGrid>
                    {touched.voice && errors.voice && (
                      <Typography color="error" variant="caption" textAlign="center">
                        {errors.voice}
                      </Typography>
                    )}
                  </Stack>

                  {/* RIGHT: Tone */}
                  <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" textAlign="center">
                      Preferred tone
                    </Typography>
                    <SectionGrid minColWidth={TONE_MIN_COL} gap={GRID_GAP}>
                      {TONES.map((t) => (
                        <Box key={t.key}>
                          <SelectCard
                            title={t.label}
                            subtitle={t.hint}
                            selected={values.tone === t.key}
                            onClick={() => setFieldValue('tone', t.key)}
                            onPreview={() =>
                              previewSelection({
                                tone: t.key,
                                voice: values.voice || 'en-GB-Standard-A',
                                firstName: values.firstName,
                              })
                            }
                            height={CARD_HEIGHT}
                          />
                        </Box>
                      ))}
                    </SectionGrid>
                    {touched.tone && errors.tone && (
                      <Typography color="error" variant="caption" textAlign="center">
                        {errors.tone}
                      </Typography>
                    )}
                  </Stack>
                </Box>


                

                {error && <Typography color="error" textAlign="center">{error}</Typography>}

                

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
