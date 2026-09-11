from playwright.sync_api import sync_playwright
from color_utils import deduplicate

# Runs inside the browser — extracts computed color frequencies per category
_EXTRACT_JS = """
() => {
    function parseColor(str) {
        if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
        const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
        if (!m) return null;
        const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
        if (alpha < 0.25) return null;
        const r = +m[1], g = +m[2], b = +m[3];
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    const BG_TAGS  = new Set(['DIV','SECTION','MAIN','HEADER','FOOTER','NAV','ASIDE',
                               'ARTICLE','HTML','BODY','FORM','FIGURE','TABLE','TR','TD','TH']);
    const TXT_TAGS = new Set(['P','H1','H2','H3','H4','H5','H6','SPAN','A','LI',
                               'LABEL','STRONG','EM','TD','TH','BLOCKQUOTE','FIGCAPTION']);

    const counts = { background: {}, text: {}, accent: {} };

    // Identify CTA / interactive elements
    const ctaEls = new Set();
    const ctaSels = ['button:not([disabled])','[role="button"]','input[type="submit"]',
                     'a[class*="btn"]','a[class*="button"]','[class*="btn-primary"]',
                     '[class*="btn-cta"]','[class*="-cta"]','[class*="cta-"]'];
    ctaSels.forEach(sel => {
        try { document.querySelectorAll(sel).forEach(el => ctaEls.add(el)); } catch(e) {}
    });

    document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        if (rect.top > 6000) return;

        const s  = window.getComputedStyle(el);
        const tag = el.tagName;
        const isCta = ctaEls.has(el);

        const bg = parseColor(s.backgroundColor);
        if (bg) {
            if (isCta) {
                counts.accent[bg] = (counts.accent[bg] || 0) + 6;
            } else if (BG_TAGS.has(tag)) {
                counts.background[bg] = (counts.background[bg] || 0) + 1;
            }
        }

        // Border of CTAs often carries the brand accent colour
        if (isCta) {
            const border = parseColor(s.borderColor);
            if (border && border !== bg) {
                counts.accent[border] = (counts.accent[border] || 0) + 2;
            }
        }

        const fg = parseColor(s.color);
        if (fg && TXT_TAGS.has(tag) && !isCta) {
            counts.text[fg] = (counts.text[fg] || 0) + 1;
        }
    });

    return counts;
}
"""


def _top_colors(freq_map, n, dedup_threshold=40):
    """Sort by frequency, deduplicate similar colours, return up to n hex strings."""
    sorted_hexes = [h for h, _ in sorted(freq_map.items(), key=lambda x: -x[1])]
    return deduplicate(sorted_hexes, threshold=dedup_threshold)[:n]


def extract_colors(url, n_background=3, n_text=3, n_accent=3,
                   on_status=None, headless=True):
    """
    Open *url* in system Chrome (channel="chrome") and extract brand colours.

    Returns:
        {"background": [...], "text": [...], "accent": [...]}
        Each value is a list of hex strings, most-frequent first.

    Raises:
        RuntimeError if Chrome cannot be launched.
    """
    def status(msg):
        if on_status:
            on_status(msg)

    status("Launching Chrome…")
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=headless)
        except Exception as exc:
            raise RuntimeError(
                "Could not launch Chrome.\n"
                "Make sure Google Chrome is installed at /Applications/Google Chrome.app\n\n"
                f"Detail: {exc}"
            )

        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})

        status("Loading page…")
        try:
            page.goto(url, wait_until="networkidle", timeout=30_000)
        except Exception:
            page.goto(url, wait_until="domcontentloaded", timeout=30_000)

        # Scroll to trigger lazy-loaded elements
        status("Scanning page…")
        for depth in range(1, 5):
            page.evaluate(f"window.scrollTo(0, {depth * 1000})")
            page.wait_for_timeout(300)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(400)

        status("Extracting colours…")
        raw = page.evaluate(_EXTRACT_JS)
        browser.close()

    return {
        "background": _top_colors(raw.get("background", {}), n_background),
        "text":       _top_colors(raw.get("text",       {}), n_text),
        "accent":     _top_colors(raw.get("accent",     {}), n_accent),
    }
