import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Mesh — Disaster Response Coordinator",
  description: "Meshtastic network dashboard for disaster response coordination",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-mesh-bg text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
