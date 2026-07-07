import type { ReactNode } from "react";

export const metadata = {
  title: "Diesel Geeks Product Assistant API",
  description: "Retrieval-grounded product chat backend for dieselgeeks.com.au",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
