import type {
  Metadata,
  Viewport,
} from "next";

import {
  AuthProvider,
} from "@/src/contexts/AuthContext";

import {
  CompetitionProvider,
} from "@/src/contexts/CompetitionContext";

import {
  CompetitionTheme,
} from "@/src/contexts/CompetitionTheme";

import PushNotificationBootstrap from "@/components/notifications/PushNotificationBootstrap";

import "./globals.css";

function getSiteUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  const vercelProductionUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (vercelProductionUrl) {
    return `https://${vercelProductionUrl}`;
  }

  return "http://localhost:3000";
}

export const metadata:
  Metadata = {
    metadataBase:
      new URL(
        getSiteUrl(),
      ),

    applicationName:
      "Ludi Control",

    title: {
      default:
        "Ludi Control",
      template:
        "%s | Ludi Control",
    },

    description:
      "Centro di Controllo amministrativo della Ludis League.",

    robots: {
      index:
        false,
      follow:
        false,
      nocache:
        true,
    },

    icons: {
      icon:
        "/icons/icon-192.png",
      apple:
        "/icons/apple-touch-icon.png",
    },
  };

export const viewport:
  Viewport = {
    width:
      "device-width",

    initialScale:
      1,

    minimumScale:
      1,

    maximumScale:
      1,

    userScalable:
      false,

    viewportFit:
      "cover",
  };

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-[#F4F6F8] text-[#06142E]">
        <AuthProvider>
          <PushNotificationBootstrap />

          <CompetitionProvider>
            <CompetitionTheme>
              {children}
            </CompetitionTheme>
          </CompetitionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
