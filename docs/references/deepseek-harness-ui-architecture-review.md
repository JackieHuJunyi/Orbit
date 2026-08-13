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

这不是动态插件系统，也不是把每个按钮再封装一层。它先消除散落命令目录和快捷入口的重复；只有出现第三方运行时装卸、冲突排序和 effect 撤销需求时，才重新评估 Harness 的 slot/plugin host。

### 1.6 扩展点必须先属于业务域

Harness 把 session、agent、capability events 分域，并要求新行为挂到文档化 extension point。Rune 也必须先回答“谁拥有这个能力”：导入、scope、模型 transport、compiler、runtime preflight、transaction、persistence、export 各有唯一 owner。

若未来出现至少三个真正独立、需要第三方替换或运行时装卸的任务，再评估动态 task/plugin host。当前继续使用静态 typed composition：它更容易 tree-shake、审计、测试和迁移，也不会把生命周期/顺序/卸载复杂度提前带入产品。

## 2. 本轮采用与不采用

| Harness 方法 | Rune 决定 | 本轮落点 |
| --- | --- | --- |
| Everything is a Plugin | 采用原则，不引入运行时 | 保持 pure scope、model port、compiler、transaction 四层能力边界 |
| Durable session log | 转译为 source-derived facts | comparison evidence 从 canonical Data 重算，保存任务只存 typed scopes |
| Capability seams | 采用 | 同字段 primary/comparison scopes 由一个纯模块验证和编译 |
| Mounted collapsible panels | 采用 | Source/Preview 零宽收放、`inert`、保留 scroll/selection/runtime |
| Typed UI slots | 暂缓 | 只有两个 focused tasks，静态组合成本更低 |
| Human command registry | 采用静态版本 | `workbench-commands` 描述能力，Quick Actions 只消费，Workbench 执行现有 handler |
| Dynamic profiles/bundles/patch tree | 不采用 | Rune 不是 agent harness，暂无第三方 runtime composition 需求 |
| Chat/session-first shell | 不采用 | Rune 继续以文档、数据、分析和成品为中心 |

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
