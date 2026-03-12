# Installation

Install Semantic-TypeScript using your preferred package manager:

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

## Requirements

- **TypeScript**: 5.0 or higher
- **Node.js**: 18.0 or higher (ES2022 support required)

## TypeScript Configuration

Ensure your `tsconfig.json` includes the following settings:

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

## Importing

You can import functions from the main package:

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

## Next Steps

- [Quick Start](./quick-start.md) - Get started with basic examples
- [Core Concepts](./core-concepts.md) - Understand the fundamental concepts
