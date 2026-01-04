import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'ServiceDesk Pro',
  description: 'Modernes Helpdesk- & Service-Management-System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
