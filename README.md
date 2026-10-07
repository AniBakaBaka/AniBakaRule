# AniBaka 规则库

AniBaka 动漫源规则仓库，订阅索引见 [`index.json`](index.json)。

## 规则列表（32）

| 规则 | 标签 | 配置 |
| --- | --- | --- |
| [七色番](https://www.7sefun.top/) | 少广告、高清 | [`7sefun.json`](7sefun.json) |
| [次元番](https://www.cyfz.top/) | 无广告、高清 | [`cyfz.json`](cyfz.json) |
| [五弹幕 (5DM)](https://www.5dm.dev/) | 有广告、高清 | [`5dm.json`](5dm.json) |
| [佩可爱动漫 (peko.love)](https://ani.pekolove.net/) | 有广告、高清 | [`ani_pekolove.json`](ani_pekolove.json) |
| [路漫漫动漫](https://m.lm6.net/) | 少广告、高清 | [`lm6.json`](lm6.json) |
| [AniWatch 动漫](https://www.aniwatch.top/) | 高清 | [`aniwatch.json`](aniwatch.json) |
| [AkiAnime](https://www.akianime.com/) | 无广告、超清 | [`akianime.json`](akianime.json) |
| [Animoe动漫](https://animoe.org/) | 无广告、高清 | [`animoe.json`](animoe.json) |
| [TvTFun](https://www.tvtfun.net/) | 少广告、高清 | [`tvtfun.json`](tvtfun.json) |
| [MiFun](https://ios.mifun.org/) | 无广告、高清 | [`ios_mifun.json`](ios_mifun.json) |
| [4K动漫](https://cn.agekkkk.com/) | 少广告、超清 | [`agekkkk.json`](agekkkk.json) |
| [嘀嗒影视 (Dida HD)](https://www.didahd.xyz/) | 少广告、超清 | [`didahd.json`](didahd.json) |
| [Anime7 动画线上看](https://anime7.top/) | 有广告、高清 | [`anime7.json`](anime7.json) |
| [Hanime1.me (Mirror)](https://hanimeone.me/) | 无广告、高清 | [`hanimeone.json`](hanimeone.json) |
| [GirigiriLove](https://ani.girigirilove.com/) | 无广告、高清 | [`girigirilove.json`](girigirilove.json) |
| [GirigiriLove Beta](https://beta.girigirilove.com/) | 高清 | [`girigirilove_beta.json`](girigirilove_beta.json) |
| [Xifanacg](https://anime.xifanacg.com/) | 少广告、高清 | [`xifanacg.json`](xifanacg.json) |
| [AGE动漫](https://www.agedm.io/) | 少广告、高清 | [`age.json`](age.json) |
| [西瓜卡通](https://www.xgcartoon.com/) | 无广告、高清 | [`xigua.json`](xigua.json) |
| [MuteFun动漫 (2kdm)](https://www.2kdm.com/) | 无广告、高清 | [`2kdm.json`](2kdm.json) |
| [咕咕番](https://www.gugu3.com/) | 少广告、高清 | [`gugu.json`](gugu.json) |
| [Anime1](https://anime1.me/) | 无广告、高清 | [`anime1.json`](anime1.json) |
| [動漫花園](https://share.dmhy.org/) | 无广告、高清 | [`dmhy.json`](dmhy.json) |
| [蜜柑计划](https://mikanani.me/) | 无广告、高清 | [`mikan.json`](mikan.json) |
| [DM84](https://dmbus.cc/) | 少广告、高清 | [`dm84.json`](dm84.json) |
| [番薯动漫](https://www.fsdm02.com/) | 无广告、高清 | [`fsdm02.json`](fsdm02.json) |
| [Mgnacg 橘子动漫](https://www.mgnacg.com/) | 少广告、高清 | [`mgnacg.json`](mgnacg.json) |
| [Moonci](https://www.moonci.com/) | 无广告、高清 | [`moonci.json`](moonci.json) |
| [嘶哩嘶哩](https://www.silisilifun.com/) | 动漫 | [`silisili.json`](silisili.json) |
| [E站弹幕网](https://www.ezdmw.org/) | 少广告、高清 | [`ezdmw.json`](ezdmw.json) |
| [打驴动漫 (dalvdm)](https://www.sbdl.cc/) | 高清 | [`dalvdm.json`](dalvdm.json) |
| [青空次元 (Sorani)](https://www.sorani.net/) | 高清 | [`sorani.json`](sorani.json) |

## index.json 的自动维护

规则、索引、同步脚本或工作流改动推到 `main` 后，[`Sync rule index`](.github/workflows/sync-rule-index.yml) 会校验并同步 [`index.json`](index.json)。PR 只运行测试和预览，不写回仓库。

- 为已登记的规则记录 `contentHash`（规范化 JSON 的 SHA-256）；只有规则内容变化时才把 `rev` 加一，App 端仍通过 `rev` 判断“有更新”；
- JSON 缩进、换行和对象字段顺序不影响指纹；数组顺序、脚本和正则字符串仍参与比较；
- 用规则文件里的 `baseUrl`、`iconUrl`、`description` 覆盖条目的 `site`、`badge`、`intro`；
- 只有索引确实发生变化才更新 `synced`，提交 `chore: sync rule index [skip ci]`；重复执行不会再次升版或制造空提交。

**首次迁移：** 没有 `contentHash` 的条目只建立当前内容的指纹基线，保留已有 `rev`，不会让所有源同时提示更新。没有旧指纹时无法判断历史内容是否变化；若迁移前确有尚未升版的规则改动，须先为这些规则调整 `rev`。基线建立后，只有内容指纹变化的规则才自动升版，新增条目也保留填写的初始版本。本地运行同步后应把生成的索引与规则一起提交，Action 会识别已同步的内容。

同步每次扫描全库，只需要最新一次提交，不依赖推送事件的提交范围或完整 Git 历史；连续推送导致待运行任务被替换时也能补齐改动。写回遇到远端新提交会重新拉取、测试并计算索引，最多尝试三次，不强推。

工作流只同步已登记的规则。新增规则文件仍需手动补一条 `entries`（包括 `key`、`title`、`rev`、`ref`、`labels` 等），否则会警告并跳过同步；手写标题与规则 `name` 不一致时只提示，保留原值。删除或重命名规则时须一并更新索引的 `ref`。无效 JSON、重复 ID/key/ref、ID 不匹配、缺失引用或非法版本号都会使任务失败，整个索引保持原样。

本机使用 Node.js 24，无需安装 npm 依赖：

```bash
node --test scripts/sync-index.test.mjs          # 同步逻辑回归测试
node scripts/sync-index.mjs --check              # 只校验，不生成指纹或升版
node scripts/sync-index.mjs --dry-run            # 预览全库改动，不写文件
node scripts/sync-index.mjs                     # 同步全库（--all 仍兼容）
node scripts/sync-index.mjs --files=7sefun.json  # 只处理指定规则
node scripts/sync-index.mjs --no-intro           # 保留 index.json 里手写的简介
```

`--root=<dir>` 可指定规则目录；`SYNC_INDEX_NO_INTRO=1` 等价于 `--no-intro`。默认扫描当前工作区内容，不再使用 `GITHUB_BEFORE` / `GITHUB_AFTER`。手动触发 Action 时可勾选 `dry_run`；从非 `main` 分支运行也只预览。任务摘要会列出变动或失败原因。

这里的检查覆盖 JSON、索引映射与同步行为；实际搜索、详情、播放流水线仍由依赖 AniBaka 引擎的 Dart 审计脚本验证，不能据此认为站点已通过在线播放测试。
