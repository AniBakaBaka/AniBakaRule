# AniBakaRule 核查记录（2026-09-30，香港时间）

核查了全部 **33 个规则文件**（订阅索引登记 32 条），修改 **22 条**；已登记的改动规则 revision 各加 1。保留核查开始时两个仓库已有的未提交改动。silisili 原本未登记且媒体上游仍失败，没有自动重新上架。

**18 条至少有一个可读取的实际媒体/磁力样本。** AGE 另有正常浏览器加载视频证据。这个结果不代表每条线路或每个历史剧集都可播放；番薯只有部分线路通过，E站分片有 PNG 前缀，磁力源未实测 BT 播放。

## 方法与范围

- 使用 AniBaka 当前 CustomSourceConfig、Recipes、PipelineInterpreter、HTML/XPath 解析及 RuleValidator，兼容平级和嵌套 pipeline 格式。
- 对每条规则执行搜索→详情→抽样线路的首集→真实媒体响应。常用关键词为海贼；Anime1 用異世界、Hanimeone 用 OVA、Animoe 用海、AniWatch 用 Re。最多抽样头三条线路；E站追加了葬送样本。不是遍历所有历史剧集。
- 对访问失败比较默认连接与 curl --noproxy '*'。不改系统代理，不把沙箱拒连当站点故障，不解人工验证码。
- HTTP 视频要求 MP4 Range 的文件标识，或 HLS 清单及实际片段可读；磁力源检查真实 magnet/种子内容。已识别的占位 MP4 不记成功。清单 200 但分片 404 也不记通过。
- 审计宿主没有模拟 WebView 成功，所有浏览器需求独立标注。AGE 的浏览器证据与 Animoe 的真实应用适配器证据分别保存。其余 HTTP 审计不代表原生播放器完整解码验证。
- 33 条最终规则格式/正则校验通过；规则解释器、规则解码、HLS 和源生命周期 **54 项回归通过**；本次 5 个变更文件静态检查无诊断。

## 逐规则结果

| 规则 | 修改 | 结果 | 证据与限制 |
| --- | --- | --- | --- |
| 11kt | 已修改 | 仍有限制 | HTTP 默认连接/直连为 Cloudflare 403；浏览器自动验证后搜索、详情及播放页面可读。增加 HTML 后备，抽样 ffzy 媒体仍 403。 |
| 2kdm | 已修改 | 有可读样本 | 实际清单及分片通过；增加直接媒体优先，避免直链重复进入解析器，修正解析入口。 |
| 4kcz | 保留 | 仍有限制 | HTTP 与正常浏览器均被雷池 WAF 拦截，无法验证媒体。保留原规则。 |
| 7sefun | 已修改 | 有可读样本 | 两条抽样线路 MP4 Range 206；修正直链正则，完整保留 query 签名；部分其他旧样本仍 404。 |
| age | 已修改 | 浏览器已加载视频 | 浏览器样本 /play/20260254/1/1：video readyState=4，1920×1080，224.04 秒。保留必要 WebView；HTTP 后备同一页面由每线 4 次减少到 1 次。未验证 AniBaka 原生 WebView 的整段播放。 |
| agekkkk | 保留 | 有可读样本 | 真实搜索验证协议、详情、清单及分片通过；必要会话验证保留。 |
| akianime | 已修改 | 仍有限制 | 更正搜索路径；搜索/详情/直链解析成功，但抽样两条海贼首集 CDN 都为 404。 |
| ani_pekolove | 保留 | 仍有限制 | 默认连接和直连均 TLS 握手失败；无法验证剧集和直链，未猜测修改协议。 |
| anime1 | 保留 | 有可读样本 | 真实 API 及带 Cookie 的 MP4 Range 206；无 Cookie 为 403，必须保留 Cookie 与验证。 |
| anime7 | 已修改 | 有可读样本 | 主清单、变体及分片通过；启用原有嗅探后备并明确 episodeId，媒体检查防止解析页误判。 |
| animoe | 已修改 | 有可读样本 | 补齐搜索后备；新增规则声明的 XOR 清单解码。真实应用适配器生成本地完整清单 200，初始化片段及 fMP4 媒体片段 206。需要同时更新本次 AniBaka 引擎代码。 |
| aniwatch | 已修改 | 仍有限制 | Re 搜索返回 12 条，详情 API 可读；改为一次服务器 q 搜索。播放页 Cloudflare 阻断。不同集返回同一 212.25 秒占位 MP4，未当剧集通过。 |
| cyfz | 已修改 | 仍有限制 | 搜索 API 200，抽样详情 403；增加正常浏览器 HTML 后备与媒体检查，尚未验证真实媒体。 |
| dalvdm | 已修改 | 仍有限制 | 默认连接/直连均 Cloudflare 403；移除首页预取，直接媒体优先；尚未验证媒体。 |
| didahd | 已修改 | 仍有限制 | 搜索/详情可取，但播放器是动态 encrypt=3 协议；直接媒体优先、保留浏览器后备，未验证此动态线路。 |
| dm84 | 保留 | 有可读样本 | HH 播放 API、两线清单及实际分片通过；保留必要解析、签名和请求头。 |
| dmhy | 保留 | 有可读样本 | 搜索与系列分组成功，真实 magnet 输出通过；磁力源不以 HTTP 视频直链标准判定。未实测 BT 下载/播放。 |
| dmwo | 已修改 | 仍有限制 | 搜索依赖浏览器且有 Cloudflare 防护；用页面就绪条件替代固定等待，并防止裸 token 被当媒体。未验证媒体。 |
| ezdmw | 已修改 | 有可读样本 | 葬送样本真实 HLS 清单 200、TS 内容 200；iframe 内已有直接 src 时省一次播放器请求。旧样本为 401。媒体分片含 PNG 前缀，原生解码尚未验证。 |
| fsdm02 | 已修改 | 有可读样本 | muiplayer 抽样 MP4 Range 206；BY1 403。过滤需要外部插件/验证码的 cyc、mtvod 裸 token，保留 API 直链线路。仅部分线路通过。 |
| girigirilove | 已修改 | 有可读样本 | 两条抽样 HLS 线路及分片通过；为首分支补媒体检查，解析页可继续走后备。 |
| gugu | 已修改 | 仍有限制 | 公开解析 API 返回同一个 5 秒 milimili.mp4；明确 form 提交并拒绝该占位 URL，保留 episode 浏览器后备。未获取本集有效媒体。 |
| hanimeone | 已修改 | 有可读样本 | HTML source 取得 MP4 Range 206；修复原来无法执行的 sniff 后备，显式使用 episodeId。 |
| ios_mifun | 已修改 | 有可读样本 | 公开 iframe/sign API 与 MP4 Range 206；媒体移除不兼容 Referer，补媒体检查、明确嗅探 episodeId；必要签名请求保留。 |
| lm6 | 保留 | 仍有限制 | 默认连接/直连均 Cloudflare 403，需要正常浏览器；未验证媒体。 |
| mgnacg | 保留 | 有可读样本 | 原有解密协议、真实联通 CDN MP4 Range 206；原规则无需修改。审计请求必须自动解压 gzip。 |
| mikan | 已修改 | 有可读样本 | 实际搜索/系列/种子 bencode 通过；改为已验证的 mikanani.me，省域名重定向。未实测 BT 下载/播放。 |
| moonci | 已修改 | 有可读样本 | playerAaaa 直接取得 MP4 Range 206；改 canonical www 域名、HTTP 优先，保留显式 episodeId 浏览器后备。 |
| mubai | 保留 | 仍有限制 | 搜索/API 可解析，但多个实际媒体为 404；大系列详情也发生传输截断。未猜测替换 CDN。 |
| silisili | 已修改 | 仍有限制 | 修复本站 POST、MD5/AES 解密直链；抽样首集与最新集分片仍 404，另一路 403。该文件原本不在订阅索引，未自动重新上架。 |
| tvtfun | 保留 | 仍有限制 | 默认连接/直连均 521 上游故障；必要会话步骤和现有 600ms 等待无实证可安全删除，保留。 |
| xifanacg | 保留 | 有可读样本 | 真实授权播放 API、主清单/变体/TS 分片通过；必要 API 调用保留。 |
| xigua | 已修改 | 有可读样本 | 去掉简体 keywordMatch/别名裁剪造成的繁体搜索误过滤；真实 API、主清单/变体/TS 分片通过。 |

## 减少耗时的改动

| 源/路径 | 原流程 | 本次流程 | 可确认的减少 |
| --- | --- | --- | --- |
| AGE HTTP 后备 | 每条抽样线路重复请求同一播放页 4 次 | 请求一次后在已有 HTML 上分支解析 | 每线少 3 次请求；全库抽样该源 14→5 次 HTTP |
| AniWatch 搜索 | 抓取两个 100 条目录页后筛选/后备 | 一次服务器 q 搜索 | 目录分页请求改为按关键词请求 |
| Moonci 播放 | fetch 播放页后启动浏览器 | playerAaaa 本地解析，失败才浏览器 | 正常直链路径不启动 WebView |
| 2kdm / Dalvdm / DidaHD | 优先进入解析器或浏览器 | 已见媒体直接通过，失败再后备 | 已经是直链时省解析器/浏览器步骤 |
| E站 iframe src | 总是再请求 iframe 播放器 | src 已是媒体 URL 时直接取出 | 该条件下少一次请求；token src 保留必要请求 |
| 打驴搜索 | 先请求首页 | 直接搜索入口 | 少一次首页预取 |
| 动漫窝 / 11kt HTML | 固定等待或缺少可用后备 | 使用已观察到的页面就绪条件 | 去掉不必要的 settle 等待，保留超时上限 |
| 蜜柑 / Moonci | 先访问会重定向的域名 | canonical 域名 | 避免已确认的域名重定向 |

以上是请求结构的减少，不是设备启动速度或 FPS 的保证。Cookie、授权 API、签名和未能证实多余的会话等待都保留，特别是 Anime1、TVTFun。

## Animoe 应用端依赖

规则新增 hlsManifestDecode 声明，应用端补了只按声明解码的 XOR HLS helper，并以 bytes 取清单、物化解码后的 VOD；加密 master 会落到可用变体。未配置该字段的源继续走原路径。声明挂在已有 playerAaaa 步骤上，保持原有 URL 缓存和媒体头处理。

需要同时使用本次 D:/AniBaka 的应用代码；旧安装版仅更新订阅规则不能完成该协议。真实 PipelineSourceAdapter 复验得到本地完整清单 200、init 206 ftyp、媒体片段 206 styp。代码和规则均未提交或推送。

## 可重复核查

在 D:/AniBaka 运行（需要本机已有 Flutter 依赖）：

```powershell
$env:RULE_AUDIT_ARGS='--rules=D:/AniBakaRule --out=D:/AniBaka/.dart_tool/rule_audit/recheck --workers=3 --lines=3'
flutter test --no-pub D:/AniBakaRule/scripts/audit-rules-test.dart --reporter expanded
```

只校验可加 --validate-only=true；可用 --ids=moonci,anime7、--keyword=关键词、--series=实际详情ID、--episode=实际播放页缩小检查范围。默认禁用 curl 代理，--proxy=true 使用 curl 默认代理配置。浏览器分支会记录为 browser_required，不伪造成功。测试程序自身的 All tests passed 只表示审计运行完成，须看 summary.json 各源的 status 和 plays/media。

本机完整原始请求/响应证据与修复前快照在 D:/AniBaka/.dart_tool/rule_audit/；其结果只代表这次核查时刻。可长期保留的简明结果见本报告与同名 JSON。
