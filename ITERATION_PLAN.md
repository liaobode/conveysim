# ConveySim 迭代优化计划 v1

> 基于全量代码审查（48 个源文件），2026-05-07

---

## 一、问题分类（按严重度）

### 🔴 P0 — Bug（8 个）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **PalletGraphic.ts 是死代码** | `src/canvas/objects/PalletGraphic.ts` | PalletLayer 直接用 `PIXI.Graphics` 内联绘制，该类从未实例化，增加维护负担 |
| 2 | **托盘在移载机/叉车内不可见** | `src/canvas/layers/PalletLayer.ts` sync() | `sync()` 只匹配 `conveyors`，托盘进入移载机或叉车后从画布消失 |
| 3 | **选中高亮只对输送机生效** | `CanvasManager.ts` highlightSelected() | 只遍历 `conveyorList` 调用 `setHighlight()`，移载机和叉车选中无视觉反馈（但它们的 Graphic 类都有 `setHighlight()` 方法） |
| 4 | **叉车每次重绘内存泄漏** | `ForkliftGraphic.ts` draw() | 每次调用 `draw()` 都 `new PIXI.Text()` 但不销毁旧的，反复重绘累积孤儿对象 |
| 5 | **连线操作撤销快照不一致** | `SnapManager.ts` + `canvasStore.ts` | Wire 工具添加/删除连线时，`pushUndoSnapshot()` 调用缺失或不一致，用户无法撤销连线操作 |
| 6 | **叉车端口命名语义混乱** | `SnapManager.ts` getPorts() | 叉车 consumer 只有 `output` 端口，但仿真中 conveyor.output 连到 consumer.output，语义上应是 consumer 的 input |
| 7 | **Simulation.emitEvent 类型不安全** | `engine/Simulation.ts` | 参数类型为 `string` 而非已定义的 `SimulationEventType` 联合类型 |
| 8 | **Worker 回调参数类型为 any** | `engine/Simulation.ts` 构造函数 | `onFrameUpdate`/`onStats`/`onEvent` 回调全是 `(p: any) => void`，丢失了 `FrameUpdatePayload` 等类型安全 |

### 🟡 P1 — 代码质量（5 个）

| # | 问题 | 影响 |
|---|------|------|
| 1 | **canvasStore 用 `Object.assign` 更新嵌套对象** | 嵌套属性变更不触发 Pinia 细粒度响应，依赖 `version++` 全量刷新，性能浪费 |
| 2 | **SelectionManager 用 `as any` 强转** | 修补 transfer/forklift 的 `{x, y, rotation}` 时类型不匹配，掩盖类型错误 |
| 3 | **GridLayer 绘制固定 ±10000px 区域** | 不随视口动态调整，缩放时可能过密/过疏，浪费渲染 |
| 4 | **UPDATE_TOPOLOGY 重置整个仿真** | 运行中修改拓扑会丢失所有运行时状态，而非增量更新 |
| 5 | **批量运行部分阻塞 UI** | `runBatch()` 主线程 `setInterval` 运行仿真，多轮时可能掉帧 |

### 🟢 P2 — UX 缺陷（6 个）

| # | 问题 | 影响 |
|---|------|------|
| 1 | **属性面板无输入校验** | 速度/长度可设为 0 或负数，破坏仿真 |
| 2 | **无"适应视图"按钮** | 用户需手动平移/缩放找回组件 |
| 3 | **仿真错误无用户反馈** | tick 异常只 console.log，UI 无提示 |
| 4 | **双向输送机/逆流无视觉区分** | `_reverseFlow` 托盘在画布上与正常托盘外观一样 |
| 5 | **叉车仿真时无动画/冷却指示** | 发生器/消费者运行时视觉静止，无节奏感 |
| 6 | **路由表操作语义不清** | "直行/转弯" 与实际端口方向(N/S/E/W)映射关系不直观 |

### 🔵 P3 — 功能增强（4 个）

| # | 方向 | 价值 |
|---|------|------|
| 1 | **复制/粘贴组件** | 当前只有删除和旋转，无法快速复制同类组件 |
| 2 | **仿真速度 >4x** | 目前上限 4x，长时间仿真等待太久，建议支持 8x/16x/Max（跳帧渲染） |
| 3 | **仿真运行时拓扑热更新** | 允许暂停→调整→继续，而非完全重启 |
| 4 | **单元测试** | 零测试覆盖，引擎逻辑无保障 |

---

## 二、迭代计划

### Phase 1：Bug 修复（预计 5 个变更）

| 步骤 | 变更 | 验证方式 |
|------|------|----------|
| 1.1 | 删除 `PalletGraphic.ts` 死代码 | 编译通过，运行无回归 |
| 1.2 | PalletLayer 增加移载机/叉车内托盘渲染 | 仿真时托盘全程可见 |
| 1.3 | CanvasManager 补全移载机/叉车选中高亮 | 点击任一组件均有高亮框 |
| 1.4 | ForkliftGraphic.draw() 修复：重绘前销毁旧 Text | 反复切换叉车属性，观察无内存增长 |
| 1.5 | SnapManager/CanvasStore 连线操作补全 `pushUndoSnapshot()` | 连线后 Ctrl+Z 可撤销 |

**依赖**：无，可立即执行
**风险**：低，纯修补

---

### Phase 2：类型安全 & 端口语义（预计 3 个变更）

| 步骤 | 变更 | 验证方式 |
|------|------|----------|
| 2.1 | Forklift 端口重命名：consumer 的 `output` → `input`，同步修改 SnapManager/Engine/测试电路 | 连线验证：发生器 output→输送机 input，输送机 output→消费者 input，语义清晰 |
| 2.2 | Simulation 构造函数回调 + emitEvent 参数改为强类型 | TypeScript 编译无 any 警告 |
| 2.3 | SelectionManager 消除 `as any`：为 Transfer/Forklift 类型补 `x, y` 字段或用 Pick 类型 | 无 any 断言，编译通过 |

**依赖**：Phase 1.5（端口重命名涉及连线逻辑）
**风险**：中，2.1 需同步修改多处，需仔细测试连线+仿真

---

### Phase 3：UX 修补（预计 4 个变更）

| 步骤 | 变更 | 验证方式 |
|------|------|----------|
| 3.1 | PropertyPanel 数值输入增加 min/max 校验（速度≥0.1, 长度≥0.5, 间隔≥0.5 等） | 输入非法值被拒绝或钳制 |
| 3.2 | 工具栏增加"适应视图"按钮（zoom-to-fit 所有组件） | 点击后画布自动居中显示全部组件 |
| 3.3 | 仿真异常时 UI Toast 提示 | 模拟引擎错误，界面弹提示而非静默 |
| 3.4 | 逆流托盘视觉区分（如添加方向箭头或不同色调） | 双向输送机逆流托盘可识别 |

**依赖**：Phase 2（类型安全到位后改 UI 更放心）
**风险**：低

---

### Phase 4：功能增强（预计 4 个变更，按优先级排序）

| 步骤 | 变更 | 验证方式 |
|------|------|----------|
| 4.1 | 仿真速度扩展：8x / 16x / Max（跳帧渲染，每 N tick 刷一帧） | 切换到 16x 仿真加速明显，画布不卡 |
| 4.2 | Ctrl+C/V 复制粘贴选中组件 | 选中→复制→粘贴→新组件出现，连接关系可选是否复制 |
| 4.3 | 叉车仿真动画（冷却进度条/脉冲效果） | 仿真时叉车有节奏视觉反馈 |
| 4.4 | 引擎核心逻辑单元测试（ZPA 推进、路由表、正态分布生成） | 覆盖关键路径，CI 可跑 |

**依赖**：Phase 3
**风险**：中，4.1 跳帧逻辑需仔细设计避免数据丢失

---

## 三、排除项（明确不做）

- 不做架构大重构（如替换 PixiJS、迁移到 Canvas 2D 原生）
- 不做多人协作/云端保存
- 不做 3D 视图
- 不做实时拓扑热更新（复杂度高，收益不确定，留作远期考虑）

---

## 四、执行原则

1. **保守稳定优先**：Bug → 代码质量 → UX → 功能增强
2. **每阶段独立可验证**：阶段结束确认无回归后进入下一阶段
3. **范围可控**：每阶段变更数量有限，不跨阶段混合
4. **依赖感知排序**：后续阶段依赖前序阶段的产出
