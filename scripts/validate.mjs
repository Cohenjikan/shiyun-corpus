// shiyun-corpus — validate.mjs
// 构建后必跑(= 验收清单,CORPUS_DB_GUIDE §7)。流式校验 data/**/*.jsonl,生成 REPORT.md,失败 exit 1。
//   node --max-old-space-size=4096 scripts/validate.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const OUT = join(ROOT, "data");
const OUT_RESTRICTED = join(OUT, "_restricted");

const CANON = new Set(["xianqin","qinhan","weijin","nanbeichao","sui","tang","wudai","song","liao","jin","yuan","ming","qing","jinxiandai","dangdai"]);
const GENRES = new Set(["shi","ci","qu","xinshi"]);
const sha1 = (s) => createHash("sha1").update(s, "utf8").digest("hex");

const errors = [];   // 致命(FAIL)
const warnings = []; // 警告(不阻塞)
const err = (m) => { if (errors.length < 60) errors.push(m); else if (errors.length === 60) errors.push("…(更多错误省略)"); };
const warn = (m) => { if (warnings.length < 40) warnings.push(m); };

// 收集分片文件
function shardFiles(dir, prefix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.startsWith("poems.") && f.endsWith(".jsonl")).map((f) => ({ file: prefix + f, abs: join(dir, f) }));
}
const files = [...shardFiles(OUT, ""), ...shardFiles(OUT_RESTRICTED, "_restricted/")];
if (!files.length) { console.error("✗ 找不到任何 data/poems.*.jsonl — 先跑 build.mjs"); process.exit(1); }

const stat = {
  total: 0, perLayer: { public: 0, restricted: 0 }, perDynasty: {}, perGenre: {}, perLicense: {}, perType: {},
  placeholder: 0, restrictedNoLicense: 0, publicNonPD: 0, curatedNoNote: 0, correctionNoChange: 0,
};
const dupCount = new Map();   // dup_group -> n
const dupSample = new Map();  // dup_group -> {author,title}  (仅当 n→2 时记一个样本)
const HEX16 = /^[0-9a-f]{16}$/, HEX12 = /^[0-9a-f]{12}$/;
const PLACEHOLDER = /[�■□]|\?/;
let sampleChecked = 0, sampleBadId = 0; // id 复算抽检

for (const { file, abs } of files) {
  const layer = file.startsWith("_restricted/") ? "restricted" : "public";
  const text = readFileSync(abs, "utf8");
  let ln = 0;
  for (const line of text.split("\n")) {
    if (!line) continue;
    ln++;
    let r;
    try { r = JSON.parse(line); } catch (e) { err(`${file}:${ln} JSON 解析失败: ${e.message}`); continue; }
    stat.total++; stat.perLayer[layer]++;

    // 1) schema
    if (!HEX16.test(r.id || "")) err(`${file}:${ln} id 非法(应 16hex): ${r.id}`);
    if (typeof r.title !== "string") err(`${file}:${ln} title 缺失/非串`);
    if (!r.author) err(`${file}:${ln} author 为空`);
    if (!r.body) err(`${file}:${ln} body 为空`);
    if (typeof r.dynasty_raw !== "string") err(`${file}:${ln} dynasty_raw 缺失`);
    if (!HEX12.test(r.dup_group || "")) err(`${file}:${ln} dup_group 非法(应 12hex): ${r.dup_group}`);
    // 2) dynasty ∈ 15 canonical
    if (!CANON.has(r.dynasty)) err(`${file}:${ln} dynasty 非 canonical: ${r.dynasty}`);
    stat.perDynasty[r.dynasty] = (stat.perDynasty[r.dynasty] || 0) + 1;
    // genre
    if (!GENRES.has(r.genre)) err(`${file}:${ln} genre 非法: ${r.genre}`);
    stat.perGenre[r.genre] = (stat.perGenre[r.genre] || 0) + 1;
    // 5) provenance
    const p = r.provenance;
    if (!p || typeof p !== "object") { err(`${file}:${ln} provenance 缺失`); }
    else {
      if (p.type !== "upstream" && p.type !== "curated") err(`${file}:${ln} provenance.type 非法: ${p.type}`);
      if (!p.source) err(`${file}:${ln} provenance.source 为空`);
      if (!p.license) { err(`${file}:${ln} provenance.license 为空`); }
      stat.perLicense[p.license] = (stat.perLicense[p.license] || 0) + 1;
      stat.perType[p.type] = (stat.perType[p.type] || 0) + 1;
      if (p.type === "curated") {
        if (!p.note) { stat.curatedNoNote++; err(`${file}:${ln} curated 缺 note`); }
        if (p.corrected_from != null) { // 订正条目
          if (p.corrected_from === r.body) { stat.correctionNoChange++; err(`${file}:${ln} 订正 corrected_from 与 body 相同(未实际改动)`); }
        }
      }
      // 6) 许可分层
      if (layer === "restricted" && !p.license) stat.restrictedNoLicense++;
      if (layer === "public" && p.license !== "PD") { stat.publicNonPD++; err(`${file}:${ln} 公开层非 PD 许可: ${p.license}(应隔离)`); }
    }
    // 3) 编码占位符(报告,不致命)
    if (PLACEHOLDER.test(r.body)) stat.placeholder++;
    // 4) 去重计数
    const dg = r.dup_group;
    const n = (dupCount.get(dg) || 0) + 1; dupCount.set(dg, n);
    if (n === 2) dupSample.set(dg, { author: r.author, title: r.title });
    // id 抽检(每 997 条复算一次)
    if (stat.total % 997 === 0) { sampleChecked++; if (sha1(`${r.author}|${r.dynasty}|${r.title}|${r.body}`).slice(0, 16) !== r.id) { sampleBadId++; err(`${file}:${ln} id 复算不一致`); } }
  }
}

// 去重分布
const dist = { "1(unique)": 0, "2": 0, "3-5": 0, "6-10": 0, "11-50": 0, "51+": 0 };
let dupRecords = 0, dupGroups = 0;
for (const n of dupCount.values()) {
  if (n === 1) dist["1(unique)"]++;
  else { dupGroups++; dupRecords += n;
    if (n === 2) dist["2"]++; else if (n <= 5) dist["3-5"]++; else if (n <= 10) dist["6-10"]++; else if (n <= 50) dist["11-50"]++; else dist["51+"]++;
  }
}
const topDup = [...dupCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 15)
  .map(([dg, n]) => ({ dup_group: dg, n, sample: dupSample.get(dg) }));

// build report(curated 应用情况)
let br = null;
try { br = JSON.parse(readFileSync(join(OUT, "_build_report.json"), "utf8")); } catch { warn("_build_report.json 缺失 — curated 应用情况无法核对"); }
if (br) {
  for (const c of br.curated.corrections) {
    if (c.applied === 0) err(`correction 未命中底库(applied=0): "${c.matchFirstLine}" → ${c.replace}`);
    if (c.applied > 1) err(`correction 命中不唯一(applied=${c.applied}): "${c.matchFirstLine}" — 违反唯一命中铁律`);
    if (c.findMiss) warn(`correction 首句匹配但 find 不在正文 ×${c.findMiss}: "${c.matchFirstLine}"`);
  }
}
if (sampleChecked && sampleBadId === 0) {} // ok

// ── 生成 REPORT.md ──────────────────────────────────────────────────────────
const pass = errors.length === 0;
const pct = (n) => ((n / stat.total) * 100).toFixed(2) + "%";
const sortObj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const DYN_LABEL = { xianqin:"先秦", qinhan:"秦汉", weijin:"魏晋", nanbeichao:"南北朝", sui:"隋", tang:"唐", wudai:"五代", song:"宋", liao:"辽", jin:"金", yuan:"元", ming:"明", qing:"清", jinxiandai:"近现代", dangdai:"当代" };
const fmtBytes = (b) => (b / 1024 / 1024).toFixed(1) + " MB";

let md = `# shiyun-corpus — 构建 / 校验报告 (REPORT)

> 由 \`scripts/validate.mjs\` 生成。校验项依据 \`CORPUS_DB_GUIDE.md §7\`。

## 0. 总判定

**${pass ? "✅ PASS — 全部致命校验通过" : `❌ FAIL — ${errors.length} 项致命错误(见 §8)`}**

- 总记录数:**${stat.total.toLocaleString()}**
- 公开层(PD 古典):**${stat.perLayer.public.toLocaleString()}**　|　隔离层(现代/在册):**${stat.perLayer.restricted.toLocaleString()}**
- 诗人:公开 ${br?.poets?.public ?? "?"} · 隔离 ${br?.poets?.restricted ?? "?"}
- id 抽检:复算 ${sampleChecked} 条,不一致 ${sampleBadId} 条

## 1. 分层 / 来源

| 层 | 记录数 | 占比 |
|---|---:|---:|
| public (data/) | ${stat.perLayer.public.toLocaleString()} | ${pct(stat.perLayer.public)} |
| restricted (data/_restricted/) | ${stat.perLayer.restricted.toLocaleString()} | ${pct(stat.perLayer.restricted)} |

来源 (provenance.source 前缀):
${sortObj(br?.perSource || {}).map(([k, v]) => `- \`${k}\` — ${v.toLocaleString()}`).join("\n") || "- (build report 缺失)"}

## 2. 按朝代

| 朝代 | key | 记录数 | 占比 |
|---|---|---:|---:|
${["xianqin","qinhan","weijin","nanbeichao","sui","tang","wudai","song","liao","jin","yuan","ming","qing","jinxiandai","dangdai"].filter((k) => stat.perDynasty[k]).map((k) => `| ${DYN_LABEL[k]} | ${k} | ${stat.perDynasty[k].toLocaleString()} | ${pct(stat.perDynasty[k])} |`).join("\n")}

## 3. 按体裁 (genre)

| genre | 含义 | 记录数 | 占比 |
|---|---|---:|---:|
${sortObj(stat.perGenre).map(([k, v]) => `| ${k} | ${{shi:"诗",ci:"词",qu:"曲(散曲)",xinshi:"现代新诗/自由诗"}[k] || k} | ${v.toLocaleString()} | ${pct(v)} |`).join("\n")}

## 4. 按许可 (license)

| license | 记录数 | 层 |
|---|---:|---|
${sortObj(stat.perLicense).map(([k, v]) => `| ${k} | ${v.toLocaleString()} | ${k === "PD" ? "public" : "restricted"} |`).join("\n")}

provenance.type:${sortObj(stat.perType).map(([k, v]) => `${k}=${v.toLocaleString()}`).join(" · ")}

## 5. 去重 (dup_group,同 author+正文 归一组,**不删**)

> 仅作报告,交消费者决定是否去重(诗云正因刻意不去重而有陆游虚高)。

- 去重组数(size≥2):**${dupGroups.toLocaleString()}**,涉及记录 **${dupRecords.toLocaleString()}**(${pct(dupRecords)})
- 组规模分布:
${Object.entries(dist).map(([k, v]) => `  - size ${k}: ${v.toLocaleString()} 组`).join("\n")}

最大的 15 个重出组:

| dup_group | 重复数 | 样本(作者《题》) |
|---|---:|---|
${topDup.map((d) => `| \`${d.dup_group}\` | ${d.n} | ${d.sample?.author || "?"}《${(d.sample?.title || "").slice(0, 20)}》 |`).join("\n")}

## 6. 编码 / 占位符

- 含占位符(\`?\`/\`�\`/\`■\`/\`□\`,多为 utf8mb4 生僻字被上游替换)的记录:**${stat.placeholder.toLocaleString()}**(${pct(stat.placeholder)})
- 处置:**保留不删**(铁律:完整不删字),仅报告;如需净化由消费者在快照侧处理。

## 7. curated 校勘层

- additions(补录):**${br?.curated?.additions ?? "?"}** 条
- corrections(订正):

| matchFirstLine | find → replace | applied | license |
|---|---|---:|---|
${(br?.curated?.corrections || []).map((c) => { const restricted = /in-copyright|non-commercial/.test(c.license || ""); return restricted ? `| （restricted·正文已隐去） | — | ${c.applied} | ${c.license} |` : `| ${c.matchFirstLine} | ${c.find} → ${c.replace} | ${c.applied} | ${c.license} |`; }).join("\n") || "| (无) | | | |"}

## 8. §7 验收清单逐条

| # | 校验项 | 结果 |
|---|---|---|
| 1 | schema 完整(必填字段齐、类型对) | ${errors.some((e) => /id|title|author|body|dynasty_raw|dup_group/.test(e)) ? "❌" : "✅"} |
| 2 | dynasty ∈ 15 canonical key | ${errors.some((e) => /canonical/.test(e)) ? "❌" : "✅"} |
| 3 | 编码:无致命乱码(占位符仅报告) | ✅ (占位符 ${stat.placeholder.toLocaleString()},见 §6) |
| 4 | 去重报告(dup_group,不自动删) | ✅ (见 §5) |
| 5 | provenance 齐全(type/source;curated 有 note;订正有 corrected_from) | ${errors.some((e) => /provenance|curated|订正/.test(e)) ? "❌" : "✅"} |
| 6 | 许可:公开层=PD,隔离层有 license | ${stat.publicNonPD || stat.restrictedNoLicense ? "❌" : "✅"} |
| 7 | corrections 唯一命中底库 | ${errors.some((e) => /correction/.test(e)) ? "❌" : "✅"} |

${errors.length ? `### 致命错误(前 ${Math.min(errors.length, 60)} 条)\n\n${errors.map((e) => `- ${e}`).join("\n")}` : ""}
${warnings.length ? `\n### 警告\n\n${warnings.map((w) => `- ${w}`).join("\n")}` : ""}

## 9. 输出文件清单

| 文件 | 大小 |
|---|---:|
${(br?.files || []).map((f) => `| \`data/${f.file}\` | ${fmtBytes(f.bytes)} |`).join("\n") || "- (build report 缺失)"}

## 10. 存疑 / 交 owner 决定(铁律:不在数据里改姓名/朝代/合并,只在此报告)

- **隔离层 \`⚠in-copyright(verify)\`(${(stat.perLicense["⚠in-copyright(verify)"] || 0).toLocaleString()} 条)**:来自 Werneror 近现代/当代桶,无法逐条确证 life+50。
  其中**多数民国早期作者实为 PD**(如王国维 d.1927、章太炎 d.1936、梁启超 d.1929、苏曼殊 d.1918)。
  建议:做一份"已确证死亡年"的诗人白名单,把确证 PD 者从隔离层提升到公开层。
- **毛泽东《到韶山》跨源重出**:Werneror 骨干本已订正(jinxiandai,type=curated,正文在隔离层);yuxqiu modern times 另有一份(dangdai,保真不动)。
  两份 \`dynasty\` 不一致(同一作者跨源分桶差异)——**按铁律不归并**,交 owner 决定是否统一朝代/去重。
- **曲(散曲)仅 ${(stat.perGenre["qu"] || 0)} 条**:Werneror **不系统标注宫调**,故 genre=qu 命中极少(与诗云体检"曲≈0"一致)。
  若需补全散曲,建议新增父库《全元散曲》并入构建(本库已用 curated 补录兰楚芳一首示范)。
- **兰楚芳**:本库归 \`yuan\`(《全元散曲》收为元);亦有作"元末明初(ming)"之说,存疑交 owner。

---
*铁律:完整不删字 · 保留原始标点 · 简体唯一 · provenance-first · 不破坏式 · 不杜撰 · 只收诗词曲(不收古文)。*
`;

writeFileSync(join(ROOT, "REPORT.md"), md);
console.log(`\nREPORT.md 已生成。`);
console.log(`总记录=${stat.total}  public=${stat.perLayer.public}  restricted=${stat.perLayer.restricted}`);
console.log(`去重组(≥2)=${dupGroups}  占位符记录=${stat.placeholder}  id抽检=${sampleChecked}/坏${sampleBadId}`);
if (pass) { console.log("✅ VALIDATE PASS"); }
else { console.error(`❌ VALIDATE FAIL — ${errors.length} 项致命错误:`); for (const e of errors.slice(0, 15)) console.error("  - " + e); process.exit(1); }
