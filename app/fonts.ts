import localFont from "next/font/local";

export const fontSignifier = localFont({
  src: [
    {
      path: "../public/fonts/signifier/Signifier-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/signifier/Signifier-RegularItalic.otf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-signifier-local",
  display: "swap",
});

export const fontSohne = localFont({
  src: [
    {
      path: "../public/fonts/sohne/Sohne-Buch.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/sohne/Sohne-BuchKursiv.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/sohne/Sohne-Kraftig.otf",
      weight: "450",
      style: "normal",
    },
    {
      path: "../public/fonts/sohne/Sohne-KraftigKursiv.otf",
      weight: "450",
      style: "italic",
    },
    {
      path: "../public/fonts/sohne/Sohne-Halbfett.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/sohne/Sohne-HalbfettKursiv.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/fonts/sohne/Sohne-Dreiviertelfett.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/sohne/Sohne-DreiviertelfettKursiv.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-sohne-local",
  display: "swap",
});
