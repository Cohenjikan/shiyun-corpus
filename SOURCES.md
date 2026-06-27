# SOURCES — 上游父库清单 / 许可 / 同步

本库**不创作诗歌**,只把多个上游父库**统一、清洗、标注**成一个干净、完整、带 provenance 的库。
每条记录都带 `provenance.source`(具体来自哪个上游文件)与 `provenance.license`。

## 上游父库

| 上游 | 内容 | 工具许可 | 文本许可 | 本库分层 |
|---|---|---|---|---|
| **Werneror/Poetry** | 古典诗词,先秦→当代,~85 万首,CSV `题目,朝代,作者,内容` | MIT | 古典文本公有领域 (PD) | 古典朝代 → `data/`(公开)；近现代/当代桶 → `data/_restricted/`(隔离) |
| **yuxqiu/modern-poetry**(China-modern-poetry) | 中文现代诗 + 旧体(contemporary/modern/modern times) | Apache-2.0 | 多为在册作者,**文本著作权归原作者** | `data/_restricted/`(隔离) |
| **sheepzh/poetry** | 汉语现代诗歌语料库,~3.5k 诗人 | 工具 MIT | **作者著作权,非商用** | `data/_restricted/`(隔离) |

> 仅收录上述三库中的**中文诗词曲 / 现代诗**。modern-poetry 仓中的**外语诗歌**(France/Germany/Russia/UK/USA/others)
> 与图片(clouds)**不收录**(非中文 + 译文著作权)。本库**不收录古文(散文/赋/序记等)**——只收诗、词、曲、现代诗。

## 本机路径(构建时读取,可用环境变量覆盖)

```
WERNEROR_DIR = C:/corpus/Werneror-Poetry                       (默认)
MODERN_DIR   = C:/corpus/modern-poetry/China-modern-poetry      (默认)
SHEEPZH_DIR  = C:/corpus/sheepzh-poetry/data                    (默认)
```

各上游来源地址:
- Werneror/Poetry — https://github.com/Werneror/Poetry (MIT)
- yuxqiu/modern-poetry — https://github.com/yuxqiu/modern-poetry (Apache-2.0)
- sheepzh/poetry — https://github.com/sheepzh/poetry (非商用)

## 许可姿态(公开仓)

- **古典文本**(唐宋元明清…):公有领域,自由收录发布 → `data/`(公开层,全 PD)。
- **现代 / 在册作者**(life+50 未到、Apache、非商用):逐条标 `license`,**默认隔离**于 `data/_restricted/`
  (`.gitignore` 默认排除),**是否纳入公开仓由 owner 决定**。README/SOURCES **诚实声明混合许可**。
- 最稳姿态:**古典全开 + 现代标注/可剥离 + 非商用声明**。

## 同步上游(可重复运行)

```bash
git -C C:/corpus/Werneror-Poetry pull   # 各上游 pull
node scripts/build.mjs                   # 重新构建(curated 校勘层自动复用,永不随上游重拉丢失)
node scripts/validate.mjs                # 全量校验 + 计数 diff
```
若上游变更命中某条 correction(首句匹配但 `find` 已不在正文),validate 会**警告**,人工重核。
