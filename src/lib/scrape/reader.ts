import "server-only";

export type SitePage = {
  title: string;
  markdown: string;
  /** Candidate menu photos, most likely first. */
  images: string[];
  /** Same-site links labelled "menu", for when the pasted page is a homepage or a 404. */
  menuLinks: string[];
  notFound: boolean;
};

const MAX_IMAGES = 8;

/** Reads a page through Jina Reader (r.jina.ai), which handles JS-heavy sites and returns markdown. */
export async function readSite(url: string, signal: AbortSignal): Promise<SitePage> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-With-Images-Summary": "true",
  };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;

  const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal });
  if (!res.ok) throw new Error(`Couldn't read the site (reader returned ${res.status}).`);

  const body = await res.json();
  const data = body?.data ?? {};
  const markdown: string = typeof data.content === "string" ? data.content : "";
  const title: string = typeof data.title === "string" ? data.title : "";
  if (!markdown.trim()) throw new Error("The site returned no readable content.");

  // Images come from the reader's summary when present, plus any linked in the markdown.
  const summary: { alt: string; src: string }[] = Object.entries(data.images ?? {}).map(
    ([alt, src]) => ({ alt, src: String(src) }),
  );
  const inline = [...markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)/g)].map((m) => ({
    alt: m[1],
    src: m[2],
  }));

  return {
    title,
    markdown,
    images: pickMenuImages([...summary, ...inline]),
    menuLinks: findMenuLinks(markdown, url),
    notFound: /\b404\b|page not found/i.test(title),
  };
}

function findMenuLinks(markdown: string, pageUrl: string): string[] {
  const { host } = new URL(pageUrl);
  const links = [...markdown.matchAll(/(?<!!)\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)]
    .filter(([, text, href]) => /menu/i.test(text) && URL.canParse(href) && new URL(href).host === host)
    .map(([, , href]) => href.split("#")[0])
    .filter((href) => href.replace(/\/$/, "") !== pageUrl.replace(/\/$/, ""));
  return [...new Set(links)];
}

function pickMenuImages(candidates: { alt: string; src: string }[]): string[] {
  const seen = new Set<string>();
  const usable = candidates.filter(({ src }) => {
    if (seen.has(src) || !/^https?:\/\//.test(src)) return false;
    seen.add(src);
    return (
      !/\.(svg|gif|ico)(\?|$)/i.test(src) &&
      !/logo|icon|favicon|sprite|avatar|badge|[_-]small|thumb/i.test(src) &&
      !/instagram|facebook|tiktok|twitter|youtube|whatsapp|redbook|xiaohongshu|linkedin/i.test(src)
    );
  });
  // Photos that look like menus go first.
  const looksLikeMenu = ({ alt, src }: { alt: string; src: string }) => /menu/i.test(alt + src);
  return [...usable.filter(looksLikeMenu), ...usable.filter((c) => !looksLikeMenu(c))]
    .slice(0, MAX_IMAGES)
    .map((c) => c.src);
}
