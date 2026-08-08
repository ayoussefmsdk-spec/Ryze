import './globals.css';
import { BRAND } from '../components/Brand.jsx';

// Favicon: the hex-cell + play mark as an inline SVG data URI — no asset files.
const faviconSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 24"><path d="M13 1.8 L22 7 V17 L13 22.2 L4 17 V7 Z" fill="none" stroke="#f0b64a" stroke-width="1.9" stroke-linejoin="round"/><path d="M7.2 7.6 h11.6 M7.2 16.4 h11.6" stroke="#f0b64a" stroke-width="1.1" opacity="0.8"/><path d="M10.8 9.6 L16.4 12 L10.8 14.4 Z" fill="#f0b64a"/></svg>`,
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
