# data/_restricted/ — 隔离层(现代 / 在册作者)

本目录存放**著作权状态需复核**的条目,**默认不纳入公开仓**(见仓库根 `.gitignore`)。

## 为什么隔离

| 来源 | 许可标注 | 原因 |
|---|---|---|
| Werneror 近现代 / 当代 桶 | `⚠in-copyright(verify)` | 混入在册作者(如毛泽东 d.1976→2027),无法逐条确证 life+50 已过,**保守隔离**。多数民国早期作者实为 PD,可经逐人核定死亡年后白名单放行。 |
| yuxqiu / China-modern-poetry | `Apache-2.0` | Apache-2.0 覆盖**数据集打包**,诗歌**文本著作权仍归原作者**。 |
| sheepzh/poetry | `non-commercial` | 社区现代诗,作者著作权,声明非商用。 |
| 叶嘉莹等 curated 补录 | `⚠in-copyright(2074)` | 在册作者,默认隔离待 owner 决定。 |

## 公开仓姿态

最稳:**古典全开(`data/` = PD) + 现代标注/可剥离 + 非商用声明**。

- **不公开现代层(默认)**:保持 `.gitignore` 原样即可,`data/` 公开层全是 PD。
- **要公开部分现代层**:删去 `.gitignore` 中 `data/_restricted/` 一行,在 README/SOURCES 中**诚实声明混合许可**,并优先只发布已确证 PD 的子集。

数据本身仍**完整保存在本地**——隔离只影响"是否 push 到公开仓",不影响本库完整性。
