import './globals.css';

export const metadata = {
  title: 'Ryze — Clip Tracker',
  description: 'Automated view tracking and payouts for clipping campaigns.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
