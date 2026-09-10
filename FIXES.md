# FIXES.md — 缺陷修复说明

本文件记录针对评审报告（`.workbuddy/review/semantic-typescript-review.html`）中缺陷的修复内容。
所有修复均有回归测试覆盖：**55 项测试全部通过**（`npm test`）。

```
# 验证方式
npm install        # devDependencies 已补上 typescript
npm test           # 先 tsc 构建，再用 node:test 跑 52 项端到端测试
```

消费者侧也已实测：`npm pack` → 装进空项目 → `import`（ESM）与 `require`（CJS）均可正常加载。

---

## 一、破坏性变更（升级前请留意）

| 变更 | 原行为 | 现行为 | 原因 |
| :--- | :--- | :--- | :--- |
| `useBlob(...)` 返回类型 | `SynchronousSemantic` | **`AsynchronousSemantic`** | 读取 Blob 本身是异步的，同步收集器会得到空数组 |
| `useInterval(...)` 返回类型 | `SynchronousSemantic` | **`AsynchronousSemantic`** | 数据由定时器产生，同步收集器恒为空 |
| `useFrom(AsyncIterable)` 返回类型 | `SynchronousSemantic` | **`AsynchronousSemantic`** | 同步收集器会在数据到达前结束，静默返回 `[]` |
| `toOrdered(comparator)` | 不接受比较器（传了也被忽略） | 新增重载 | 与 `SynchronousOrderedCollectable` 构造器保持一致 |
| `partition(count)` 语义 | 首元素即抛 `RangeError` | 按**元素索引轮转**分入 `count` 个桶 | 等价于 `partitionBy((_e, index) => index % count)`，已在代码注释中写明 |
| `shuffle()` 语义 | 按元素哈希（结果恒定） | 每次调用分配随机索引，产生真正的随机置换 | README 示例 4 承诺"随机" |
| `translate(offset)` 语义 | 索引整体平移（`toOrdered` 后无效果） | **循环平移**（先物化整条流，按 `(position + offset) mod n` 分配索引） | 与 README 示例 5 的"正数右旋"一致；注意数值重载会物化流 |
| `nonMatch(...)` 结果 | 完全颠倒（全部不匹配时返回 `false`） | 修正为正确语义 | 收集器 finisher 多做了一次取反 |

> `translate` 的数值重载会先物化整条流（循环平移必须知道长度），函数式重载 `translate(mapper)` 仍是逐元素惰性映射。

---

## 二、逐条修复

### P0-1 发布包在 Node 中无法 import（阻断性）

* **根因**：`tsconfig` 用 `module: "ESNext"` + `moduleResolution: "bundler"`，产物保留了无扩展名相对导入。
* **修复**：改为 `module: "NodeNext"` + `moduleResolution: "NodeNext"`，并为 `src` 下 **60 处**相对导入补全 `.js` 扩展名。
* **顺带**：`engines.node` 由 `>=14.0.0` 修正为 `>=18.17.0`（target ES2022 + 类型里用到 `Blob`/`WritableStream`）；新增 `sideEffects: false` 支持 tree-shaking；补 `devDependencies.typescript`（原来 `npm run build` 在新克隆上必失败）。
* **涉及**：`tsconfig.json`、`src/**/*.ts`（导入路径）、`package.json`

### P0-2 索引重排被收集器丢弃

* **根因**：`toOrdered` 先调用 `useSynchronousToArray()` 收集（该累加器签名是 `(array, element)`，**不接收 index**），再用 `map((element, index) => ({ index: BigInt(index) }))` 用数组下标伪造索引。
* **修复**：新增保留索引的收集器 `useSynchronousToIndexedArray` / `useAsynchronousToIndexedArray`，`toOrdered` 默认按元素真实索引排序；传入比较器时仍按值排序并重排索引（统计类依赖该语义）。
* **效果**：`redirect` / `reverse` / `translate` / `shuffle` + `toOrdered` 全部生效。
* **涉及**：`src/synchronous/collector.ts`、`src/synchronous/semantic.ts`、`src/asynchronous/collector.ts`、`src/asynchronous/semantic.ts`

### P0-3 异步链路整条坏死

* **根因 1**：`AsynchronousOrderedCollectable` 构造期就把 `buffer` 定义成 `writable: false`，`then` 回调里赋值抛 `TypeError` → unhandled rejection、缓冲区永远为空、`toOrdered`/统计类返回空或永久挂起。
  **修复**：移除只读的 `buffer` 属性定义；`complete` 标志改为在通知监听者**之前**置位。
* **根因 2**：`AsynchronousOrderedCollectable.source()` 在未完成时只注册监听器就立刻 `resolve()`，调用方拿到空数组（`useInterval` 因此恒为 `[]`）。
  **修复**：改为在监听回调内 emit 完再 `resolve()`，并补齐 `reject` 分支。
* **根因 3**：`find*` 系列在未完成时只注册监听器、空流或不命中索引时不 settle → 永久挂起。
  **修复**：新增 `settled()` 先等待收集完成；`findAt`/`findAny`/`findFirst`/`findLast` 补 `reject` 分支；`findMaximum`/`findMinimum` 无比较器时改为按**元素值**比较（原来按索引比较，对 `toOrdered` 的索引序缓冲毫无意义）；`findMaximum`/`findMinimum` 不再原地 `sort` 冻结数组。
* **根因 4**：`useFrom(AsyncIterable)` 返回同步语义（见破坏性变更）。
* **涉及**：`src/asynchronous/semantic.ts`、`src/factory.ts`

### P0-4 find* / reduce 恒返回空

* **根因**：累加器条件写成"要求累加器已有值才写入"，而初值是 `Optional.empty()`，且 interrupt 在有值时立即停止 → 永远写不进第一个值。
* **修复**：`findFirst`/`findAny`/`findLast`/`findMaximum`/`findMinimum`（同步侧）与 `reduce`（无初值重载，同步 + 异步）改为"空则写入、有值则保留/归约"。
* **连带收益**：`SynchronousNumericStatistics.range()` 依赖 `findFirst/findLast`，现在返回正确值。
* **涉及**：`src/synchronous/collector.ts`、`src/asynchronous/collector.ts`

### P0-5 partition / partitionBy 抛异常

* `partition`：`limited % BigInt(array.length)` 在首元素时除零 → 改为按索引轮转分桶。
* `partitionBy`：`array[Number(index)]` 用错下标 → 改为分类结果 `Number(resolved)`，并处理负值。

### P0-6 sub() 永不产出

* **根因**：`count` 只在 `accept` 分支自增，而进入该分支的条件又是 `minimum <= count`，形成死锁。
* **修复**：`count` 改为统计上游第几个元素。

### P0-7 useStringify 循环引用抛错

* **根因**：replacer 内部再次调用 `JSON.stringify(value)`，等于序列化过程中重复递归。
* **修复**：replacer 原样返回值（对象重复引用返回 `undefined` 以丢弃），只由最外层做一次编码；回调不再作用于根节点（否则整份文档会被替换成回调对根对象的返回值）。

### P0-8 useRandom 大整数死循环 + 分布退化

* **根因 1**：`do { ... } while (result >= range)` 复用同一个随机数，条件恒真 → 死循环。
  **修复**：改为标准拒绝采样（掩码由 `bound` 推出，每轮重新取随机数）。
* **根因 2**：`getRandomBigInt` 每个分片都至少左移 3 位 → 结果低 3 位恒为 0，`useRandom(1n, 10n)` 只会返回 `1` 或 `9`。
  **修复**：改为按 53 位一段拼接。实测 9000 次调用在 1..9 上均匀分布（每档约 1000 次）。

### P0-9 useBlob 缓冲区复用

* **根因**：所有分块都指向同一个被就地覆写的 `Uint8Array`。
* **修复**：每个分块用 `buffer.slice(...)` 拷贝后交付。实测三块内容独立、非同一对象。

### P0-10 useText

* 补齐单参数重载 `useText(text)`：按 Unicode 码点切分（emoji 正确），原来该写法直接抛 `TypeError`。
* 分隔符分支补上缺失的 `index++`：原来所有分片索引都是 `0n`，无序收集器（Map 按索引存储）会静默丢数据，`"a,b,c"` 只剩 `"c"`。

### P0-11 大整数统计

* **标准差**：`BigInt(Math.sqrt(...))` 遇到非整数平方根抛 `RangeError`，且方差本身被整数除法截断。
* **修复**：方差 / 标准差 / 偏度 / 峰度改为**浮点计算统计量后四舍五入回 bigint**，与数值版语义一致。
  `[1n,2n,3n,4n]`：方差 `1n`（精确 1.25）、标准差 `1n`（精确 1.118）、偏度 `0n`、峰度 `-1n`（精确 −1.36），不再抛错。
* **数值版峰度公式**：`sum(z^4)/(n*n) - 3` → `sum(z^4)/n - 3`（`[1,2,3,4]` 由 −2.59 修正为 −1.36）。

### P0-12 useIterate 只吐第一个元素

* 删除 `accept` 之后多余的 `break;`，并补上缺失的 `index++`。

### P0-13 useInterval 是死代码

* 修正"先 `clearInterval` 却仍 `accept`"的越界泄漏，并在中断时 `resolve()`。
* 返回类型改为 `AsynchronousSemantic`（见破坏性变更）。实测 `useInterval(1).limit(3n).toOrdered().toArray()` → `[0,1,2]`。

### P0-14 哈希模块未被导出

* `src/index.ts` 补 `export * from "./hash.js";`，`useHash` / `register` / `unregister` / `maskOf` 对外可用。

### P0-15 shuffle 不是洗牌

* 由"按元素哈希排序（结果恒定）"改为每次调用分配随机索引。

### P0-16 品牌校验与 Symbol 复键

* `symbol.ts`：`SynchronousStatisticsSymbol` 等三个同步 Symbol 不再复用异步键，去掉多余的 `"Symbol"` 后缀。
* `guard.ts`：修正两处字段名拼写（`isAsynchronousNumericStatistics` 读成了 BigInt 字段；`isSynchronousNumericStatistics` 读成了 `Asynchronous` 前缀）。实测 `isSynchronousNumericStatistics(useOf(1,2,3).toNumericStatistics())` 由 `false` 修正为 `true`。

### 其他（P1 / P2）

| 问题 | 修复 |
| :--- | :--- |
| `useGenerate(supplier, interrupt)` 的第二个参数被同名形参遮蔽、完全失效 | 重命名形参，用户谓词与下游中断同时生效 |
| `useSubscription` 边界处重复 `unsubscribe` | 退订后 `clear()` 订阅表，实测订阅 1 次 / 退订 1 次 |
| `hash` 原始值缓存无上限（长跑进程泄漏） | 超过 10 万条整体清空 |
| `hash` 按引用缓存 `path`（path 数组被复用后命中脏数据） | 改为每次重算 |
| `useTraverse` 的 `path` 只 `push` 不 `pop` | 改为成对 push/pop，路径不再跨兄弟节点累积 |
| `toWindow().slide()` / `tumble()` 在异步流上切出 0 个窗口（切窗读取了未就绪的缓冲区） | 切窗前先等待收集完成（`settled()`）；同时修正形参拼写 `accepet` |
| `Object.freeze(this.complete)`（冻结布尔量，无操作） | 删除 |
| `nonMatch` 结果颠倒（测试发现，评审报告未列出） | finisher 不再二次取反 |

---

## 三、新增工程能力

* **回归测试**：`test/semantic.test.mjs`，55 项断言，覆盖全部已修缺陷 + 正常路径 + 窗口算子 + 异步链路，零新增运行时依赖（使用 Node 内置 `node:test`）。
* **`npm test`**：`npm run build && node --test`，在 CI 中可直接复用。
* **`devDependencies`**：补上 `typescript ~5.9.3`，新克隆的仓库现在可以 `npm install && npm run build`。
* **`package.json`**：`sideEffects: false`、`engines >= 18.17.0`、版本号由 `0.7.1`（与 npm 上 1.0.0 脱节）统一为 `1.0.1`。

---

## 四、本次未处理（建议后续单独排期）

1. **同步 / 异步双份实现合并**：约 7800 行里存在近乎逐字重复的两套算子实现，任何修复都要改两遍。建议抽公共核心，把行数压到 3500 行以内。
2. **CJS 双产物**：目前 `require` 条件指向 ESM 文件（Node ≥22.12 可用，老版本 Node 不可用）。建议按 issue #3 接入 `tsup` 输出 esm + cjs + types。
3. **Node / Browser 类型分离**：`.d.ts` 中 `WritableStream` 出现 46 次、`Blob` 5 次，非 DOM 的 Node 工程会因缺 `lib.dom` 报类型错（issue #4）。
4. **命名体系重构**（issue #2）：`useXxx` 被用在算子、收集器、比较器、工具函数等所有层级上，属破坏性改名，建议 2.0 再动。
5. **可扩展算子**（issue #5）、**VitePress 文档站与 9 语言 README 收敛**（issue #3）。
6. **统计口径文档化**：`median()`（插值）与 `quantile()`（最近秩）目前对同一问题给出不同答案，建议统一并在 README 写明样本/总体约定。

---

## 五、修复后自检清单

| 报告结论 | 现状 |
| :--- | :--- |
| 发布包在 Node 中无法 import | ✅ ESM + CJS 消费者实测均可加载 |
| 索引重排（reverse/translate/redirect/shuffle）失效 | ✅ README 示例 3/4/5 全部通过 |
| 异步链路返回空或挂起 | ✅ `usePromise` / `useFrom(async)` / `useIterate` / `useInterval` / `useBlob` 全部可用，无 unhandled rejection |
| `find*` / `reduce` 恒为空 | ✅ 返回值正确，空流返回空 Optional / reject |
| `partition` / `sub` / `useText` / `useStringify` / `useRandom` 不可用 | ✅ 全部修复并有测试覆盖 |
| 统计公式与精度 | ✅ 峰度公式修正；大整数统计不再抛错且精度显著改善 |
| 无测试、构建脚本不可用 | ✅ 55 项回归测试 + `npm test` + devDependencies 补齐 |
