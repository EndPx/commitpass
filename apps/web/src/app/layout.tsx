import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import Script from "next/script";
import { project } from "@commitpass/shared";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: `${project.name} — ${project.tagline}`,
  description: project.description,
  icons: {
    icon: { url: "/brand/commitpass-mark.png", type: "image/png" },
    apple: "/brand/commitpass-mark.png",
  },
  openGraph: {
    title: `${project.name} — ${project.tagline}`,
    description: project.description,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const devTools =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS !== "1";

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <head>
        {devTools && (
          <>
            <Script
              src="https://unpkg.com/react-grab@0.2.0/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
            <Script
              src="https://unpkg.com/react-scan@0.5.7/dist/auto.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
