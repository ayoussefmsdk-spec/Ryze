import './globals.css';

export const metadata = {
  title: 'RyZeX — Clipping Agency',
  description: 'Automated view tracking and payouts for clipping campaigns.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
