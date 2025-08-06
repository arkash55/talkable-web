'use client';
import { logoutUser } from '@/services/authService';
import { Button } from '@mui/material';

import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
  };

  return (
    <Button variant="outlined" color="error" onClick={handleLogout}>
      Logout
    </Button>
  );

}
