import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Capacity",
  description: "Given what is happening in my body, what should I actually do today?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="px-6 sm:px-10 pt-7">
            <div className="mx-auto w-full max-w-3xl flex items-center justify-between">
              <span className="text-[13px] tracking-[0.22em] uppercase text-muted">Capacity</span>
              <Nav />
            </div>
          </header>
          <main className="flex-1 px-6 sm:px-10 py-10 sm:py-16">
            <div className="mx-auto w-full max-w-3xl">{children}</div>
          </main>
          <footer className="px-6 sm:px-10 pb-10 pt-4">
            <p className="mx-auto w-full max-w-3xl text-[11px] leading-relaxed text-muted">
              Capacity is wellness and performance decision support, not medical advice or
              diagnosis. Scores are provisional and not clinically validated.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
