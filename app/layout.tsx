import type { Metadata } from "next";
import { headers } from "next/headers";
import { ORBIT_APPEARANCE_STORAGE_KEY, ORBIT_APPEARANCE_THEMES } from "./lib/appearance";
import { ORBIT_PRODUCT_NAME } from "./lib/product-meta";
import "./styles/index.css";

const ORBIT_PREHYDRATE_SCRIPT = `(()=>{const root=document.documentElement;try{root.dataset.orbitOnboarding=localStorage.getItem("orbit-onboarding-v1")==="complete"?"complete":"pending";const theme=localStorage.getItem(${JSON.stringify(ORBIT_APPEARANCE_STORAGE_KEY)});if(${JSON.stringify(ORBIT_APPEARANCE_THEMES.map(({ id }) => id))}.includes(theme))root.dataset.theme=theme}catch{root.dataset.orbitOnboarding="pending"}})();`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = `${ORBIT_PRODUCT_NAME} — Work that traces back to source`;
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
          url: `${origin}/og-orbit.png`,
          width: 1727,
          height: 911,
          alt: `${ORBIT_PRODUCT_NAME} turns readable sources into traceable work`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og-orbit.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" data-theme="mist-blue" data-orbit-onboarding="pending" suppressHydrationWarning>
      <head>
        <script id="orbit-prehydrate-state" dangerouslySetInnerHTML={{ __html: ORBIT_PREHYDRATE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
