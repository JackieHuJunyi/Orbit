# Windows 开发断点

## 当前范围

Windows 上的浏览器开发启动、Electron 桌面验证和旧版 Office 导入导出已完成；macOS 打包仍不在本次 Windows 工作范围内。

## 版本记录

1. 原始代码：45736cd，标签 baseline-macos-v1.64.0。
2. Windows 启动适配：标签 windows-web-dev-v1；dev/build/start 通过 scripts/run-vinext.mjs 设置 WRANGLER_LOG_PATH，消除 Unix 专用环境变量赋值。不新增依赖；忽略项目内 npm 缓存。
3. 本文件记录验证和续作信息。用 git log --oneline --decorate 查看各步提交号。
4. Windows 旧版 Office 对等：保留 macOS AppleScript 链，仅在 win32 下分流到 Windows Script Host + Office COM；具体提交号见 git log。

## 验证结果（2026-09-14）

- Windows，Node v24.19.0，npm 11.17.0。
- npm.cmd ci --cache .npm-cache --no-audit --no-fund：成功安装 677 个包，锁文件未改动。
- npm 提示四个依赖安装脚本尚未获 allowScripts 授权；未修改全局设置，当前开发启动成功。
- node --check scripts/run-vinext.mjs 和启动器 --help：通过。
- npm.cmd run dev：启动成功，http://localhost:3000/。
- Playwright + 本机 Edge：主页 HTTP 200，标题 Orbit — Work that traces back to source；中文工作区、源编辑器和收入图表渲染；未捕获 pageerror。
- 此次只验证开发启动和首页渲染，未运行完整测试、生产构建或全部功能验收。

## 启动

在 PowerShell 中：

```powershell
cd C:\ChatGPT\Orbit-main
npm.cmd run dev
```

打开 http://localhost:3000/，Ctrl+C 停止服务。若端口占用，以终端实际地址为准。
首次下载项目需要先运行 npm.cmd ci。此机 PowerShell 阻止 npm.ps1，使用 npm.cmd 即可，无需改变执行策略；cmd.exe 中也可用 npm run dev。

## 续作断点

当前 Windows 浏览器开发启动、Electron 第 2 步桌面验证和第 3 步旧版 Office 导入导出均已验证。后续从 OCR、DuckDB 查询、模型连接及其余 Windows 功能对等继续；macOS AppleScript 与打包链保持不变。
本次自动化环境在 git init 后反复报告 sandbox helper setup refresh 错误，读取/写入/运行均通过明确审批后执行。仓库由沙箱账号创建，普通账号 Git 若报告 dubious ownership，可在命令中添加 -c safe.directory=C:/ChatGPT/Orbit-main；本次未修改全局 Git 配置。

## 查看和回滚

- git log --oneline --decorate：查看每步提交。
- git show <提交号>：查看该步改动。
- git diff baseline-macos-v1.64.0 HEAD：查看相对原始代码的所有改动。
- git revert <提交号>：生成回滚提交，保留历史。
- git switch -c inspect-baseline baseline-macos-v1.64.0：在新分支查看原版（先提交当前修改）。

## 第 2 步完成记录（2026-09-14，已完成）

- 已执行 npm.cmd run desktop:dev；五阶段生产构建完成。
- Electron 运行时通过 Electron 下载镜像完成安装；未安装全局依赖，未修改全局代理或系统配置。
- 进程状态：Electron 主进程与渲染进程均已正常启动并保持运行；窗口验证结束后可正常退出。
- `http://127.0.0.1:43719/` 返回 HTTP 200；43719 为桌面 QA loopback 端口。
- 页面标题：`Orbit — Work that traces back to source`。
- 预加载桥接测试：16/16 通过。
- 桌面窗口、预加载桥和关闭窗口后的退出行为均已验证；第 2 步完成，后续从第 3 步继续。

## 第 3 步完成记录（2026-09-16，已完成）

- Windows 下 `.doc/.ppt` 导入和 `.docx/.pptx` 旧格式导出已接入现有 Electron IPC；文件名、12 MB 上限、60 秒超时、警告和临时目录清理保持原有边界。
- Office COM 通过 `cscript.exe` 执行私有临时目录中的 VBScript；参数由 `execFile` 独立传递，不拼接命令行。Word 隐藏运行；PowerPoint 使用 `WithWindow=False` 无窗口打开；两者都在打开文件前设置 `AutomationSecurity = 3` 强制禁用宏。
- 本机 PowerShell/.NET COM binder 在 Office 类型库加载时稳定触发 `0x80029C4A (TYPE_E_CANTLOADLIBRARY)`；Windows Script Host 的原生 IDispatch 路径已通过真实保存验证，无需修复 Office、注册类型库或修改系统配置。
- `npm.cmd run qa:legacy-office` 真实往返通过：DOC 旧格式输出 36,352 字节并重新导入 1,374 字符；PPT 旧格式输出 69,120 字节并重新导入 5,500 字符（现代包会因 Office 元数据产生少量字节差异）。
- `node --test tests/windows-office.test.mjs`：6/6 通过；`npm.cmd run test:unit`：751/751 通过；`npm.cmd run lint` 和 `npm.cmd run typecheck` 均以退出码 0 完成。
- 第 4 步建议从 OCR 和 DuckDB 本地运行时的 Windows 实际功能验证继续，再验证模型连接；不要改动已验证的 macOS Office 与打包路径。

## 第 4 步 OCR 与 DuckDB Windows 验证记录（2026-09-16，当前子步骤完成）

- 真实 Microsoft Edge OCR：`$env:ORBIT_E2E_BROWSER='msedge'; npx.cmd --no-install playwright test e2e/workbench.spec.ts --project=chromium --grep "recognizes a scanned PDF"`，1/1 通过；扫描 PDF 被本机 OCR 识别并在导入审阅中显示转录和置信度。
- OCR 根因是 tesseract.js 7 的 `Lang[]` 初始化消息把内存语言包的 `data` 字节数组当作语言名。新增 `scripts/ocr-worker-wrapper.js`，仅在 `initialize` 消息中改用 descriptor `code`，保留 `loadLanguage` 的原始字节；OCR 模型继续以同源、静态可服务的 `.traineddata.wasm` 提供。
- 真实 Microsoft Edge DuckDB：`$env:ORBIT_E2E_BROWSER='msedge'; npx.cmd --no-install playwright test e2e/visual-live-sync.spec.ts --project=chromium --grep "mirrors an exact Data-cell draft"`，1/1 通过；Data 单元格保存完成并通过 DuckDB-Wasm 影响图重新验证。
- OCR E2E 诊断已收敛为只记录同源 `/ocr/` 请求/响应、失败请求、失败响应和截断后的浏览器错误，保留失败证据而避免输出语言包字节数组。
- 最终校验：`npm.cmd run test:unit` 753/753 通过；`npm.cmd run lint`、`npm.cmd run typecheck` 和 `npm.cmd run build` 均以退出码 0 完成；该阶段改动随后纳入本轮分逻辑提交。

## 第 5 步模型连接 Windows 验证记录（2026-09-16，代码修复完成；实时生成待外部服务）

- Windows npm 安装的 `codex.cmd` shim 在 `shell:false` 下不能直接作为 `spawn` 可执行文件；账户运行时现在只解析受限的 `.cmd/.bat` shim，优先调用包内原生 `codex.exe`，否则调用 `node.exe + codex.js`，不执行 shell 文本。
- Windows 账户临时工作区清理加入了有限的 `EBUSY`、`ENOTEMPTY`、`EPERM` 重试；清理失败不会覆盖已经发生的模型调用错误。
- 真实 Electron IPC 发现验证通过：Codex account 状态为 `ready`，默认模型为 `gpt-6-astra@low`，发现 27 个 model/effort 组合；`/api/model-profiles` 返回 HTTP 200，当前选择存在于目录。
- 真实登录账户的生成 readiness probe 已到达模型客户端；重复请求均因外部服务重连后超时而返回 HTTP 502：`The signed-in model client timed out.` 这项不计为通过；修复前的本地 `EBUSY` 清理错误已消失，超时错误也能原样传播，且未留下账户临时工作区。
- 最终校验：`npm.cmd run test:unit` 760/760 通过；`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd run build` 和格式检查均以退出码 0 完成。本轮改动按逻辑分为 5 个提交，提交后工作树干净；下一步在外部账户服务可用时重试真实生成，再继续 Claude、Gemini 和本地运行时的 Windows 对等验证。

## 第 6 步 Windows 代理支持验证记录（2026-09-16，已完成）

- 修复前提验证：仅在 Codex 子进程环境中注入 `HTTP_PROXY`、`HTTPS_PROXY` 后，真实 account runtime readiness 返回 HTTP 200，模型为 `gpt-6-astra@low`，耗时 19,529 ms，结果为 `{"ready":true}`，未出现重连错误。
- 代理来源实现：Windows 优先使用 `HTTPS_PROXY`、`HTTP_PROXY`、`ALL_PROXY`，否则通过 Electron `session.defaultSession.resolveProxy("https://chatgpt.com")` 获取系统代理；Electron 已处理系统 PAC/ProxyOverride，解析结果仅注入 Codex 子进程环境，无法解析时保持直连。macOS 不传入系统代理解析器，原有行为不变。
- 格式兼容：支持裸 `host:port`、`PROXY host:port`、`HTTPS host:port`、SOCKS 指令，以及 `http=...;https=...` 多协议映射；裸地址按 HTTP 代理处理，不硬编码任何代理地址。
- 真实 Electron 验证：`npm.cmd run desktop:dev` 启动后发起真实 `/__orbit_account__/codex/v1/responses` 请求，返回 HTTP 200，结果为 `{"ready":true}`，耗时 12,254 ms；本轮 502 已消失。
- 最终校验：`npm.cmd run test:unit` 764/764 通过（基线 760 + 4 个代理回归测试）；`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run format:check` 均以退出码 0 完成；开发进程已关闭，工作树待本次单独提交后保持干净。
