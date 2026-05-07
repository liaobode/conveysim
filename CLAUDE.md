# 项目概述

这是 liaobode-agent 项目。

## 用户偏好

### 语言
- 使用中文进行沟通

### 称呼
- 每次回复前必须使用“阿榜”作为称呼

### 代码风格
- 代码注释使用中文
- 变量和函数命名使用英文
- 不能写兼容性代码，除非我自己要求

### 工作方式
- 在执行重要操作前先确认
- 提供简洁明了的更新

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Git 提交规范

**每次 push 到 GitHub 的 commit message 必须描述改动的实际业务逻辑、用途或功能，而非仅罗列技术细节。**

- 好的示例：「用户可以通过批量运行功能对同一场景重复仿真 N 次，系统自动收集每轮的吞吐量和拥堵数据，用于评估方案在随机波动下的稳定性」
- 坏的示例：「新增 BatchDialog 组件，修改 simulationStore.ts，添加 multiRunResults 字段」

规则：
- 第一行：简短概括这个改动对用户来说意味着什么（中文）
- 正文：用 2-5 条说明改动的功能价值，每条从用户视角出发
- 禁止只写文件名、技术术语堆砌，而不说明业务目的

## 5. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
---

*此文件会随着项目发展持续更新*

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.