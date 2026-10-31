# Myriad Tapp

Myriad 的应用（Tapp）层：应用的契约、校验规则、给作者的 CLI 和文档，以及每个宿主都用的那份 TypeScript 运行时。

- **契约**：`shared/tapp_sandbox_contract.json` 是唯一的权威（权限、能力档、沙箱限制、清单字段）。`crates/tapp-contract` 读它并校验清单、地址和响应头；`tools/tapp-contract-export` 把契约导出成 CLI 用的 JSON、清单 schema 和 SDK 类型。
- **规则**：`crates/myriad-tapp-rules`，不碰网络和数据库的纯计算（签名、转换、打包计划、动态合并）。
- **CLI**：`tools/tapp-cli`，发布为 npm 包 `@myriad-you/tapp-cli`，在上传前离线检查一个应用项目。用法见它自己的 [README](tools/tapp-cli/README.md)。
- **运行时**：`runtime/`，pnpm 包 `@myriad/tapp-runtime`。宿主建一个 `TappKernel`，把自己的能力（发授权、取资源、带凭据的请求、配额、联邦限制、把错误码换成给用户看的话）经 `TappKernelHost` 借给它；内核给出沙箱文档的安全外壳、应用说话用的桥和运行时授权。运行时没有模块级状态，报错只带错误码。
- **作者文档**：`docs/`，从 [QUICKSTART](docs/QUICKSTART.md) 开始；`docs/fixtures/` 是文档和测试共用的样例。

谁在用：[Myriad](https://github.com/Myriad-You/Myriad) 以子模块 `tapp/` 钉住本仓库。站点后端把两个 crate 当路径依赖，并在编译时用 `include_str!` 收进作者文档和样例；前端把 `runtime/` 当 pnpm workspace 包引用。别的端按钉住的提交照本仓库接入。

## 入口

运行时外面只能经 `runtime/package.json` 的 `exports` 取，按用途分：

- `@myriad/tapp-runtime`：内核与宿主接口、桥、授权、沙箱文档的各部分、契约类型（清单、权限、限制）。
- `@myriad/tapp-runtime/testing`：桩宿主上的内核（`createTestTappKernel`）。只给测试用，随测试改。

入口列出的就是对外的全部，`src/` 里别的写法都是内部的。

## 开发

```sh
git clone https://github.com/Myriad-You/myriad-tapp.git
cd myriad-tapp

# 契约、规则、导出器
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --all-targets --locked

# CLI：改了契约后重新生成，再跑测试
cd tools/tapp-cli
npm ci
npm run sync-contract
npm test

# 运行时
cd ../../runtime
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

在 Myriad 里，`frontend/` 的 `pnpm install` 会一起装好运行时的依赖，`pnpm test:unit`、`pnpm typecheck` 和 `pnpm lint` 也会跑运行时的；不要在 `tapp/runtime/` 里直接跑 `pnpm`，那会把它当独立项目另装一份。应用在真浏览器里的生命周期、弹窗和窗口测试是站点的，在 Myriad 里跑。

本仓库 2026-10-31 带着历史从 Myriad 拆出来，之前的提交记录照原样保留（提交说明里的 `#数字` 指 Myriad 的 PR，旧路径是拆分前在 Myriad 里的位置）。

## 许可

按目录分，见 [LICENSE](LICENSE)：`crates/tapp-contract`、`shared/tapp_sandbox_contract.json`、`tools/tapp-cli`、`tools/tapp-contract-export` 是 Apache-2.0（契约 JSON 在拆出时从 AGPL 改过来：契约 crate 把它编进去，CLI 发的生成文件也出自它），其余是 AGPL-3.0-only（附 Myriad 同一份第 7 条附加许可）。
