# shiyun-corpus — 构建 / 校验报告 (REPORT)

> 由 `scripts/validate.mjs` 生成。校验项依据 `CORPUS_DB_GUIDE.md §7`。

## 0. 总判定

**✅ PASS — 全部致命校验通过**

- 总记录数:**970,324**
- 公开层(PD 古典):**763,545**　|　隔离层(现代/在册):**206,779**
- 诗人:公开 28156 · 隔离 5302
- id 抽检:复算 973 条,不一致 0 条

## 1. 分层 / 来源

| 层 | 记录数 | 占比 |
|---|---:|---:|
| public (data/) | 763,545 | 78.69% |
| restricted (data/_restricted/) | 206,779 | 21.31% |

来源 (provenance.source 前缀):
- `sheepzh` — 80,596
- `Werneror/宋_1.csv` — 78,557
- `Werneror/宋_2.csv` — 78,557
- `Werneror/宋_3.csv` — 65,000
- `Werneror/宋_4.csv` — 65,000
- `Werneror/明_3.csv` — 59,479
- `Werneror/明_1.csv` — 59,478
- `Werneror/明_2.csv` — 59,000
- `Werneror/明_4.csv` — 59,000
- `Werneror/唐.csv` — 49,195
- `Werneror/清_1.csv` — 45,091
- `Werneror/清_2.csv` — 44,998
- `Werneror/元.csv` — 37,375
- `yuxqiu/modern times` — 28,419
- `Werneror/近现代.csv` — 28,418
- `Werneror/当代.csv` — 28,219
- `Werneror/明末清初.csv` — 17,700
- `Werneror/元末明初.csv` — 15,736
- `Werneror/清末民国初.csv` — 15,367
- `Werneror/清末近现代初.csv` — 12,464
- `Werneror/宋末元初.csv` — 12,058
- `Werneror/南北朝.csv` — 4,586
- `yuxqiu/contemporary` — 4,494
- `Werneror/近现代末当代初.csv` — 3,426
- `yuxqiu/modern` — 3,426
- `Werneror/魏晋.csv` — 3,020
- `Werneror/金末元初.csv` — 3,019
- `Werneror/金.csv` — 2,741
- `Werneror/民国末当代初.csv` — 1,948
- `Werneror/隋.csv` — 1,170
- `Werneror/唐末宋初.csv` — 1,118
- `Werneror/先秦.csv` — 570
- `Werneror/隋末唐初.csv` — 472
- `Werneror/汉.csv` — 363
- `Werneror/宋末金初.csv` — 234
- `Werneror/辽.csv` — 22
- `Werneror/秦.csv` — 2
- `《毛泽东诗词集》(人民文学出版社,中央文献研究室编)` — 1
- `Werneror/魏晋末南北朝初.csv` — 1
- `《小仓山房诗文集》(袁枚,乾隆刻本)` — 1
- `《全元散曲》(隋树森编,中华书局)` — 1
- `《张太岳集》(张居正)` — 1
- `《迦陵诗词稿》(叶嘉莹)` — 1

## 2. 按朝代

| 朝代 | key | 记录数 | 占比 |
|---|---|---:|---:|
| 先秦 | xianqin | 570 | 0.06% |
| 秦汉 | qinhan | 365 | 0.04% |
| 魏晋 | weijin | 3,021 | 0.31% |
| 南北朝 | nanbeichao | 4,586 | 0.47% |
| 隋 | sui | 1,170 | 0.12% |
| 唐 | tang | 50,785 | 5.23% |
| 宋 | song | 299,406 | 30.86% |
| 辽 | liao | 22 | 0.00% |
| 金 | jin | 5,760 | 0.59% |
| 元 | yuan | 37,376 | 3.85% |
| 明 | ming | 252,694 | 26.04% |
| 清 | qing | 107,790 | 11.11% |
| 近现代 | jinxiandai | 59,088 | 6.09% |
| 当代 | dangdai | 147,691 | 15.22% |

## 3. 按体裁 (genre)

| genre | 含义 | 记录数 | 占比 |
|---|---|---:|---:|
| shi | 诗 | 791,378 | 81.56% |
| ci | 词 | 93,667 | 9.65% |
| xinshi | 现代新诗/自由诗 | 84,905 | 8.75% |
| qu | 曲(散曲) | 374 | 0.04% |

## 4. 按许可 (license)

| license | 记录数 | 层 |
|---|---:|---|
| PD | 763,545 | public |
| ⚠in-copyright(verify) | 89,842 | restricted |
| non-commercial | 80,596 | restricted |
| Apache-2.0 | 36,339 | restricted |
| ⚠in-copyright(2027) | 1 | restricted |
| ⚠in-copyright(2074) | 1 | restricted |

provenance.type:upstream=970,319 · curated=5

## 5. 去重 (dup_group,同 author+正文 归一组,**不删**)

> 仅作报告,交消费者决定是否去重(诗云正因刻意不去重而有陆游虚高)。

- 去重组数(size≥2):**34,249**,涉及记录 **68,512**(7.06%)
- 组规模分布:
  - size 2: 34,242 组
  - size 1(unique): 901,812 组
  - size 3-5: 6 组
  - size 6-10: 1 组
  - size 11-50: 0 组
  - size 51+: 0 组

最大的 15 个重出组:

| dup_group | 重复数 | 样本(作者《题》) |
|---|---:|---|
| `0df08c1a712a` | 9 | 黄春伯《南台舟中联句》 |
| `08c7284cd41a` | 4 | 石元规《同游栖真联句》 |
| `0b1670afbb76` | 3 | 王枞《灯花联句》 |
| `e75d8eea601f` | 3 | 南人《夜：1》 |
| `25a2a22b1635` | 3 | 张香华《雨中，酒中》 |
| `ae403e24e39d` | 3 | 朱文《永冬》 |
| `f43a3e3f589c` | 3 | 林亨泰《风景：之二》 |
| `cc6ed6abd1fb` | 2 | 黄仲昭《送王主事世英还朝次翰林诸公饯别联句韵》 |
| `ce7dd7e601c9` | 2 | 黄仲昭《病中立秋偶成》 |
| `ec6c545c8cc9` | 2 | 张宁《董源画》 |
| `b9e2a98ed82f` | 2 | 张宁《戴文进小景二绝 其一》 |
| `78c10bb2c328` | 2 | 洪亮吉《伊犁纪事诗四十三首 其三十七》 |
| `d344d734a517` | 2 | 祁韵士《晚宿格子烟墩》 |
| `ea73961423c1` | 2 | 成书《东行巡屯诗四首 其二》 |
| `24e764f174cb` | 2 | 黄浚《天山快雪》 |

## 6. 编码 / 占位符

- 含占位符(`?`/`�`/`■`/`□`,多为 utf8mb4 生僻字被上游替换)的记录:**13,393**(1.38%)
- 处置:**保留不删**(铁律:完整不删字),仅报告;如需净化由消费者在快照侧处理。

## 7. curated 校勘层

- additions(补录):**4** 条
- corrections(订正):

| matchFirstLine | find → replace | applied | license |
|---|---|---:|---|
| （restricted·正文已隐去） | — | 1 | ⚠in-copyright(2027) |

## 8. §7 验收清单逐条

| # | 校验项 | 结果 |
|---|---|---|
| 1 | schema 完整(必填字段齐、类型对) | ✅ |
| 2 | dynasty ∈ 15 canonical key | ✅ |
| 3 | 编码:无致命乱码(占位符仅报告) | ✅ (占位符 13,393,见 §6) |
| 4 | 去重报告(dup_group,不自动删) | ✅ (见 §5) |
| 5 | provenance 齐全(type/source;curated 有 note;订正有 corrected_from) | ✅ |
| 6 | 许可:公开层=PD,隔离层有 license | ✅ |
| 7 | corrections 唯一命中底库 | ✅ |




## 9. 输出文件清单

| 文件 | 大小 |
|---|---:|
| `data/_restricted/poems.dangdai.2.jsonl` | 45.0 MB |
| `data/_restricted/poems.dangdai.3.jsonl` | 25.2 MB |
| `data/_restricted/poems.dangdai.jsonl` | 45.0 MB |
| `data/_restricted/poems.jinxiandai.jsonl` | 34.2 MB |
| `data/poems.jin.jsonl` | 2.8 MB |
| `data/poems.liao.jsonl` | 0.0 MB |
| `data/poems.ming.2.jsonl` | 45.0 MB |
| `data/poems.ming.3.jsonl` | 33.1 MB |
| `data/poems.ming.jsonl` | 45.0 MB |
| `data/poems.nanbeichao.jsonl` | 2.3 MB |
| `data/poems.qing.2.jsonl` | 11.4 MB |
| `data/poems.qing.jsonl` | 45.0 MB |
| `data/poems.qinhan.jsonl` | 0.2 MB |
| `data/poems.song.2.jsonl` | 45.0 MB |
| `data/poems.song.3.jsonl` | 45.0 MB |
| `data/poems.song.4.jsonl` | 7.2 MB |
| `data/poems.song.jsonl` | 45.0 MB |
| `data/poems.sui.jsonl` | 0.5 MB |
| `data/poems.tang.jsonl` | 23.1 MB |
| `data/poems.weijin.jsonl` | 1.5 MB |
| `data/poems.xianqin.jsonl` | 0.4 MB |
| `data/poems.yuan.jsonl` | 18.1 MB |

## 10. 存疑 / 交 owner 决定(铁律:不在数据里改姓名/朝代/合并,只在此报告)

- **隔离层 `⚠in-copyright(verify)`(89,842 条)**:来自 Werneror 近现代/当代桶,无法逐条确证 life+50。
  其中**多数民国早期作者实为 PD**(如王国维 d.1927、章太炎 d.1936、梁启超 d.1929、苏曼殊 d.1918)。
  建议:做一份"已确证死亡年"的诗人白名单,把确证 PD 者从隔离层提升到公开层。
- **毛泽东《到韶山》跨源重出**:Werneror 骨干本已订正(jinxiandai,type=curated,正文在隔离层);yuxqiu modern times 另有一份(dangdai,保真不动)。
  两份 `dynasty` 不一致(同一作者跨源分桶差异)——**按铁律不归并**,交 owner 决定是否统一朝代/去重。
- **曲(散曲)仅 374 条**:Werneror **不系统标注宫调**,故 genre=qu 命中极少(与诗云体检"曲≈0"一致)。
  若需补全散曲,建议新增父库《全元散曲》并入构建(本库已用 curated 补录兰楚芳一首示范)。
- **兰楚芳**:本库归 `yuan`(《全元散曲》收为元);亦有作"元末明初(ming)"之说,存疑交 owner。

---
*铁律:完整不删字 · 保留原始标点 · 简体唯一 · provenance-first · 不破坏式 · 不杜撰 · 只收诗词曲(不收古文)。*
