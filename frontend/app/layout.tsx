import { Source_Serif_4, Source_Sans_3 } from 'next/font/google';
import './globals.css';
import Sidebar from './components/layout/Sidebar';
import { ChatProvider } from './context/ChatContext';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  title: 'FloatChat',
  description: 'AI assistant for ARGO oceanographic data',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${sourceSans.variable}`}>
      <body>
        <ChatProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col h-screen overflow-y-auto">
              {children}
            </main>
          </div>
        </ChatProvider>
      </body>
    </html>
  );
}
