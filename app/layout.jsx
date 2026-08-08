import './globals.css';
import { BRAND } from '../components/Brand.jsx';

// Favicon: the sliced-triangle mark as an inline SVG data URI — no asset files.
const faviconSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.1 12.4 L2.5 21 H21.5 L16.6 12.2 L6.9 15.4 Z" fill="#b48f45"/><path d="M12.6 2.6 L16.1 9.0 L6.6 12.1 Z" fill="#e8ba58"/></svg>`,
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
