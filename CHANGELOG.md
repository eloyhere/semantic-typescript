# 更新日志

本文件记录 `semantic-typescript` 的重要变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.1.0] - 2026-09-11

本次发布是一次**全面缺陷修复**：修复了 1.0.0 中 16 项阻断级缺陷（含"发布包在 Node 中无法 import"、
"索引重排全部失效"、"异步链路返回空或永久挂起"），并首次引入回归测试。
其中 3 个工厂函数的返回类型有变更，升级前请先阅读「行为变更」一节。

### 行为变更（Breaking Changes）

- **`useBlob(...)` 返回 `AsynchronousSemantic`**（原 `SynchronousSemantic`）。
  Blob 读取本身是异步的，返回同步语义会让同步收集器拿到空数组。
- **`useInterval(...)` 返回 `AsynchronousSemantic`**（原 `SynchronousSemantic`）。
  数据由定时器产生，同步收集器会在第一个 tick 之前结束收集。
- **`useFrom(AsyncIterable)` 返回 `AsynchronousSemantic`**（原 `SynchronousSemantic`）。
  原实现会静默返回 `[]`。
- **`translate(offset)` 改为循环平移语义**：与 README 示例 5（正数右旋、负数左旋）一致。
  数值重载需要知道流长度，因此会先物化整条流；函数式重载 `translate(mapper)` 仍保持逐元素惰性映射。
- **`partition(count)` 语义明确为"按元素索引轮转分桶"**，等价于 `partitionBy((_element, index) => index % count)`。
- **`shuffle()` 改为真正的随机洗牌**：原实现按元素哈希分配索引，同一输入每次运行结果完全一致。

### 修复（Fixed）

**打包与工程**

- 修复发布产物在 Node 中无法加载的问题：`tsconfig` 改用 `module/moduleResolution: NodeNext`，
  并为源码内 60 处相对导入补全 `.js` 扩展名。此前 ESM 与 CJS 消费者都会直接抛 `ERR_MODULE_NOT_FOUND`，只有打包器能解析。
- `engines.node` 由 `>=14.0.0` 修正为 `>=18.17.0`（构建目标为 ES2022，类型中使用了 `Blob` / `WritableStream`）。
- 补上 `devDependencies.typescript`：此前新克隆的仓库执行 `npm run build` 必然失败。

**索引与收集器**

- 修复 `toOrdered()` 丢失元素真实索引的问题（原来用数组下标伪造索引），
  `redirect` / `reverse` / `translate` / `shuffle` 现在都能正确重排。
- 新增 `toOrdered(comparator)` 重载；传入比较器时按值排序并将索引重排为顺序位（统计类依赖该语义）。
- 无序收集器遇到重复索引时改用兜底键，不再静默丢弃数据（例如 `useText("a,b,c", ",")` 曾只返回 `["c"]`）。

**异步链路**

- 修复异步有序收集器在构造期把 `buffer` 定义为只读属性、导致 `then` 回调赋值抛 `TypeError` 的问题
  （表现为 `toOrdered()` / 统计类返回空数组，或 `.summate()` 永久挂起）。
- 修复 `source()` 未等待数据就绪即 `resolve()` 的问题（`useInterval` 因此恒为空）。
- 新增 `settled()`：`findFirst` / `findLast` / `findAny` / `findAt` / `findMaximum` / `findMinimum`
  在流未完成或空流时会正确等待或 `reject`，不再永久挂起。
- `findMaximum` / `findMinimum` 无比较器时改为按元素值比较（原来按索引比较）。

**终止操作**

- 修复 `findFirst` / `findLast` / `findAny` / `findMaximum` / `findMinimum` 恒返回空值的问题。
- 修复 `reduce(accumulator)`（无初值重载）恒返回空 Optional 的问题。
- 连带修复 `numericStatistics.range()` 因依赖 `findFirst` / `findLast` 而恒返回 `0` 的问题。
- 修复 `nonMatch()` 结果完全颠倒的问题（收集器 finisher 多做了一次取反）。

**算子与工厂函数**

- `partition`：修复首元素即 `RangeError: Division by zero`。
- `partitionBy`：修复使用元素下标而非分类结果导致的 `TypeError`。
- `sub(start, end)`：修复计数死锁导致永远不产出元素。
- `useGenerate(supplier, interrupt)`：修复第二个参数被同名形参遮蔽、判断条件完全失效的问题。
- `useIterate`：修复异步迭代器只产出第一个元素（多余的 `break`）以及索引不自增的问题。
- `useText`：补齐单参数重载（按 Unicode 码点切分，emoji 正确）；修复分隔符分支索引不自增导致的静默丢数据。
- `useStringify`：修复 replacer 内部重复递归序列化、遇到循环引用直接抛 `TypeError` 的问题。
- `useRandom`：修复大整数区间约 15/16 概率死循环的问题（拒绝采样复用了同一个随机数）；
  并修复随机大整数低 3 位恒为 0、`useRandom(1n, 10n)` 只会返回 `1` 或 `9` 的分布退化。
- `useBlob`：修复所有分块指向同一块被就地覆写的缓冲区（数据互相覆盖）的问题。
- `useInterval`：修复中断判断晚于 `accept` 导致漏出越界元素的问题。
- `useSubscription`：修复边界触发时重复 `unsubscribe` 的问题。
- `toWindow().slide()` / `tumble()`：修复在异步流上切出 0 个窗口的问题（切窗直接读取了尚未就绪的缓冲区）。

**统计**

- 修复数值峰度公式（由 `sum(z⁴)/n² - 3` 修正为 `sum(z⁴)/n - 3`）：`[1,2,3,4]` 的结果由 `-2.59` 修正为 `-1.36`。
- 修复大整数统计：`standardDeviation` / `skewness` / `kurtosis` 因 `BigInt(Math.sqrt(...))` 遇到非整数平方根而抛错；
  方差/标准差还受整数除法截断（`[1,2,3,4]` 的方差被算成 `3`）。
  现改为用浮点计算统计量后四舍五入回 `bigint`，与数值版语义一致。

**其他**

- 修复 `useHash` / `register` / `unregister` / `maskOf` 未被导出（`src/index.ts` 漏了 `./hash`）的问题。
- 修复同步/异步统计 Symbol 复用同一 `Symbol.for` 键、以及两处守卫函数字段名拼写错误
  （`isSynchronousNumericStatistics` 曾对数字统计对象返回 `false`）。
- 修复 `useTraverse` 的 `path` 只 `push` 不 `pop`，导致路径跨兄弟节点累积。
- 哈希原始值缓存增加上限（超过 10 万条清空），避免长跑进程持续泄漏。

### 新增（Added）

- **回归测试**：`test/semantic.test.mjs`，55 项断言，覆盖全部已修缺陷、正常路径、窗口算子与异步链路。
  使用 Node 内置 `node:test`，零新增运行时依赖。
- **`npm test`**：`npm run build && node --test`，可直接接入 CI。
- **`CHANGELOG.md`**：本文件。
- **`FIXES.md`**：逐条修复说明，包含根因、破坏性变更清单与后续排期建议。

### 变更（Changed）

- `package.json` 增加 `"sideEffects": false`，便于打包器做 tree-shaking。
- 构建产物 `dist/` 加入 `.gitignore`（发布时由 `prepublishOnly` 自动构建）。

### 致谢

感谢 issue 区 `#1` ~ `#5` 的反馈，本次修复采纳了其中关于构建产物、命名与可扩展性的判定，
并保留在后续排期（详见 `FIXES.md` 第四节）。

---

## 历史版本说明

- **[1.0.0] - 2026-04-07**：npm 上此前的最新版本。需要说明的是，该版本存在文中列出的 16 项阻断级缺陷，
  **建议直接升级到 1.1.0**。此外该版本发布时仓库 `package.json` 停留在 `0.7.1`，仓库状态与线上产物一度脱节。
- **0.6.0 及更早**：`0.6.0` 之前的全部版本已在 npm 上标记 deprecated
  （`< 0.5.0` 缺事件流 API，`0.5.x` 存在循环依赖问题）。
- 仓库此前没有 git tag，`.github/workflows/publish.yml` 以 `v*` 标签触发；本次发布补齐了 `v1.1.0` 标签。

[1.1.0]: https://github.com/eloyhere/semantic-typescript/releases/tag/v1.1.0
[1.0.0]: https://www.npmjs.com/package/semantic-typescript/v/1.0.0
