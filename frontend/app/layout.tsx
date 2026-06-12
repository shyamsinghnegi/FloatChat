import './globals.css';
import Sidebar from './components/layout/Sidebar';
import { ChatProvider } from './context/ChatContext';

export const metadata = {
  title: 'FloatChat',
  description: 'AI assistant for ARGO oceanographic data',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
