# DeepSeek Harness：Rune 可采用的 UI 与架构方法

- 审阅日期：2026-08-14
- 上游版本：[`47f9438`](https://github.com/deepseek-ai/deepseek-harness/commit/47f943859bef60e4160492346772ded9b24f765a)
- 上游状态：Developer Preview；官方明确提示会发生破坏性兼容变更
- 结论：学习边界和交互方法，不直接引入其运行时，也不把 Rune 改造成聊天产品

## 1. 真正值得学习的部分

### 1.1 入口必须薄，能力必须有明确所有者

Harness 的 Web 入口只寻找挂载节点并启动 `@deepseek-ai/dsh-client-web`；模型适配器、工具、会话、设置、布局和 UI 都由独立包组合。它的核心原则是“Everything is a Plugin”，底层由 Cordis 提供服务、typed events 和可撤销 effects。

Rune 不需要立即采用动态插件树，但应保留同样清晰的三类角色：

1. **Definition**：声明输入、输出和限制；
2. **Provider**：实现纯计算或受控 I/O；
3. **Consumer**：只通过接口使用能力，不越权写状态。

Rune 当前对应关系已经成立：`operating-review-scope` 拥有 typed scope，`task-model-planning` 拥有有界客户端模型请求，task compiler 拥有生成物，transaction pipeline 独占写入。新增任务不得把 fetch、证据计算、文件生成和 Apply 再塞回 React。

### 1.2 持久事实与瞬时状态必须分开

Harness 把 session event log 作为模型历史、恢复、fork、回放和 UI 的事实来源；运行中的拦截、状态和请求则使用 live events。其关键约束是：任何模型可见输入都必须能从日志重建。

Rune 的对应原则不是复制一份聊天日志，而是：

- canonical Artifact source 与 reviewed task recipe 是持久事实；
- evidence preview、hover、popover、当前面板和加载进度是可丢弃的投影；
- 模型看到的 source/evidence 必须能由当前 canonical workspace 重新计算；
- 保存任务只记录 typed recipe、输出 identity 和有界 outcome，不能缓存一份会漂移的结果正文。

### 1.3 面板切换应保留上下文

Harness 的布局在折叠 details 时保留子树，只把 grid track 收到零；拖动时取消 easing，键盘或按钮切换时才使用短过渡。这样滚动、输入和局部运行时不会因为面板切换被重新创建。

Rune v0.94 采用同一原则：桌面端 Source/Preview focus view 不再 `display: none` 跳切，而是保持两侧 mounted，通过 240ms grid-track 过渡收放；不可见一侧同时使用 `inert`、`aria-hidden`、零宽、不可点击和延迟 `visibility`，避免焦点落入屏幕外。拖动分栏仍然直接跟随指针，不应用过渡。小屏继续使用明确的单面板布局。

### 1.4 动效是状态反馈，不是装饰库存

Harness 的主要过渡集中在约 100–180ms 的透明度、旋转和位移，以及布局的稍慢收放；多处显式处理 `prefers-reduced-motion`。它很少使用持续循环的“大效果”。

Rune 的规则：

- 100–180ms：按钮、chevron、hover、pressed；
- 240ms：面板与布局状态；
- 280–420ms：popover/dialog 等一次性 material reveal；
- 仅欢迎场景允许较慢的书写和环境动效；
- 所有动作在 reduced-motion 下必须可瞬时完成；
- 不以 blur、漂浮光晕或弹跳来掩盖未完成的状态设计。

### 1.5 命令目录应描述能力，不应复制业务执行

Harness 将人类命令的目录、筛选和选择界面与具体能力分开：命令 UI 只呈现候选项，真正行为仍由拥有该能力的服务执行。Rune v0.97 采用这一窄边界，新增静态 `workbench-commands` 注册表和 Quick Actions 消费者。注册表拥有十四个稳定 id、分组、九语言文案、快捷键、搜索关键词和 capability-derived availability；命令面板只负责搜索、键盘移动、焦点恢复和选择事件，不能导入持久化、Artifact 写入或网络能力。Workbench 把选择分发回现有 New、Import、Task、View、Checkpoint、Guide 和 Model handlers。

v1.04 又把目录下方的最小组合原语抽成 React-free `surface-registry`：surface owner 只声明 `single/list` cardinality，feature 提交 stable id、order 与纯 value，重复、未知 surface、非法 id 和 single 冲突立即失败，注册返回幂等 disposer。Workspace views 与 Quick Actions 共同使用它；registry 仍不能渲染、执行命令、读取浏览器状态或写 workspace。

v1.05 再把同一条 owner/provider 原则落实到 Rune 自己的文件域：五种 Artifact 必须各有一个静态 adapter，统一拥有新建元数据、starter source、格式识别、验证、状态统计和本地建议。它不使用 Harness 的 service container 或动态 plugin；React preview 通过另一份 exhaustive typed renderer map 消费 kind，防止 domain registry 获得 UI 或写入能力。

这不是动态插件系统，也不是把每个按钮再封装一层。它先消除散落命令目录、视图定义和快捷入口的重复，并证明可撤销 contribution 合同；只有出现第三方运行时装卸、隔离、配置 patch 和跨包生命周期需求时，才重新评估 Harness 的完整 slot/plugin host。

### 1.6 扩展点必须先属于业务域

Harness 把 session、agent、capability events 分域，并要求新行为挂到文档化 extension point。Rune 也必须先回答“谁拥有这个能力”：导入、scope、模型 transport、compiler、runtime preflight、transaction、persistence、export 各有唯一 owner。

若未来出现至少三个真正独立、需要第三方替换或运行时装卸的任务，再评估动态 task/plugin host。当前继续使用静态 typed composition：它更容易 tree-shake、审计、测试和迁移，也不会把生命周期/顺序/卸载复杂度提前带入产品。

### 1.7 主题与呈现必须各有单一所有者

Harness 的 `ui-theme` 独占静态色阶、语义别名、字体、motion、shadow 和 light/dark preference；功能组件只消费语义 token。其客户端又把纯数据对象、React 绑定层和纯 props 呈现组件做成单向依赖，避免业务组件直接读取全局 context。

Rune 继续采用更轻的对应实现：`app/styles/tokens.css` 与 appearance registry 是颜色、字体、圆角、阴影和 motion 的唯一共享权威；功能样式使用语义变量，不另建主题；`app/lib` 的 compiler/port 不导入 React，组件只接收已经准备好的数据与回调。v1.00 的图片兼容导入进一步把 package parser、共享 hash validator、review transaction 和 IndexedDB effect 分开；v1.01 让同一个 Deck compiler 同时供应完整交付 HTML 与逐页预览，v1.07 再让 presentation 把所有 compiler-owned 页面组成连续编辑流，并把 revision/range proof 与 DOM focus/scroll effect 分开。它们都证明无需动态插件树也能获得清晰、可替换且单向的数据边界。

## 2. 本轮采用与不采用

| Harness 方法                         | Rune 决定                   | 本轮落点                                                                                                                  |
| ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Everything is a Plugin               | 采用原则，不引入运行时      | 保持 pure scope、model port、compiler、transaction 四层能力边界                                                           |
| Durable session log                  | 转译为 source-derived facts | comparison evidence 从 canonical Data 重算，保存任务只存 typed scopes                                                     |
| Capability seams                     | 采用                        | 同字段 primary/comparison scopes 由一个纯模块验证和编译                                                                   |
| Mounted collapsible panels           | 采用                        | Source/Preview 零宽收放、`inert`、保留 scroll/selection/runtime                                                           |
| Typed UI slots                       | 采用最小静态子集            | React-free reversible surface registry 承载 Workspace views 与 Quick Actions；不含动态 loader、session scope 或第三方代码 |
| Human command registry               | 采用静态版本                | `workbench-commands` 描述能力，Quick Actions 只消费，Workbench 执行现有 handler                                           |
| Theme owner + semantic aliases       | 采用                        | token/appearance 独占共享视觉事实，功能样式不复制 palette                                                                 |
| Data → binding → presentation 单向层 | 采用                        | pure `app/lib` 端口、Workbench effect、props-only review component                                                        |
| Pure state/effect boundary           | 采用窄版本                  | compiler facts 进入 React-free diagnostic contract；Workbench 只执行 Source focus effect，UI 只拥有本地化与展开状态       |
| Dynamic profiles/bundles/patch tree  | 不采用                      | Rune 不是 agent harness，暂无第三方 runtime composition 需求                                                              |
| Chat/session-first shell             | 不采用                      | Rune 继续以文档、数据、分析和成品为中心                                                                                   |

## 2.1 v1.04 新增落点

- Workbench 不再复制 Source/Preview 两份 view switch；一个 props-only 组件消费同一组 registry contributions。
- Separator 的 gesture 从 window listeners 改为 element pointer capture；移动按 `requestAnimationFrame` 合并，结束时才持久化，避免 React 更新、浏览器绘制与存储写入互相追赶。
- 拖动时暂停 grid-track easing，指针和面板边界保持贴合；静止时 separator chrome 隐藏，hover、focus 与 dragging 才显示轻量浮动胶囊。
- Source 与 Preview 继续 mounted，因而 selection、scroll、DuckDB/Chart preview 和撤销上下文不因视图切换重建。
- 没有复制上游组件、品牌色或聊天信息架构；Rune 只采用可组合边界、稳定 DOM identity 与细粒度交互反馈。

## 2.2 v1.05 新增落点

- `document / data / query / chart / slides` 是显式完整集合；缺失、重复、未知或错误 definition 在加载时失败。
- New、导入识别、source validation、status stats 与 Quick Actions 不再维护互相漂移的 kind 分支。
- `.deck.md` 与 `.chart.json` 的专用识别由 adapter 明确排除通用 Markdown/JSON shadowing。
- Preview 使用 compile-time exhaustive renderer record；React 不进入 adapter registry，registry 也不获得 workspace writer。
- 继续不引入 runtime unload、第三方代码、profile tree 或 service locator。

## 2.3 v1.06 新增落点

- 原始 parser/compiler/binding 错误先进入 React-free `artifact-diagnostics`，分类成十三个稳定 code，并对数量、detail 与 reference 做边界控制和 immutable 输出。
- UI 只把 code 映射为九语言标题与修复方向；未经改写的编译器信息放进原生 disclosure，需要时才展开，技术事实与产品文案不互相冒充。
- “打开 Source 修复”是 Workbench effect：Preview-only 先恢复 Split，再聚焦 textarea；能找到精确 reference 时选中并居中，否则落在首行。动作不改 source、不调用模型、不持久化。
- 诊断面板使用同一 design token、viewport 内滚动、移动端重排和既有 Arabic RTL，不引入第二套 error palette、numeric layer 或 overlay owner。
- 这采用 Harness input machine 的 `events/facts in, effects out` 思路，但不把 Rune 编辑器迁成通用 agent session state machine。

## 2.4 v1.07 新增落点

- Deck compiler 继续输出完整交付 HTML 与 ordered standalone pages；Presentation 只把后者组成一个 lazy、连续的 16:9 页面流，不建立第二个 renderer。
- 顶部页索引不再拥有当前页业务状态，只把 exact target 交回共享 navigation；Source caret 与实际页面使用同一 compiler identity 双向滚动。
- `source-navigation` 在 React 和 DOM 之外完成 artifact/revision/range proof，并声明 layout/selection/Agent effects；Workbench 才执行 focus、scroll 与 view change。
- diagnostic repair 复用同一个 effect executor，但它的 plan 明确不激活 Selection Agent；相似的视觉动作因此共享实现而不混淆权限。
- 这对应 Harness 对 pure machine 与 effect 的分离，同时保留 Rune 的 canonical Artifact、review-before-write 和无 iframe privilege 边界。

## 2.5 v1.08 新增落点

- Agent composer 从 Workbench 内联 JSX 抽成独立 props-only 组件；Workbench 继续独占 scope 状态、计划调用、评审与持久化，组件只声明草稿、作用域 chips、建议动作与发送控件的呈现和回调。
- 卡片采用 Harness InputBar 的信息架构而不复制其视觉资产：可折叠建议区、无边框自适应 textarea、底部工具行（左侧作用域 pill chips，右侧 planner 徽章与 34px 圆形发送钮）、22px 胶囊圆角、hairline 描边、主题色 focus ring，以及 180ms 微过渡；品牌色仍来自 Rune theme token，而非上游 business blue。
- 建议动作作为卡片内首个 disclosure，展开时在同一卡片内以换行 chips 呈现，避免第二浮层菜单；query evidence 提示随 disclosure 一起展开。
- 发送/作用域/建议的禁用状态全部由 Workbench 传入的 busy/locked/selectionUnavailable 布尔值派生，组件自身不拥有任何任务或 workspace 状态。
- 草稿高度由 onChange 本地测量并封顶 132px；外部清空（例如计划成功后）由 value 驱动的 effect 收缩，不引入第二高度来源。
- 组件通过 React 19 ref-as-prop 暴露 textarea 节点，Workbench 的 ⌘Enter 提交与 focus-agent 命令行为不变。

## 2.6 v1.09 新增落点

- More Tools 的完整内容从顶部 chrome 移到 activity rail 底部的单一 Settings 入口；Workbench 仍拥有打开状态和所有设置 effect，activity rail 只接收状态、无障碍属性和回调。
- Settings popover 以触发器为定位锚点并在 Arabic RTL 下镜像，避免建立第二套全局导航或 overlay authority；顶部只保留跨文件工作需要的动作。
- 全局 token 增加统一的玻璃材质、hairline、交互抬升和 motion 曲线，欢迎页、工作台与浮层复用同一视觉语法，而不是在组件内硬编码独立效果。
- Space Black 使用完整的语义颜色覆盖，不依赖简单反色；pointer glow、欢迎内容抬升和 Preview 滚动阴影都只是可取消的呈现反馈，不携带 workspace 状态或写权限。
- Activity rail 与 Status bar 抽成 props-only 组件；OCR core 改为安装/构建阶段从固定依赖生成，并加入 Chromium smoke 与 critical accessibility 检查，降低后续界面迭代的验证成本。

## 3. 后续架构门槛

只有同时满足以下条件，才引入 runtime task registry 或 UI slot host：

1. 至少三个独立任务重复实现同一种注册、排序或替换逻辑；
2. 有明确的运行时启停、第三方扩展或分发需求；
3. 能定义卸载后撤销 effect、状态迁移和冲突顺序；
4. repository test 能阻止 capability 越权依赖；
5. 插件失败不能破坏 canonical workspace、review 或 Apply。

在此之前，优先抽取纯函数、typed port 和窄组件；不要以“插件化”代替清晰的产品域。

## 4. 上游依据

- [DeepSeek Harness README](https://github.com/deepseek-ai/deepseek-harness)
- [DeepSeek Harness Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [Web thin entry](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/web/src/main.ts)
- [AppFrame layout](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-layout/src/client/AppFrame.module.css)
- [Client UI packages](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client)
