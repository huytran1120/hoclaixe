import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const iconPath = `${BASE_PATH}/favicon.svg`;

export const metadata: Metadata = {
  title: "Học Lái Xe · Ôn tập & Thi thử 600 câu hỏi lý thuyết",
  description:
    "Nền tảng miễn phí giúp mọi người ôn tập và thi thử 600 câu hỏi lý thuyết sát hạch lái xe cơ giới đường bộ trên cả máy tính và điện thoại.",
  icons: {
    icon: iconPath,
    shortcut: iconPath,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("hoclaixe_theme_v1");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.dataset.theme="dark";}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={beVietnamPro.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
