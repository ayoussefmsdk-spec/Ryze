import './globals.css';
import { BRAND } from '../components/Brand.jsx';

// Favicon: the hex-cell + play mark as an inline SVG data URI — no asset files.
const faviconSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 1.8 L20.6 6.8 V16.8 L12 21.8 L3.4 16.8 V6.8 Z" fill="none" stroke="#f0b64a" stroke-width="2.1" stroke-linejoin="round"/><path d="M9.9 8.3 L16.2 11.8 L9.9 15.3 Z" fill="#f0b64a"/></svg>`,
);

export const metadata = {
  title: `${BRAND.name} — ${BRAND.descriptor}`,
  description: `${BRAND.tagline} Automated view tracking and payouts for clipping campaigns.`,
  icons: { icon: `data:image/svg+xml,${faviconSvg}` },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
