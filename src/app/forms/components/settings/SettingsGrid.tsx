// src/app/settings/SettingsGrid.tsx
'use client';

import * as React from 'react';
import { Grid } from '@mui/material';
import { useRouter } from 'next/navigation';
import SettingsTile from './SettingsGridTiles';
import { logoutUser } from '@/services/firestoreService';

// lucide-react icons
import {
  User,
  Palette,
  Accessibility as AccessibilityIcon,
  Mic,
  Volume2,
  ShieldCheck,
  Database,
  PlugZap,
  Info,
  LogOut,
  Trash2,
} from 'lucide-react';

type Item = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;            // where to push on click
  'data-testid'?: string;
  danger?: boolean;        // if true, styles the tile as a danger action
};

const ITEMS: Item[] = [
  { key: 'account',      title: 'Account',        subtitle: 'Profile & security',            icon: <User size={22} />,         href: '/settings/profile' },
  { key: 'audio',        title: 'Voice & Tone', Subtitle: 'TTS settings',            icon: <Volume2 size={22} />,      href: '/settings/tone-voice' },
  { key: 'privacy',      title: 'Privacy',        subtitle: 'Permissions & telemetry',       icon: <ShieldCheck size={22} />,  href: '/settings/privacy' },
  { key: 'about',        title: 'About',          subtitle: 'Version & credits',             icon: <Info size={22} />,         href: '/settings/about' },
  { key: 'delete',       title: 'Delete Account', subtitle: 'Permanently remove your data',  icon: <Trash2 size={22} />,      href: '/settings/delete', danger: true,
  },
  {
    key: 'logout', title: 'Log Out', subtitle: 'End your session safely', icon: <LogOut size={22} />, href: '/logout', danger: true },
  // { key: 'input',        title: 'Input (Mic)',    subtitle: 'Recording & devices',           icon: <Mic size={22} />,          href: '/settings/input' },
  // { key: 'appearance',   title: 'Appearance',     subtitle: 'Theme & layout',                icon: <Palette size={22} />,      href: '/settings/appearance' },
  // { key: 'accessibility',title: 'Accessibility',  subtitle: 'Text size, contrast, captions',icon: <AccessibilityIcon size={22} />, href: '/settings/accessibility' },
  // { key: 'integrations', title: 'Integrations',   subtitle: 'Watson/STT, TTS, APIs',         icon: <PlugZap size={22} />,      href: '/settings/integrations' },
  // { key: 'data',         title: 'Data',           subtitle: 'Storage & reset',               icon: <Database size={22} />,     href: '/settings/data' },
  
];

type Props = {
  onOpenSection?: (key: string) => void;
  selectedKey?: string;
  spacing?: number;
  cols?: { xs?: number; sm?: number; md?: number };
};

export default function SettingsGrid({
  onOpenSection,
  selectedKey,
  spacing = 2,
  cols = { xs: 12, sm: 6, md: 4 },
}: Props) {
  const router = useRouter();

  const handleClick = (item: Item) => async () => {
    onOpenSection?.(item.key);

    if (item.key === 'logout') {
      try {
        await logoutUser();
        // Redirect to auth entry (adjust path if your login route differs)
        router.replace('/login');
      } catch (e) {
        console.error('Logout failed:', e);
        // Fallback: hard reload to clear any client state
        window.location.href = '/login';
      }
      return; // prevent href navigation
    }

    if (item.href) router.push(item.href);
  };

  return (
    <Grid container spacing={spacing} display="flex" justifyContent="center">
      {ITEMS.map((item) => (
        <Grid rows={2} columns={3} item key={item.key} xs={cols.xs} sm={cols.sm} md={cols.md}>
          <SettingsTile
            title={item.title}
            subtitle={item.subtitle}
            icon={item.icon}
            onClick={handleClick(item)}
            selected={selectedKey === item.key}
            data-testid={item['data-testid'] ?? `tile-${item.key}`}
          />
        </Grid>
      ))}
    </Grid>
  );
}
