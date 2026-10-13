// Renders index.html frame by frame with Chrome and encodes it with the soundtrack.
//   node render.mjs                 full video -> qr-ordering-agent-demo.mp4
//   node render.mjs stills 1 9 17   PNG stills at those seconds -> stills/
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import puppeteer from "puppeteer-core";
import QRCode from "qrcode";

const FPS = 30, DURATION = 60, W = 1920, H = 1080;
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const QR_LINK = "https://sg-opus-dev-day.vercel.app/r/kopi-satay-house?mode=table&t=12";

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--force-device-scale-factor=1", "--hide-scrollbars", "--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(new URL("index.html", import.meta.url).href);
const qr = await QRCode.toString(QR_LINK, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1c1410", light: "#ffffff" } });
await page.evaluate((svg) => window.setQR(svg), qr);
await page.evaluate(() => document.fonts.ready);

if (process.argv[2] === "stills") {
  await mkdir(here("stills"), { recursive: true });
  for (const t of process.argv.slice(3).map(Number)) {
    await page.evaluate((time) => window.render(time), t);
    await writeFile(here(`stills/t${t.toFixed(2).padStart(5, "0")}.jpg`), await page.screenshot({ type: "jpeg", quality: 80 }));
  }
  await browser.close();
  process.exit(0);
}

const out = here("qr-ordering-agent-demo.mp4");
const ffmpeg = spawn(ffmpegPath, [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-i", here("music.wav"),
  "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS),
  "-c:a", "aac", "-b:a", "192k", "-t", String(DURATION), "-movflags", "+faststart", out,
], { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise((resolve, reject) => ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));

const total = FPS * DURATION;
for (let i = 0; i < total; i++) {
  await page.evaluate((time) => window.render(time), i / FPS);
  const frame = await page.screenshot({ type: "jpeg", quality: 95 });
  if (!ffmpeg.stdin.write(frame)) await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve));
  if (i % 300 === 0) console.log(`frame ${i}/${total}`);
}
ffmpeg.stdin.end();
await done;
await browser.close();
console.log("wrote", out);
