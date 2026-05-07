# ConveySim UI/UX 优化计划

> 基于 UI/UX Pro Max 技能分析，2026-05-07 生成

---

## 一、现状评估总览

| 维度 | 评分/100 | 状态 |
|------|----------|------|
| 可访问性 (Accessibility) | 20 | 🔴 严重 |
| 交互反馈 (Interaction Feedback) | 45 | 🔴 待改进 |
| 视觉一致性 (Visual Consistency) | 65 | 🟡 尚可 |
| 布局架构 (Layout Architecture) | 75 | 🟡 尚可 |
| 动画动效 (Animation & Motion) | 15 | 🔴 严重 |
| 响应式 (Responsive) | 10 | 🔴 严重 |
| 设计系统 (Design System) | 5 | 🔴 严重 |
| 色彩排版 (Color & Typography) | 55 | 🔴 待改进 |
| **综合均值** | **36.3** | **🔴 待改进** |

### 优势（保留）
- **布局架构清晰**：IDE 式固定 Chrome + 弹性 Canvas 中心布局，符合仿真工具的专业场景
- **组件组织良好**：4 目录（layout/panels/canvas/dialogs）12 组件，职责清晰
- **PixiJS-Vue 集成干净**：Store 作为桥梁，渲染层与逻辑层解耦
- **深色主题内在一致**：Navy/Cyberpunk 风格统一，适合工业仿真氛围

### 核心问题
1. **零设计令牌** — 40+ 硬编码颜色散布在 12 个文件中，改主题需逐文件修改
2. **零可访问性** — 无 ARIA、无 focus 管理、无键盘 UI 导航、颜色作为唯一指示
3. **零过渡动画** — 对话框瞬间出现/消失，按钮无 hover/press 反馈
4. **零图标体系** — 使用 Unicode 字符和原生 title 属性

---

## 二、推荐设计系统

基于 UI/UX Pro Max 的 `--design-system` 分析结果：

### 推荐风格：Data-Dense Dashboard
- 适合工业仿真/运营监控场景
- 暗色模式完整支持，空间高效，数据密度最大化

### 推荐配色方案（基于现有深色主题优化）

| Token | 值 | 用途 | 替换现有 |
|-------|-----|------|----------|
| `--color-primary` | `#1E3A5F` | 品牌主色 | `#0f3460` |
| `--color-secondary` | `#2563EB` | 交互强调色 | `#2a4a6a` |
| `--color-accent` | `#059669` | 成功/确认 | `#4ae04a` |
| `--color-destructive` | `#DC2626` | 删除/危险 | `#e94560` |
| `--color-warning` | `#D97706` | 警告 | `#e9a820` |
| `--color-bg-base` | `#0f172a` | 主背景 | `#1a1a2e` |
| `--color-bg-surface` | `#1e293b` | 面板/卡片 | `#16213e` |
| `--color-bg-deep` | `#020617` | Canvas 背景 | `#0a0a1a` |
| `--color-border` | `#334155` | 边框/分隔 | `#0f3460` |
| `--color-fg-primary` | `#f1f5f9` | 主要文字 | `#e0e0e0` |
| `--color-fg-secondary` | `#94a3b8` | 次要文字 | `#888` |
| `--color-fg-muted` | `#64748b` | 辅助文字 | `#666` |

### 推荐字体：Fira Code / Fira Sans
- **Fira Sans**：UI 文本（标签、按钮、面板）
- **Fira Code**：数据值、坐标显示、代码感元素
- Mood: dashboard, data, analytics, technical, precise
- Google Fonts: `https://fonts.google.com/share?selection.family=Fira+Code:wght@400;500;600;700|Fira+Sans:wght@300;400;500;600;700`

---

## 三、优化计划（4 阶段，依赖递进）

### P0：设计令牌与样式体系（无前置依赖）

**目标**：将 40+ 硬编码颜色提取为 CSS 变量，建立语义化设计令牌

**变更清单**：

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1 | 创建 `src/design-tokens.css` | 新文件 | 定义 `:root` 下所有 CSS 变量（颜色、字号、间距、圆角、阴影层级） |
| 2 | 在 `main.ts` 或 `App.vue` 中引入 tokens | `src/main.ts` | `import './design-tokens.css'` |
| 3 | 替换 `AppHeader.vue` 硬编码颜色 | `AppHeader.vue` | ~8 处 → `var(--color-*)` |
| 4 | 替换 `Toolbar.vue` 硬编码颜色 | `Toolbar.vue` | ~6 处 → `var(--color-*)` |
| 5 | 替换 `PropertyPanel.vue` 硬编码颜色 | `PropertyPanel.vue` | ~10 处 → `var(--color-*)` |
| 6 | 替换 `DataPanel.vue` 硬编码颜色 | `DataPanel.vue` | ~8 处 → `var(--color-*)` |
| 7 | 替换 `StatusBar.vue` 硬编码颜色 | `StatusBar.vue` | ~5 处 → `var(--color-*)` |
| 8 | 替换 `SaveDialog.vue` 硬编码颜色 | `SaveDialog.vue` | ~6 处 → `var(--color-*)` |
| 9 | 替换 `LoadDialog.vue` 硬编码颜色 | `LoadDialog.vue` | ~4 处 → `var(--color-*)` |
| 10 | 替换 `BatchDialog.vue` 硬编码颜色 | `BatchDialog.vue` | ~4 处 → `var(--color-*)` |
| 11 | 替换 `SimToast.vue` 硬编码颜色 | `SimToast.vue` | ~3 处 → `var(--color-*)` |
| 12 | 替换 `CanvasContainer.vue` 硬编码颜色 | `CanvasContainer.vue` | ~2 处 → `var(--color-*)` |
| 13 | 替换 `RoutingTable.vue` 硬编码颜色 | `RoutingTable.vue` | ~4 处 → `var(--color-*)` |
| 14 | 替换 `HeatmapLegend.vue` 硬编码颜色 | `HeatmapLegend.vue` | ~3 处 → `var(--color-*)` |
| 15 | 统一 `style.css` 全局样式引用变量 | `src/style.css` | 字体、间距 token 化 |

**验证标准**：
- [ ] `grep -r '#[0-9a-fA-F]\{3,6\}' src/ --include='*.vue'` 零结果（或仅剩 PixiJS 相关不可替换的）
- [ ] 修改单个 CSS 变量值，全局视觉一致变化

**影响**：12 文件 | **风险**：低（纯样式替换，无逻辑变更）

---

### P1：可访问性与键盘导航（前置：P0）

**目标**：达到 WCAG 2.1 AA 基本合规，关键交互可通过键盘完成

**变更清单**：

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1 | 所有 `<button>` 添加 `aria-label` | 全部组件 | 图标按钮（x、+、缩放适配）必须有描述 |
| 2 | 添加全局 focus ring 样式 | `design-tokens.css` + `style.css` | `:focus-visible` 用 `var(--color-ring)` 2px outline |
| 3 | 对话框 focus trap | `SaveDialog/LoadDialog/BatchDialog.vue` | 打开时 autofocus 首个输入框，Tab 循环锁定在对话框内 |
| 4 | 对话框 Escape 关闭 | `SaveDialog/LoadDialog/BatchDialog.vue` | `@keydown.escape` 关闭对话框 |
| 5 | Speed 下拉菜单键盘支持 | `AppHeader.vue` | 上下箭头选择、Enter 确认、Escape 关闭 |
| 6 | 颜色对比度修复 | 全部组件 | `#888` on `#16213e` = 3.2:1（不合规）→ `#94a3b8` = 4.8:1 |
| 7 | disabled 态对比度提升 | 全部按钮 | `opacity: 0.3` → `opacity: 0.5` + 保留 `cursor: not-allowed` |
| 8 | 状态色辅助指示 | `StatusBar.vue`, `DataPanel.vue` | 运行/暂停/停止添加图标（▶/⏸/⏹），利用率条添加文字标注 |
| 9 | 语义化 landmark | `App.vue` | `<header role="banner">`, `<main>`, `<aside role="complementary">`, `<footer>` |
| 10 | 跳过导航链接 | `App.vue` | `<a href="#main-canvas" class="skip-link">跳到画布</a>` |

**验证标准**：
- [ ] Tab 键可遍历所有交互元素，顺序符合视觉布局
- [ ] 对话框打开后 Tab 不跳出对话框范围
- [ ] 所有文字/背景对比度 ≥ 4.5:1（用 contrast checker 验证）
- [ ] macOS VoiceOver 可识别按钮用途

**影响**：12 文件 | **风险**：低 | **前置**：P0（依赖 CSS 变量）

---

### P2：交互反馈与动画（前置：P0）

**目标**：所有交互有即时视觉反馈，消除"瞬间出现/消失"的突兀感

**变更清单**：

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1 | 对话框 `<Transition>` 包裹 | `App.vue` | fade + scale (0.95→1) 进出动画，200ms |
| 2 | 按钮 hover/active 微交互 | `design-tokens.css` + `style.css` | `transition: all 150ms`, `:active { transform: scale(0.97) }` |
| 3 | Toast 退出动画 | `SimToast.vue` | 添加 `<Transition>` leave 动画（slide-out + fade，150ms） |
| 4 | 表单校验视觉反馈 | `PropertyPanel.vue` | 输入值被 clamp 时，边框闪红 + tooltip 显示范围提示 |
| 5 | 删除确认对话框 | `Toolbar.vue` | 场景 "x" 按钮改为先弹确认，而非直接删除 |
| 6 | 覆盖保存确认强化 | `SaveDialog.vue` | 覆盖警告改为独立确认步骤（二次点击或复选框） |
| 7 | 批量运行进度条 | `BatchDialog.vue` | 添加进度条组件替代纯数字计数 |
| 8 | Canvas 缩放适配按钮替换 Unicode | `CanvasContainer.vue` | 用 SVG 图标替换 `&#9744;` |

**验证标准**：
- [ ] 所有对话框进出有 150-300ms 过渡动画
- [ ] 按钮点击有 scale 反馈（0.97→1，< 150ms）
- [ ] 删除操作需二次确认
- [ ] 表单值越界有视觉提示

**影响**：10 文件 | **风险**：低 | **前置**：P0（依赖 CSS 变量和 transition token）

---

### P3：视觉打磨与增强（前置：P0+P1）

**目标**：提升专业感和完成度，引入图标体系、工具提示、面板折叠

**变更清单**：

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1 | 引入 Lucide Vue 图标库 | `package.json` | `npm install lucide-vue-next`，替换所有 Unicode 和 title-only tooltip |
| 2 | 创建 `SimTooltip.vue` 组件 | 新文件 | 可定位、可样式、延迟 300ms 显示的自定义 tooltip |
| 3 | 面板标题栏折叠功能 | `PropertyPanel.vue`, `DataPanel.vue` | 点击标题折叠/展开内容区，200ms height 过渡 |
| 4 | 可拖拽分隔线 | `App.vue` | 工具栏和右面板支持拖拽调整宽度（min 120px, max 400px） |
| 5 | 空态占位 | `PropertyPanel.vue`, `DataPanel.vue` | 未选中组件时显示引导文字（"点击画布中的组件查看属性"） |
| 6 | Fira Code/Sans 字体 | `design-tokens.css` + `index.html` | 数据值用 `Fira Code`，UI 文本用 `Fira Sans`，`font-display: swap` |
| 7 | `prefers-reduced-motion` 支持 | `style.css` | 全局 `@media (prefers-reduced-motion: reduce)` 禁用动画 |
| 8 | PixiJS canvas 错误边界 | `CanvasContainer.vue` | WebGL 不可用时显示降级提示 |
| 9 | 统一间距系统 | `design-tokens.css` | 4px 基数的间距 token：`--space-1` (4px) 到 `--space-6` (24px) |
| 10 | z-index 层级规范 | `design-tokens.css` | `--z-canvas: 1`, `--z-panel: 10`, `--z-header: 20`, `--z-dialog: 100`, `--z-toast: 200` |

**验证标准**：
- [ ] 所有图标来自 Lucide，风格一致（stroke-width 2）
- [ ] 面板可折叠，折叠动画流畅
- [ ] 开启 `prefers-reduced-motion` 后无动画
- [ ] 间距遵循 4px 基数系统

**影响**：12 文件 | **风险**：中（新增依赖、新增组件）| **前置**：P0+P1

---

## 四、明确排除项

| 排除项 | 原因 |
|--------|------|
| 亮色/暗色模式切换 | 当前暗色主题一致性好，暂不需要双主题；P0 的 CSS 变量为此预留了基础 |
| 移动端响应式 | ConveySim 是桌面专业工具，Canvas 交互不适合触屏；暂不投入 |
| i18n 国际化 | 当前中文 UI 满足需求，后期如需再引入 vue-i18n |
| 路由改造（Vue Router） | 单页应用无需路由，不需要引入 |
| CSS 框架（Tailwind/UnoCSS） | 项目已有完整 scoped CSS 体系，引入框架收益低、迁移成本高 |

---

## 五、与现有迭代计划的关系

当前 `ITERATION_PLAN.md` 有 5 个 Phase：

| 原 Phase | 内容 | 与本计划关系 |
|-----------|------|-------------|
| Phase 1 | Bug 修复 (B1-B9) | **优先执行**，UI/UX 优化在 Bug 修复后进行 |
| Phase 2 | 代码质量 | 可与 P0 并行（P0 是样式层，不影响逻辑） |
| Phase 3 | UX 改善 | **与 P1+P2 合并执行**，消除重复 |
| Phase 4 | 功能增强 | 独立于 UI/UX 优化，可并行 |
| Phase 5 | 收尾 | 包含 P3 的视觉打磨项 |

**建议执行顺序**：Phase 1 (Bug) → Phase 2 + P0 (并行) → Phase 3 + P1 + P2 (合并) → Phase 4 + P3 (并行) → Phase 5 (收尾)

---

## 六、预估工作量

| 阶段 | 变更项 | 预估工时 | 可自动化比例 |
|------|--------|----------|-------------|
| P0 设计令牌 | 15 项 | 2-3h | 80%（颜色替换可脚本化） |
| P1 可访问性 | 10 项 | 3-4h | 30%（aria-label 需人工判断） |
| P2 交互反馈 | 8 项 | 2-3h | 40% |
| P3 视觉打磨 | 10 项 | 4-6h | 20%（新组件需设计+实现） |
| **合计** | **43 项** | **11-16h** | **~45%** |
