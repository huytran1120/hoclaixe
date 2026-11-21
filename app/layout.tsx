import type { Metadata } from "next";
import "./globals.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const iconPath = `${BASE_PATH}/favicon.svg`;

export const metadata: Metadata = {
  title: "Học Lái Xe · Ôn tập & Thi thử 600 câu hỏi lý thuyết",
  description:
    "Nền tảng miễn phí giúp mọi người ôn tập và thi thử 600 câu hỏi lý thuyết sát hạch lái xe cơ giới đường bộ theo cấu trúc hạng B.",
  icons: {
    icon: iconPath,
    shortcut: iconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
