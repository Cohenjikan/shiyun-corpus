// shiyun-corpus — build.mjs
// 上游父库(Werneror / yuxqiu / sheepzh) → 统一、清洗、标注 → data/*.jsonl(带 provenance)。
// 铁律:完整不删字 · 保留原始标点 · 简体唯一 · provenance-first · 不破坏式(dup→dup_group) · 不杜撰 · 只收诗词曲(不收古文)。
// 可重复运行(= 与父库同步)。零 npm 依赖。
//   node --max-old-space-size=4096 scripts/build.mjs
//
// 分层(为公开仓合规):
//   data/poems.<dyn>.jsonl            —— 公开层:古典 PD 诗词(先秦…清),size-capped 分片
//   data/_restricted/poems.<dyn>.jsonl —— 隔离层:现代/在册(yuxqiu/sheepzh/Werneror 近现代·当代),默认 gitignore,owner 决定是否公开
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, openSync, writeSync, closeSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const OUT = join(ROOT, "data");
const OUT_RESTRICTED = join(OUT, "_restricted");
const CURATED = join(ROOT, "curated");

const WERNEROR = process.env.WERNEROR_DIR || "C:/corpus/Werneror-Poetry";
const MODERN_ROOT = process.env.MODERN_DIR || "C:/corpus/modern-poetry/China-modern-poetry";
const SHEEPZH = process.env.SHEEPZH_DIR || "C:/corpus/sheepzh-poetry/data";
const SHARD_CAP = (+process.env.SHARD_CAP_MB || 45) * 1024 * 1024; // GitHub warns >50MB / rejects >100MB

const sha1 = (s) => createHash("sha1").update(s, "utf8").digest("hex");
const id16 = (author, dyn, title, body) => sha1(`${author}|${dyn}|${title}|${body}`).slice(0, 16);
const dupGroup = (author, body) => sha1(`${author}|${body.replace(/\s+/g, "")}`).slice(0, 12);
// 简体唯一(铁律):上游 Werneror ~99.8% 已简,这里补最后一公里——仅映射经核验确实出现在语料里的
// 残留繁体字(非全量 OpenCC;若日后接入繁体父库,再换 t2s)。
const SIMPLIFY = { "證":"证","闢":"辟","車":"车","鳥":"鸟","風":"风","頁":"页","魚":"鱼","烏":"乌","島":"岛","龜":"龟","靈":"灵","晝":"昼" };
const simplify = (s) => (s || "").replace(/[證闢車鳥風頁魚烏島龜靈晝]/g, (c) => SIMPLIFY[c]);
// fnv32 poetId — 与诗云一致,方便下游 join
function fnv32(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
const poetId = (name, dyn) => fnv32(name + "|" + dyn).toString(16).padStart(8, "0");

// ── 中文数字 → 整数(仅支持 一~九十九/百 组合的规范写法;解析不出返回 null → 调用方按保守规则跳过) ──
const CN_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnToInt(raw) {
  const s = raw.replace(/^其|^之/, "");
  if (!s) return null;
  if (s.length === 1) return CN_DIGIT[s] ?? (s === "十" ? 10 : null);
  // 二位:十N / N十 / 廿N；三位:N十N / 一百N
  if (s.length === 2) {
    if (s[0] === "十") return CN_DIGIT[s[1]] != null ? 10 + CN_DIGIT[s[1]] : null;
    if (s[1] === "十") return CN_DIGIT[s[0]] != null ? CN_DIGIT[s[0]] * 10 : null;
    if (s[0] === "廿") return CN_DIGIT[s[1]] != null ? 20 + CN_DIGIT[s[1]] : (s[1] === undefined ? 20 : null);
    return null;
  }
  if (s.length === 3 && s[1] === "十") return (CN_DIGIT[s[0]] != null && CN_DIGIT[s[2]] != null) ? CN_DIGIT[s[0]] * 10 + CN_DIGIT[s[2]] : null;
  if (s.length === 3 && s.slice(0, 2) === "一百") return CN_DIGIT[s[2]] != null ? 100 + CN_DIGIT[s[2]] : null;
  return null; // 其余写法(数位连写如"一一一"等)保守跳过,不参与总题拼接判定
}
// 组诗成员标题:"<base> 其N" / "<base> N"(空白分隔) / "<base> 之N"。返回 {base, n} 或 null(n 解析不出也算 null,调用方跳过)。
const MEMBER_RE = /^(.*?)[\s　]+(其[一二三四五六七八九十百廿]+|[一二三四五六七八九十百廿]+|之[一二三四五六七八九十百廿]+)$/;
function splitMember(title) {
  const m = MEMBER_RE.exec(title);
  if (!m) return null;
  const n = cnToInt(m[2]);
  if (n == null) return null;
  return { base: m[1], n };
}

// raw 朝代 → canonical key(沿用诗云 src/data/dynasties.ts 的 15 键映射)
const DYN = {
  先秦: "xianqin",
  秦: "qinhan", 汉: "qinhan",
  魏晋: "weijin", 魏晋末南北朝初: "weijin",
  南北朝: "nanbeichao",
  隋: "sui", 隋末唐初: "tang",
  唐: "tang", 唐末宋初: "tang",
  宋: "song", 宋末金初: "song", 宋末元初: "song",
  辽: "liao",
  金: "jin", 金末元初: "jin",
  元: "yuan", 元末明初: "ming",
  明: "ming", 明末清初: "qing",
  清: "qing", 清末民国初: "jinxiandai", 清末近现代初: "jinxiandai",
  近现代: "jinxiandai", 近现代末当代初: "dangdai", 民国末当代初: "dangdai",
  当代: "dangdai",
};
const CANON_KEYS = new Set(["xianqin","qinhan","weijin","nanbeichao","sui","tang","wudai","song","liao","jin","yuan","ming","qing","jinxiandai","dangdai"]);
// 现代古典层中 → 近现代(与诗云 MODERN_JINXIANDAI 一致),其余 → 当代
const MODERN_JINXIANDAI = new Set([
  "徐志摩","闻一多","郭沫若","戴望舒","朱自清","冯至","卞之琳","何其芳","臧克家","林徽因","废名",
  "李金发","穆旦","郑敏","梁宗岱","刘半农","胡适","俞平伯","汪静之","冰心","宗白华","沈尹默",
  "刘大白","王独清","穆木天","殷夫","蒋光慈","田间","袁可嘉","杜运燮","陈梦家","朱湘","邵洵美",
  "鲁迅","周作人","艾青","纪弦","痖弦","郑愁予","周梦蝶","洛夫","余光中","覃子豪","方思",
]);
// 现代古典 dynasty:近现代/当代 都进隔离层
const modernDyn = (author) => (MODERN_JINXIANDAI.has(author) ? "jinxiandai" : "dangdai");

// ── genre 派生(诗/词/曲/新诗) ──────────────────────────────────────────────
const cipai = new Set();
try {
  for (const line of readFileSync(join(WERNEROR, "cipai_2.txt"), "utf8").split(/\r?\n/)) {
    const t = line.trim(); if (t) cipai.add(t);
  }
} catch { console.warn("⚠ cipai_2.txt 未找到 — ci 识别将退化"); }
const GONGDIAO = ["正宫","中吕","南吕","双调","越调","仙吕","黄钟","商调","大石","小石","般涉","高平","歇指","商角","道宫","中吕宫","南吕宫","仙吕宫","黄钟宫"];
const titleHead = (title) => (title || "").replace(/^[【\[〔（(《]+/, "").split(/[·・,，.．、\s　/|]/)[0];
// classical: qu(宫调前缀)→ci(词牌头∈cipai)→shi;free verse → xinshi
function deriveGenre(title, { freeVerse }) {
  const stripped = (title || "").replace(/^[【\[〔（(《]+/, "");
  if (GONGDIAO.some((g) => stripped.startsWith(g))) return "qu";
  const head = titleHead(title);
  if (head && cipai.has(head)) return "ci";
  return freeVerse ? "xinshi" : "shi";
}

// ── size-capped JSONL 分片写入器(fd + 缓冲,避免 85万次 syscall) ───────────
class ShardWriter {
  constructor(dir, base) { this.dir = dir; this.base = base; this.part = 0; this.fd = null; this.buf = []; this.bufBytes = 0; this.partBytes = 0; this.count = 0; this.files = []; }
  _open() { this.part++; const name = this.part === 1 ? `${this.base}.jsonl` : `${this.base}.${this.part}.jsonl`; const p = join(this.dir, name); this.fd = openSync(p, "w"); this.partBytes = 0; this.files.push(name); }
  write(obj) {
    if (this.fd === null) this._open();
    const line = JSON.stringify(obj) + "\n";
    const b = Buffer.byteLength(line, "utf8");
    if (this.partBytes + b > SHARD_CAP && this.partBytes > 0) { this._flush(); closeSync(this.fd); this.fd = null; this._open(); }
    this.buf.push(line); this.bufBytes += b; this.partBytes += b; this.count++;
    if (this.bufBytes >= 4 * 1024 * 1024) this._flush();
  }
  _flush() { if (this.buf.length) { writeSync(this.fd, this.buf.join("")); this.buf = []; this.bufBytes = 0; } }
  close() { if (this.fd !== null) { this._flush(); closeSync(this.fd); this.fd = null; } }
}
const writers = new Map(); // layerKey -> ShardWriter
function emit(rec) {
  const layer = rec.__layer; const dir = layer === "restricted" ? OUT_RESTRICTED : OUT;
  const key = layer + "|" + rec.dynasty;
  let w = writers.get(key);
  if (!w) { w = new ShardWriter(dir, `poems.${rec.dynasty}`); writers.set(key, w); }
  delete rec.__layer;
  w.write(rec);
}

// ── 统计累加 ──────────────────────────────────────────────────────────────
const stat = {
  total: 0, perDynasty: {}, perGenre: {}, perSource: {}, perLicense: {}, perLayer: { public: 0, restricted: 0 },
  placeholderRecords: 0, badDynasty: 0,
};
const PLACEHOLDER = /[�■□]|\?/; // utf8mb4 占位(Werneror README:用 ? 替代) / 乱码替换符
// 来源聚合键:Werneror 按文件(33)、yuxqiu 按子目录、sheepzh 整体折叠(否则 3500 诗人各成一行)
function sourceKey(src) {
  if (src.startsWith("Werneror/")) return src;
  if (src.startsWith("yuxqiu/")) return "yuxqiu/" + src.split("/")[1];
  if (src.startsWith("sheepzh/")) return "sheepzh";
  return src.split("/")[0];
}
const poets = new Map(); // poetId -> {id,name,dynasty,layer,count,genres:Set,hasCurated}
const aliasPoets = new Map(); // aliasPoetId -> {id,name,dynasty,layer,mergedInto:{author,dynasty},note} — poemCount 恒 0,仅为保住 #a= 深链而发行
function record({ title, author, dynRaw, dyn, body, genre, layer, prov }) {
  body = simplify((body || "").replace(/^\s+|\s+$/g, ""));
  author = simplify((author || "").trim());
  title = simplify((title || "").trim());
  if (!author || !body) return false;
  if (!CANON_KEYS.has(dyn)) stat.badDynasty++;
  // merges:命中别名(author,dyn)→ 诗行改挂正身;provenance 存证原署名(merged_from);别名诗人身份单独记一行(poemCount:0)
  const merge = resolveMerge(author, dyn);
  if (merge) {
    const aliasPid = poetId(author, dyn);
    if (!aliasPoets.has(aliasPid)) {
      aliasPoets.set(aliasPid, {
        id: aliasPid, name: author, dynasty: dyn, layer,
        mergedInto: { author: merge.author, dynasty: merge.dynasty },
        note: merge.note,
      });
    } else if (layer === "public") {
      aliasPoets.get(aliasPid).layer = "public"; // 别名身份跨层出现时同 poet 归并规则:public 优先展示
    }
    prov = { ...prov, merged_from: { author, dynasty: dyn } };
    author = merge.author; dyn = merge.dynasty;
  }
  const rec = {
    id: id16(author, dyn, title, body),
    title, author, dynasty: dyn, dynasty_raw: dynRaw,
    body, genre, dup_group: dupGroup(author, body),
    provenance: prov, __layer: layer,
  };
  // stats
  stat.total++;
  stat.perDynasty[dyn] = (stat.perDynasty[dyn] || 0) + 1;
  stat.perGenre[genre] = (stat.perGenre[genre] || 0) + 1;
  const sk = sourceKey(prov.source);
  stat.perSource[sk] = (stat.perSource[sk] || 0) + 1;
  stat.perLicense[prov.license] = (stat.perLicense[prov.license] || 0) + 1;
  stat.perLayer[layer]++;
  if (PLACEHOLDER.test(body)) stat.placeholderRecords++;
  // poet aggregate(正身;别名已在上面 resolveMerge 分支单独记账,不进这里)
  const pid = poetId(author, dyn);
  let p = poets.get(pid);
  if (!p) { p = { id: pid, name: author, dynasty: dyn, layer, count: 0, genres: new Set(), hasCurated: false }; poets.set(pid, p); }
  p.count++; p.genres.add(genre); if (prov.type === "curated") p.hasCurated = true;
  if (layer === "restricted" && p.layer === "public") p.layer = "restricted"; // poet appearing in both → restricted-tainted
  emit(rec);
  return true;
}

// ── 流式 CSV 记录读取器(引号/""转义/内嵌换行;逐条 yield,内存恒定) ──────
function* csvRecords(text) {
  let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); yield row; row = []; field = ""; }
      else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); yield row; }
}

// ── curated 层:corrections 索引(按首句匹配) ─────────────────────────────
function loadJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l, i) => {
    try { return JSON.parse(l); } catch (e) { throw new Error(`${path}:${i + 1} 不是合法 JSON — ${e.message}`); }
  });
}
// PD 条目入公开仓;在册/受版权条目放 *.restricted.jsonl(gitignored,本地仍读取,不进公开仓)
const corrections = [...loadJsonl(join(CURATED, "corrections.jsonl")), ...loadJsonl(join(CURATED, "corrections.restricted.jsonl"))];
const additions = [...loadJsonl(join(CURATED, "additions.jsonl")), ...loadJsonl(join(CURATED, "additions.restricted.jsonl"))];
const corrByFirst = new Map(); // matchFirstLine -> {...correction, applied}
for (const c of corrections) { c.applied = 0; corrByFirst.set(c.matchFirstLine, c); }
const firstLine = (body) => body.split(/[，。！？；\n]/)[0];

// ── merges(别名正身层):curated/merges.jsonl,{alias_author,alias_dynasty,canonical_author,canonical_dynasty,note}
// Wikidata 模式:数据层不删——诗行改挂正身 author/dynasty(provenance 存证 merged_from),
// poets.jsonl 为别名身份仍发一行(poemCount:0, merged_into),保住原 poetId(name|dynasty)不断 #a= 深链。
const merges = loadJsonl(join(CURATED, "merges.jsonl"));
const mergeByAlias = new Map(); // "author|dynasty" -> {canonical_author,canonical_dynasty,note}
for (const m of merges) { m.applied = 0; mergeByAlias.set(`${m.alias_author}|${m.alias_dynasty}`, m); }
// resolveMerge:命中别名 → 返回正身 {author,dynasty};未命中 → null。别名键用 build.mjs 内 simplify/trim 后的 author 比对(与 record() 一致)。
function resolveMerge(author, dyn) {
  const m = mergeByAlias.get(`${author}|${dyn}`);
  if (!m) return null;
  m.applied++;
  return { author: m.canonical_author, dynasty: m.canonical_dynasty, note: m.note };
}

// 套用 correction:命中则改正、转 provenance=curated、留 corrected_from。返回处理后字段或 null。
function applyCorrection(author, body) {
  const c = corrByFirst.get(firstLine(body)); // 仅首句精确匹配
  if (!c) return null;
  if (!body.includes(c.find)) { c.findMiss = (c.findMiss || 0) + 1; return null; } // 首句匹配但 find 不在 → 不动,记账
  const newBody = body.split(c.find).join(c.replace);
  c.applied++;
  return {
    body: newBody,
    prov: { type: "curated", source: c.source, license: c.license, note: c.note || "", corrected_from: body },
    layer: c.layer || "restricted",
    dynOverride: c.dynasty, genreOverride: c.genre,
  };
}

// ════════════════════════════════════════════════════════════════════════════
console.log("clean output dirs…");
mkdirSync(OUT, { recursive: true });
mkdirSync(OUT_RESTRICTED, { recursive: true });
for (const d of [OUT, OUT_RESTRICTED]) for (const f of readdirSync(d)) if (f.endsWith(".jsonl") || f === "_build_report.json" || f.startsWith("poets")) try { rmSync(join(d, f)); } catch {}

// ── 1) Werneror(古典,公开 PD;近现代/当代 → 隔离) ─────────────────────────
console.log("\n[1/3] Werneror …", WERNEROR);
{
  const files = readdirSync(WERNEROR).filter((f) => f.endsWith(".csv"));
  for (const file of files) {
    const text = readFileSync(join(WERNEROR, file), "utf8");
    let header = true, n0 = stat.total;
    for (const row of csvRecords(text)) {
      if (header) { header = false; continue; } // 题目,朝代,作者,内容
      const [title, dynRaw, author, content] = row;
      if (!author || !content) continue;
      const dyn = DYN[dynRaw] || "unknown";
      const layer = (dyn === "jinxiandai" || dyn === "dangdai") ? "restricted" : "public";
      const license = layer === "restricted" ? "⚠in-copyright(verify)" : "PD";
      // 先试 correction(如 毛泽东 到韶山)
      const fix = applyCorrection(author, content);
      if (fix) {
        record({ title, author, dynRaw, dyn: fix.dynOverride || dyn, body: fix.body, genre: fix.genreOverride || deriveGenre(title, { freeVerse: false }), layer: fix.layer, prov: fix.prov });
      } else {
        record({ title, author, dynRaw, dyn, body: content, genre: deriveGenre(title, { freeVerse: false }), layer, prov: { type: "upstream", source: `Werneror/${file}`, license, note: "", corrected_from: null } });
      }
    }
    console.log(`  ${file}: +${stat.total - n0}  (total=${stat.total})`);
  }
}

// ── 2) yuxqiu China-modern-poetry(隔离层) ────────────────────────────────
// contemporary: paragraphs=数组(自由诗,新诗);modern / modern times: paragraphs=字符串(旧体诗词,带标点)
console.log("\n[2/3] yuxqiu modern …", MODERN_ROOT);
{
  const subs = [
    { dir: "contemporary", freeVerse: true, license: "Apache-2.0" },
    { dir: "modern", freeVerse: false, license: "Apache-2.0" },
    { dir: "modern times", freeVerse: false, license: "Apache-2.0" },
  ];
  for (const { dir, freeVerse, license } of subs) {
    const full = join(MODERN_ROOT, dir);
    let mfiles;
    try { mfiles = readdirSync(full).filter((f) => /^\d/.test(f) && f.endsWith(".json")); }
    catch (e) { console.warn(`  skip ${dir}: ${e.code || e.message}`); continue; }
    const n0 = stat.total;
    for (const file of mfiles) {
      let arr; try { arr = JSON.parse(readFileSync(join(full, file), "utf8")); } catch (e) { console.warn(`  ⚠ ${dir}/${file} JSON 解析失败 — 跳过文件: ${e.message}`); continue; }
      if (!Array.isArray(arr)) continue;
      for (const poem of arr) {
        const author = (poem.author || "").trim();
        if (!author) continue;
        let body;
        if (Array.isArray(poem.paragraphs)) body = poem.paragraphs.join("\n");
        else if (typeof poem.paragraphs === "string") body = poem.paragraphs;
        else continue;
        const dyn = modernDyn(author);
        // 先试 correction(如 毛泽东 到韶山)。保桶/保层:现代路径的 dyn/layer 是路径本身定的(modernDyn/restricted),
        // 忽略 fix.dynOverride/fix.layer——否则订正条目里的 dynasty(如 jinxiandai)会把「当代」副本改桶,
        // 导致「作者|dangdai」这个诗人从下游消失、断永久链接。genre 同理维持本路径原判,除非订正条目明确给了 genre。
        const fix = applyCorrection(author, body);
        if (fix) {
          record({ title: poem.title || "", author, dynRaw: "现代", dyn, body: fix.body, genre: fix.genreOverride || deriveGenre(poem.title || "", { freeVerse }), layer: "restricted", prov: fix.prov });
        } else {
          record({ title: poem.title || "", author, dynRaw: "现代", dyn, body, genre: deriveGenre(poem.title || "", { freeVerse }), layer: "restricted", prov: { type: "upstream", source: `yuxqiu/${dir}/${file}`, license, note: "现代作者作品多受著作权保护;Apache-2.0 覆盖数据集打包,文本著作权归原作者。", corrected_from: null } });
        }
      }
    }
    console.log(`  ${dir}: +${stat.total - n0}  (total=${stat.total})`);
  }
}

// ── 3) sheepzh 汉语现代诗歌(隔离层,非商用) ──────────────────────────────
console.log("\n[3/3] sheepzh modern …", SHEEPZH);
{
  const HAN_AUTHOR = /^[㐀-䶿一-鿿·]{1,8}$/; // 丢弃 handle/junk 目录(666_666, Apple_apple…)
  let sdirs = [];
  try { sdirs = readdirSync(SHEEPZH, { withFileTypes: true }).filter((d) => d.isDirectory()); }
  catch (e) { console.warn(`  skip sheepzh: ${e.code || e.message}`); }
  const n0 = stat.total; let badName = 0, noBody = 0;
  for (const d of sdirs) {
    const cut = d.name.lastIndexOf("_");
    const author = cut > 0 ? d.name.slice(0, cut) : d.name;
    if (!HAN_AUTHOR.test(author)) { badName++; continue; }
    const dyn = modernDyn(author);
    let pts; try { pts = readdirSync(join(SHEEPZH, d.name)).filter((f) => f.endsWith(".pt")); } catch { continue; }
    for (const f of pts) {
      let raw; try { raw = readFileSync(join(SHEEPZH, d.name, f), "utf8"); } catch { continue; }
      const rows = raw.split(/\r?\n/);
      let title = f.slice(0, -3), bodyStart = 0;
      if (rows[0]?.startsWith("title:")) { title = rows[0].slice(6).trim() || title; bodyStart = 1; }
      if (rows[bodyStart]?.startsWith("date:")) bodyStart++;
      const body = rows.slice(bodyStart).join("\n").replace(/^\n+|\n+$/g, "");
      if (!body.trim()) { noBody++; continue; }
      // 先试 correction。保桶/保层:同 yuxqiu 路径——忽略 fix.dynOverride/fix.layer,
      // dyn 恒为 modernDyn(author)、layer 恒为 restricted,避免订正条目把现代副本改桶导致下游诗人消失。
      const fix = applyCorrection(author, body);
      if (fix) {
        record({ title, author, dynRaw: "现代", dyn, body: fix.body, genre: fix.genreOverride || deriveGenre(title, { freeVerse: true }), layer: "restricted", prov: fix.prov });
      } else {
        record({ title, author, dynRaw: "现代", dyn, body, genre: deriveGenre(title, { freeVerse: true }), layer: "restricted", prov: { type: "upstream", source: `sheepzh/${d.name}/${f}`, license: "non-commercial", note: "sheepzh/poetry:文本著作权归原作者,非商用。", corrected_from: null } });
      }
    }
  }
  console.log(`  sheepzh: +${stat.total - n0}  junk-folders=${badName} empty=${noBody}  (total=${stat.total})`);
}

// ── 4) curated additions(我方补录,带权威出处) ───────────────────────────
console.log("\n[curated] additions …");
{
  const n0 = stat.total;
  for (const a of additions) {
    const dyn = a.dynasty;
    const layer = a.layer || (a.license === "PD" ? "public" : "restricted");
    record({ title: a.title || "", author: a.author, dynRaw: a.dynasty_raw || "", dyn, body: a.body, genre: a.genre || deriveGenre(a.title || "", { freeVerse: a.freeVerse || false }), layer, prov: { type: "curated", source: a.source, license: a.license, note: a.note || "", corrected_from: null } });
  }
  console.log(`  additions: +${stat.total - n0}`);
}

// ── 收尾:关闭分片 ─────────────────────────────────────────────────────────
for (const w of writers.values()) w.close();

// ── canonical 标注(merges 之后跑,两类;分组遍历,不做 O(n²) 全库比对) ──────
// a) 精确重复:同 dup_group(同作者同文)组内保留一条 canonical(优先 provenance.type=curated,否则首条原序),其余标 canonical:false + canonical_id。
// b) 组诗总题合并行:同作者下,标题 T 的行 body 去空白后 == members("T 其N"/"T N"/"T 之N",按数字排序)按序拼接 → T 行标 canonical:false + canonical_note(拼接不精确相等则不标,无单一 canonical_id,留 null)。
// 缺省 canonical=true(不写字段=true,老消费者零感知)。
console.log("\n[canonical] 别名/组诗标注 …");
const canonStat = { exactDupLines: 0, totalTitleLines: 0, perAuthorExact: new Map(), perAuthorTotal: new Map() };
{
  // 1) 重新读回所有已写分片(含刚 merge 改挂正身的行),按文件持有可变数组,再按 author 建索引(引用同一对象,原地标注后按文件整体重写)
  const fileRows = new Map(); // fileAbsPath -> Array<rec>
  const byAuthor = new Map(); // author -> Array<rec>  (rec 与 fileRows 中的对象同引用)
  for (const dir of [OUT, OUT_RESTRICTED]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith("poems.") || !f.endsWith(".jsonl")) continue;
      const abs = join(dir, f);
      const lines = readFileSync(abs, "utf8").split("\n");
      const rows = [];
      for (const l of lines) { if (!l) continue; rows.push(JSON.parse(l)); }
      fileRows.set(abs, rows);
      for (const rec of rows) {
        let arr = byAuthor.get(rec.author);
        if (!arr) { arr = []; byAuthor.set(rec.author, arr); }
        arr.push(rec);
      }
    }
  }

  for (const [author, recs] of byAuthor) {
    // b) 组诗总题合并行——先算候选集(仅算,不落字段),供 a) 选 canonical 时避让,防止 a) 选中的 canonical 行
    //    随后又被 b) 判定为总题合并行,导致"canonical_id 指向的行必须 canonical"被打破(别名链式)。
    const byTitle = new Map();
    for (const r of recs) { let a = byTitle.get(r.title); if (!a) { a = []; byTitle.set(r.title, a); } a.push(r); }
    const membersByBase = new Map(); // base -> [{n, body}]
    for (const r of recs) {
      const sp = splitMember(r.title);
      if (!sp) continue;
      let a = membersByBase.get(sp.base); if (!a) { a = []; membersByBase.set(sp.base, a); }
      a.push({ n: sp.n, body: r.body.replace(/\s+/g, "") });
    }
    const totalTitleCandidates = new Set(); // Set<rec> —— b) 将会标注的行(在 a) 选 canonical 时避让)
    for (const [base, members] of membersByBase) {
      const totalRows = byTitle.get(base);
      if (!totalRows || members.length < 2) continue;
      const sorted = [...members].sort((x, y) => x.n - y.n);
      const concat = sorted.map((m) => m.body).join("");
      for (const t of totalRows) {
        if (t.body.replace(/\s+/g, "") === concat) totalTitleCandidates.add(t);
      }
    }

    // a) 精确重复(dup_group 分组;dup_group = sha1(author|body无空白),同作者内天然聚组,无需跨作者比较)
    // canonical 优先级:非总题候选 + curated > 非总题候选(首条原序)。
    // 若组内全员都是总题候选(极端情况,如同一诗人对同一组诗有两个总题各自匹配自身分首)——
    // 则没有安全的 canonical_id 落点,跳过 a) 的跨行链接,交给 b) 各自独立标注 canonical_note(不产生 canonical_id 链)。
    const byDup = new Map();
    for (const r of recs) { let a = byDup.get(r.dup_group); if (!a) { a = []; byDup.set(r.dup_group, a); } a.push(r); }
    for (const group of byDup.values()) {
      if (group.length < 2) continue;
      const canon = group.find((r) => r.provenance?.type === "curated" && !totalTitleCandidates.has(r))
        || group.find((r) => !totalTitleCandidates.has(r));
      if (!canon) continue; // 全员总题候选,跳过(保守:不造 canonical_id 链)
      let demoted = 0;
      for (const r of group) {
        if (r === canon) continue;
        r.canonical = false; r.canonical_id = canon.id;
        demoted++;
      }
      canonStat.exactDupLines += demoted;
      canonStat.perAuthorExact.set(author, (canonStat.perAuthorExact.get(author) || 0) + demoted);
    }
    // b) 正式标注(仅在仍为 canonical 的行上标注,不覆盖 a) 已判定的行;canon 行已在上面避让,这里理应不再命中,兜底仍加保护)
    for (const t of totalTitleCandidates) {
      if (t.canonical === false) continue; // 已被 a) 判定(理论上不会,因 a) 已避让;兜底不覆盖)
      t.canonical = false; t.canonical_note = "组诗总题合并行,分首为正身";
      canonStat.totalTitleLines++;
      canonStat.perAuthorTotal.set(author, (canonStat.perAuthorTotal.get(author) || 0) + 1);
    }
  }

  // 2) 按文件整体重写(仅改过的字段体现在 JSON.stringify 里;未标注行原样输出)
  for (const [abs, rows] of fileRows) {
    writeFileSync(abs, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  }
}
const top10 = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([author, n]) => ({ author, n }));
console.log(`  精确重复标注: ${canonStat.exactDupLines} 行`);
console.log(`  组诗总题标注: ${canonStat.totalTitleLines} 行`);

// poets.jsonl(公开层) + poets.restricted.jsonl(隔离层)
const poetRowsPublic = [], poetRowsRestricted = [];
for (const p of [...poets.values()].sort((a, b) => b.count - a.count)) {
  const row = { id: p.id, name: p.name, dynasty: p.dynasty, poemCount: p.count, genres: [...p.genres].sort(), has_curated: p.hasCurated };
  (p.layer === "restricted" ? poetRowsRestricted : poetRowsPublic).push(row);
}
// 别名身份行(merges 命中的原署名):poemCount 恒 0,merged_into 指向正身——保住原 poetId(name|dynasty),#a= 深链不断
for (const ap of aliasPoets.values()) {
  const row = { id: ap.id, name: ap.name, dynasty: ap.dynasty, poemCount: 0, mergedInto: ap.mergedInto, note: ap.note };
  (ap.layer === "restricted" ? poetRowsRestricted : poetRowsPublic).push(row);
}
writeFileSync(join(OUT, "poets.jsonl"), poetRowsPublic.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(OUT_RESTRICTED, "poets.jsonl"), poetRowsRestricted.map((r) => JSON.stringify(r)).join("\n") + "\n");

// 文件清单 + 字节数
const fileList = [];
for (const [key, w] of writers) for (const name of w.files) {
  const layer = key.split("|")[0]; const dir = layer === "restricted" ? OUT_RESTRICTED : OUT;
  fileList.push({ file: (layer === "restricted" ? "_restricted/" : "") + name, bytes: statSync(join(dir, name)).size });
}

const buildReport = {
  builtAt_note: "时间戳由 owner 在外部记录(脚本内不取系统时钟以保证可复现)",
  sources: { werneror: WERNEROR, yuxqiu: MODERN_ROOT, sheepzh: SHEEPZH },
  total: stat.total,
  perLayer: stat.perLayer,
  perDynasty: stat.perDynasty,
  perGenre: stat.perGenre,
  perSource: stat.perSource,
  perLicense: stat.perLicense,
  placeholderRecords: stat.placeholderRecords,
  badDynasty: stat.badDynasty,
  poets: { public: poetRowsPublic.length, restricted: poetRowsRestricted.length },
  curated: {
    additions: additions.length,
    corrections: corrections.map((c) => ({ matchFirstLine: c.matchFirstLine, find: c.find, replace: c.replace, applied: c.applied || 0, findMiss: c.findMiss || 0, expectHits: c.expectHits ?? 1, license: c.license })), // expectHits:声明合法命中数,缺省 1(validate 铁律据此核对)
    merges: merges.map((m) => ({ alias_author: m.alias_author, alias_dynasty: m.alias_dynasty, canonical_author: m.canonical_author, canonical_dynasty: m.canonical_dynasty, applied: m.applied || 0 })),
  },
  canonical: {
    exactDupLines: canonStat.exactDupLines,
    totalTitleLines: canonStat.totalTitleLines,
    perAuthorExactTop10: top10(canonStat.perAuthorExact),
    perAuthorTotalTop10: top10(canonStat.perAuthorTotal),
  },
  shardCapMB: SHARD_CAP / 1024 / 1024,
  files: fileList.sort((a, b) => a.file.localeCompare(b.file)),
};
writeFileSync(join(OUT, "_build_report.json"), JSON.stringify(buildReport, null, 2));

console.log(`\nDONE  total=${stat.total}  public=${stat.perLayer.public}  restricted=${stat.perLayer.restricted}`);
console.log(`poets: public=${poetRowsPublic.length} restricted=${poetRowsRestricted.length}`);
console.log(`genres:`, stat.perGenre);
console.log(`corrections applied:`, buildReport.curated.corrections);
console.log(`merges applied:`, buildReport.curated.merges);
console.log(`canonical: exactDupLines=${canonStat.exactDupLines} totalTitleLines=${canonStat.totalTitleLines}`);
if (stat.badDynasty) console.warn(`⚠ 未知朝代键记录数: ${stat.badDynasty}`);
console.log(`\n→ data/_build_report.json 写出。下一步: node scripts/validate.mjs`);
