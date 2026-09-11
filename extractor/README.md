# SiteScan Extractor

A macOS desktop tool that analyses competitor websites and extracts their brand colours — ready to paste straight into the [SiteScan colour wheel](https://noah-zhuhaotian.github.io/SiteScan/).

---

## Download (macOS)

Go to the [Releases](../../releases) page, download the latest `SiteScan-Extractor-mac.zip`, unzip, and drag **SiteScan Extractor.app** to `/Applications`.

**Requirements:** macOS with **Google Chrome** installed. No Python or other setup needed.

---

## What it does

For each URL you add, the tool:
1. Opens the page in Chrome via Playwright
2. Scrolls to trigger lazy-loaded elements
3. Classifies every visible element into **Background**, **Text**, or **Accent** by tag and CTA heuristics
4. Deduplicates similar colours (RGB distance threshold = 40)
5. Returns the top N colours per category

---

## Usage

1. Enter a URL (e.g. `https://stripe.com`) and a brand name
2. Set how many colours to extract per category (Background / Text / Accent)
3. Click **Analyse & Add** — extraction takes ~10–20 s per site
4. Repeat for as many competitors as you like
5. Click a category button to copy its JSON to clipboard:

```
[ Background ]  [ Text ]  [ Accent ]
```

6. Paste into SiteScan → **Import JSON** → **Add N colours**

---

## JSON format

```json
{
  "sites": ["Stripe", "Apple"],
  "category": "Accent",
  "colors": [
    { "hex": "#635BFF", "label": "Accent" },
    { "hex": "#0071E3", "label": "Accent" }
  ]
}
```

Labels use the category name (`Background`, `Text`, `Accent`) so colours are identifiable on the wheel.

---

## Run from source

Requires Python 3.11+ and Google Chrome.

```bash
cd extractor
pip install -r requirements.txt
python main.py
```

> Playwright uses `channel="chrome"` — it talks directly to your system Chrome, so you do **not** need to run `playwright install`.

---

## Build the Mac app yourself

```bash
cd extractor
bash build_mac.sh
# Output: dist/SiteScan Extractor.app
```

Must be run on a Mac. The GitHub Actions workflow (`build-mac-extractor.yml`) does this automatically on a `macos-latest` runner — trigger it from the **Actions** tab with a version number to produce a new Release.
