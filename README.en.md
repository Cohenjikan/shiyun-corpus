<div align="center">

# shiyun-corpus

**A standalone, complete, provenance-annotated Simplified-Chinese classical-poetry corpus**

shi (诗) · ci (词) · qu (曲) ｜ no classical prose ｜ no character dropping ｜ original punctuation kept ｜ every record traceable · auditable · revertible

[中文](./README.md) · [SOURCES](./SOURCES.md) · [REPORT](./REPORT.md)

</div>

---

## What this is

It **unifies, cleans and annotates** several **upstream parent corpora** (Werneror / yuxqiu / sheepzh) into one clean, complete library. It sits between the *upstream parents* and the *downstream consumers* — **shiyun (诗云) is just one downstream**. A consumer filters its own snapshot (charset gate, poet aggregation, punctuation stripping); **this corpus is bound by none of those downstream constraints**.

| | Downstream (e.g. shiyun) | **This corpus** |
|---|---|---|
| Goal | 3D star-map viz | **clean, complete, reusable annotated corpus** |
| Charset | frozen; whole poem skipped if out-of-set | **no dropping** — rare chars, ci, qu all kept |
| Punctuation | stripped | **original punctuation kept** |
| Annotation | none | **per-record provenance** |
| Relation | consumes a snapshot of this | upstream → **this** → shiyun/others |

> **Annotation is in-corpus metadata; it never reaches any frontend.**

## Design invariants

1. **No character dropping** — not limited by any downstream charset (rare chars / ci / qu kept); never silently discard an upstream poem.
2. **Keep the original** — `body` keeps original **punctuation**; `dynasty_raw` keeps the original dynasty string.
3. **Simplified only** — current upstreams are already Simplified; OpenCC `t2s` is applied at build time only when a Traditional parent is added later.
4. **Provenance-first** — every record is tagged (upstream which file / curated add·fix), **auditable and revertible**.
5. **Non-destructive** — cross-attributed / duplicate poems are **not deleted**; tagged with `dup_group`, leaving dedup to the consumer.
6. **No fabrication** — every curated poem / fix comes from an **authoritative source**, cited per entry.
7. **Poetry only** — **no classical prose** (essays / fu / prefaces); no foreign-language poetry.

## Record schema (`data/poems.<dynasty>.jsonl`, one poem per line, UTF-8)

```jsonc
{
  "id": "sha1(author|dynasty|title|body)[:16]",
  "title": "念奴娇·赤壁怀古",
  "author": "苏轼",
  "dynasty": "song",            // one of 15 canonical keys
  "dynasty_raw": "宋",          // original, reversible
  "body": "大江东去，浪淘尽、千古风流人物。…", // full text WITH punctuation
  "genre": "ci",                // shi / ci / qu / xinshi (modern free verse)
  "dup_group": "9f3a1c0b7e22",  // sha1(author|whitespace-stripped body)[:12]
  "provenance": {
    "type": "upstream",         // upstream (parent) | curated (our add/fix)
    "source": "Werneror/宋_1.csv",
    "license": "PD",            // PD | Apache-2.0 | non-commercial | ⚠in-copyright(YYYY)
    "note": "",                 // required for curated: why added/fixed
    "corrected_from": null      // fixes only: original (wrong) body, kept for audit
  }
}
```

15 canonical dynasty keys: `xianqin qinhan weijin nanbeichao sui tang wudai song liao jin yuan ming qing jinxiandai dangdai` (same mapping as shiyun for easy downstream joins).

## Public vs. restricted layers (copyright posture)

- **Public layer `data/`** = classical texts, **public domain (PD)**, freely publishable.
- **Restricted layer `data/_restricted/`** = modern / in-copyright authors (yuxqiu Apache-2.0 / sheepzh non-commercial / Werneror modern buckets / 叶嘉莹 etc.). Each carries a `license`; **isolated by default** (excluded via `.gitignore`); **whether to publish is the owner's call**.
- Safest posture: **classical fully open + modern annotated/strippable + non-commercial notice**.

## Usage

```bash
# Requires the upstream parents cloned to C:/corpus/ (or override paths, see SOURCES.md)
npm run build      # upstream → data/*.jsonl + data/_build_report.json
npm run validate   # full validation + generates REPORT.md (exit 1 on failure)
npm run all        # build + validate
```

**Re-runnable** = stays in sync with upstream; the curated layer is reapplied automatically and **never lost on an upstream re-pull**. Zero npm dependencies, Node ≥ 18.

## License

Code / curated annotations / docs: **MIT** (see [LICENSE](./LICENSE)). Poem text: **per upstream source** (see [SOURCES.md](./SOURCES.md)).
