import type { Metadata } from "next";
import { headers } from "next/headers";
import { RUNE_APPEARANCE_STORAGE_KEY, RUNE_APPEARANCE_THEMES } from "./lib/appearance";
import "./styles/index.css";

const RUNE_PREHYDRATE_SCRIPT = `(()=>{const root=document.documentElement;try{root.dataset.runeOnboarding=localStorage.getItem("rune-onboarding-v1")==="complete"?"complete":"pending";const theme=localStorage.getItem(${JSON.stringify(RUNE_APPEARANCE_STORAGE_KEY)});if(${JSON.stringify(RUNE_APPEARANCE_THEMES.map(({ id }) => id))}.includes(theme))root.dataset.theme=theme}catch{root.dataset.runeOnboarding="pending"}})();`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Rune — Work that traces back to source";
  const description = "Turn business data into traceable reports and decks. Review every AI change before it writes.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `${origin}/og-v2.jpg`,
          width: 1727,
          height: 911,
          alt: "Rune turns readable sources into traceable work",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og-v2.jpg`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" data-theme="mist-blue" data-rune-onboarding="pending" suppressHydrationWarning>
      <head>
        <script id="rune-prehydrate-state" dangerouslySetInnerHTML={{ __html: RUNE_PREHYDRATE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
