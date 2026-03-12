# 安装

使用您喜欢的包管理器安装 Semantic-TypeScript：

::: code-group

```bash [npm]
npm install semantic-typescript
```

```bash [yarn]
yarn add semantic-typescript
```

```bash [pnpm]
pnpm add semantic-typescript
```

```bash [bun]
bun add semantic-typescript
```

:::

## 系统要求

- **TypeScript**: 5.0 或更高版本
- **Node.js**: 18.0 或更高版本（需要 ES2022 支持）

## TypeScript 配置

确保您的 `tsconfig.json` 包含以下设置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## 导入

您可以从主包导入函数：

```typescript
import {
  useOf,
  useFrom,
  useRange,
  useWindow,
  useHTMLElement,
  useWebSocket,
} from "semantic-typescript";
```

## 下一步

- [快速开始](./quick-start.md) - 从基本示例开始
