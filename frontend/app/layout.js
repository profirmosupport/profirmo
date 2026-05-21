import './globals.css';

export const metadata = {
  title: 'Profirmo — Online Professional Consultations',
  description:
    'Profirmo connects you with verified advocates, lawyers, legal firms and tax consultants for online consultations, secure bookings and end-to-end case management.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
