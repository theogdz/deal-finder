import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DealFinder — Get alerts for Craigslist deals',
  description: 'AI-powered Craigslist monitoring. Get notified when great deals are posted.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-content">
            <a href="/" className="logo">
              <span className="logo-mark">D</span>
              DealFinder
            </a>
            <a href="/dashboard" className="nav-link">My Alerts</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
