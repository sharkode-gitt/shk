import { continueRender, delayRender, staticFile } from 'remotion';

// Rubik embutida em public/fonts (sem depender de internet no render)
export const FONT = "Rubik, 'Arial Black', sans-serif";
const handle = typeof document !== 'undefined' ? delayRender('fonts-rubik') : null;
if (handle !== null) {
  Promise.all(
    [600, 700, 800, 900].map((w) =>
      new FontFace('Rubik', `url(${staticFile(`fonts/rubik-latin-${w}-normal.woff2`)}) format('woff2')`, { weight: String(w) })
        .load()
        .then((f) => document.fonts.add(f)),
    ),
  ).then(() => continueRender(handle), () => continueRender(handle));
}
