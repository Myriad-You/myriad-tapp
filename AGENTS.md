# AGENTS.md

本文件面向在本仓库工作的 AI 代理。人类读者请从 `README.md` 开始。

本仓库是 Myriad 的应用层：契约、规则、CLI、作者文档和 TypeScript 运行时。站点（[Myriad-You/Myriad](https://github.com/Myriad-You/Myriad)）以子模块 `tapp/` 钉住本仓库；改动只有经过一次钉住才会到达站点。

## 事实纪律

- 结论落到 `文件:行号`，或文件加符号名。没有位置的断言等于没有断言。
- 外部文档里的符号名不可信，引用前在本仓库或 Myriad 里核实。
- 无法验证的判断标注 `uncertain`。浏览器的沙箱和 CSP 行为不在本仓库控制内，说清楚。

## 硬约束

违反下列任一条的改动会被要求返工。

- **权限三层不可混用。** 声明权限是应用在清单里请求的，批准权限是安装时落库的，授予权限是运行时过滤后实际生效的。只有授予权限决定行为。任何「放宽权限」的改动先说清动哪一层。
- **密钥不进沙箱。** 宿主密钥与应用凭据只在宿主后端的出站路径解析，不出现在任何返回给应用的载荷里，错误信息也算载荷。运行时跑在浏览器里，拿不到也不该拿它们。
- **契约只有一份。** 权限、能力档、限制和清单字段只写在 `shared/tapp_sandbox_contract.json`。Rust 经 `crates/tapp-contract` 读，运行时直接 import 这份 JSON，CLI 用导出器生成的文件。改了契约跑 `tools/tapp-cli` 的 `npm run sync-contract`，把 `src/generated/` 一起提交；说明里写清影响哪几端。
- **不引用宿主。** `runtime/src/` 不 import 任何站点模块（i18n、config、services、组件、上下文、全局 store），也不读 `window.location` 这类宿主自己的东西。内核需要的一切经 `TappKernelHost` 在构造时传进来。
- **没有模块级状态。** 授权表、桥的路由、资源加载都在 `TappKernel` 实例上，不加 `let` 单例、不往 `window` 上挂东西。纯计算结果的缓存是例外（`runtime/src/sandbox/sdkWidget.ts` 的 SDK 模板缓存，键里不含会话令牌）。注入沙箱的脚本文本（`sandbox/sdkBody.ts`、`sandbox/security.ts`）在应用自己的窗口里跑，不受这条约束。
- **错误只带码。** 运行时抛 `TappKernelError`（码加参数），给用户看的话由宿主的 `describeError` 按码给；`TappBridge` 构造时必须给它，不设默认值，免得哪个宿主漏了脱敏。
- **对外只经入口，入口按用途分。** 见 README 的「入口」。改入口里的名字要在说明里写站点怎么跟着改。
- **路径相对仓库根。** 本仓库在 Myriad 里是 `tapp/`，单独检出时是根；代码和脚本里的路径都相对本仓库根写，CLI 找源码树经 `tools/tapp-cli/scripts/myriad-source.mjs` 的 `findTappRoot`。
- **作者文档也是代码。** Myriad 后端在编译时用 `include_str!` 收进 `docs/` 的文档和 `docs/fixtures/`，改名或删文件会让站点编译失败；样例先改 `docs/fixtures/`，文档和测试再跟着改。

## 输出去向

- 提交按 Conventional Commits，一个可评审单元一次提交。
- 每次改动说明站点换钉住的提交时要做什么（新的宿主字段、入口改名、后端要跟着改的契约字段）。
- 草稿、临时规格、代理笔记不进主干。
