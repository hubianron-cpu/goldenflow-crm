import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

const themeInitScript = `
  (function () {
    try {
      var savedTheme = window.localStorage.getItem("goldenflow-theme");
      var theme = savedTheme === "light" || savedTheme === "trainer" ? savedTheme : "dark";
      var themeClass = "theme-" + theme;
      document.documentElement.classList.remove("theme-dark", "theme-light", "theme-trainer");
      document.documentElement.classList.add(themeClass);
      document.body.classList.remove("theme-dark", "theme-light", "theme-trainer");
      document.body.classList.add(themeClass);
    } catch (_) {
      document.documentElement.classList.add("theme-dark");
      document.body.classList.add("theme-dark");
    }
  })();
`;

export const metadata: Metadata = {
  title: "מרכז השליטה של העסק שלך",
  description: "מערכת CRM לניהול לידים, המשימות שלי, מסלול המכירה וסגירה יומית למאמנים ויועצים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="theme-dark" dir="rtl" lang="he" suppressHydrationWarning>
      <body className={`${heebo.variable} theme-dark`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
