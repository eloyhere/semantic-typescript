# Semantic-TypeScript 文档

基于 VitePress 的多语言文档站点。

## 文档结构

```
docs/
├── .vitepress/
│   └── config.mts          # VitePress 配置
├── guide/                  # 指南文档（英文）
│   ├── about.md
│   ├── installation.md
│   ├── quick-start.md
│   ├── core-concepts.md
│   ├── important-rules.md
│   ├── performance.md
│   ├── comparison.md
│   ├── changelog.md
│   └── faq.md
├── api/                    # API 文档（英文）
│   ├── index.md
│   ├── factory-functions.md
│   ├── asynchronous-semantic.md
│   ├── synchronous-semantic.md
│   ├── collectors.md
│   ├── type-guards.md
│   ├── utilities.md
│   └── optional.md
├── cn/                     # 中文文档
│   ├── guide/
│   └── api/
├── public/                 # 静态资源
└── index.md               # 首页
```

## 支持的语言

- 🇺🇸 English (en)
- 🇨🇳 简体中文 (cn)
- 🇹🇼 繁體中文 (tw)
- 🇩🇪 Deutsch (de)
- 🇪🇸 Español (es)
- 🇫🇷 Français (fr)
- 🇯🇵 日本語 (jp)
- 🇰🇷 한국어 (kr)
- 🇷🇺 Русский (ru)

## 本地开发

1. 安装依赖：
```bash
npm install
```

2. 启动开发服务器：
```bash
npm run docs:dev
```

3. 打开浏览器访问 `http://localhost:5173`

## 构建

构建生产版本：

```bash
npm run docs:build
```

构建输出将在 `docs/.vitepress/dist` 目录中。

## 预览构建

预览生产构建：

```bash
npm run docs:preview
```

## 添加新内容

### 添加新的指南页面

1. 在 `docs/guide/` 或 `docs/cn/guide/` 中创建新的 Markdown 文件
2. 在 `.vitepress/config.mts` 中更新侧边栏配置

### 添加新的 API 页面

1. 在 `docs/api/` 或 `docs/cn/api/` 中创建新的 Markdown 文件
2. 在 `.vitepress/config.mts` 中更新侧边栏配置

### 添加新语言

1. 在 `docs/` 下创建新的语言目录（例如 `docs/de/`）
2. 复制并翻译所需的文件
3. 在 `.vitepress/config.mts` 中添加新的语言配置

## 文档编写

### Markdown 扩展

VitePress 支持：
- ✅ GitHub Flavored Markdown
- ✅ 语法高亮
- ✅ 自定义容器
- ✅ emoji 快捷方式
- ✅ 目录（TOC）

### 自定义容器

使用提示框：

```markdown
::: tip 提示
这是一个提示
:::

::: warning 警告
这是一个警告
:::

::: danger 危险
这是一个危险警告
:::

::: info 信息
这是一个信息框
:::
```

### 代码组

展示多个代码示例：

```markdown
::: code-group

```bash [npm]
npm install semantic-typescript
```

```bash [yarn]
yarn add semantic-typescript
```

:::
```

## 相关资源

- [VitePress 官方文档](https://vitepress.dev/)
- [项目 README](../README.md)
- [GitHub 仓库](https://github.com/your-username/semantic-typescript)
