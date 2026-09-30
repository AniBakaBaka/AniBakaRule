# AniBaka 规则库

AniBaka 动漫源规则仓库，订阅索引见 [`index.json`](index.json)。

## 规则列表（32）

| 规则 | 标签 | 配置 |
| --- | --- | --- |
| [七色番](https://www.7sefun.top/) | 少广告、高清 | [`7sefun.json`](7sefun.json) |
| [厂长资源](https://www.4kcz.com/) | 有广告、超清 | [`4kcz.json`](4kcz.json) |
| [次元番](https://www.cyfz.top/) | 无广告、高清 | [`cyfz.json`](cyfz.json) |
| [去看吧 (QuKanBa)](https://11kt.net/) | 无广告、高清 | [`11kt.json`](11kt.json) |
| [佩可爱动漫 (peko.love)](https://ani.pekolove.net/) | 有广告、高清 | [`ani_pekolove.json`](ani_pekolove.json) |
| [路漫漫动漫](https://m.lm6.net/) | 少广告、高清 | [`lm6.json`](lm6.json) |
| [打驴动漫 (dalvdm)](https://www.dalvdm.cc/) | 无广告、高清 | [`dalvdm.json`](dalvdm.json) |
| [AniWatch 动漫](https://www.aniwatch.top/) | 高清 | [`aniwatch.json`](aniwatch.json) |
| [AkiAnime](https://www.akianime.com/) | 无广告、超清 | [`akianime.json`](akianime.json) |
| [Animoe动漫](https://animoe.org/) | 无广告、高清 | [`animoe.json`](animoe.json) |
| [TvTFun](https://www.tvtfun.net/) | 少广告、高清 | [`tvtfun.json`](tvtfun.json) |
| [MiFun](https://ios.mifun.org/) | 无广告、高清 | [`ios_mifun.json`](ios_mifun.json) |
| [4K动漫](https://cn.agekkkk.com/) | 少广告、超清 | [`agekkkk.json`](agekkkk.json) |
| [嘀嗒影视 (Dida HD)](https://www.didahd.xyz/) | 少广告、超清 | [`didahd.json`](didahd.json) |
| [Anime7 动画线上看](https://anime7.top/) | 少广告、高清 | [`anime7.json`](anime7.json) |
| [Hanime1.me (Mirror)](https://hanimeone.me/) | 无广告、高清 | [`hanimeone.json`](hanimeone.json) |
| [GirigiriLove](https://ani.girigirilove.com/) | 无广告、高清 | [`girigirilove.json`](girigirilove.json) |
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
| [动漫窝](https://www.dmwo.one/) | 少广告、高清 | [`dmwo.json`](dmwo.json) |
| [GoFilm（幕白）](https://m.mubai.link/) | 无广告、高清 | [`mubai.json`](mubai.json) |
| [E站弹幕网](https://www.ezdmw.org/) | 少广告、高清 | [`ezdmw.json`](ezdmw.json) |

## index.json 的自动维护

规则文件改完推到 `main` 后，[`Sync rule index`](.github/workflows/sync-rule-index.yml) 工作流会自动更新 [`index.json`](index.json)，不需要手动改：

- 本次改动过的每个规则条目 `rev` 加一，App 端据此判断“有更新”；
- 用规则文件里的 `baseUrl`、`iconUrl`、`description` 覆盖条目的 `site`、`badge`、`intro`；
- 更新 `synced` 时间戳，然后把 `index.json` 作为一次 `chore: bump rule revisions [skip ci]` 提交推回 `main`。

工作流只处理已登记的规则。新增规则文件仍要先手动补一条 `entries`（`key`、`title`、`labels` 等无法从规则文件推断），否则工作流会警告并跳过该文件；`title` 与规则文件的 `name` 不一致时同样会警告。

同一个脚本可以在本机直接运行：

```bash
node scripts/sync-index.mjs --dry-run --all      # 预览全库改动，不写文件
node scripts/sync-index.mjs --all                # 按当前工作区全部规则对齐
node scripts/sync-index.mjs --files=7sefun.json  # 只处理指定规则
node scripts/sync-index.mjs --no-intro           # 保留 index.json 里手写的简介
```
