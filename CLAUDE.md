# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**semantic-typescript** 是一个现代化的类型安全流处理库，灵感来自 JavaScript Generator、Java Stream 和 MySQL Index。它通过智能索引而非暴力迭代来构建高效的数据处理管道。

## 核心架构

### 双模式设计

项目采用**双模式架构**，同步和异步流处理分离但 API 统一：

1. **`AsynchronousSemantic<E>`** - 异步流处理核心类
   - 用于事件流、WebSocket、DOM 监听器、长时间运行或无限流
   - 基于 `AsynchronousGenerator<E>` 类型
   - 所有中间操作返回新的 `AsynchronousSemantic` 实例

2. **`SynchronousSemantic<E>`** - 同步流处理核心类
   - 用于静态数据、范围、立即迭代
   - 基于 `SynchronousGenerator<E>` 类型
   - 所有中间操作返回新的 `SynchronousSemantic` 实例

### 关键设计模式

**生成器模式**：
- 流不立即执行，而是返回一个生成器函数
- 生成器接受两个回调：`accept(element, index)` 和 `interrupt(element, index)`
- 数据仅在消费者需要时才通过 `accept` 回调传递
- 每个元素自动携带 `bigint` 类型的索引

**收集器模式**：
- 终端操作前必须转换为收集器：`.toUnordered()` 或 `.toOrdered()`
- `.toUnordered()` - O(n) 时间/空间，基于 Map，不排序
- `.toOrdered()` - O(2n) 时间/空间，保持索引顺序
- 统计收集器：`.toNumericStatistics()` 和 `.toBigIntStatistics()`

## 模块结构

```
src/
├── factory.ts           # 工厂函数（useOf, useFrom, useRange 等）
├── asynchronous/
│   ├── semantic.ts      # AsynchronousSemantic 类实现
│   └── collector.ts     # 异步收集器实现
├── synchronous/
│   ├── semantic.ts      # SynchronousSemantic 类实现
│   └── collector.ts     # 同步收集器实现
├── guard.ts             # 类型守卫（isXxx 函数）
├── utility.ts           # 类型定义和工具函数
├── hook.ts              # 工具函数（useCompare, useStringify 等）
├── symbol.ts            # Symbol 定义
├── hash.ts              # 哈希函数
└── optional.ts          # Optional 类型实现
```

## 开发命令

```bash
# 构建项目
npm run build

# 发布前构建
npm run prepublishOnly

# TypeScript 编译
tsc
```

**注意**：项目没有配置测试框架。所有源代码位于 `src/` 目录，编译输出到 `dist/` 目录。

## TypeScript 配置

- **目标**: ES2022
- **模块**: ESNext
- **编译输出**: `./dist` 目录
- **类型定义**: 自动生成 `.d.ts` 文件
- **严格模式**: 启用
- **未使用检查**: 启用（`noUnusedLocals`, `noUnusedParameters`）

## 重要使用规则

### 事件流管理

事件流（`useWindow`, `useHTMLElement`, `useWebSocket` 等）**必须**使用限制操作来防止内存泄漏：

```typescript
// ✅ 正确：使用 limit/sub/takeWhile 限制
useWindow("resize")
  .limit(5n)          // 必须！
  .toUnordered()
  .forEach(callback);

// ❌ 错误：没有限制会导致内存泄漏
useWindow("resize")
  .toUnordered()
  .forEach(callback);
```

### 终端操作

终端操作**必须**在转换为收集器后调用：

```typescript
// ✅ 正确：先转换再操作
useOf(1, 2, 3)
  .toUnordered()   // 必须！
  .toArray();

// ❌ 错误：直接调用终端操作
useOf(1, 2, 3)
  .toArray();      // 编译错误
```

### 类型安全

项目使用严格的 TypeScript 类型系统：
- 所有函数都有完整的类型注解
- 使用 `bigint` 作为索引类型（而非 `number`）
- 泛型约束确保类型安全
- 使用 Symbol 进行运行时类型检查

## 工厂函数

`factory.ts` 提供所有入口函数：

- **数据源**: `useOf()`, `useFrom()`, `useRange()`
- **DOM 事件**: `useWindow()`, `useDocument()`, `useHTMLElement()`
- **网络**: `useWebSocket()`
- **文本**: `useText()`, `useStringify()`
- **工具**: `useCompare()`, `useToNumber()`, `useToBigInt()`, `useTraverse()`

## 性能特征

| 收集器 | 时间复杂度 | 空间复杂度 | 排序 | 适用场景 |
|--------|-----------|-----------|------|---------|
| `toUnordered()` | O(n) | O(n) | 否 | 性能关键路径 |
| `toOrdered()` | O(2n) | O(n) | 是 | 需要稳定排序 |
| `toNumericStatistics()` | O(2n) | O(n) | 是 | 数值统计 |
| `toBigIntStatistics()` | O(2n) | O(n) | 是 | 大整数统计 |

## 代码风格

- **函数命名**: 使用 `use` 前缀（如 `useOf`, `useFrom`）
- **类型定义**: 集中在 `utility.ts`
- **类型守卫**: 使用 `is` 前缀（如 `isNumber`, `isBigInt`）
- **Symbol**: 用于品牌类型和运行时类型检查
- **不可变性**: 所有操作返回新实例，不修改原数据
