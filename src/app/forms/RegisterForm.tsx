'use client';
import {
  Box, Button, TextField, Typography, CircularProgress, Stack
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { Formik, Form, Field, FormikHelpers } from 'formik';
import Link from 'next/link';
import { useState } from 'react';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';

import { RegisterFormProps } from './types/register';
import { TONES, VOICES, VOICE_MIN_COL, TONE_MIN_COL, CARD_HEIGHT, GRID_GAP } from './constants/voiceToneOptions';
import { step1Schema, step2Schema, step3Schema } from './schemas/registerSchemas';
import { SectionGrid } from './components/SectionGrid';
import { SelectCard } from './components/SelectCard';
import { ensureEmailAvailable } from '@/services/authService';

const RegisterForm = ({ error, setError, handleSubmit, isLoading }: RegisterFormProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [previewText, setPreviewText] = useState('Hello! This is my voice.');

  const initialValues = {
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    tone: '', voice: '', description: '',
  };

  // Helper to detect "email already used" from different sources (Firebase / API / generic)
  const isEmailTakenError = (err: any) => {
    const code = err?.code;
    const msg  = (err?.message || '').toLowerCase();
    return (
      code === 'auth/email-already-in-use' ||
      msg.includes('email already in use') ||
      msg.includes('email already exists') ||
      msg.includes('email is taken') ||
      msg.includes('email taken')
    );
  };

const onNext1 = async (
  values: typeof initialValues,
  helpers: FormikHelpers<typeof initialValues>
) => {
  const { setErrors, setTouched, setFieldError } = helpers;
  setError('');
  try {
    await step1Schema.validate(
      {
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
      },
      { abortEarly: false }
    );

    // 🔍 server-side check (throws if taken)
    await ensureEmailAvailable(values.email);

    setStep(2);
  } catch (e: any) {
    if (e?.name === 'ValidationError' && Array.isArray(e.inner)) {
      const formErrors: Record<string, string> = {};
      e.inner.forEach((err: any) => {
        if (err.path) formErrors[err.path] = err.message;
      });
      setTouched(
        Object.keys(formErrors).reduce((a: any, k) => ((a[k] = true), a), {}),
        false
      );
      setErrors(formErrors);
    } else {
      // Comes from ensureEmailAvailable
      setFieldError('email', e.message || 'Email check failed');
    }
  }
};


  const onNext2 = async (
    values: typeof initialValues,
    helpers: FormikHelpers<typeof initialValues>
  ) => {
    const { setErrors, setTouched } = helpers;
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
      setTouched(Object.keys(formErrors).reduce((a: any, k) => ((a[k] = true), a), {}), false);
      setErrors(formErrors);
    }
  };

  const onFinish = async (
    values: typeof initialValues,
    helpers: FormikHelpers<typeof initialValues>
  ) => {
    const { setErrors, setTouched, setFieldError } = helpers;
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
      // If backend / auth provider says email is taken: go back to step 1
      if (isEmailTakenError(e)) {
        setStep(1);
        setFieldError('email', 'Email already in use');
        setTouched({ email: true, password: true, confirmPassword: true }, false);
        return;
      }

      // Yup validation / other field errors
      const formErrors: Record<string, string> = {};
      e?.inner?.forEach((err: any) => { if (err.path) formErrors[err.path] = err.message; });
      if (Object.keys(formErrors).length) {
        setTouched(
          Object.keys(formErrors).reduce((a: any, k) => ((a[k] = true), a), {}),
          false
        );
        setErrors(formErrors);
      } else {
        // Generic error fallback
        setError(e?.message || 'Registration failed');
      }
    }
  };

  const previewSelection = (vals: { tone?: string; voice?: string; firstName?: string }) => {
    const tone = vals.tone || 'calm';
    const voice = vals.voice || 'en-GB-Standard-A';
    speakWithGoogleTTSClient(previewText || 'Hello!', tone, voice, vals.firstName);
  };

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', my: { xs: 2, md: 4 }, px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 }, minHeight: '80vh' }}>
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="h5" gutterBottom>Register</Typography>
        <Typography variant="body2" color="text.secondary">Step {step} of 3</Typography>
      </Box>

      <Formik initialValues={initialValues} onSubmit={() => {}}>
        {(formik) => {
          const {
            errors, touched, values, setFieldValue, setErrors, setTouched, isSubmitting
          } = formik;

          return (
            <Form>
              {step === 1 && (
                <Stack spacing={2} alignItems="center">
                  <Box sx={{ width: '100%', maxWidth: 440 }}>
                    <Field as={TextField} label="Email" name="email" fullWidth error={touched.email && !!errors.email} helperText={touched.email && errors.email} disabled={isLoading} margin="normal" />
                    <Field as={TextField} label="Password" name="password" type="password" fullWidth error={touched.password && !!errors.password} helperText={touched.password && errors.password} disabled={isLoading} margin="normal" />
                    <Field as={TextField} label="Repeat Password" name="confirmPassword" type="password" fullWidth error={touched.confirmPassword && !!errors.confirmPassword} helperText={touched.confirmPassword && errors.confirmPassword} disabled={isLoading} margin="normal" />
                    {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
                    <Stack spacing={1.5} sx={{ pt: 2 }}>
                      <Button
                        type="button"
                        variant="contained"
                        fullWidth
                        size="large"
                        sx={BIG_BUTTON_SX}
                        disabled={isLoading || isSubmitting}
                        onClick={() => onNext1(formik.values, formik)}
                      >
                        {isLoading ? <CircularProgress size={22} /> : 'Continue'}
                      </Button>
                      <Button component={Link} href="/login" variant="text" fullWidth size="large" sx={BIG_BUTTON_SX} disabled={isLoading}>
                        Already have an account? Log in
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              )}

              {step === 2 && (
                <Stack spacing={2} alignItems="center">
                  <Box sx={{ width: '100%', maxWidth: 980 }}>
                    <Stack spacing={2}>
                      <Field as={TextField} label="First Name" name="firstName" fullWidth error={touched.firstName && !!errors.firstName} helperText={touched.firstName && errors.firstName} disabled={isLoading} />
                      <Field as={TextField} label="Last Name" name="lastName" fullWidth error={touched.lastName && !!errors.lastName} helperText={touched.lastName && errors.lastName} disabled={isLoading} />
                      <Field as={TextField} label="Self Description" name="description" fullWidth multiline minRows={4} error={touched.description && !!errors.description} helperText={touched.description && errors.description} disabled={isLoading} />
                    </Stack>
                  </Box>
                  {error && <Typography color="error">{error}</Typography>}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, width: '100%' }}>
                    <Button type="button" variant="outlined" fullWidth size="large" sx={BIG_BUTTON_SX} onClick={() => setStep(1)} disabled={isLoading}>Back</Button>
                    <Button
                      type="button"
                      variant="contained"
                      fullWidth
                      size="large"
                      sx={BIG_BUTTON_SX}
                      disabled={isLoading || isSubmitting}
                      onClick={() => onNext2(formik.values, formik)}
                    >
                      Continue
                    </Button>
                  </Stack>
                </Stack>
              )}

              {step === 3 && (
                <Stack spacing={2} sx={{ overflow: 'hidden' }}>
                  <Box sx={{ width: '100%', mt: 1 }}>
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', lg: 'center' }} justifyContent="center" sx={{ width: '100%' }}>
                      <TextField size="small" fullWidth value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Preview phrase" disabled={isLoading} />
                      <Button
                        size="medium"
                        variant="outlined"
                        startIcon={<VolumeUpIcon />}
                        onClick={() => previewSelection({ tone: values.tone, voice: values.voice, firstName: values.firstName })}
                        disabled={!values.voice || !values.tone || isLoading}
                        sx={{ px: 3, minWidth: { md: 160 }, flexShrink: 0 }}
                      >
                        Listen
                      </Button>
                    </Stack>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 7, alignItems: 'stretch' }}>
                    <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" textAlign="center">Voice Selection</Typography>
                      <SectionGrid minColWidth={VOICE_MIN_COL} gap={GRID_GAP}>
                        {VOICES.map(v => (
                          <Box key={v.id}>
                            <SelectCard
                              title={v.label}
                              subtitle={v.hint || v.id}
                              selected={values.voice === v.id}
                              onClick={() => setFieldValue('voice', v.id)}
                              onPreview={() => previewSelection({ tone: values.tone || 'calm', voice: v.id, firstName: values.firstName })}
                              height={CARD_HEIGHT}
                            />
                          </Box>
                        ))}
                      </SectionGrid>
                      {touched.voice && errors.voice && <Typography color="error" variant="caption" textAlign="center">{errors.voice}</Typography>}
                    </Stack>

                    <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" textAlign="center">Preferred tone</Typography>
                      <SectionGrid minColWidth={TONE_MIN_COL} gap={GRID_GAP}>
                        {TONES.map(t => (
                          <Box key={t.key}>
                            <SelectCard
                              title={t.label}
                              subtitle={t.hint}
                              selected={values.tone === t.key}
                              onClick={() => setFieldValue('tone', t.key)}
                              onPreview={() => previewSelection({ tone: t.key, voice: values.voice || 'en-GB-Standard-A', firstName: values.firstName })}
                              height={CARD_HEIGHT}
                            />
                          </Box>
                        ))}
                      </SectionGrid>
                      {touched.tone && errors.tone && <Typography color="error" variant="caption" textAlign="center">{errors.tone}</Typography>}
                    </Stack>
                  </Box>

                  {error && <Typography color="error" textAlign="center">{error}</Typography>}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button type="button" variant="outlined" fullWidth size="large" sx={BIG_BUTTON_SX} onClick={() => setStep(2)} disabled={isLoading}>Back</Button>
                    <Button
                      type="button"
                      variant="contained"
                      fullWidth
                      size="large"
                      sx={BIG_BUTTON_SX}
                      onClick={() => onFinish(formik.values, formik)}
                      disabled={isLoading || isSubmitting}
                    >
                      {isLoading ? <CircularProgress size={22} /> : 'Create account'}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Form>
          );
        }}
      </Formik>
    </Box>
  );
};

export default RegisterForm;
