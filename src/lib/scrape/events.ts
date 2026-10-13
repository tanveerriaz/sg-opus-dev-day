// Progress events streamed from POST /api/scrape to the restaurant page, one JSON object per line.

export type ScrapeStep = "reading" | "photos" | "extracting" | "saving";

export type ScrapeEvent =
  | { type: "step"; step: ScrapeStep; message: string }
  | {
      type: "done";
      restaurant: { id: string; name: string; itemCount: number };
      /** True when the live scrape failed or was too slow and the saved copy was used. */
      fromSavedCopy: boolean;
    }
  | { type: "error"; message: string };
