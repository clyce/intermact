import { getSingletonHighlighter } from "shiki/bundle/web";

const THEME = "github-dark";
const LANG = "tsx";

let highlighterPromise: ReturnType<typeof getSingletonHighlighter> | null = null;

/** Lazily create a Shiki highlighter (tsx + github-dark) shared by the source panel. */
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      themes: [THEME],
      langs: [LANG],
    });
  }
  return highlighterPromise;
}

/**
 * Highlight demo source as HTML for {@link SourcePanel}.
 * Uses the web bundle so only requested langs/themes are loaded on demand.
 */
export async function highlightTsxSource(source: string): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(source, { lang: LANG, theme: THEME });
}
