import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { PWARegister } from "./pwa-register";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JNews — AI News Digest",
  description: "Briefings de inteligência e digest personalizado de notícias por IA.",
  applicationName: "JNews",
  appleWebApp: {
    capable: true,
    title: "JNews",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/png-192", sizes: "192x192", type: "image/png" },
      { url: "/icons/png-512", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/png-192", sizes: "192x192" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2ece1" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('jnews-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(t||(d?'dark':'light'));})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  );
}
