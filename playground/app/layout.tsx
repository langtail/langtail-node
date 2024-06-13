import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Langtail Quickstart",
  description:
    "A simple app that would should you how to write an AI chat that obtains weather information through Langtail.",
  icons: {
    icon: "https://mintlify.s3-us-west-1.amazonaws.com/langtail-64/_generated/favicon/favicon-32x32.png?v=3",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <img
          className="logo"
          src="https://mintlify.s3-us-west-1.amazonaws.com/langtail-64/images/logo/light.svg"
          alt="OpenAI Logo"
        />
      </body>
    </html>
  );
}
