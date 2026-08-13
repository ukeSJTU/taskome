# Fumadocs 能否消费/主题化 shadcn 组件（packages/ui）？

研究日期：2026-08-13

## 结论

Fumadocs UI 官方**明确支持并推荐**与 shadcn/ui 共用主题：它提供一个专门的 `fumadocs-ui/css/shadcn.css` 预设，作用是让 Fumadocs UI "adopt colors from your Shadcn UI theme"（采用你的 Shadcn UI 主题颜色），并且官方原话承认其设计系统"was inspired by Shadcn UI"（[Themes](https://fumadocs.dev/docs/ui/theme)）。更进一步，Fumadocs 的整体定制模型（Fumadocs CLI）被官方明确类比为"a much more flexible approach inspired by Shadcn UI"——即像 shadcn 一样把组件源码"fork"进项目由使用者完全掌控，而不是消费一个不透明的黑盒包（[What is Fumadocs](https://www.fumadocs.dev/docs/what-is-fumadocs)）。

对 taskome 具体而言：

- **主题共享是可行且有官方路径的**：`packages/ui` 已经是 Tailwind v4 + CSS 变量式 shadcn/ui（见下文），与 Fumadocs 当前版本要求的 Tailwind v4 完全吻合，二者的 CSS 变量语义（background/foreground/primary/secondary/accent/muted/card/popover/border/ring 等）也高度对应，理论上可以让 `apps/docs` 引入 `fumadocs-ui/css/shadcn.css` 预设，再叠加/复用 `packages/ui` 的 `globals.css` 变量值，从而让文档站视觉上贴近产品主题。
- **组件层不建议直接复用 `packages/ui` 的组件**：Fumadocs UI 自带的交互组件（tabs、dialog、popover、accordion、collapsible、scroll-area、navigation-menu 等）内部使用的是 **Radix UI** 原语（`@radix-ui/react-*`）+ `class-variance-authority` + `lucide-react`（[npm: fumadocs-ui](https://www.npmjs.com/package/fumadocs-ui) 依赖清单），这与经典 shadcn/ui 的技术栈一致；但 taskome 的 `packages/ui`（style: `base-lyra`）改用的是 **Base UI**（`@base-ui/react`）而非 Radix 作为无样式原语（见 `packages/ui/src/components/button.tsx`、`package.json`）。两者头层组件的行为/API 不是同一套 primitives，因此"消费"更现实的落点是**主题 token 层**（颜色、圆角、字体），而不是直接把 `packages/ui` 的组件塞进 Fumadocs 的布局插槽，或反过来把 Fumadocs 组件当作 `packages/ui` 的组件使用。
- **变量命名冲突已有官方解法**：Fumadocs 的主题变量默认带 `fd-` 前缀（如 `--color-fd-background`、`--color-fd-primary`），这是当前版本的**默认行为**，用来避免与 shadcn/ui 等其他系统的同名变量（`--background`、`--primary`）冲突（[Themes](https://fumadocs.dev/docs/ui/theme)）。社区在 [GitHub Discussion #1171](https://github.com/fuma-nama/fumadocs/discussions/1171) 中曾要求手动配置 `cssPrefix` 才能避免冲突，维护者 fuma-nama 随后表示"we can make it the default to add `fd-` prefix"——从目前官方文档已经默认展示 `fd-` 前缀变量来看，这个改进已经落地，手动配置 `cssPrefix` 的旧方案已过时。

## 一、taskome 当前的 shadcn 设置是什么

以下事实全部来自本仓库文件，是集成决策的基线：

- **`packages/ui/components.json`**：`style: "base-lyra"`、`tailwind.cssVariables: true`、`tailwind.baseColor: "neutral"`、`tailwind.config: ""`（无 JS/TS 配置文件，纯 CSS-first）、`iconLibrary: "lucide"`。这是 shadcn 较新的注册表体系下的一个 style（不是经典的 `default`/`new-york`），依赖 `"shadcn": "^4.16.0"` CLI 与 `"@shadcn/react": "^0.2.1"`（shadcn 官方的无样式 primitives 包，见其 npm 描述 "Unstyled components for React"，仓库指向 `shadcn-ui/ui`）。
- **原语库是 Base UI，不是 Radix**：`packages/ui/src/components/button.tsx` 从 `@base-ui/react/button` 导入 `Button as ButtonPrimitive`，配合 `class-variance-authority`（cva）做 variant，`tailwind-merge` + `clsx` 做类名合并（`packages/ui/src/lib/utils.ts` 的 `cn()`）。
- **Tailwind v4，纯 CSS 配置**：`packages/ui/postcss.config.mjs` 只挂 `@tailwindcss/postcss` 插件；`packages/ui/src/styles/globals.css` 用 `@import "tailwindcss"`、`@import "tw-animate-css"`、`@import "shadcn/tailwind.css"` 三段式导入，没有 `tailwind.config.js`/`.ts`。仓库 pnpm catalog 中 `tailwindcss: ^4.3.3`（`pnpm-workspace.yaml`），确认是 Tailwind v4。
- **CSS 变量式主题**：`globals.css` 在 `:root`/`.dark` 下定义了完整的 oklch 色板（`--background`、`--foreground`、`--card`、`--popover`、`--primary`、`--secondary`、`--muted`、`--accent`、`--destructive`、`--border`、`--input`、`--ring`、`--chart-1..5`、`--sidebar-*`、`--radius`），再通过 `@theme inline` 把这些变量映射成 Tailwind 的 `--color-*`/`--radius-*` token。这是标准 shadcn/ui 的"CSS 变量"主题模式（而非 Tailwind class 硬编码模式），变量名与 shadcn 官方默认主题命名完全一致。
- **monorepo 内的消费/共享方式**：`packages/ui/package.json` 的 `exports` 把 `./globals.css` 暴露为 `@taskome/ui/globals.css`；`apps/web/src/index.css` 仅一行 `@import "@taskome/ui/globals.css";`，自身的 `apps/web/postcss.config.mjs` 单独挂 `@tailwindcss/postcss`。`apps/web/components.json` 里的 `tailwind.css` 又反向指向 `../../packages/ui/src/styles/globals.css`，让 shadcn CLI 在 `apps/web` 内运行时仍把变量写回 `packages/ui`。也就是说，**taskome 现有的跨包 Tailwind v4 共享模式就是"直接 `@import` 另一个包导出的 CSS 文件"**，没有共享的 `tailwind.config` 包（`packages/config` 目前只有 `tsconfig.base.json`，没有 Tailwind 预设包）。
- **`apps/docs` 尚未创建**：仓库里没有 `apps/docs` 目录；`docs/adr/0020-docs-site-as-separate-deployable.md` 已经决定用 Fumadocs（Next.js）作为独立部署单元，路由在 `docs.taskome.com` 子域名，且明确"static content with no gateway access"，不参与 BFF 边界。本研究只回答"能否/怎么主题化"，不涉及脚手架搭建。

## 二、Fumadocs 官方的主题体系

- **底层就是 Tailwind CSS v4 的一个 preset**：官方原话——"Fumadocs UI adds its own colors, animations, and utilities with Tailwind CSS preset"，且"Only Tailwind CSS v4 is supported"（[Themes](https://fumadocs.dev/docs/ui/theme)）。标准接入方式是三行 CSS 导入：
    ```css
    @import "tailwindcss";
    @import "fumadocs-ui/css/neutral.css";
    @import "fumadocs-ui/css/preset.css";
    ```
    这与 taskome `packages/ui/src/styles/globals.css` 的"CSS-first 多重 `@import`"写法是同一范式，不存在配置模型上的错位。
- **内置多套配色预设**，通过替换 `fumadocs-ui/css/<theme>.css` 里的文件名切换：`neutral`、`black`、`vitepress`、`dusk`、`catppuccin`、`ocean`、`purple`、`solar`、`emerald`、`ruby`、`aspen`（[Themes](https://fumadocs.dev/docs/ui/theme)）。
- **专门的 shadcn 预设**：把 `neutral.css` 换成 `shadcn.css` 即可：
    ```css
    @import "tailwindcss";
    @import "fumadocs-ui/css/shadcn.css";
    @import "fumadocs-ui/css/preset.css";
    ```
    官方原话："Fumadocs UI will adopt colors from your Shadcn UI theme."（[Themes](https://fumadocs.dev/docs/ui/theme)）
- **变量语义与前缀**：Fumadocs 主题变量当前默认带 `fd-` 前缀（`--color-fd-background`、`--color-fd-foreground`、`--color-fd-primary`、`--color-fd-secondary`、`--color-fd-muted`、`--color-fd-accent`、`--color-fd-card`、`--color-fd-popover`、`--color-fd-border`、`--color-fd-ring`，及各自的 `-foreground` 变体），命名语义与 shadcn/ui 的默认 token 一一对应，只是加了前缀以避免和宿主项目/其他系统的同名变量冲突（[Themes](https://fumadocs.dev/docs/ui/theme)）。
- **暗色模式**：通过 `next-themes` 集成，接入点是 `RootProvider`（[Themes](https://fumadocs.dev/docs/ui/theme)）——taskome `packages/ui/package.json` 的 `dependencies` 里也已经有 `next-themes`（catalog 版本），暗色模式机制天然兼容。
- **CLI 定制哲学直接对标 shadcn**：`fumadocs-ui` 的组件可以通过 Fumadocs CLI"安装到本地并完全控制"（"install the components locally and have full control"），官方将这个模型明确类比为"a much more flexible approach inspired by Shadcn UI"（[What is Fumadocs](https://www.fumadocs.dev/docs/what-is-fumadocs)）——即抄源码进仓库、自己维护，而不是引用一个封闭的样式包。

## 三、Fumadocs 内部用什么原语库，和 packages/ui 是否同源

- `fumadocs-ui`（当前 npm 最新版 16.14.3）的 `dependencies` 中包含一整套 `@radix-ui/react-*` 包：`react-slot`、`react-tabs`、`react-dialog`、`react-popover`、`react-presence`、`react-accordion`、`react-direction`、`react-collapsible`、`react-scroll-area`、`react-navigation-menu`，另外还有 `class-variance-authority`、`lucide-react`、`next-themes`（[npm registry: fumadocs-ui](https://registry.npmjs.org/fumadocs-ui/latest)）。这与经典 shadcn/ui 组件的技术栈（Radix + cva + lucide + next-themes）完全一致，佐证了官方"design inspired by Shadcn UI"的说法不只停留在配色层，组件实现范式也同源。
- **但 taskome 的 `packages/ui` 已经迁移到 Base UI**（`@base-ui/react`，见 `button.tsx`），不是 Radix。这意味着：即便 Fumadocs 和 `packages/ui` 在"CSS 变量 token 语义"上高度兼容，**二者的组件（Tabs、Dialog、Popover 等）不能直接互相替换/复用**——它们是两套不同的无样式 primitives，props/行为不保证一致。可行的集成边界因此是"主题 token 共享"，而非"组件直接复用"。
- 另有官方独立包 `@fumadocs/tailwind`（当前 0.1.1，描述为"The Tailwind CSS utils for Fumadocs UI"），是 Fumadocs 自己的 Tailwind 工具集，不依赖 shadcn 包。

## 四、社区一手集成案例（Fumadocs 作者本人维护）

- Fumadocs 作者 fuma-nama 在 [`fumadocs-shadcn` 示例仓库](https://github.com/fuma-nama/fumadocs-shadcn)中演示了三步做法：
    1. 在 `tailwind.config.js` 的 `createPreset`（来自 `fumadocs-ui/tailwind-plugin`）选项里设置 `cssPrefix`（如 `"fuma-"`），给 Fumadocs 的 CSS 变量加前缀，避免和 `shadcn init` 写入的变量冲突；
    2. 从 `global.css` 中移除 Fumadocs 默认的 border/background/text 颜色声明，因为 shadcn/ui 会提供自己的默认色；
    3. 把 background/foreground 样式从全局挪到具体布局组件上（示例里是 `app/(home)/layout.tsx` 的 `HomeLayout` 加 `className="bg-background text-foreground"`），而不是全局套用。
- 这个示例对应的讨论见 [GitHub Discussion #1171 "How to make shadcn not override Fumadocs' theme?"](https://github.com/fuma-nama/fumadocs/discussions/1171)：用户报告 `shadcn add button` 会覆盖 Fumadocs 默认主题；作者最初的解法就是手动 `cssPrefix` + 关闭 `addGlobalColors`，随后表示"计划把 `fd-` 前缀做成默认行为"。**结合第二部分核实的当前官方文档（变量已默认带 `fd-` 前缀、且没有再提 `cssPrefix` 选项）**，可以确认这个改进已经落地——即社区示例仓库里手动配置 `cssPrefix` 的步骤，对当前版本的 Fumadocs 已经是过时/非必要的，用官方 `shadcn.css` 预设即可开箱兼容，不需要再手工加前缀。

## 五、Monorepo 内共享 Tailwind 配置的通用做法（非 Fumadocs 专属，用于类比 taskome 场景）

- 在 Tailwind v3 时代，常见做法是建一个独立的 `@repo/tailwind-config` 包，导出一份 JS/TS 配置对象，各 app 的 `tailwind.config.ts` 通过 `presets: [sharedConfig]` 继承。
- 到 Tailwind v4，配置整体转为 CSS-first：不再需要共享的 `tailwind.config.js` 包，各 app 直接 `@import` 一个共享包导出的 CSS 文件（例如 `import "@repo/ui/styles.css"`），配置/token 都写在这份 CSS 里的 `@theme` 块中。
- 这正是 taskome 当前 `apps/web` 消费 `packages/ui` 的方式（`@import "@taskome/ui/globals.css"`），也是 Fumadocs 官方文档展示的接入方式（三行 `@import`）。两者模式一致，说明把 `apps/docs` 接入 `packages/ui` 的主题，在技术形态上和现有 `apps/web` 的接入方式不会有额外的架构落差——都是"CSS 文件级别的 `@import` 组合"，没有找到 Fumadocs 官方或社区文档提供针对本仓库这种三包（`packages/ui` + `apps/web` + 即将加入的 `apps/docs`）结构的现成模板，这部分组合方式需要 taskome 自己在实现阶段验证（例如 `apps/docs` 的 CSS 导入顺序：先 `tailwindcss`，再 `fumadocs-ui/css/shadcn.css`/`preset.css`，再 `@taskome/ui/globals.css` 覆盖具体色值，这一顺序在官方资料中没有直接示例，是基于 CSS 层叠规则的推论，不是逐字官方规范）。

## 主要一手资料

- Fumadocs: [Themes](https://fumadocs.dev/docs/ui/theme) —— Tailwind v4 preset、内置配色预设列表、`shadcn.css` 预设、`fd-` 前缀变量
- Fumadocs: [What is Fumadocs](https://www.fumadocs.dev/docs/what-is-fumadocs) —— "inspired by Shadcn UI" 的 CLI 定制哲学
- Fumadocs: [Manual Installation / Next.js](https://www.fumadocs.dev/docs/manual-installation/next) —— 包安装命令、CSS 导入方式
- npm registry: [fumadocs-ui 依赖清单](https://www.npmjs.com/package/fumadocs-ui)（原始数据取自 `https://registry.npmjs.org/fumadocs-ui/latest`）—— 确认内部使用 Radix UI + cva + lucide-react
- npm registry: `@fumadocs/tailwind`（`https://registry.npmjs.org/@fumadocs/tailwind/latest`）—— Fumadocs 官方 Tailwind 工具包
- GitHub: [fuma-nama/fumadocs-shadcn](https://github.com/fuma-nama/fumadocs-shadcn) —— Fumadocs 作者维护的 shadcn 集成示例仓库
- GitHub: [fuma-nama/fumadocs Discussion #1171](https://github.com/fuma-nama/fumadocs/discussions/1171) —— `cssPrefix`/`fd-` 前缀冲突的原始讨论与作者回复
- 本仓库: `packages/ui/components.json`、`packages/ui/package.json`、`packages/ui/postcss.config.mjs`、`packages/ui/src/styles/globals.css`、`packages/ui/src/components/button.tsx`、`packages/ui/src/lib/utils.ts`、`apps/web/src/index.css`、`apps/web/postcss.config.mjs`、`apps/web/components.json`、`pnpm-workspace.yaml`、`docs/adr/0020-docs-site-as-separate-deployable.md` —— taskome 当前 shadcn/Tailwind 设置的基线事实
