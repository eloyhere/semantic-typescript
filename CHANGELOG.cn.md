# 更新日志

本文件记录 `semantic-typescript` 的重要变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [2.0.0] - 2026-11-05

本节涵盖 1.2.0 之后合入的改动。这是一次较大的变更：集合族被拆分、相位环 API 重做、
统计/窗口/信号/分布四个模块成为公开入口，并修复了若干异步生命周期缺陷。升级前请先阅读
「破坏性变更」「变更」与「移除」三节。

### 破坏性变更（Breaking）

**统计量改用 R / NumPy / pandas / Excel 的默认定义**

以下均为所有者批准的、有意的破坏性变更：旧定义与主流工具不一致，继续兼容只会把错误固化。
每一项旧行为都可显式恢复。

- **`quantile(probability)` 默认改为 Hyndman–Fan 类型 7**（`h = (n - 1)p + 1`，线性插值），
  不再是类型 1（`ceil(np)` 就近取秩）。类型 7 是 R `quantile`、NumPy `quantile`
  （`method="linear"`）、Excel `PERCENTILE.INC` 与 pandas `quantile` 的默认。
  `[1..8]` 在 `p = 0.75` 处由 `6` 变为 `6.25`；`[2,4,4,4,5,5,7,9]` 在 `p = 0.9` 处由 `9`
  变为 `7.6`。九种类型均可通过 `quantile(p, { method: "type-1" })` …
  `{ method: "type-9" }` 选择，`"type-1"` 精确恢复旧的取秩结果。
- **`interquartileRange()` 使用同一方法**（默认类型 7），因此 Tukey 栅栏与 R、NumPy 对齐：
  `[1..8]` 得到 `3.5`（旧值 `4`），`[1,2,3,4]` 得到 `1.5`（旧值 `2`）。
  可用 `{ method }` 指定类型。
- **`kurtosis()` 默认改为无偏超额估计 `G2`**，
  `G2 = ((n - 1) / ((n - 2)(n - 3))) · ((n + 1)g2 + 6)`，与 Excel `KURT`、pandas `kurt`
  一致，不再是 `g2 = m4 / m2² - 3`。`[1,2,3,4]` 由 `-1.36` 变为 `-1.2`；传
  `{ estimator: "g2" }` 恢复旧值。`{ excess: false }` 会加回 3，返回非超额的四阶标准矩。
- **`skewness()` 默认改为无偏 `G1`**，`G1 = √(n(n - 1))/(n - 2) · g1`，与 Excel `SKEW`、
  pandas `skew`、SPSS 一致，不再是 `g1 = m3 / m2^(3/2)`；传 `{ estimator: "g1" }` 恢复。
- **`variance()` 与 `standardDeviation()` 的分母改为 `n - 1`**（贝塞尔校正），与 R
  `var`/`sd`、pandas、NumPy `var(ddof=1)` 一致，不再是 `n`。`[1,2,3,4]` 的方差由 `5/4`
  变为 `5/3`；传 `{ ddof: 0 }` 恢复总体定义。`standardDeviation` 是该方差的开方，
  在正态下仍略有偏（Jensen 不等式）。
- **小样本改为返回空 `Optional`，而不是 `0` 或 `NaN`。** `G2` 在 `n < 4` 时无定义，
  `G1` 在 `n < 3` 时无定义，样本方差/标准差在 `n < 2` 时无定义；空样本上的全部统计量、
  常数样本上的偏度与峰度也无定义。例如 `n = 3` 时默认 `kurtosis()` 为空，
  而 `{ estimator: "g2" }` 有值；`n = 2` 时 `skewness()` 为空，而 `{ estimator: "g1" }`
  为 `0`。bigint 视图返回同样的空值；`{ ddof: 0 }` 下单个观测的方差仍定义为 `0`。
- **`variance()` 与 `standardDeviation()` 改用两遍算法**（先求均值、再累加平方偏差），
  不再使用收集器的 `sum(x²) - sum(x)²/n`，避免标准差远小于均值时的灾难性抵消。
- **`skewness` 与 `kurtosis` 新增闭式标准误。** 数值统计视图提供
  `skewnessStandardError()` 与 `kurtosisStandardError()`，分别返回
  `√(6n(n - 1)/((n - 2)(n + 1)(n + 3)))` 与
  `√(24n(n - 1)²/((n - 3)(n - 2)(n + 3)(n + 5)))`，即 SAS/SPSS 与
  `e1071::skewness`/`e1071::kurtosis` 采用的形式；前者要求 `n ≥ 3`，后者要求 `n ≥ 4`。
  bigint 视图不提供，因为把标准误四舍五入成整数会对多数样本报 `0`。
- **上述方法现在返回 `Optional`。** `variance`、`standardDeviation`、`quantile`、
  `interquartileRange`、`skewness`、`kurtosis` 的结果都包在 `Optional` 中，调用方需用
  `.get()`、`.orElse(...)` 或 `.isPresent()` 解包。bigint 视图仍把每个结果四舍五入为整数。
- **数值对账。** 新默认复现已发表结果：`[1,2,3,4]` 的
  `variance(ddof = 1) = 5/3`、`G2 = -1.2`、`g2 = -1.36`、`G1 = g1 = 0`；
  `[1..8]` 在 `p = 0.75` 处类型 7 为 `6.25`、类型 1 为 `6`；Wikipedia 峰度示例
  （`n = 20`）给出 `g1 = 4.129251`、`G1 = 4.471885`、`g2 = 15.051427`、
  `G2 = 19.998429`，标准误 `0.512103` 与 `0.992384`。这些值与 R、NumPy、pandas、Excel
  在已发表的精度内一致。

**信号分析改用物理功率与 DFT-even 约定**

这些同样是所有者批准的、有意的破坏性变更：旧定义把幅度与功率混为一谈，或假定只存在完整帧，
因而会系统性地偏置电平与时频帧。

- **移除 `decibel`，拆成 `amplitudeDecibel` 与 `powerDecibel`。** 前者保留旧的
  `20·log10` 幅度惯例；后者对功率、能量、均方与功率谱密度使用 `10·log10`。功率 `0.25`
  经 `powerDecibel` 得 `−6.02 dB`，而旧函数报 `−12.04 dB`。`Bin.decibel` 与
  `Spectrum.decibelOf` 仍是幅度电平；`Spectrum.powerDecibelOf` 是对应的功率电平。
- **`Spectrum.bandEnergy(low, high)` 默认改为单边口径。** 实信号的共轭半边被折叠回非负频率轴：
  DC 与 Nyquist 计一次，每个内部 bin 计两次，因此覆盖整个单边频率轴的频带满足 Parseval
  （`Σ|X|² = N·Σx²`）。旧的原始双边求和（对 Nyquist 以下的频带只计正频率半边，少 `3.01 dB`）
  保留为 `bandEnergy(low, high, "two-sided")`，适用于复谱。
- **`Spectrum.flatness()` 改为度量单边功率谱。** 旧方法对双边复谱的**幅度**取几何/算术均值；
  现在用 `power()` 在 `0 … floor(count/2)` 上计算，且不施加 `oneSided()` 仅供显示的幅度加倍；
  仍有零 bin 时返回 `0`。
- **`Sampler.shortTimeFourierTransform` 与 `Sampler.spectrogram` 默认改为周期 Hann 窗、
  `boundary: "zeros"`、`padded: true`。** 对称 Hann 与旧的「只取完整帧」路径（`64` 样本、
  帧 `16`、跳 `8` 时 `7` 帧）仍可通过 `useHannWindow` / `useHannPeriodicWindow` 与
  `{ boundary: "none", padded: false }` 取得；新默认返回 `9` 帧、不丢尾部样本，并与 SciPy
  `stft` 的默认值一致。新增可选第五参数 `{ boundary, padded }`。
- **`Spectrogram` 的帧时间改为帧中心。** 未扩展时 `getTime(k)` 返回
  `(k·hop + frameSize/2)/rate`，扩展后返回 `(k·hop + (frameSize mod 2)/2)/rate`，不再是帧起点。
  `getDuration()` 与 `toFrame()` 也会裁掉边界扩展。构造函数新增可选第四参数（边界模式），
  默认 `"none"`。

### 新增（Added）

**集合族**

- **`OrderedSet` / `UnorderedSet`**，各有同步与异步版本。`OrderedSet` 由比较器决定唯一性与
  迭代顺序（默认使用 `useCompare`）；`UnorderedSet` 先按 `useHash` 分桶，再按 SameValueZero
  比较。迭代顺序对有序变体是契约的一部分，对无序变体则明确不作保证。
- **`OrderedLRUSet` / `UnorderedLRUSet`** 与 **`OrderedSkipSet` / `UnorderedSkipSet`**，
  补上了此前的缺口：LRU 与 SKIP 家族提供有序与无序映射，却只有一个不加区分的集合。
- **`OrderedMap` / `UnorderedMap`** 提升为各自独立的根接口。原有的共同基类已移除，
  两个变体都不再从对方继承顺序承诺。

**错误模型**

- `structure/error.ts` 中的类型化错误层级：15 个类，覆盖校验、索引、容量、状态、并发、
  集合协议、序列化、数值、相位与配置失败。每个类都带有稳定的 `name`、可选的 `cause`
  （指向原始错误）与可选的 `context`（诊断信息包），并各自配有一个品牌守卫。
- **`SemanticRangeError`**：导出的 `RangeError` 类的别名。两个名字指向同一个类，
  `instanceof` 判断在两者间通用。该类保留历史名称——库内没有模块隐式导入它，裸写的
  `new RangeError(...)` 仍指向全局构造器——但消费者一旦写出 `import { RangeError }`，
  就会在整个模块内遮蔽全局构造器，使同一文件中原本无关的 `new RangeError(...)` 变成库自己的
  错误；改从 `SemanticRangeError` 导入则不会碰全局。

**模块分层**

- **收集器工厂迁入 `collectors.ts`。**`collector.ts` 现在只声明 `SynchronousCollector` 与
  `AsynchronousCollector`（约 340 行与 350 行）；53 个 `useSynchronousXxx` 与 53 个
  `useAsynchronousXxx` 工厂位于 `synchronous/collectors.ts` 与 `asynchronous/collectors.ts`。
  依赖是单向的：`collectors.ts` 引用 `collector.ts`，反之不成立；`factory.ts` 仍是构建
  `Semantic` 的工厂，于是「创建 `Semantic`」与「创建收集器」成了两件分开的事。
- **森林独立成模块。**`rootedForest` 与 `unionFindForest` 从 `structure/tree/` 迁到
  `structure/forest/`，并新增 `forest/index.ts` 与 `structure/forest.ts` 桶文件（与原有
  `structure/tree.ts` 并列）。二项堆、斐波那契堆、广度优先搜索树、深度优先搜索树与最小生成树
  现在从新路径导入有根森林，树 API 的边界类型测试也一并改指向新路径。

**相位环**

- `mathematics/field.ts` 中的 `PhaseField` 与 `useField`：`[-1, 1]` 上的有界得分，由一个
  截断余弦级数定义。构造函数强制 `|offset| + Σ|weight| ≤ 1`，于是界是构造本身的结果，
  而不是事后补上的夹取。
- `Cycle` 现在能报告自身状态：`purity()`、`sequences()`、`zeroSequence()`、`isBalanced()`、
  `resultant()`、`relativeAt()`、`viewAt()`、`viewsAt()`、`jetAt()`、`windingAt()`、
  `errorIntegralAt()`、`scoreAt()`、`scoresAt()`、`analyse()` 与 `toSpectrum()`。
- `combineCycles(a, b)` 在最小公倍数上拼接两个环，并报告成对相容条件，因此联合环是拉回
  而不是直积。
- `useAngularSpectrum(cycle, instants, plan)` 构建二维 `(ω, n)` 平面，每个空间模式一列。
- `BlobLike`：对 `useBlob` 所需字节的结构化描述，使已发布的类型声明不再依赖消费者编译环境中
  存在 DOM 库。

**信号分析**

- **周期（DFT-even）窗**：`useHannPeriodicWindow`、`useHammingPeriodicWindow`、
  `useBlackmanPeriodicWindow`、`useNuttallPeriodicWindow`、`useFlatTopPeriodicWindow` 与
  `useKaiserPeriodicWindow(beta)`。它们与对称窗形状相同，但分母是 `count` 而非 `count - 1`，
  因此周期 Hann 在 50% 重叠下的叠加和恒为 `1.000000`，而对称 Hann 在 `N = 16` 时波纹
  `0.841 dB`、`N = 1024` 时仍剩 `0.013 dB`。既有对称窗导出保持不变。
- **`Spectrum.powerDecibelOf(index, normalization?, reference?)`**：`decibelOf` 的功率对应物，
  返回 `10·log10(power / reference)`。
- **`BandSidedness`**（`"one-sided" | "two-sided"`）：修正后的 `Spectrum.bandEnergy` 的显式参数类型。
- **`TimeFrequencyOptions`**：`shortTimeFourierTransform` 与 `spectrogram` 的
  `{ boundary?, padded? }` 选项，以及它们使用的 `BoundaryExtension`
  （`"zeros" | "constant" | "none"`）类型。
- **`Spectrogram.getBoundary()`** 与 **`Sampler.spectrogram(..., options)`**：谱图保留扩展模式，
  并在 `toFrame` 时裁掉扩展。

**公开模块**

- **`statistics.ts`、`window.ts`、`signal.ts` 与 `distribution.ts` 成为各自 API 的归属模块**，
  同步与异步两侧都是如此。这些模块里的类与值对象由 `semantic.ts` 再导出，因此
  `#semantic/synchronous/semantic`（及其异步版本）这一历史导入路径仍然可用，而重复定义已经删除。
- **新增具名导出**：`SynchronousStatistics`、`SynchronousBigIntStatistics`、
  `SynchronousNumericStatistics`、`SynchronousWindowCollectable`、
  `SynchronousWindowArrayCollectable`、`SynchronousSignalCollectable`、
  `SynchronousDistributionCollectable` 及对应的 `Asynchronous*` 版本，另有分布值对象
  （`Histogram`、`HistogramBin`、`EmpiricalDistribution`、`MomentSummary`、`RobustSummary`、
  `DensityEstimate`）与 `SpectralDensity`。每个类都带同步/异步前缀，因为不带前缀的同名对
  在包桶里会相互冲突（TS2308）。
- **深导入**：`package.json` 现将 `semantic-typescript/signal`、`semantic-typescript/statistics`、
  `semantic-typescript/window` 与 `semantic-typescript/distribution` 映射到同名的同步模块
  （含声明文件），消费者可以只加载一个分析模块而不必加载整个桶文件。
- **`SynchronousWindowArrayCollectable`**（及异步版本）把 `slide` / `tumble` 物化为数组。
  `toWindow()` 仍返回 `SynchronousWindowCollectable`，即 README 记录的惰性管道形式，
  窗口依旧可以先变换再消费。

**工程**

- README 按共享的十三节大纲重写为九种语言，并新增「周期分析」一节。
- 新增 `.vscode/settings.json`，让编辑器自动导入优先使用项目路径别名而非相对写法。

### 变更（Changed）

- **`Cycle.frequency` 是环境转速**，而不是位置之间的相位步长。环境把每个相量推进同一角度，
  因此无法破坏内在模式。位置相位现在由精确余数 `i mod n` 导出，`phaseAt(i)` 与
  `phaseAt(i + n)` 逐位相同，而不只是数值接近。
- **`useText` 按码点切片**，而不是按 UTF-16 索引，因此增补平面字符保持完整；区间倒置仍会交换，
  负位置仍夹到 0，与文档所述的切片行为一致。
- **`useRange` 在步长为负时接受递减区间**，并拒绝数值种类与边界种类不一致的步长，
  不再在 `number` 与 `bigint` 之间强制转换。
- `factory.ts` 中每个工厂函数与 `hook.ts` 中每个钩子的 JSDoc 均按实际行为重写，
  重载亦逐个覆盖。
- `structure/tree/` 导出的 296 个接口全部补齐接口 JSDoc，写明契约、默认值与代价，而不只是
  名字；两个 `collectors.ts` 也同样为各自的 34 个工厂接口与每个重载补齐注释。

### 移除（Removed）

- **`SynchronousSet` / `AsynchronousSet` / `SynchronousMap` / `AsynchronousMap`**，
  连同其品牌符号与守卫一并移除。请改用与所需语义相符的有序或无序变体。不提供兼容别名。
- 映射族的 `Collector` 基类型，由内部的、无品牌的契约取代，仅用于组合 LRU 与 SKIP 家族。
- **`structure/tree/rootedForest` 与 `structure/tree/unionFindForest` 入口**，以及
  `tree/index.ts` 中对应的再导出。两套契约现位于 `structure/forest/` 下，旧路径不保留兼容
  再导出。

### 修复（Fixed）

- **`useSubscription` 不再泄漏订阅。**清理是幂等的，并在每一条退出路径上执行：消费者主动
  停止、消费者抛错、订阅中途失败，以及运行结束之后才到达的事件。即使前一个 `unsubscribe`
  抛错，每个已记录的 `unsubscribe` 仍会被尝试；即使某个 `unsubscribe` 抛错，`unmount` 仍会被
  尝试，因此单个失败的宿主方法不会连累其余方法。清理期间抛出的错误会被吞掉，以免掩盖触发
  清理的那个错误。
- **`useSubscription` 在达到接受上限时即完成**，不再多等一个事件；空事件名列表现在立即完成，
  而不是永不落定。对于在 `subscribe` 中同步触发处理器的宿主也做了处理：注册返回后即退订该
  处理器。
- **事件名不再限定为字符串。**符号或数字可以作为单个事件名；此前即便这类键就是普通属性键，
  也会被拒绝。
- **`useInterval` 会清理两个句柄。**消费者抛错时，过去会让定时器永远运行；而挂起的初始延迟
  此前根本没有被跟踪。现在只要运行停止，两者都会被清除，消费者的错误原样向上传播。
- **`usePromise` 不再挂起。**那个吞掉 rejection 的异步执行器已移除：源被 reject 与消费者抛错
  都会以原始原因 reject 整个集合。
- **`useBlob` 在错误路径上取消流。**此前只释放读取器的锁而不取消流，底层源会继续向一个已被
  丢弃的缓冲区生产数据。
- **平顶窗保留负瓣。**`useFlatTopWindow` 曾用 `Math.max(0, ...)` 把所有权重夹到零，但平顶窗
  按定义就是部分取负的：`N = 1024` 时未夹取的对称窗有 `578` 个负样本（最小值 `−0.070560`），
  相干增益 `0.215368`、噪声带宽 `3.773946` bin，而夹取版报 `0.233280` 与 `3.199558`。
  扇贝损失从 `−0.3087 dB` 恢复到 `−0.0097 dB`（约改善 32 倍）；周期形式与调研目标一致
  （`CG 0.215579`、`ENBW 3.7702`、`HPBW 3.7247`、`−0.0098 dB`、`577` 个负样本）。
- **短时变换不再丢弃信号尾部。**默认的 `boundary: "zeros"` 与 `padded: true` 在两端各扩展半帧
  并对尾部补零，因此 `64` 样本、帧 `16`、跳 `8` 产生 `9` 帧而非 `7` 帧，且每个源样本都被覆盖；
  `1000` 样本、帧 `256`、跳 `128` 产生 `9` 帧而非 `6` 帧（此前有 232 个样本无法进入任何帧）。
- **短时变换默认使用周期窗。**对称 Hann 不满足 COLA：50% 重叠下叠加和在 `N = 16` 时波纹
  `0.841 dB`、`N = 1024` 时仍有 `0.013 dB`；新的默认 `useHannPeriodicWindow` 在任意长度下
  叠加和都是 `1.000000`。
- **`Spectrum.flatness()` 改用功率谱。**旧方法对完整双边谱的**幅度**取几何/算术均值；现在用
  `power()` 在单边半谱上计算。功率为 `4` 与 `1` 的两个 bin 得到 `0.8`（旧幅度口径为
  `0.9428`），单位冲激得到 `1`。
- **`Spectrum.bandEnergy()` 不再把 Nyquist 以下频带减半。**旧的原始双边和对实谱只计正频率
  半边：`8` 点频谱中 bin `1` 的单位余弦在 `[0, 2)` 上读 `16`，而总功率是 `32`。新的默认单边
  口径折叠共轭半边（DC/Nyquist 一次、内部 bin 两次），读 `32`，满足 Parseval；
  `"two-sided"` 保留原始求和。

### 测试（Tests）

- 684 项断言，全部通过，`tsc` 无任何诊断信息。新增测试文件覆盖有序/无序集合、错误层级、
  森林构造，以及 2.0.0 的统计量定义：九种 Hyndman–Fan 分位数类型、`G1`/`G2` 与
  `g1`/`g2` 的对照、`ddof`、闭式标准误，以及同步/异步/数值/大整数四套视图的小样本空 Optional。

---

## [1.2.0] - 2026-09-11

本次发布重新划定了**索引模型的职责边界**：管道只做廉价的惰性索引改写，索引整理完全交给收集器。
`translate` 回归纯平移，`findAt` / `findNegativeAt` 改按物化顺序寻址，并修复了 4 个异步/边界缺陷。

### 行为变更（Breaking Changes）

- **`translate` 回归纯惰性索引平移**：数值重载与函数重载都只做 `i + offset` / `i + mapper(element, i)`，
  不再物化整条流（1.1.0 中数值重载会先缓冲全部元素再取余）。`translate` 现在可以在无限流上配合
  `limit` 使用。
- **有序收集器负责索引归一化**：`toOrdered()` 将每个索引重写为 `((i mod n) + n) mod n`
  （n 为元素总数）后按索引排序。`reverse` / `translate` / `shuffle` 的旋转、反转、洗牌效果
  由这一步实现——例如 `translate(7)` 与 `translate(2)` 在 5 个元素上等价。
- **无序收集器不整理索引（性能契约）**：`toUnordered()` 保留原始索引原样存入 `Map`，
  不做归一化、不排序，维持 O(n) 吞吐。`translate(2)` 以无序方式收集时索引仍为 `2n,3n,4n,…`。
- **`findAt(k)` / `findNegativeAt(k)` 改按物化顺序寻址**：`findAt(1n)` 永远是物化后的第二个元素，
  `findNegativeAt(-1n)` 永远是物化后的倒数第一个，与上游做过什么索引改写无关。
  两者均支持提前中断（O(k) / O(n−k)）。
- **`reverse()` 实现为 `-index - 1n`**（原 `-index`）：在取余归一化下 `-index` 会把首元素钉在原位
  （`-0n === 0n`），`-index - 1n` 才是真反转。
- **`redirect` 是唯一的重排机制**：`reverse` / `translate` / `shuffle` 均为其预置策略，
  都必须配合 `toOrdered()` 才能生效（无序收集器只保证到达顺序）。

### 修复（Fixed）

- 修复异步 `translate` 漏接上游 Promise（回调缺少 `.then` 链接）导致元素丢失或空结果的问题
  （同步侧无此缺陷）。
- 修复异步有序收集器缺少取余归一化、与同步侧结果不一致的问题
  （异步 `translate(2).toOrdered()` 曾返回未旋转的顺序）。
- 修复异步 `flatMap` 在展开第一个内层可迭代后提前 `resolve()`、静默丢弃后续元素的问题。
- 修复 `dropWhile` 把第一个不满足谓词的元素也丢掉的边界错误（同步/异步同源）：
  `[1,2,3,4,1].dropWhile(n < 3)` 曾返回 `[4,1]`，正确结果为 `[3,4,1]`。

### 文档（Documentation）

- README 全面重写（英文基准，采用英式英语）：**每个工厂函数、转换算子、收集器与终止操作
  均标注时间与空间复杂度**；设计思想、整体架构与数据流独立成章。
- 索引模型章节重写：管道惰性改写 vs 收集器整理的职责划分
  （`OrderedCollectable` 及子类负责索引整理，`UnorderedCollectable` 保证性能而不整理）。
- 9 种语言版本全部重新生成：修复简体中文/日语版章节标题未翻译、俄语版缺失的问题；
  全部代码块与英文版逐字节一致。

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
  **建议直接升级到 2.0.0**。此外该版本发布时仓库 `package.json` 停留在 `0.7.1`，仓库状态与线上产物一度脱节。
- **0.6.0 及更早**：`0.6.0` 之前的全部版本已在 npm 上标记 deprecated
  （`< 0.5.0` 缺事件流 API，`0.5.x` 存在循环依赖问题）。
- 仓库此前没有 git tag，`.github/workflows/publish.yml` 以 `v*` 标签触发；本次发布补齐了 `v1.1.0` 标签。

[2.0.0]: https://github.com/eloyhere/semantic-typescript/releases/tag/v2.0.0
[1.2.0]: https://github.com/eloyhere/semantic-typescript/releases/tag/v1.2.0
[1.1.0]: https://github.com/eloyhere/semantic-typescript/releases/tag/v1.1.0
[1.0.0]: https://www.npmjs.com/package/semantic-typescript/v/1.0.0
