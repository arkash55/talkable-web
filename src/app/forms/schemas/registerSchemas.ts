import * as Yup from 'yup';
import { TONES, VOICES } from '../constants/voiceToneOptions';

export const step1Schema = Yup.object({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(6, 'Minimum 6 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

export const step2Schema = Yup.object({
  firstName: Yup.string().required('First name is required'),
  lastName:  Yup.string().required('Last name is required'),
  description: Yup.string().required('Self description is required'),
});

export const step3Schema = Yup.object({
  tone:  Yup.string().oneOf(TONES.map(t => t.key)).required('Tone is required'),
  voice: Yup.string().oneOf(VOICES.map(v => v.id)).required('Voice is required'),
});