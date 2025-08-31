import Header from './components/header/Header';
import { AuthProvider } from './context/AuthContext';
import { CustomThemeProvider } from './context/ThemeContext';
import './globals.css';
import { Inter, Roboto } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata = {
  title: 'My App',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${roboto.variable}`}>
      <body
        style={{
          height: '100vh',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <CustomThemeProvider>
          <AuthProvider>
            <Header />
            <main
              style={{
                flex: 1,
                overflow: 'hidden', // stop scrolling
              }}
            >
    
              <div
                style={{
                  height: '100%',
                  width: '100%',
                }}
              >
                {children}
              </div>
            </main>
          </AuthProvider>
        </CustomThemeProvider>
      </body>
    </html>
  );
}
