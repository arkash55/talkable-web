'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  TextField,
  Typography,
  Button,
  Alert,
  Collapse,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { changePassword } from '@/services/authService';
import { BIG_BUTTON_SX } from '@/app/styles/buttonStyles';

const Schema = Yup.object({
  oldPwd: Yup.string().required('Enter your current password.'),
  newPwd: Yup.string()
    .required('Enter a new password.')
    .min(8, 'New password must be at least 8 characters.')
    .notOneOf([Yup.ref('oldPwd')], 'New password must be different from the old password.'),
  confirmPwd: Yup.string()
    .required('Confirm your new password.')
    .oneOf([Yup.ref('newPwd')], 'New passwords do not match.'),
});

export default function ChangePasswordPage() {
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'center' }}>
      <Paper
        elevation={1}
        sx={{
          width: '100%',
          maxWidth: 720,
          p: { xs: 2, md: 3 },
          border: (t) => `1px solid ${t.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <Stack spacing={2.5}>
          <Typography variant="h5" fontWeight={700}>
            Change Password
          </Typography>
        <Typography variant="body2" color="text.secondary">
        Choose a new password to keep your account secure.
        </Typography>

          <Formik
            initialValues={{ oldPwd: '', newPwd: '', confirmPwd: '' }}
            validationSchema={Schema}
            initialStatus={{ error: null as string | null }}
            onSubmit={async (values, { setSubmitting, setStatus, resetForm }) => {
              setStatus({ error: null });
              setSuccessOpen(false);

              const res = await changePassword(values.oldPwd, values.newPwd);
              setSubmitting(false);



                if (!res.ok) {
                const msg =
                    res.code === "wrong-old-password"
                    ? "Old password is incorrect."
                    : "Something went wrong. Please try again later.";
                setStatus({ error: msg });
                return;
                }


              setSuccessOpen(true);
              resetForm();
              setTimeout(() => setSuccessOpen(false), 4000);
            }}
          >
            {({
              values,
              errors,
              touched,
              handleChange,
              handleBlur,
              isSubmitting,
              isValid,
              dirty,
              status,
              setStatus,
              resetForm,
            }) => (
              <Form noValidate>
                <Collapse in={successOpen} sx={{ mb: 1 }}>
                  <Alert severity="success" onClose={() => setSuccessOpen(false)}>
                    Password updated successfully.
                  </Alert>
                </Collapse>

                {status?.error && (
                  <Alert severity="error" sx={{ mb: 1 }} onClose={() => setStatus({ error: null })}>
                    {status.error}
                  </Alert>
                )}

                <Stack spacing={2.5}>
                  <TextField
                    name="oldPwd"
                    label="Old password"
                    type={showOld ? 'text' : 'password'}
                    value={values.oldPwd}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    autoComplete="current-password"
                    error={touched.oldPwd && Boolean(errors.oldPwd)}
                    helperText={(touched.oldPwd && errors.oldPwd)}
                    disabled={isSubmitting}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowOld((s) => !s)}
                            edge="end"
                            aria-label="toggle old password visibility"
                          >
                            {showOld ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    name="newPwd"
                    label="New password"
                    type={showNew ? 'text' : 'password'}
                    value={values.newPwd}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    autoComplete="new-password"
                    error={touched.newPwd && Boolean(errors.newPwd)}
                    helperText={(touched.newPwd && errors.newPwd)}
                    disabled={isSubmitting}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowNew((s) => !s)}
                            edge="end"
                            aria-label="toggle new password visibility"
                          >
                            {showNew ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    name="confirmPwd"
                    label="Confirm new password"
                    type={showConfirm ? 'text' : 'password'}
                    value={values.confirmPwd}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    autoComplete="new-password"
                    error={touched.confirmPwd && Boolean(errors.confirmPwd)}
                    helperText={(touched.confirmPwd && errors.confirmPwd)}
                    disabled={isSubmitting}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirm((s) => !s)}
                            edge="end"
                            aria-label="toggle confirm password visibility"
                          >
                            {showConfirm ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />






                  <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ pt: 1 }}>
                    <Button
                      variant="outlined"
                      sx={BIG_BUTTON_SX}
                      onClick={() => {
                        resetForm();
                        setStatus({ error: null });
                      }}
                      disabled={isSubmitting}
                    >
                      Clear
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      sx={BIG_BUTTON_SX}
                      disabled={isSubmitting || !dirty || !isValid}
                    >
                      {isSubmitting ? <CircularProgress size={22} /> : 'Save changes'}
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            )}
          </Formik>
        </Stack>
      </Paper>
    </Box>
  );
}
