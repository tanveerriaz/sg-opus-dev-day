# Demo video

`qr-ordering-agent-demo.mp4` is a 60-second animated walkthrough of the user journey: paste a website, scan the QR, order by chatting, confirm, kitchen dashboard, memory and voice.

The screens are mock-ups drawn for the video, not recordings of the app. The scrape (#3), memory (#5) and voice (#6) scenes show planned features.

## Re-render

Needs Google Chrome installed at the default macOS path.

```bash
cd demo
npm install
node music.mjs    # writes music.wav
node render.mjs   # writes qr-ordering-agent-demo.mp4 (about 80 seconds)
```

Edit the scenes in `index.html`. `node render.mjs stills 10 25 40` saves preview frames at those seconds into `stills/`.
