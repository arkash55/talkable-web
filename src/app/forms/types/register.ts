export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tone: string;
  voice: string;
  description: string;
};

export interface RegisterFormProps {
  error: string;
  setError: (msg: string) => void;
  handleSubmit: (data: RegisterPayload) => void | Promise<void>;
  isLoading: boolean;
}