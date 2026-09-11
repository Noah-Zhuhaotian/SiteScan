"""
SiteScan Color Extractor
Analyses multiple websites and exports a single combined JSON for the SiteScan
colour-wheel web app, so you can compare Background / Text / Accent colours
across competitors on one wheel.
"""

import json
import threading
import tkinter as tk

import customtkinter as ctk

from extractor import extract_colors

# ── Theme ──────────────────────────────────────────────────────────────────────
ctk.set_appearance_mode("light")
ctk.set_default_color_theme("blue")

CAT_ORDER  = ["background", "text", "accent"]
CAT_LABELS = {"background": "Background", "text": "Text", "accent": "Accent"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe_color(hex_str: str) -> str:
    """Return hex_str if Tkinter can display it, else a neutral fallback."""
    try:
        tk.Label(fg=hex_str)
        return hex_str
    except Exception:
        return "#CCCCCC"


def _swatch(parent, hex_str: str, size: int = 22) -> ctk.CTkFrame:
    f = ctk.CTkFrame(parent, width=size, height=size, corner_radius=4,
                     fg_color=_safe_color(hex_str),
                     border_width=1, border_color="#E5E5EA")
    f.pack_propagate(False)
    return f


# ── Main window ────────────────────────────────────────────────────────────────

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("SiteScan Color Extractor")
        self.geometry("540x920")
        self.resizable(False, True)
        self.minsize(540, 600)

        # List of analysed sites:
        # [{ brand, url, colors: {background:[hex…], text:[hex…], accent:[hex…]} }]
        self._sites: list[dict] = []
        self._analysing = False

        self._build_ui()

    # ── UI construction ────────────────────────────────────────────────────────

    def _build_ui(self):
        P = {"padx": 24}

        # ── Header ────────────────────────────────────────────────────────────
        ctk.CTkLabel(self, text="🎨  SiteScan Color Extractor",
                     font=ctk.CTkFont(size=18, weight="bold")).pack(**P, pady=(22, 2))
        ctk.CTkLabel(self, text="Add multiple websites — compare on one colour wheel",
                     text_color="gray", font=ctk.CTkFont(size=12)).pack(**P, pady=(0, 16))

        # ── Input card ────────────────────────────────────────────────────────
        card = ctk.CTkFrame(self, corner_radius=10)
        card.pack(**P, fill="x")

        ctk.CTkLabel(card, text="Website URL", anchor="w",
                     font=ctk.CTkFont(size=11, weight="bold"),
                     text_color="gray").pack(padx=16, pady=(14, 2), fill="x")
        self.url_entry = ctk.CTkEntry(card, placeholder_text="https://stripe.com",
                                      height=34, font=ctk.CTkFont(size=13))
        self.url_entry.pack(padx=16, pady=(0, 10), fill="x")
        self.url_entry.bind("<Return>", lambda _: self._start_analysis())

        ctk.CTkLabel(card, text="Brand Name", anchor="w",
                     font=ctk.CTkFont(size=11, weight="bold"),
                     text_color="gray").pack(padx=16, pady=(0, 2), fill="x")
        self.brand_entry = ctk.CTkEntry(card, placeholder_text="Stripe",
                                         height=34, font=ctk.CTkFont(size=13))
        self.brand_entry.pack(padx=16, pady=(0, 10), fill="x")

        # Count controls
        counts_row = ctk.CTkFrame(card, fg_color="transparent")
        counts_row.pack(padx=16, pady=(0, 6), fill="x")
        self._count_vars: dict[str, ctk.StringVar] = {}
        defaults = {"background": "3", "text": "2", "accent": "3"}
        for col, cat in enumerate(CAT_ORDER):
            f = ctk.CTkFrame(counts_row, fg_color="transparent")
            f.grid(row=0, column=col, padx=(0, 10))
            ctk.CTkLabel(f, text=CAT_LABELS[cat],
                         font=ctk.CTkFont(size=11), text_color="gray").pack(anchor="w")
            var = ctk.StringVar(value=defaults[cat])
            self._count_vars[cat] = var
            ctk.CTkOptionMenu(f, variable=var,
                              values=["1", "2", "3", "4", "5"],
                              width=80, height=28).pack()
        counts_row.columnconfigure((0, 1, 2), weight=1)

        self.add_btn = ctk.CTkButton(card, text="＋  Analyse & Add",
                                      height=38, font=ctk.CTkFont(size=13, weight="bold"),
                                      command=self._start_analysis)
        self.add_btn.pack(padx=16, pady=(10, 6), fill="x")

        self.status_lbl = ctk.CTkLabel(card, text="", text_color="gray",
                                        font=ctk.CTkFont(size=11))
        self.status_lbl.pack(padx=16)

        self.progress = ctk.CTkProgressBar(card, height=5, mode="indeterminate")
        # shown only while analysing

        ctk.CTkFrame(card, height=1, fg_color="transparent").pack(pady=(6, 0))

        # ── Sites list ────────────────────────────────────────────────────────
        ctk.CTkFrame(self, height=1, fg_color="#E5E5EA").pack(**P, pady=14, fill="x")

        self.sites_header = ctk.CTkLabel(self, text="Analysed sites  (0)",
                                          anchor="w", font=ctk.CTkFont(size=12, weight="bold"))
        self.sites_header.pack(**P, fill="x")

        self.sites_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", height=110)
        self.sites_frame.pack(**P, pady=(6, 0), fill="x")

        self.empty_lbl = ctk.CTkLabel(self.sites_frame,
                                       text="No sites yet — add one above.",
                                       text_color="#AEAEB2", font=ctk.CTkFont(size=12))
        self.empty_lbl.pack(anchor="w", pady=4)

        # ── Export ────────────────────────────────────────────────────────────
        ctk.CTkLabel(self, text="Copy to SiteScan", anchor="w",
                     font=ctk.CTkFont(size=12, weight="bold")).pack(**P, pady=(12, 4), fill="x")

        copy_row = ctk.CTkFrame(self, fg_color="transparent")
        copy_row.pack(**P, fill="x")

        self._export_btns = []
        for cat in CAT_ORDER:
            btn = ctk.CTkButton(copy_row, text=CAT_LABELS[cat],
                                height=32, state="disabled",
                                fg_color="#6E6E73", hover_color="#4A4A4F",
                                command=lambda c=cat: self._copy_cat(c))
            btn.pack(side="left", padx=(0, 6))
            self._export_btns.append(btn)

        # ── Combined preview ──────────────────────────────────────────────────
        ctk.CTkFrame(self, height=1, fg_color="#E5E5EA").pack(**P, pady=14, fill="x")

        self.preview_header = ctk.CTkLabel(self, text="Combined preview  (0 colours)",
                                            anchor="w", font=ctk.CTkFont(size=12, weight="bold"))
        self.preview_header.pack(**P, fill="x")

        self.preview_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", height=180)
        self.preview_frame.pack(**P, pady=(8, 16), fill="x", expand=True)

    # ── Analysis ──────────────────────────────────────────────────────────────

    def _start_analysis(self):
        if self._analysing:
            return
        url = self.url_entry.get().strip()
        if not url:
            self._status("Enter a URL first.", "red")
            return
        if not url.startswith("http"):
            url = "https://" + url
            self.url_entry.delete(0, "end")
            self.url_entry.insert(0, url)

        brand = self.brand_entry.get().strip() or url.split("//")[-1].split("/")[0]
        counts = {cat: int(self._count_vars[cat].get()) for cat in CAT_ORDER}

        self._analysing = True
        self.add_btn.configure(state="disabled", text="Analysing…")
        self.progress.pack(padx=16, pady=(4, 10), fill="x")
        self.progress.start()
        self._status("Starting Chrome…", "gray")

        def run():
            try:
                result = extract_colors(
                    url,
                    n_background=counts["background"],
                    n_text=counts["text"],
                    n_accent=counts["accent"],
                    on_status=lambda m: self.after(0, lambda msg=m: self._status(msg, "gray")),
                )
                self.after(0, lambda: self._add_site(brand, url, result))
            except Exception as exc:
                self.after(0, lambda e=exc: self._analysis_error(str(e)))

        threading.Thread(target=run, daemon=True).start()

    def _analysis_done(self):
        self._analysing = False
        self.progress.stop()
        self.progress.pack_forget()
        self.add_btn.configure(state="normal", text="＋  Analyse & Add")

    def _add_site(self, brand: str, url: str, colors: dict):
        self._analysis_done()
        total = sum(len(v) for v in colors.values())
        self._status(f"Added {brand} ({total} colours)", "#34C759")

        # Clear inputs for next site
        self.url_entry.delete(0, "end")
        self.brand_entry.delete(0, "end")

        self._sites.append({"brand": brand, "url": url, "colors": colors})
        self._refresh_sites_list()
        self._refresh_preview()
        self._set_export_enabled(True)

    def _analysis_error(self, msg: str):
        self._analysis_done()
        self._status(f"Error: {msg[:90]}", "#FF3B30")

    def _status(self, msg: str, color: str = "gray"):
        self.status_lbl.configure(text=msg, text_color=color)

    # ── Sites list ─────────────────────────────────────────────────────────────

    def _refresh_sites_list(self):
        for w in self.sites_frame.winfo_children():
            w.destroy()

        self.sites_header.configure(text=f"Analysed sites  ({len(self._sites)})")

        if not self._sites:
            self.empty_lbl = ctk.CTkLabel(self.sites_frame,
                                           text="No sites yet — add one above.",
                                           text_color="#AEAEB2", font=ctk.CTkFont(size=12))
            self.empty_lbl.pack(anchor="w", pady=4)
            return

        for idx, site in enumerate(self._sites):
            row = ctk.CTkFrame(self.sites_frame, fg_color="transparent")
            row.pack(fill="x", pady=3)

            total = sum(len(v) for v in site["colors"].values())

            ctk.CTkLabel(row, text=f"● {site['brand']}",
                         font=ctk.CTkFont(size=13, weight="bold"),
                         anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=f"  {total} colours",
                         text_color="gray", font=ctk.CTkFont(size=12),
                         anchor="w").pack(side="left")

            # Mini swatches
            for cat in CAT_ORDER:
                for hex_str in site["colors"].get(cat, []):
                    s = _swatch(row, hex_str, size=16)
                    s.pack(side="left", padx=2)

            ctk.CTkButton(row, text="×", width=28, height=28,
                          fg_color="transparent", text_color="#AEAEB2",
                          hover_color="#F2F2F7",
                          command=lambda i=idx: self._remove_site(i)).pack(side="right")

    def _remove_site(self, idx: int):
        self._sites.pop(idx)
        self._refresh_sites_list()
        self._refresh_preview()
        self._set_export_enabled(bool(self._sites))

    # ── Combined preview ───────────────────────────────────────────────────────

    def _refresh_preview(self):
        for w in self.preview_frame.winfo_children():
            w.destroy()

        total = sum(len(v) for s in self._sites for v in s["colors"].values())
        self.preview_header.configure(text=f"Combined preview  ({total} colours)")

        if not self._sites:
            ctk.CTkLabel(self.preview_frame,
                         text="Nothing yet.", text_color="#AEAEB2",
                         font=ctk.CTkFont(size=12)).pack(anchor="w")
            return

        # One row per category, one group per site
        for cat in CAT_ORDER:
            row = ctk.CTkFrame(self.preview_frame, fg_color="transparent")
            row.pack(fill="x", pady=5)

            ctk.CTkLabel(row, text=CAT_LABELS[cat],
                         width=90, anchor="w",
                         font=ctk.CTkFont(size=11, weight="bold"),
                         text_color="#8E8E93").pack(side="left")

            for site in self._sites:
                hexes = site["colors"].get(cat, [])
                if not hexes:
                    continue
                group = ctk.CTkFrame(row, fg_color="transparent")
                group.pack(side="left", padx=(0, 12))

                ctk.CTkLabel(group, text=site["brand"],
                             font=ctk.CTkFont(size=10), text_color="#AEAEB2",
                             anchor="w").pack(anchor="w")

                swatch_row = ctk.CTkFrame(group, fg_color="transparent")
                swatch_row.pack()
                for hex_str in hexes:
                    s = _swatch(swatch_row, hex_str, size=24)
                    s.pack(side="left", padx=2)
                    ToolTip(s, f"{hex_str}")

    # ── Export ─────────────────────────────────────────────────────────────────

    def _set_export_enabled(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        for btn in self._export_btns:
            btn.configure(state=state)

    def _build_json(self, category: str | None = None) -> str:
        """Build JSON for one category (label = brand name) or all categories."""
        colors = []
        cats = [category] if category else CAT_ORDER
        for site in self._sites:
            for cat in cats:
                for hex_str in site["colors"].get(cat, []):
                    colors.append({"hex": hex_str, "label": CAT_LABELS[cat]})
        payload = {"sites": [s["brand"] for s in self._sites], "colors": colors}
        if category:
            payload["category"] = CAT_LABELS[category]
        return json.dumps(payload, indent=2, ensure_ascii=False)

    def _copy_cat(self, category: str):
        self.clipboard_clear()
        self.clipboard_append(self._build_json(category))
        btn = self._export_btns[CAT_ORDER.index(category)]
        original = CAT_LABELS[category]
        btn.configure(text="Copied ✓")
        self.after(2000, lambda: btn.configure(text=original))


# ── Minimal tooltip ────────────────────────────────────────────────────────────

class ToolTip:
    def __init__(self, widget, text: str):
        self._tip = None
        widget.bind("<Enter>", lambda _: self._show(widget, text))
        widget.bind("<Leave>", lambda _: self._hide())

    def _show(self, widget, text: str):
        x = widget.winfo_rootx() + 4
        y = widget.winfo_rooty() - 22
        self._tip = tk.Toplevel(widget)
        self._tip.wm_overrideredirect(True)
        self._tip.wm_geometry(f"+{x}+{y}")
        tk.Label(self._tip, text=text, background="#1C1C1E", foreground="white",
                 font=("Menlo", 11), padx=6, pady=3, relief="flat").pack()

    def _hide(self):
        if self._tip:
            self._tip.destroy()
            self._tip = None


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    App().mainloop()
