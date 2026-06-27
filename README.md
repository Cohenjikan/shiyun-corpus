<div align="center">

# 诗云语料库 · shiyun-corpus

**一个独立、完整、带 provenance(来源)标注的简体中文古典诗词语料库**

诗 · 词 · 曲 ｜ 不收古文 ｜ 完整不删字 ｜ 保留原文标点 ｜ 每条可溯源 · 可审计 · 可回滚

[English](./README.en.md) · [来源与许可 SOURCES](./SOURCES.md) · [构建报告 REPORT](./REPORT.md)

</div>

---

## 这是什么

把多个**上游父库**(Werneror / yuxqiu / sheepzh)**统一、清洗、标注**成一个干净、完整的库。
它坐在「上游父库」与「下游消费者」之间——**诗云(shiyun)只是下游之一**,下游摄取快照时自己过滤
(字库门、poetId 聚合、去标点),**本库不受任何下游约束**。

| | 下游(如诗云) | **本库** |
|---|---|---|
| 目的 | 3D 星图可视化 | **干净、完整、可复用的标注语料** |
| 字库 | 冻结字库,库外整首跳过 | **不删字**——含生僻字、词、曲 |
| 标点 | 去标点(只存断句) | **保留原始标点** |
| 标注 | 无 | **每条带 provenance** |
| 关系 | 消费本库的一个快照 | 上游父库 → **本库** → 诗云/其他 |

> **标注是库内元数据,不进任何前端。** 解耦红利:本库追求"完整 + 正确",下游各取所需。

## 设计铁律

1. **完整不删字** — 收录不受任何下游字库限制(含生僻字 / 词 / 曲);不静默丢弃任何上游诗。
2. **保留原文** — `body` 保留原始**标点**;保留原始朝代串 `dynasty_raw`。
3. **简体唯一** — 当前上游本就是简体;将来接入繁体父库才用 OpenCC `t2s`,转换在构建期完成。
4. **provenance-first** — 每条都标来源(upstream 哪个文件 / curated 我方新增·订正),**可审计可回滚**。
5. **不破坏式** — 互见 / 重出**不删**,标 `dup_group`,把去重判断交给消费者。
6. **不杜撰** — curated 的每首诗 / 每处订正都来自**权威出处**,逐条写 `source`。
7. **只收诗词曲** — **不收录古文**(散文 / 赋 / 序记等);外语诗歌不收录。

## 记录 schema(`data/poems.<朝代>.jsonl`,一行一首,UTF-8)

```jsonc
{
  "id": "sha1(author|dynasty|title|body)[:16]", // 内容寻址,稳定、跨重建不变
  "title": "念奴娇·赤壁怀古",
  "author": "苏轼",
  "dynasty": "song",            // 15 canonical key(见下)
  "dynasty_raw": "宋",          // 原始朝代串,可逆
  "body": "大江东去，浪淘尽、千古风流人物。…", // 含标点的完整正文
  "genre": "ci",                // shi 诗 / ci 词 / qu 曲 / xinshi 现代新诗
  "dup_group": "9f3a1c0b7e22",  // sha1(author|去空白 body)[:12];同组=同作者重出/互见
  "provenance": {
    "type": "upstream",         // upstream(父库)| curated(我方新增·订正)
    "source": "Werneror/宋_1.csv",
    "license": "PD",            // PD | Apache-2.0 | non-commercial | ⚠in-copyright(YYYY)
    "note": "",                 // curated 必填:为何新增/订正
    "corrected_from": null      // 仅订正:原(错)正文,留底可审计
  }
}
```

**朝代 15 canonical key**:`xianqin qinhan weijin nanbeichao sui tang wudai song liao jin yuan ming qing jinxiandai dangdai`
(沿用诗云 `DYN` 映射,便于下游 join)。

## 目录结构

```
shiyun-corpus/
├─ README.md / README.en.md / SOURCES.md / REPORT.md / LICENSE
├─ package.json                  # type:module,零依赖
├─ scripts/
│  ├─ build.mjs                  # 上游 → 规范化 → provenance → genre → curated → 分片输出
│  └─ validate.mjs              # schema/朝代/编码/去重/provenance/许可 校验 + 生成 REPORT.md
├─ curated/
│  ├─ additions.jsonl            # 我方补录(带权威出处)
│  └─ corrections.jsonl          # 我方订正(带 corrected_from)
└─ data/
   ├─ poems.<朝代>.jsonl         # 【公开层】古典 PD 诗词,按朝代分片(>45MB 再切 .2/.3…)
   ├─ poets.jsonl                # 公开层诗人聚合
   └─ _restricted/               # 【隔离层】现代/在册作者,默认 .gitignore(owner 决定是否公开)
      ├─ poems.<朝代>.jsonl
      ├─ poets.jsonl
      └─ README.md
```

## 公开 / 隔离两层(版权姿态)

- **公开层 `data/`** = 古典文本,**公有领域 (PD)**,可自由发布。
- **隔离层 `data/_restricted/`** = 现代 / 在册作者(yuxqiu Apache-2.0 / sheepzh 非商用 / Werneror 近现代·当代桶 /
  叶嘉莹等),著作权状态复杂 → **逐条标 `license`,默认隔离**(`.gitignore` 排除),**是否纳入公开仓由 owner 决定**。
- 最稳姿态:**古典全开 + 现代标注/可剥离 + 非商用声明**。详见 [`data/_restricted/README.md`](./data/_restricted/README.md)。

## 用法

```bash
# 需要本机已 clone 上游父库到 C:/corpus/(或用环境变量覆盖路径,见 SOURCES.md)
npm run build      # 读上游 → 输出 data/*.jsonl + data/_build_report.json
npm run validate   # 全量校验 + 生成 REPORT.md(失败 exit 1)
npm run all        # build + validate
```

- **可重复运行** = 与父库同步;curated 校勘层自动复用,**永不随上游重拉丢失**。
- 零 npm 依赖,Node ≥ 18。大库构建建议 `--max-old-space-size=4096`(脚本已内置)。

## 校勘层(`curated/`)

| 类型 | 条目 | 处理 |
|---|---|---|
| corrections | 毛泽东《到韶山》单字订正 | 在册→隔离层;条目正文(含 `corrected_from`)不入公开仓,见隔离层 |
| additions | 袁枚《所见》 | 上游缺收,PD,源《小仓山房诗集》→ 公开层 |
| additions | 兰楚芳《南吕·四块玉·风情》 | 元散曲,genre=qu,PD,源《全元散曲》→ 公开层 |
| additions | 叶嘉莹《浣溪沙》 | 🔴 著作权至 2074,默认隔离待 owner 定 |

> **绝不做**:改诗人姓名、改朝代归并、合并"同一人不同条目"——这类只写进 REPORT 交 owner,不动数据。

## 数据来源

见 [SOURCES.md](./SOURCES.md)。简言之:Werneror(古典 PD)+ yuxqiu(Apache-2.0)+ sheepzh(非商用),
**诚实声明混合许可**。本库不创作诗歌,只做统一 / 清洗 / 标注 / 补录订正。

## 许可

代码 / 校勘标注 / 文档:**MIT**(见 [LICENSE](./LICENSE))。诗歌文本:**按来源各自许可**(见 SOURCES.md)。
