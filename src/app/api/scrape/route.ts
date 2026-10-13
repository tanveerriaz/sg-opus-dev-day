import { readMenuPhotos } from "@/lib/scrape/uploads";
import { withinDeadline } from "@/lib/scrape/deadline";
import type { Restaurant } from "@/lib/menu";
import { findRestaurantBySourceUrl, saveScrapedRestaurant } from "@/lib/restaurants";
import type { ScrapeEvent } from "@/lib/scrape/events";
import { extractMenu, NoMenuItemsError, type ExtractedMenu } from "@/lib/scrape/extract";
import { readSite, type SitePage } from "@/lib/scrape/reader";

export const runtime = "nodejs";
export const maxDuration = 60;

/** With a saved copy to fall back on, a live scrape gets this long before we switch to it. */
const LIVE_BUDGET_WITH_SAVED_MS = 20_000;
/** Without one, wait as long as the function is allowed to run. */
const LIVE_BUDGET_WITHOUT_SAVED_MS = 55_000;

export async function POST(request: Request) {
  let url: string | null = null;
  let upload: Awaited<ReturnType<typeof readMenuPhotos>> | null = null;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    try { upload = await readMenuPhotos(await request.formData()); }
    catch (error) { return Response.json({ error: errorMessage(error) }, { status: 400 }); }
  } else {
    const body = await request.json().catch(() => null);
    const input = body && typeof body === "object" ? body.url : "";
    url = normalizeUrl(String(input ?? ""));
    if (!url) return Response.json({ error: "Enter a public website URL." }, { status: 400 });
  }

  let settled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ScrapeEvent) => {
        if (!settled && !request.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const finish = (event: ScrapeEvent) => {
        if (settled) return;
        send(event);
        settled = true;
        controller.close();
      };

      const started = Date.now();
      send({ type: "step", step: "reading", message: upload ? "Reading uploaded photos…" : "Reading site…" });
      // Bound the lookup too: a stalled database must not consume the live budget.
      const saved = url ? await withinDeadline(
        (signal) => findRestaurantBySourceUrl(url!, signal), 2_000, request.signal,
      ).catch(() => null) : null;
      const budget = saved ? LIVE_BUDGET_WITH_SAVED_MS : LIVE_BUDGET_WITHOUT_SAVED_MS;

      try {
        const restaurant = await withinDeadline(
          async (signal) => {
            if (!upload) return scrapeLive(url!, signal, send);
            const result = await extract({ ...upload, markdown: "Extract the menu from the uploaded photos.", menuLinks: [], notFound: false }, signal, send);
            send({ type: "step", step: "saving", message: `Extracted ${result.menu.items.length} items` });
            return saveScrapedRestaurant({ ...result, source_url: null }, signal);
          }, budget - (Date.now() - started), request.signal,
        );
        finish(doneEvent(restaurant, false));
      } catch (err) {
        if (saved) {
          console.warn(`Live scrape of ${url} failed, using the saved copy:`, err);
          finish(doneEvent(saved, true));
        } else {
          finish({
            type: "error",
            message: errorMessage(err),
          });
        }
      }
    },
    cancel() { settled = true; },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}

async function scrapeLive(
  url: string,
  signal: AbortSignal,
  send: (event: ScrapeEvent) => void,
): Promise<Restaurant> {
  let page = await readSite(url, signal);

  // Restaurants often paste their homepage; the menu is one link away.
  const followMenuLink = async (from: SitePage) => {
    send({ type: "step", step: "reading", message: "Following the site's menu link…" });
    return readSite(from.menuLinks[0], signal);
  };
  if (page.menuLinks.length > 0 && (new URL(url).pathname === "/" || page.notFound)) {
    // Prefer the actual menu even if the homepage already advertises priced specials.
    page = await followMenuLink(page);
  }
  if (page.notFound) throw new Error("The restaurant's menu page was not found.");

  let extracted: ExtractedMenu;
  try {
    extracted = await extract(page, signal, send);
  } catch (err) {
    if (!(err instanceof NoMenuItemsError) || page.menuLinks.length === 0) throw err;
    page = await followMenuLink(page);
    extracted = await extract(page, signal, send);
  }

  const { name, menu } = extracted;
  send({ type: "step", step: "saving", message: `Extracted ${menu.items.length} items` });
  signal.throwIfAborted();
  return saveScrapedRestaurant({ name, source_url: url, menu }, signal);
}

async function extract(page: SitePage, signal: AbortSignal, send: (event: ScrapeEvent) => void) {
  const photos = page.images.length;
  send({
    type: "step",
    step: "photos",
    message: photos === 0 ? "No menu photos found" : `Found ${photos} photo${photos === 1 ? "" : "s"}`,
  });
  send({ type: "step", step: "extracting", message: "Extracting menu items…" });
  return extractMenu(page, signal);
}

function doneEvent(restaurant: Restaurant, fromSavedCopy: boolean): ScrapeEvent {
  return {
    type: "done",
    restaurant: { id: restaurant.id, name: restaurant.name, itemCount: restaurant.menu.items.length },
    fromSavedCopy,
  };
}

/** Adds https:// if missing and drops the trailing slash, so the same site always maps to one saved copy. */
function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.username || url.password || !url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname)) return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong reading that site.";
}
