import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Pixelify_Sans, Silkscreen } from "next/font/google";
import "./globals.css";
import "./styles/home.css";
import "./styles/storybook.css";
import "./styles/book.css";
import "./styles/book-add.css";
import "./styles/arcade.css";
import "./styles/arcade-play.css";
import "./styles/call.css";
import "./styles/plus.css";

const serif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

// Low-res 5x7 face. Deliberately blocky, only used at small label sizes.
const pixel = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Higher-resolution pixel face for display type, so big numbers and titles
// keep the pixel grid without going chunky.
const pixelDisplay = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Same Moon",
  description: "Every night you two call, one more moon.",
};

export const viewport: Viewport = {
  themeColor: "#0a0f1c",
  // Lets the dock read the safe area, so it clears the home bar on a phone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${pixel.variable} ${pixelDisplay.variable}`}>
      <body>{children}</body>
    </html>
  );
}
