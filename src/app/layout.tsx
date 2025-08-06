import Header from './components/header/Header';
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
      <body>
        <CustomThemeProvider>
          <Header />
          {children}
        </CustomThemeProvider>
      </body>
    </html>
  );
}
