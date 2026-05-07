# ConveySim 项目记忆

## 项目概况
- **名称**: ConveySim — 物流输送线模拟器
- **技术栈**: Vue 3 + Pinia + PixiJS v7.4 + TypeScript + Vite
- **架构**: 单页应用，无路由，条件弹窗
- **仿真引擎**: Web Worker 独立线程 + 主线程回退双模式
- **持久化**: localStorage（场景库 + 草稿）+ JSON 导入导出

## 核心模块
- `src/engine/Simulation.ts` — 仿真核心（4 阶段 tick：发生器→移载机→输送机ZPA→统计）
- `src/canvas/CanvasManager.ts` — 渲染编排（Grid→Conveyor→Component→Connection→Pallet→Heatmap→RubberBand）
- `src/stores/canvasStore.ts` — 场景数据（CRUD + 撤销快照）
- `src/stores/simulationStore.ts` — 仿真状态（Worker 生命周期 + 批量运行）

## 代码特征
- 版本号字段 `version` 用于驱动响应式刷新（弥补 Object.assign 嵌套对象响应性不足）
- 撤销采用 JSON 快照方式（最多 50 步）
- 批量运行在主线程通过 await + setTimeout 让步执行
- 自动连线阈值 SNAP_THRESHOLD=20px
- 像素比例 PIXELS_PER_METER=50

## 已知问题（截至 2026-05-07 分析）
- PalletGraphic.ts 是死代码
- 托盘在移载机/叉车内不可见
- 选中高亮只对输送机生效，移载机和叉车未实现
- 叉车每次重绘创建新 Text 对象导致内存泄漏
- 连线操作撤销快照不一致
- 属性面板无输入校验
- 无单元测试
