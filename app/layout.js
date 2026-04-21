import './globals.css';

export const metadata = {
  title:       'Kaali Raat — Horror Story Studio',
  description: 'AI-powered Hindi horror story generator',
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <body>{children}</body>
    </html>
  );
}
