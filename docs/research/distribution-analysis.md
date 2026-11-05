# `DistributionCollectable`：分布分析的专业能力调研与 API 规格

> 目标读者：`semantic-typescript` 的维护者。
> 目标：为「一批数值 → 分布刻画」补齐可直接落地的能力规格，并给出与本库风格一致的 API 提案。
> 状态：调研完成；**未改动 `src/` 下任何文件**；本文是唯一新增文件。

---

## 0. 摘要

### 0.1 一句话结论

分布分析的专业实现不是「多写几个统计量」，而是**把每一个量的定义歧义、边界约定与估计偏差在类型层面显式化**：分位数必须声明 9 种插值中的哪一种，峰度必须声明 3 种定义中的哪一种，直方图必须声明分箱规则与闭区间约定，核密度必须声明带宽规则与边界处理。本库当前的 `SynchronousNumericStatistics` 已经在 `quantile` / `skewness` / `kurtosis` 上各选了一种定义，但**没有把选择暴露给调用方**，因此跨语言对账时会静默地错。

### 0.2 覆盖范围

共 **8 大类、33 项能力**，逐项给出规范定义（公式）、直觉、复杂度、默认参数与陷阱：

| # | 能力大类 | 项数 | 代表实现对照 |
|---|---|---|---|
| 1 | 直方图分箱 | 7 | NumPy `histogram_bin_edges`、R `hist` |
| 2 | 分位数 | 2（含 9 种类型） | R `quantile`、NumPy `quantile` |
| 3 | 经验分布与密度 | 4 | R `ecdf`、R `density`、SciPy `gaussian_kde` |
| 4 | 矩与形状 | 4 | SciPy `skew`/`kurtosis`、Excel `KURT` |
| 5 | 熵与散度 | 4 | SciPy `entropy`、Kraskov 估计器 |
| 6 | 拟合与检验 | 5 | R `shapiro.test`、SciPy `anderson`、Lilliefors |
| 7 | 稳健统计 | 4 | R `mad`、R `IQR`、截尾均值 |
| 8 | 数值约定与陷阱 | 3 | n vs n−1、在线算法 |

### 0.3 证据分级

本文每个结论都标注证据级别，便于复核：

- **[A]** 一手文档或源码原文可读（R/NumPy/SciPy 官方文档、NumPy 源码、论文 DOI 元数据）。
- **[B]** 权威二手（Wikipedia 条目，条目本身引用了原始文献；用于定义与公式的交叉校验）。
- **[C]** 本报告实测或推导：脚本见附录 A，可在本机复现；所有数值均由脚本输出抄录，未手工编造。

### 0.4 网络与方法说明

本机直连外网受限，全部抓取经 `--proxy http://127.0.0.1:15236`：

- `en.wikipedia.org` `action=raw`：24 个条目，全部 HTTP 200（首批 8 个出现 429，退避重试后成功）。
- `stat.ethz.ch`（R 4.6.0 手册）、`numpy.org/doc/stable`、`docs.scipy.org`、`pandas.pydata.org`：全部 200。
- `api.crossref.org`：26 个 DOI/题名查询，全部 200 并返回元数据。
- `ar5iv.labs.arxiv.org`：2 篇（Kraskov 2004、KDE 综述 1212.2812）可读。
- `export.arxiv.org/api`：首次 200、后续 503/429，**未用于任何结论**。
- `api.semanticscholar.org`：按任务说明**未使用**。

未能验证的事项集中列在 §8，不在正文中冒充已验证。

---

## 1. 记号与约定

| 记号 | 含义 |
|---|---|
| `n` | 样本量（`bigint` 计数，避免 2^53 溢出） |
| `x_(1) ≤ … ≤ x_(n)` | 次序统计量 |
| `m_k = (1/n) Σ (x_i − x̄)^k` | **有偏**中心矩（分母 `n`） |
| `s² = (1/(n−1)) Σ (x_i − x̄)²` | 无偏样本方差（分母 `n−1`） |
| `σ̂` | 下文按上下文注明是 `s` 还是总体标准差；**函数签名中一律显式命名** |
| `F_n` | 经验分布函数 |
| `Φ` | 标准正态 CDF，`φ` 为其密度 |
| `ψ` | digamma 函数 |
| `ln` / `log2` | 自然对数 / 以 2 为底；熵的单位随底数变化（nats / bits） |

三条贯穿全文的约定：

1. **闭开区间**：分箱一律 `[lower, upper)`，只有最后一箱闭合为 `[lower, upper]`。这与 NumPy 一致 [65]，也让 `n = Σ m_i` 恒成立。
2. **分母显式化**：任何方差类量在 API 上都带 `ddof` 或独立的 `variance()` / `sampleVariance()`，禁止隐式约定。
3. **不可变性**：所有分布对象构造后冻结；派生量返回新对象。

---

## 2. 能力规格

### 2.1 直方图分箱

#### 2.1.1 规范定义

设数据 `x_1…x_n`，箱宽 `h > 0`，箱数 `k = ⌈(max x − min x) / h⌉`，第 `i` 箱为 `B_i = [x_min + (i−1)h, x_min + ih)`（末箱右闭）。计数与密度：

```
m_i = #{ j : x_j ∈ B_i }              （整数计数，sum_i m_i = n）
f̂_i = m_i / (n · h)                   （密度估计，单位为 1/x）
```

`f̂_i` 是**密度**而不是频率；直接画 `m_i` 会让不同宽度的箱不可比。异构宽度（等频箱）时必须用 `m_i/(n·w_i)`。

#### 2.1.2 五种分箱规则（含公式与适用条件）

| 规则 | 公式 | 适用条件 | 失效场景 |
|---|---|---|---|
| Sturges [1] | `k = ⌈log2 n⌉ + 1` | 近似正态、`n ≈ 100` 附近最佳 | `n < 30` 时箱数 < 7；重尾/多峰严重欠分箱 [8][4] |
| Scott | `h = 3.49 σ̂ n^(−1/3)`，等价 `h = σ̂ (24√π / n)^(1/3)` | 正态参考规则，最小化积分均方误差 | σ̂ 不稳健，一个离群点即可摧毁 [2][66] |
| Freedman–Diaconis | `h = 2 · IQR · n^(−1/3)` | IQR 稳健，适合重尾与中等样本 | 箱数仍依赖极差；离群点使 `k` 爆炸 [3][9] |
| Rice / 平方根 | `k = ⌈2n^(1/3)⌉` / `k = ⌈√n⌉` | 只看样本量，极快 | 完全忽略离散度，**不建议作为默认** [8] |
| Doane | `k = 1 + log2 n + log2(1 + |g1|/σ_g1)`，`σ_g1 = √(6(n−2)/((n+1)(n+3)))` | 偏态数据对 Sturges 的修正 | 依赖 `g1` 的有偏定义，双重不稳定 [5][8] |
| Terrell–Scott | `k = ⌈(2n)^(1/3)⌉` | 渐近最优的**下界**（"oversmoothed"） | 只能当下界用 [8] |

Scott 与 FD 的两个等价写法要特别注意：`3.49 ≈ (24√π)^(1/3)`，NumPy 文档写前者、上文公式写后者，是同一个数 [66]。

#### 2.1.3 等宽 vs 等频

等宽箱的每箱方差不同（稀疏区噪声大、密集区分辨率低）[8]。等频（equiprobable）箱令每箱期望样本数相同，其箱数经验规则为 `k = 2n^(2/5)`，该系数来自「最大化 Pearson χ² 检验功效」的推导，`α = 0.05` 时的最优区间约 `1.88n^(2/5) ~ 3.77n^(2/5)`，取 2 只为易记 [8]。等频箱的代价是：箱边界依赖数据（不稳定）、箱宽不再有意义、增量更新代价高（需要保序结构）。

**本库建议**：默认等宽；等频作为 `HistogramOptions.strategy = "equal-frequency"` 的可选路径，且必须返回显式边界数组。

#### 2.1.4 边界闭合约定

NumPy：除最后一箱外全部半开，最后一箱右闭 [65]。这会带来一个真实的可复现差异：若数据恰有值等于某个内部边界，落在左箱还是右箱取决于约定。反直觉之处在于**最大值例外**——若严格左闭右开，`max x` 会落在所有箱之外，`Σ m_i < n`，直方图与 ECDF 就对不上。因此「末箱右闭」不是偷懒，是维持 `Σ m_i = n` 的必要条件。

数值反例：数据 `[0, 1, 2]`，`bins = [0, 1, 2]`。按 `[0,1) ∪ [1,2]` 得 `m = (1, 2)`；若误写成 `[0,1) ∪ [1,2)` 则 `m = (1,1)`，总数 2 ≠ 3。

#### 2.1.5 空箱与离群值

- **空箱**：必须保留（`m_i = 0`）。删除空箱会让密度曲线在稀疏区出现假间隙，并使熵/KL 的分箱支撑随样本变化。熵计算中 `0 · ln 0 := 0`。
- **离群值**：这是 FD 规则最容易被误用的地方。FD 只用 IQR 估**宽度**，但箱数 `k = ⌈range/h⌉` 仍用**极差**。实测（附录 A/C）：n=200 正态样本 `k = 14`；同一份数据把最后一个值改成 25.0 后，IQR 几乎不变（1.206 → 1.217），`k` 从 14 暴涨到 66 [C]。这不是 FD 的 bug，是「稳健的宽度 + 不稳健的极差」的组合。
- **工程解法**：(a) 先截断到 `[q(0.005), q(0.995)]` 再分箱并单独报告被裁剪数；(b) 给箱数设上限 `k_max`（NumPy ≥ 2.0 就是这么做的，见 §4 陷阱 12）。

#### 2.1.6 复杂度

- 等宽：`O(n + k)` 时间、`O(k)` 空间（一次遍历计数，无需排序）。
- 等频：`O(n log n)`（需排序或选择算法）+ `O(n)`。
- 直方图熵/KL：在计数上再 `O(k)`。

#### 2.1.7 参数与默认值建议

| 参数 | 建议默认 | 依据 |
|---|---|---|
| `rule` | `"sturges"`？→ **建议 `"freedman-diaconis"`** | Sturges 是 R `hist` 与大量教材的默认 [66]，但它假设正态；FD 在重尾下明显更好 [3]。取 FD 作为**统计用途**默认，绘图用途仍可给 Sturges |
| `bins` | 未指定时由 `rule` 推出；显式传数组则完全接管 | 与 NumPy 语义一致 [65] |
| `closed` | `"left"`（末箱右闭） | 与 NumPy 一致，保证计数守恒 [65] |
| `k_max` | `1000` | 防止 FD 在离群点下产生十万级箱数 [C] |
| `clip` | `null`（不裁剪） | 裁剪会静默改变数据，必须显式开启 |

---

### 2.2 分位数

#### 2.2.1 规范定义

总体分位数：`Q(p) = inf{ x : F(x) ≥ p }`。样本分位数不是唯一确定的，Hyndman–Fan 用统一参数化覆盖了 9 种 [10][11]：

```
Q_i(p) = (1 − γ) x_(j) + γ x_(j+1)
其中 j = ⌊np + m⌋，g = np + m − j，γ = g（类型 1–3 取 0/0.5/1），
m = m(i) 由类型决定
```

| 类型 | `m` | `p_k`（第 k 个次序统计量对应的概率） | 等价实现 | 语义 |
|---|---|---|---|---|
| 1 | 0 | `k/n` | R‑1、SAS‑3、Maple‑1 | 逆 ECDF（阶跃） |
| 2 | 0 | `k/n` | R‑2、SAS‑5、Stata | 同 1，但在跳点取平均（阶跃） |
| 3 | −1/2 | `k/n`（名义结点，实际按就近取整） | R‑3、SAS‑2 | 就近取次序统计量（偶数优先）（阶跃） |
| 4 | 0 | `k/n` | R‑4、SciPy‑(0,1) | 逆 ECDF 的线性插值 |
| 5 | 1/2 | `(k−0.5)/n` | R‑5、SciPy‑(1/2,1/2) | 阶跃中点的分段线性（水文学常用） |
| 6 | `p` | `k/(n+1)` | R‑6、Excel `PERCENTILE.EXC`、Python `exclusive`、Minitab、SPSS | `p_k = E[F(x_(k))]` |
| 7 | `1−p` | `(k−1)/(n−1)` | **R 默认**、**NumPy 默认 `linear`**、Excel `PERCENTILE.INC`、Python `inclusive`、Guava | `p_k = mode[F(x_(k))]` |
| 8 | `(p+1)/3` | `(k−1/3)/(n+1/3)` | R‑8、SciPy‑(1/3,1/3) | `p_k ≈ median[F(x_(k))]`，**近似中位无偏** |
| 9 | `p/4 + 3/8` | `(k−3/8)/(n+1/4)` | R‑9、SciPy‑(3/8,3/8) | 正态下对次序统计量期望近似无偏 |

来源：R `quantile` 手册的 `m`/`γ` 表 [11]、NumPy `quantile` 的 `method ↔ H&F 编号 ↔ m` 对照表 [12]、Wikipedia 的软件对照表（含 Excel/Python/Guava 的等价关系）[13]。NumPy 的 `method` 名称到 H&F 编号是：`inverted_cdf`=1、`averaged_inverted_cdf`=2、`closest_observation`=3、`interpolated_inverted_cdf`=4、`hazen`=5、`weibull`=6、`linear`=7（默认）、`median_unbiased`=8、`normal_unbiased`=9 [12]。

> 注：类型 1–3 是阶跃的，`p_k` 只是"名义结点"；对类型 3，`np` 恰为半整数时按 round-half-to-even 取次序统计量，因此 `Q(2.5/n)` 可能等于 `x_2` 而非 `x_3` [11]。

#### 2.2.2 为什么不同选择会给出不同答案

三点机制：

1. **端点权重不同**。`p = 0.75, n = 8` 时，类型 1 取第 6 个值，类型 7 在 `(n−1)p+1 = 6.25` 处插值，类型 8 在 `(n+1/3)p + 1/3 = 6.58` 处插值。样本越小、尾部越远，差异越大。
2. **阶跃 vs 连续**。类型 1–3 是 `p` 的阶跃函数，对 `p` 的微小扰动不敏感但对**样本量**敏感；类型 4–9 连续，单点扰动会连续传播。
3. **无偏性目标不同**。类型 6 让 `E[F(x_(k))] = k/(n+1)`（Weibull 1939 的立场）；类型 7 取众数；类型 8 取分布无关的中位无偏；类型 9 只对正态近似无偏。Hyndman & Fan 本人推荐 **类型 8**，但主流软件大多选了 6 或 7 [11][14]。教材层面的四分位数分歧有专门梳理 [15]，另一套「真秩概率」的推导见 [16]。

实测（附录 A/B，`x = [2,4,4,4,5,5,7,9]`, `n = 8`）[C]：

| 类型 | p=0.10 | p=0.25 | p=0.50 | p=0.75 | p=0.90 |
|---|---|---|---|---|---|
| 1 | 2.000 | 4.000 | 4.000 | 5.000 | 9.000 |
| 2 | 2.000 | 4.000 | 4.500 | 6.000 | 9.000 |
| 3 | 2.000 | 4.000 | 4.000 | 5.000 | 7.000 |
| 4 | 2.000 | 4.000 | 4.000 | 5.000 | 7.400 |
| 5 | 2.600 | 4.000 | 4.500 | 6.000 | 8.400 |
| 6 | 2.000 | 4.000 | 4.500 | 6.500 | 9.000 |
| **7（R/NumPy 默认）** | **3.400** | **4.000** | **4.500** | **5.500** | **7.600** |
| 8（H&F 推荐） | 2.333 | 4.000 | 4.500 | 6.167 | 8.667 |
| 9 | 2.400 | 4.000 | 4.500 | 6.125 | 8.600 |

同一组 8 个数，`p = 0.9` 的答案在 **7.000 与 9.000 之间**（差 28.6%）；`p = 0.75` 在 **5.000 与 6.500 之间**（差 30%）。这张表本身就是「必须显式声明 method」的论据。

#### 2.2.3 重复值（ties）上的行为

这是最容易被忽略的一类分歧。取 `x = [1,1,1,1,100]`（4 个重复 + 1 个离群）[C]：

| 类型 | p=0.5 | p=0.9 |
|---|---|---|
| 1 / 2 / 5 / 6 / 8 / 9 | 1.000 | 100.000 |
| 3 | 1.000 | **1.000** |
| 4 | 1.000 | 50.500 |
| **7** | 1.000 | **60.400** |

类型 3 的 `p = 0.9` 返回 1.000——因为 `np + m = 4.5 − 0.5 = 4`，就近取第 4 个值（= 1），**完全看不到那个 100**。这不是 bug，是「就近取次序统计量」定义的直接后果；但把它用在 SLO 分位数（P90 延迟）上会得出荒谬结论。

#### 2.2.4 复杂度

- 一次性排序 `O(n log n)`，之后每次查询 `O(log n)`（二分）或 `O(1)`（预计算插值表）。
- 只查一个分位数：快速选择 `O(n)` 期望。
- 流式：t-digest / KLL，`O(log n)` 更新、有界空间、可合并；精度以 `p` 为界 [13]。
- 注意：类型 1–3 不需要插值，因而对**离散/有序因子**也可用（R 明确支持 `Date` 与 ordered factor）[11]。

#### 2.2.5 参数与默认值建议

| 参数 | 建议默认 | 依据 |
|---|---|---|
| `method` | `"type-7"` | 与 R 默认、NumPy `linear` 默认、Excel `PERCENTILE.INC` 一致，迁移成本最低 [11][12] |
| 提供 `"type-8"` | 可选 | H&F 推荐、中位无偏，作为"统计严谨"选项 [11] |
| 越界 `p` | `RangeError` | R 对 `2e-14` 容差外越界报错；本库不宜静默裁剪 [11] |
| 空样本 | `Optional.empty()` | 本库 `Optional` 惯例 |

---

### 2.3 经验分布与密度

#### 2.3.1 ECDF

定义 [17]：

```
F_n(t) = (1/n) · #{ i : x_i ≤ t } = (1/n) Σ 1{X_i ≤ t}
```

性质与语义：

- **右连续阶梯**：每经过一个数据点向上跳 `1/n`；在 `t = x_(k)` 处取值为 `≥ k/n`。图形上「包含每个台阶的左端点、不含右端点」。
- **无偏**：`E[F_n(t)] = F(t)`，`Var = F(t)(1−F(t))/n`，故 `n·F_n(t) ~ Binomial(n, F(t))` [17]。
- **一致收敛**：Glivenko–Cantelli，`sup_t |F_n − F| → 0 a.s.`；该上确界正是 KS 统计量 [17][48]。
- **变体**：部分教材用 `1/(n+1)` 归一（绘图位置），渐近等价 [17]。

分位数与 ECDF 的关系：类型 1 分位数就是 `F_n` 的广义逆；类型 4 是它的线性插值 [11]。**因此 ECDF 与分位数的类型选择必须一致**，否则 `Q(F_n(x)) ≠ x`。

复杂度：排序 `O(n log n)`；查询 `O(log n)`；离线可预计算成阶梯数组。

#### 2.3.2 KDE

定义 [18]：

```
f̂_h(x) = (1/(n h)) Σ_i K((x − x_i)/h)
```

核函数（`∫K = 1`，对称、非负）[18][27]：

| 核 | `K(u)` | 支撑 |
|---|---|---|
| Gaussian | `φ(u) = (2π)^(−1/2) e^(−u²/2)` | ℝ |
| Epanechnikov | `(3/4)(1 − u²)` | `|u| ≤ 1` |
| Biweight | `(15/16)(1 − u²)²` | `|u| ≤ 1` |
| Triweight | `(35/32)(1 − u²)³` | `|u| ≤ 1` |
| Uniform | `1/2` | `|u| ≤ 1` |
| Triangular | `1 − |u|` | `|u| ≤ 1` |

Epanechnikov 在 MSE 意义下最优，但其它核的效率损失很小 [18]；Gaussian 因数学便利成为默认（R `density` 默认 `"gaussian"` [22]）。SciPy 的 `gaussian_kde` 则把带宽作为 `factor` 暴露，`bw_method` 默认 `"scott"` [67]——与本库建议的 Silverman 默认不同，迁移时会产生肉眼可见的差异。

#### 2.3.3 带宽选择

```
AMISE(h) = R(K)/(n h) + (1/4) m₂(K)² h⁴ R(f″)
h_AMISE = C · n^(−1/5),  C = R(K)^(1/5) / (m₂(K)^(2/5) R(f″)^(1/5))
```

其中 `R(g) = ∫g²`，`m₂(K) = ∫u²K(u)du` [18]。`n^(−1/5)` 是 KDE 的固有收敛率，慢于参数方法的 `n^(−1/2)`——这不是实现问题，是非参数估计的下界。

实用规则：

| 规则 | 公式 | 备注 |
|---|---|---|
| Silverman（经验法则） | `h = 0.9 · min(σ̂, IQR/1.34) · n^(−1/5)` | R `bw.nrd0`，**R `density` 的历史默认** [21][22]，Silverman (1986) [19] |
| Scott | `h = 1.06 · σ̂ · n^(−1/5)` | R `bw.nrd`；正态参考下 AMISE 最优 [21]，Scott (1992/2015) [20] |
| 无偏/有偏交叉验证 | `bw.ucv` / `bw.bcv` | `O(n²)`（分箱后 `O(n)`）[21] |
| Sheather–Jones 代入法 | `bw.SJ(method = "ste"/"dpi")` | 公认综合表现最好 [23][21] |
| 扩散法 | Botev 等 | 无需选核，直接解扩散方程 [24] |

R 手册明确写道：`nrd0` 之所以是默认，「是历史与兼容性原因，而不是一般推荐」，`"SJ"` 通常拟合更好 [22]。这句话值得直接引用到本库的文档里。

#### 2.3.4 边界偏差

对称核在有限支撑（如 `[0, ∞)`）上会把概率质量「泄漏」到支撑之外，边界附近偏差从 `O(h²)` 退化为 `O(h)` [27]：

实测（附录 A/F）：20 个 `Exp(1)` 样本，Silverman `h = 0.3872` [C]：

| x | 朴素 KDE | 真值 `e^(−x)` | 反射修正 |
|---|---|---|---|
| 0.00 | **0.4633** | 1.0000 | 0.9265 |
| 0.25 | 0.5995 | 0.7788 | 0.8524 |
| 0.50 | 0.5695 | 0.6065 | 0.6653 |
| 1.00 | 0.3255 | 0.3679 | 0.3300 |

`x = 0` 处低估 **54%**，并有约 **14.9%** 的总质量落在 `x < 0`。

修正方案：
1. **反射/重归一化**：在 `[2a − x]` 处镜像数据点，或除以核在该点的有效质量。实现简单，适合快速修正 [18][27]。
2. **Jones 边界核**：把核在边界处线性重加权，保持 `O(h²)` 偏差 [25]。
3. **Gamma 核**（Chen）：`K_{x/b+1, b}(t)`，其支撑随 `x` 移动，`x → 0` 时自动退化为指数型，边界无额外偏差（偏差 `O(b)`，`b` 为平滑参数）[26][27]。

#### 2.3.5 复杂度

- 朴素求值：`m` 个网格点 × `n` 个样本 = `O(nm)`。
- FFT：`O(n + N log N)`（R 用 FFT，`n > 512` 时向上取 2 的幂再插值 [22]）。
- 分箱近似（linear binning）：`O(n + m)`，是大型数据的默认路径。
- 带宽交叉验证：`O(n²)`，分箱后 `O(n)` [21]。

#### 2.3.6 参数与默认值建议

| 参数 | 建议默认 | 依据 |
|---|---|---|
| `kernel` | `"gaussian"` | R `density` 默认 [22] |
| `bandwidth` | `"silverman"` | R `bw.nrd0` 默认、闭式、`O(n)` [21] |
| 提供 `"sj"` | 是 | R 手册称其通常更优 [22][23] |
| `cut` | `3`（网格超出数据 `3h`） | R `density` 默认 [22] |
| `adjust` | `1` | R 语义：实际带宽 `= adjust × bw` [22] |
| 边界处理 | `"none"` 默认，`"reflection"` / `"gamma"` 可选 | 静默修正会改变语义，必须显式 [25][26] |

---

### 2.4 矩与形状

#### 2.4.1 偏度的三种定义

```
g1 = m3 / m2^(3/2)                                  （有偏，矩估计；SciPy 默认 bias=True [31]）
b1 = m3 / s³                                        （用无偏 s，仍非无偏）
G1 = √(n(n−1))/(n−2) · g1 = n²/((n−1)(n−2)) · b1    （正态下无偏；Excel/SPSS/SAS/Minitab）
```

关系与方差（`X ~ N`）[28][30]：

```
Var(G1) = 6n(n−1) / ((n−2)(n+1)(n+3))
Var(b1) < Var(g1) < Var(G1)
√n · b1 → N(0, 6)   ⇒  SE(偏度) ≈ √(6/n)
```

#### 2.4.2 峰度的三种定义（这是分歧最大的一处）

```
g2 = m4 / m2² − 3                    （有偏，超额，Fisher；SciPy 默认 bias=True, fisher=True）
b2 = m4 / s⁴                         （Pearson 定义，非超额；注意 b2 − 3 才是超额版）
G2 = ((n−1)/((n−2)(n−3))) · ((n+1)·g2 + 6)   （正态下无偏；Excel KURT、pandas）
```

`g2` 的等价形式 `g2 = (1/n)Σ z_i⁴ − 3`，其中 `z_i` 用**分母为 n** 的标准差 [28]。方差与标准误 [29]：

```
Var(g2) = 24n(n−1)² / ((n−3)(n−2)(n+3)(n+5))
√n · g2 → N(0, 24)   ⇒  SE(峰度) ≈ √(24/n)
```

样本峰度还有上界（`n > 2`）：`g2 ≤ ½·(n−3)/(n−2)·g1² + n/2 − 3` [29]。这条不等式可用于实现自检：任何实现只要越界就一定是公式错了。

#### 2.4.3 三种定义差多少（数值）

数据：`[0,3,4,1,2,3,0,2,1,3,2,0,2,2,3,2,5,2,3,999]`（Wikipedia 峰度条目的原例，`n = 20`）[29][C]：

| 量 | 值 |
|---|---|
| `g1` | 4.129251 |
| `b1` | 3.823462 |
| `G1` | 4.471885 |
| `g2`（超额，有偏） | **15.051427** |
| `b2 = m4/s⁴`（非超额） | 16.291412 |
| `b2 − 3` | 13.291412 |
| `G2`（超额，无偏） | **19.998429** |
| `SE(g1)` / `SE(g2)` | 0.512103 / 0.992384 |

- `g2` 复现了 Wikipedia 的 15.05（18.05 − 3），说明计算路径正确 [29]。
- `G2 − g2 = 4.947`：同一组数据，两种峰度定义相差 **32.9%**。
- 即使**没有离群点**（`n = 20` 正态样本，seed 0），`G2 − g2 = 0.429`、`G1 − g1 = −0.035`——小样本偏差是结构性的，不是异常值造成的 [C]。
- 因为 `SE(g2) ≈ 0.99`，`g2 = 15.05` 距离正态的 0 有 **15 个标准误**；而 `G2 = 20.0` 是 `20.2` 个标准误。**两者对「有多重尾」的叙述强度不同**，报告里必须写清用的是哪一个。

#### 2.4.4 超额 vs 非超额

Pearson 峰度 = Fisher 峰度 + 3。正态：Pearson `= 3`，Fisher `= 0`。SciPy `kurtosis(fisher=True)` 是默认，`fisher=False` 返回 Pearson [32]；pandas `Series.kurt` 文档写明「unbiased kurtosis」，即 `G2` [58]。**mixed 使用是本领域最高频的 bug**：把 pandas 的 `G2` 当 `g2` 与 SciPy 的 `g2` 比，会稳定地高估 0.4~5 个单位。

#### 2.4.5 复杂度

- 两遍：`O(n)` 时间、`O(1)` 额外空间（先均值，再累加中心矩）。
- 单遍在线（Welford / 高阶矩递推）：`O(n)`，但需 `M2, M3, M4` 三个累加器；数值上劣于两遍，仅在流式下使用 [55]。
- 若数据已排序（分布对象通常已排序），仍为 `O(n)`。

---

### 2.5 熵与散度

#### 2.5.1 Shannon 熵与直方图估计偏差

```
H(X) = −Σ_i p_i ln p_i        （nats；底数 2 则为 bits）
```

熵的定义、单位与性质见 [33]。

连续情形（微分熵）：`h(X) = −∫ f ln f dx`，直方图估计为

```
ĥ = −Σ_i p̂_i ln p̂_i + ln w        （w 为箱宽；即离散熵 + ln w）
```

偏差是**系统性负偏**且随 `k/n` 增大而恶化：箱数越多，每箱样本越少，`p̂` 越容易低估熵 [34][36]。实测（`n = 200`，`U(0,1)`，真值 `h = 0`）[C]：

| k | 箱宽 | 非空箱 | `ĥ` | 偏差 |
|---|---|---|---|---|
| 4 | 0.2500 | 4 | −0.0036 | −0.0036 |
| 8 | 0.1250 | 8 | −0.0088 | −0.0088 |
| 16 | 0.0625 | 16 | −0.0417 | −0.0417 |
| 32 | 0.0312 | 32 | −0.0688 | −0.0688 |
| 64 | 0.0156 | 63 | −0.1324 | **−0.1324** |

经典一阶修正（Miller–Madow）为 `Ĥ_MM = Ĥ_MLE + (K̂ − 1)/(2n)`，`K̂` 为非空箱数 [34]（原文 Miller 1955 未读到，公式转引，本文仅做数值一致性校验：`k=16, n=200` 预测 −0.0375，实测 −0.0417；`k=64` 预测 −0.1575，实测 −0.1324，量级一致）。即便如此，**调箱数就能把熵改掉 0.13 nats（约 0.19 bits）**，所以熵必须与分箱方案一起报告。

#### 2.5.2 k-近邻熵估计（Kozachenko–Leonenko）

一维样本间距形式 [35, Eq. 4]：

```
H(X) ≈ (1/(N−1)) Σ_{i=1}^{N−1} ln(x_(i+1) − x_(i)) + ψ(1) − ψ(N)
```

一般 `d` 维形式 [35, Eq. 20]：

```
Ĥ(X) = −ψ(k) + ψ(N) + ln c_d + (d/N) Σ_{i=1}^{N} ln ε(i)
```

其中 `ε(i)` 是 `x_i` 到其第 `k` 近邻距离的 **2 倍**，`c_d` 是 `d` 维单位球体积（最大范数下 `c_d = 1`；欧氏范数下 `c_d = π^(d/2)/(Γ(1 + d/2)·2^d)`）[35]。

两个实现陷阱：
1. **`ε` 的 2 倍约定**：用「距离」而非「2×距离」的实现会差 `d·ln 2`（一维 0.693 nats）。跨库对比必须先对齐这条约定 [35]。
2. `ψ(N) − ψ(k)` 在 `k ≪ N` 时近似 `ln(N/k)`；`k` 太小方差大，`k` 太大会引入偏差。原文在第 II 节把 `k = 1` 的推导推广到任意 `k < N`，并指出 Eq. 20 的偏差只来自"密度在 ε-球内近似常数"这一条假设；其对 Eq. 18 的修正项为 `O(1/N²)`，在 `k`、`N` 都大时按 `(k/N)²` 缩放 [35]——因此 `k` 本身就是"偏差 vs 方差"的旋钮，必须作为参数暴露而不是写死。

复杂度：朴素 `O(n²)`；kd-tree / cover tree `O(n log n)`（一维排序后 `O(n log n)`，间距形式只需排序 `O(n log n)`）。

#### 2.5.3 KL 散度：为什么不对称

```
D_KL(P‖Q) = Σ_i p_i ln(p_i / q_i)
```

它不是度量：不满足对称性与三角不等式 [39]。该量由 Kullback 与 Leibler (1951) 提出 [37]。语义是「用 `Q` 近似 `P` 时每观测的**期望多余 surprisal**」[39]——这个解释本身就决定了方向性：`P` 是真实分布，`Q` 是模型。反向的 `D_KL(Q‖P)` 对应「用 `P` 近似 `Q`」，在变分推断里正是 ELBO 的方向，两者数值一般不同。

实测 `P = (0.5, 0.5)`、`Q = (0.9, 0.1)` [C]：

```
D_KL(P‖Q) = 0.510826 nats = 0.736966 bits
D_KL(Q‖P) = 0.368064 nats = 0.531004 bits       （差 38.8%）
```

当 `q_i = 0` 而 `p_i > 0` 时 `D_KL = +∞`——这不是数值问题，是定义。工程上必须显式选择平滑策略（加 `ε`、或用 JS），且把 `ε` 写进 API 参数而不是藏在实现里。对称化版本是 Jeffreys 散度 `D(P‖Q) + D(Q‖P)`，Kullback 本人称其为 "divergence" [39]。

#### 2.5.4 JS 散度：何时用它

```
M = (P + Q)/2
JSD(P‖Q) = ½ D_KL(P‖M) + ½ D_KL(Q‖M)
```

- **对称**且**总有界**：底数为 2 时 `0 ≤ JSD ≤ 1`（bit），更一般地 `n` 个分布时 `≤ log_b n` [40][38]。
- `√JSD` 是度量（满足三角不等式），因此可做聚类/最近邻的"距离" [40]。
- 当两个分布支撑不交时，`JSD = log_b 2`（本文实测：0.693147 nats = 1 bit），而 `KL = ∞` [C]。
- 代价：JS 对"完全没重叠"和"几乎没重叠"不敏感（都接近上界），需要区分尾部时要换别的度量。

实测同一对分布：`JSD = 0.101749 nats = 0.146793 bits`，`√JSD = 0.318982` [C]。

#### 2.5.5 复杂度与默认值

| 量 | 复杂度 | 默认 |
|---|---|---|
| 直方图熵 | `O(n + k)` | 底数 `e`（nats），与 SciPy `entropy` 的 `base=None` 一致 [41] |
| kNN 熵 | `O(n log n)`（树） | `k = 3`，`ε` 用 2× 距离以对齐 Kraskov [35] |
| KL | `O(k)` | `ε = 0`（不隐式平滑），零概率即 `Infinity` |
| JS | `O(k)` | 底数 `e`；另提供 `jensenShannonDistance()` 返回 `√JSD` |

SciPy `entropy(pk, qk)` 会**自动归一化**输入且在 `qk=0` 处返回 `inf` [41]；本库若沿用「自动归一化」必须写进文档，否则用户传入未归一化权重时会得到与手算不符的结果。

---

### 2.6 拟合与检验

#### 2.6.1 Shapiro–Wilk

```
W = (Σ a_i x_(i))² / Σ (x_i − x̄)²
```

`a_i` 由正态次序统计量的期望与协方差 `V` 导出（`a = V⁻¹m / (mᵀV⁻¹V⁻¹m)^(1/2)`）[43]（原论文 Shapiro & Wilk 1965 [42]）。`W` 的分布无闭式，临界值来自 Monte Carlo [43]；R 的实现是 Royston (1995) 的 Fortran 移植，`p` 值在 `n = 3` 时精确，`4 ≤ n ≤ 11` 与 `n ≥ 12` 用不同近似 [44]。

**硬约束**：R 要求非缺失样本量 `3 ≤ n ≤ 5000` [44]。`n > 5000` 时不该静默截断或外推，应抛错或改用 Anderson–Darling / D'Agostino。

#### 2.6.2 Anderson–Darling

二次 EDF 统计量族的一般形式与 AD 的特例 [46]：

```
n ∫ (F_n − F)² w(x) dF(x),   w(x) = 1            → Cramér–von Mises
A² = n ∫ (F_n − F)² / (F(1 − F)) dF              → Anderson–Darling
```

计算式（`Y_i` 为标准化后的次序统计量）[46]：

```
A² = −n − (1/n) Σ_{i=1}^{n} (2i − 1) [ ln Φ(Y_i) + ln(1 − Φ(Y_{n+1−i})) ]
```

权重 `1/(F(1−F))` 让**尾部获得更大权重**，这正是 AD 对尾部偏离（重尾、双峰）比 KS 敏感的原因 [46][47]（原论文 Anderson & Darling 1952 [45]）。

**关键区别**：参数已知时临界值分布无关；**参数被估计时（正态拟合几乎总是如此）必须用修正统计量或修正临界值**，Stephens 给出了 `A*² = A²(1 + 0.75/n + 2.25/n²)` 一类修正 [46][47]。SciPy `anderson` 的 `dist='norm'` 用的就是「均值方差由样本估计」的那套临界值 [69]。

#### 2.6.3 Kolmogorov–Smirnov 与 Lilliefors

```
D_n = sup_x |F_n(x) − F(x)|
√n D_n → sup_t |B(F(t))|     （B 为布朗桥，F 连续时分布无关）
```

分布无关性只在 `F` **完全指定**时成立 [48]。一旦用样本估计 `μ, σ`，`D_n` 的零分布随机地变小（因为拟合把分布"拉向"数据），标准 KS 临界值随之失效——这正是 Lilliefors 检验要解决的问题，其临界值只能由 Monte Carlo 得到 [49][50]。

本文模拟（`n = 50`，4000 次重复，附录 A/H）[C]：

| 情形 | `q95(D)` | `P(D > 1.36/√n)` |
|---|---|---|
| `μ, σ` 已知（标准 KS） | 0.1865 | 0.0413 |
| `μ, σ` 由样本估计（Lilliefors 场景） | **0.1222** | **0.0000** |

也就是说：**用 `1.36/√n` 去卡「估计了参数的正态性检验」，功效几乎归零**（在这组模拟中一次都没拒绝）。这是本领域最常见、后果最严重的统计错误之一。

#### 2.6.4 Q–Q 图

把样本次序统计量 `x_(k)` 对理论分位数 `Φ⁻¹(p_k)` 作图；两点分布相同时点落在 `y = x` 上，线性相关时落在某条直线上（可用来估 location–scale 参数）[51]。`p_k` 的取法（plotting positions）有多种，必须与分位数类型保持一致；否则 Q–Q 图与 `quantile()` 会给出互相矛盾的故事。

诊断语义：
- 两端向上/向下弯 → 重尾/轻尾（峰度）；
- 整体呈弓形 → 偏度；
- 少数点远离直线 → 离群点；
- 台阶状 → 离散化/重复值。

复杂度：`O(n log n)`（排序 + 一次求值）。

#### 2.6.5 参数估计：MLE vs 矩估计

| | MLE | MoM |
|---|---|---|
| 一致性 | 是（正则条件下） | 是 |
| 渐近有效性 | 达到 Cramér–Rao 下界 | 一般达不到 |
| 不变性 | `g(θ̂_MLE) = ĝ(θ)̂_MLE` | 无 |
| 正态分布 | 与 MoM **完全重合** [53] | 同左 |
| 均匀 `U(a,b)` | `â = min x`, `b̂ = max x` | `â = m1 − √(3(m2 − m1²))`, `b̂ = m1 + √(3(m2 − m1²))` [53] |

`U(0,θ)` 的 MLE 是 `max x`，而 `E[max] = θ·n/(n+1)`，**系统性低估 `θ/(n+1)`**——这是「MLE 无偏」这一口误的反例，需在文档中显式提醒（该期望为本文推导 [C]；MLE 定义与性质见 [52]）。

工程结论：本库若提供 `fit(distribution)`，应同时返回 `method: "mle" | "mom"` 与**标准误**（由 Fisher 信息的数值 Hessian 或 bootstrap 得到），否则「拟合优度」无法解释。

---

### 2.7 稳健统计

#### 2.7.1 崩溃点：为什么均值/标准差不可用

崩溃点（breakdown point）= 能让估计量跑到任意远的最小污染比例 [64]。中位数 `50%`，均值 `0`（一个观测即可任意移动），标准差同样 `0` [64]。

数值（附录 A/D）[C]：

| 数据 | mean | median | sd (n−1) | MAD | MAD×1.4826 | IQR |
|---|---|---|---|---|---|---|
| `1..9` | 5.000 | 5.000 | 2.739 | 2.000 | 2.965 | 4.000 |
| `1..8, 100` | **15.111** | 5.000 | **31.916** | 2.000 | 2.965 | 4.000 |

把 `100` 追加到 `1..8` 后，均值涨 202%、标准差涨 1065%，而中位数、MAD、IQR **一位数字都没变**。这就是「用 `x̄ ± 2s` 找离群点」在重尾数据上必然失败的原因：`s` 本身被离群点污染，阈值随之膨胀，于是什么都检不出来。

#### 2.7.2 MAD

```
MAD = median( |x_i − median(x)| )
σ̂ ≈ 1.4826 · MAD        （1.4826 = 1/Φ⁻¹(3/4) = 1/0.67449）
```

常数来自正态下 `MAD/σ = Φ⁻¹(3/4) = 0.67449`，故 `k = 1/0.67449 = 1.4826` 使 `E[MAD] = σ`（大 `n`）[59][60]。R 的实现还提供 `low`/`high` 两种偶数样本下的中位数取法，且 `n = 1` 时返回 `0` [60]。

注意：`1.4826·MAD = 2.965` 与真实 `sd = 2.739` 在 `n = 9` 时差 8%——常数是**渐近期望**，小样本下不该期待两者相等 [C]。

**跨库陷阱**：R 的 `mad()` 默认 `constant = 1.4826`（已乘好）[60]，而 SciPy 的 `median_abs_deviation()` 默认 `scale = 1.0`（**不**缩放），要得到一致性估计必须显式写 `scale="normal"`（等价于除以 0.67449）[68]。同一个 MAD 在两个库里相差 48%，是本领域最容易踩的默认值差异之一。

方差/标准差的稳健替代还有 `Sn`、`Qn`（Rousseeuw–Croux），在保持高崩溃点的同时效率显著高于 MAD [61]。

#### 2.7.3 IQR 与离群点判定

```
IQR = Q3 − Q1
下栅栏 = Q1 − 1.5·IQR      上栅栏 = Q3 + 1.5·IQR
```

超出栅栏的点在箱线图中标为离群点；「far out」用 `3·IQR`。注意箱线图的须**不是**栅栏本身，而是栅栏内最远的实际数据点，因此两条须可以不等长 [62]。

**必须与分位数类型绑定**：`Q1/Q3` 用哪一型，IQR 就随之变化；本库当前 `interquartileRange()` 继承的是 `quantile()` 的最近秩实现（见 §5）。

#### 2.7.4 截尾均值

```
γ-截尾均值 = 去掉最小 ⌊γn⌋ 个与最大 ⌊γn⌋ 个后的算术平均
```

- 常用 `γ ∈ [5%, 25%]`；`γ = 25%` 即四分位均值（interquartile mean）；`γ → 0.5` 退化为中位数 [63]。
- `γn` 不是整数时有两种做法：**截断**（取 `⌊γn⌋`，R `mean(trim=)` 的做法）或**插值**（在相邻两个整数截尾水平间线性插值）[63]。两种做法给出不同数值，必须声明。
- 代价：正态下效率低于均值，重尾（Cauchy）下显著优于均值与中位数 [63]。

数值（附录 A/D）[C]：`1..9` 追加 `1000` → 均值 `104.5`、中位数 `5.5`、10% 截尾均值 `5.5`、20% 截尾均值 `5.5`。截尾均值在这里与中位数一致（因为截尾后只剩中间 8 个数且对称）。

---

### 2.8 数值约定

#### 2.8.1 n vs n−1：四种分母

`Σ(x−x̄)²` 的分母有四种常见选择 [54]：

| 分母 | 性质 | 使用者 |
|---|---|---|
| `n` | 总体方差（有偏，低估 `(n−1)/n`） | NumPy `var` 默认 `ddof=0` [57]；本库 `variance()` [C] |
| `n−1` | 无偏（Bessel 修正） | R `var`/`sd` [56]；pandas |
| `n+1` | 正态下最小 MSE | 收缩估计 |
| `n−1.5` | 正态下标准差近似无偏 | 需要无偏 `σ̂` 时 |

关键细节：`s = √s²` 即使做了 Bessel 修正**仍然有偏**（Jensen 不等式，平方根是凹函数）[54]。所以「无偏标准差」和「无偏方差」不能同时成立——文档里必须写「`variance` 无偏，`standardDeviation` 是其平方根，因此略偏」。

数值：`[1,2,3,4,5]` 的总体方差 `2`，样本方差 `2.5`，差 **25%**；`n = 5` 时 `n/(n−1) = 1.25`。

#### 2.8.2 一遍算法的灾难性抵消

```
朴素： SumSq − (Sum×Sum)/n
```

当 `Σx²` 与 `(Σx)²/n` 接近时（即标准差远小于均值），相减会丢失大量有效位，Wikipedia 明确写「不应在实践中使用」[55]。

三种替代 [55]：

1. **平移**：先减去任一位移 `K`（如首个观测），再算 —— 平移不变性保证结果正确。
2. **两遍**：先求 `x̄`，再累加 `(x_i − x̄)²`。**本库默认应选这条**。
3. **Welford 在线**：`M_k` 递推，单遍、稳定，适合流式 collector。

#### 2.8.3 计数与类型

- 计数、索引、箱内频数一律 `bigint`（本库惯例，见 `SynchronousCollector.collect` 的 `count: bigint`）。
- 累加用 `number`（float64）；对 `n > 10^7` 的长流，应提供 Kahan/Neumaier 补偿求和或成对求和。
- `NaN` / `±Infinity` 必须在入口被拒绝（`TypeError`），而不是传播到结果里。本库 `isNumber` 已排除非有限值，沿用即可。
- 常数样本（`s = 0`）：偏度/峰度无定义，返回 `Optional.empty()`，不要返回 `0`（返回 0 会被误读为"对称/常峰"）。

---

## 3. 参数与默认值总表

| 能力 | 参数 | 默认 | 依据 |
|---|---|---|---|
| 直方图 | `rule` | `"freedman-diaconis"` | 重尾稳健 [3]；绘图场景可退 `"sturges"` |
| 直方图 | `closed` | `"left"`（末箱右闭） | NumPy 语义，保证 `Σm_i = n` [65] |
| 直方图 | `kMax` | `1000` | 防 FD 爆炸 [C] |
| 直方图 | `density` | `true` | 返回 `m_i/(n·w_i)`，跨箱可比 |
| 分位数 | `method` | `"type-7"` | R / NumPy / Excel `.INC` 一致 [11][12] |
| 分位数 | 越界 `p` | `RangeError` | 不静默裁剪 [11] |
| KDE | `kernel` | `"gaussian"` | R `density` [22] |
| KDE | `bandwidth` | `"silverman"` | R `bw.nrd0` [21] |
| KDE | `cut` | `3` | R `density` [22] |
| KDE | `boundary` | `"none"` | 显式优于隐式 [25][26] |
| 偏度 | `estimator` | `"G1"` | 与 Excel/SPSS 对齐 [28]；`"g1"` 保留兼容 |
| 峰度 | `estimator` | `"G2"` | 与 Excel/pandas 对齐 [28][58] |
| 峰度 | `excess` | `true` | 报告用 Fisher 更直观 [32] |
| 熵 | `base` | `Math.E` | SciPy 默认 nats [41] |
| 熵 | `bins` | 与直方图同一对象 | 避免"熵和直方图不同箱"的自欺 |
| KL | `epsilon` | `0` | 不隐式平滑；零概率 → `Infinity` |
| JS | `base` | `Math.E`；`distance` 返回 `√JSD` | [40] |
| 检验 | `test` | `"anderson-darling"` | 对尾部更敏感 [46][47] |
| 检验 | `alpha` | `0.05` | 惯例 |
| 稳健 | `scale` | `"mad"`，`constant = 1.4826` | R `mad` [60] |
| 稳健 | `trim` | `0.1` | 常用下限 [63] |
| 数值 | `ddof` | 显式必填（无默认） | 强制调用方表态 [54] |

---

## 4. 陷阱清单（20 条，均为「错误 → 正确 + 数值」）

**T1. 峰度三定义混用**
❌ 用 SciPy 的 `g2 = 15.051` 去对 Excel `KURT` 的 `19.998`，得出「两库不一致」。
✅ 显式声明 `estimator ∈ {"g2","G2","b2"}`。同一组数：`g2 = 15.051`、`G2 = 19.998`、`b2 = 16.291`，最大差 **32.9%** [C]。

**T2. 偏度三定义混用**
❌ 到处用 `m3/m2^1.5`。
✅ `g1 = 4.129` / `b1 = 3.823` / `G1 = 4.472`，三者相差 17% [C]。

**T3. 方差分母不声明**
❌ 拿 NumPy `var`（`ddof=0`）与 R `var`（`n−1`）对账。
✅ `[1..5]`：`2.0` vs `2.5`，差 **25%** [54][57][56]。

**T4. 分位数类型不声明**
❌ 默认认为「中位数以外都一样」。
✅ `p = 0.9` 时同一组 8 个数从 **7.000（类型 3）到 9.000（类型 1）** [C]。

**T5. 重复值下分位数塌缩**
❌ 对 `[1,1,1,1,100]` 用类型 3 求 P90 → **1.000**，报告「P90 延迟 1ms」。
✅ 用类型 7（60.400）或类型 1（100.000）。类型 3 的"就近取"在离散/重复数据上会完全屏蔽离群点 [C][11]。

**T6. 估计参数后仍用 KS 临界值**
❌ `kstest(x, 'norm', args=(x.mean(), x.std()))`。
✅ 用 Lilliefors 临界值或 AD。模拟：`n=50` 时 `P(D > 1.36/√n)` 从 0.0413 掉到 **0.0000** [C][49][50]。

**T7. 对 `n > 5000` 用 Shapiro–Wilk**
❌ 直接算，或静默截断到 5000。
✅ 抛 `RangeError` 或切换检验。R 明确限制 `3 ≤ n ≤ 5000` [44]。

**T8. 直方图末箱不闭合**
❌ `[a,b)` 用于全部箱。
✅ 末箱 `[a,b]`。`[0,1,2]` 配 `bins=[0,1,2]`：正确计数 `(1,2)` 合计 3；错误写法得 `(1,1)` 合计 2 [65]。

**T9. FD 在离群点下箱数爆炸**
❌ 无脑用 `"fd"`。
✅ 加 `kMax` 或先截尾。实测 `n=200`：无离群点 `k=14`，一个 `25.0` 使 `k=66`（IQR 几乎没变，极差从 5.58 涨到 27.46）[C]。

**T10. 小样本用 Sturges**
❌ `n = 20` 用 Sturges 得 `k = 6`。
✅ `n < 30` 时至少用 `max(sturges, 7)` 或改用 FD。Wikipedia 明确警告 `n < 30` 时箱数 < 7，难以显示结构 [8]。

**T11. 直方图熵不校正**
❌ 用 `k = 64` 的分箱熵当微分熵。
✅ 报偏差或做 Miller–Madow 修正。`n=200, U(0,1)`：`k=4` 偏差 −0.0036，`k=64` 偏差 **−0.1324 nats** [C][34]。

**T12. 相信 `numpy.histogram_bin_edges(bins='auto')` 的字面语义**
❌ 以为 `auto = min(sturges, fd)`。
✅ NumPy ≥ 2.0 源码里 `auto` 是 **relaxed FD**：`min(max(fd_bw, sqrt_bw/2), sturges_bw)`（`_hist_bin_auto`）。同一份含离群点数据：裸 `fd` = 66 箱，`auto` = **29 箱**（本机 numpy 2.3.5 实测；`sqrt_bw/2` 补齐后手算 `ceil(27.4576/0.9708) = 29`，与输出吻合）[66][C]。**跨版本复现必须锁版本。**

**T13. 把 KL 当距离**
❌ `kl(a,b)` 与 `kl(b,a)` 混用。
✅ `D(P‖Q) = 0.510826` vs `D(Q‖P) = 0.368064` nats，差 38.8%；不满足三角不等式 [C][39]。

**T14. KL 遇零概率无策略**
❌ `q_i = 0, p_i > 0` → `Infinity` 冒到 UI。
✅ 显式 `epsilon` 平滑或改用 JS。`P=(1,0)`, `Q=(0,1)`：`KL = ∞`，`JSD = 0.693147 nats = 1 bit` [C][40]。

**T15. KDE 在有限支撑上泄漏**
❌ 对 `[0,∞)` 数据直接用 Gaussian 核。
✅ 反射/重归一化/gamma 核。`Exp(1)`, `n=20`, `h=0.3872`：`f̂(0) = 0.4633` vs 真值 `1.0`（低估 54%），**14.9%** 质量落在负半轴 [C][25][26]。

**T16. MAD 忘记乘 1.4826**
❌ 直接用 `MAD = 2.0` 与 `sd = 2.739` 比。
✅ `1.4826 × 2.0 = 2.965`；不乘会低估 27%（`n=9`）[C][59][60]。

**T17. 截尾均值取整方式不一致**
❌ 以为 `trim = 0.15, n = 10` 会去掉 1.5 个。
✅ 要么 `⌊0.15×10⌋ = 1`（截断，R 做法），要么在 10%/20% 之间线性插值。两种结果不同，必须声明 [63]。

**T18. 单遍 `Σx² − (Σx)²/n`**
❌ 用它算方差。
✅ 两遍或 Welford。当 `sd/|mean|` 很小时有效位大量丢失，Wikipedia 明确不建议使用 [55]。

**T19. 用 `sd` 做离群点阈值**
❌ `|x − x̄| > 2s`。
✅ 用 `|x − median| > 3 × 1.4826 × MAD`。数据 `1..8,100`：`s = 31.916`，`3×MAD×1.4826 = 8.895`——前者把 `100` 也包进去了 [C][59]。

**T20. 空样本 / 常数样本除零**
❌ `g2` 在 `n = 3` 时仍套 `G2` 公式（分母 `n−3 = 0`）；`s = 0` 时算 `m3/s³`。
✅ `G2` 要求 `n ≥ 4`；`g2`/`G2` 在 `s = 0` 时无定义。统一返回 `Optional.empty()`，并让 `@throws` 只覆盖类型错误而非"数据不够" [C]。

---

## 5. 与本库现状的差距（只读分析，未改动代码）

现状：`src/synchronous/semantic.ts` 的 `SynchronousNumericStatistics` 已提供 `mean` / `median` / `mode` / `variance` / `standardDeviation` / `range` / `summate` / `average` / `quantile` / `interquartileRange` / `skewness` / `kurtosis`，`SynchronousBigIntStatistics` 提供同名的大整数版本。但：

> **行号快照说明**：下表行号取自 2026-11-05 08:20（CST）的 `semantic.ts`（4110 行）。该文件在本次调研期间正被并行修改（同一模式也出现在 `SynchronousBigIntStatistics` 上），**行号会漂移，语义描述才是权威**。核对时请以方法名 + 代码片段为准。

| 位置（Numeric / BigInt） | 当前实现 | 等价于 | 风险 |
|---|---|---|---|
| `semantic.ts:3866-3882` / `3409-3425` | `index = max(0, ceil(q·n) − 1)`，直接取 `data[index]` | **Hyndman–Fan 类型 1**（逆 ECDF，阶跃） | 与 R/NumPy 默认（类型 7）系统性不同；`p = 0.75, n = 8` 给 `5.0` 而非 `5.5`；对重复值会出现 T5 的塌缩 |
| `semantic.ts:3902-3915` / `3445-3458` | `interquartileRange()` 调用两次 `quantile()` | 类型 1 的 IQR | 栅栏（Tukey fences）随之偏移，离群点判定与 R/箱线图不一致 |
| `semantic.ts:3935-3958` / `3478-3501` | `z = (x − mean)/standardDeviation_pop`，返回 `mean(z³)` | **`g1`**（有偏） | 与 Excel/SPSS 的 `G1` 差 8%（本例） |
| `semantic.ts:3977-4000` / `3517-3540` | `mean(z⁴) − 3` | **`g2`**（有偏超额） | 与 pandas/Excel 的 `G2` 差 33%（本例） |
| `semantic.ts:3680-3691` / `3208-3219` | 文档明确写「population variance」 | 分母 `n` | 与 R/pandas 的 `n−1` 差 `n/(n−1)`；`n = 5` 时 25% |
| 全部 | 空样本返回 `0` 而非 `Optional.empty()` | — | `0` 会被误读为"对称/零方差"，与本库 `Optional` 惯例冲突 |
| — | 无直方图 / ECDF / KDE / 熵 / 散度 / 检验 / MAD / 截尾均值 | — | 本文 §2.1、§2.3、§2.5、§2.6、§2.7 全部缺失 |

上一轮已经通过 `useSynchronousXxx` 建立了 collector 生态，`SynchronousCollectable` / `SynchronousNumericStatistics` 也都带品牌符号（`#semantic/symbol`）。因此新能力的正确落点不是往 `SynchronousNumericStatistics` 里继续加方法（那会让「惰性视图」承担「物化分布」的职责），而是**新增一个物化的不可变值对象 `DistributionCollectable`**，由 `toDistribution()` 与 collector 两条路径产生。

---

## 6. API 提案

### 6.1 设计约束（来自本库既有约定）

1. **不可变值对象**：构造时校验，`Object.freeze`，访问器只读（参照 `Sample` / `Frequency` / `Bin`）。
2. **`Optional<T>`**：可能不存在的结果一律 `Optional`，不返回哨兵值（参照 `Optional.of` / `Optional.empty`）。
3. **`bigint` 索引与计数**：`count`、`index`、箱内频数用 `bigint`（参照 `SynchronousCollector.collect`）。
4. **`useXxx` 工厂**：对外入口是工厂函数，类本身可以只暴露静态工厂（参照 `useSynchronousAnyMatch`、`useField`）。
5. **`#semantic/...` 子路径导入**：`import { Optional } from "#semantic/optional"`。
6. **`erasableSyntaxOnly`**：不能用 `enum`、`namespace`、构造函数参数属性。所有"枚举"用字符串字面量联合类型 + `Object.freeze` 数组校验（参照 `bin.ts` 的 `Normalization`）。
7. **`verbatimModuleSyntax`**：类型导入必须 `import type`。

需要在 `#semantic/symbol` 新增（**本次未修改**）：

```ts
export const DistributionCollectableSymbol: unique symbol = Symbol.for("DistributionCollectable");
```

### 6.2 类型与选项

```ts
import { isNumber, isBigInt } from "#semantic/guard";
import { Optional } from "#semantic/optional";
import type { Comparator, Functional } from "#semantic/utility";

/** 分箱规则。字符串字面量而非 enum：tsconfig 开启了 erasableSyntaxOnly。 */
export type HistogramRule =
    | "sturges" | "scott" | "freedman-diaconis"
    | "sqrt" | "rice" | "doane" | "terrell-scott";

/** 箱宽来源：规则推导，或调用方显式给出的边界（含最右边界）。 */
export type HistogramBinning = HistogramRule | ReadonlyArray<number>;

/** 九种 Hyndman–Fan 分位数类型，命名与 R 的 type 参数一一对应。 */
export type QuantileMethod =
    | "type-1" | "type-2" | "type-3" | "type-4" | "type-5"
    | "type-6" | "type-7" | "type-8" | "type-9";

export type SkewnessEstimator = "g1" | "b1" | "G1";
export type KurtosisEstimator = "g2" | "b2" | "G2";

export type KernelName =
    | "gaussian" | "epanechnikov" | "uniform"
    | "triangular" | "biweight" | "triweight";

export type BandwidthRule = "silverman" | "scott" | "sj" | "ucv";

export type BoundaryCorrection = "none" | "reflection" | "renormalize";

export type DivergenceMeasure = "kl" | "jeffreys" | "jensen-shannon";

export type NormalityTest =
    | "shapiro-wilk" | "anderson-darling"
    | "kolmogorov-smirnov" | "lilliefors";

/** 直方图选项。所有字段可选；未给出时按 §3 的默认值。 */
export interface HistogramOptions {
    /** 分箱规则或显式边界数组；默认 "freedman-diaconis"。 */
    readonly binning?: HistogramBinning;
    /** 半开区间约定：左侧闭（末箱右闭）或右侧闭（首箱左闭）；默认 "left"。 */
    readonly closed?: "left" | "right";
    /** 箱数上限，防止 FD 在离群点下爆炸；默认 1000n。 */
    readonly maximumBins?: bigint;
    /** 是否返回密度而非原始频数；默认 true。 */
    readonly density?: boolean;
}

export interface QuantileOptions {
    /** 默认 "type-7"（与 R / NumPy / Excel PERCENTILE.INC 一致）。 */
    readonly method?: QuantileMethod;
}

export interface DensityOptions {
    /** 默认 "gaussian"。 */
    readonly kernel?: KernelName;
    /** 默认 "silverman"；也可直接给正数带宽。 */
    readonly bandwidth?: BandwidthRule | number;
    /** 带宽缩放；等价于 R density 的 adjust。默认 1。 */
    readonly adjust?: number;
    /** 网格向数据外延伸的带宽倍数；默认 3（R density 的 cut）。 */
    readonly cut?: number;
    /** 边界修正；默认 "none"。 */
    readonly boundary?: BoundaryCorrection;
    /** 网格点数；默认 512n，且向上取 2 的幂。 */
    readonly gridSize?: bigint;
}

export interface DivergenceOptions {
    /** 对数底数；默认 Math.E（nats）。 */
    readonly base?: number;
    /** 零概率平滑量；默认 0，即不隐式平滑，零概率遇正概率直接 Infinity。 */
    readonly epsilon?: number;
}

export interface NormalityOptions {
    /** 默认 "anderson-darling"（对尾部更敏感）。 */
    readonly test?: NormalityTest;
    /** 显著性水平；默认 0.05。 */
    readonly alpha?: number;
}

export interface RobustOptions {
    /** 截尾比例 γ ∈ [0, 0.5)；默认 0.1。 */
    readonly trim?: number;
    /** 截尾取整方式；默认 "truncate"，可选 "interpolate"。 */
    readonly trimPolicy?: "truncate" | "interpolate";
    /** IQR 栅栏倍数；默认 1.5，far-out 用 3。 */
    readonly fence?: number;
}
```

### 6.3 返回类型（均为不可变值对象）

```ts
/** 一个直方图箱。左闭右开（末箱右闭），与 NumPy 语义一致。 */
export class HistogramBin {
    public constructor(lower: number, upper: number, count: bigint, density: number);
    public getLower(): number;
    public getUpper(): number;
    public getMidpoint(): number;
    public getCount(): bigint;
    public getDensity(): number;
    /** 是否落在本箱内；内部边界归属由 Histogram 的 closed 选项决定。 */
    public contains(value: number): boolean;
    public equals(other: HistogramBin): boolean;
    public toString(): string;   // "HistogramBin([0.5, 0.7) n=12 ρ=0.86)"
}

export class Histogram {
    public static use(bins: ReadonlyArray<HistogramBin>, rule: HistogramRule | "manual"): Histogram;
    public getBins(): ReadonlyArray<HistogramBin>;
    public getCounts(): ReadonlyArray<bigint>;
    public getDensities(): ReadonlyArray<number>;
    public getBinWidth(): number;          // 等宽时有效；显式边界时抛 RangeError
    public getTotal(): bigint;             // 必须等于样本量，否则实现有 bug
    public getRule(): HistogramRule | "manual";
    public getEntropy(options?: { readonly base?: number }): number;
    public toString(): string;
}

/** 经验分布函数：右连续阶梯，每步 1/n。 */
export class EmpiricalDistribution {
    public getOrderStatistics(): ReadonlyArray<number>;
    public getStep(): number;              // 1/n
    public evaluate(value: number): number;         // F_n(value)
    public leftLimit(value: number): number;        // F_n(value^-)，KS 统计量需要
    public quantile(probability: number, options?: QuantileOptions): Optional<number>;
    public toArray(): ReadonlyArray<number>;
}

/** 核密度估计，含带宽与核的元信息，便于复现。 */
export class DensityEstimate {
    public evaluate(value: number): number;
    public evaluateAll(values: Iterable<number>): ReadonlyArray<number>;
    public getBandwidth(): number;
    public getKernel(): KernelName;
    public getBoundary(): BoundaryCorrection;
    public integrate(lower: number, upper: number): number;  // 梯形法，O(m)
    public getSupport(): readonly [number, number];
}

export class MomentSummary {
    public getCount(): bigint;
    public getMean(): number;
    public getVariance(ddof?: 0 | 1): number;
    public getSkewness(estimator?: SkewnessEstimator): Optional<number>;
    public getKurtosis(estimator?: KurtosisEstimator, excess?: boolean): Optional<number>;
    public getSkewnessStandardError(): Optional<number>;
    public getKurtosisStandardError(): Optional<number>;
}

export class RobustSummary {
    public getMedian(): Optional<number>;
    public getMedianAbsoluteDeviation(constant?: number): Optional<number>;
    public getInterquartileRange(options?: QuantileOptions): Optional<number>;
    public getTrimmedMean(options?: RobustOptions): Optional<number>;
    public getLowerFence(factor?: number): Optional<number>;
    public getUpperFence(factor?: number): Optional<number>;
}

export class NormalityReport {
    public getTest(): NormalityTest;
    public getStatistic(): number;
    public getPValue(): Optional<number>;   // KS 的渐近 p 值有，Lilliefors 无闭式 → empty
    public getSampleSize(): bigint;
    public isRejected(alpha?: number): boolean;
    public getCriticalValue(alpha?: number): Optional<number>;
    public toString(): string;
}
```

### 6.4 主体：`DistributionCollectable`

```ts
/**
 * 一批数值的物化分布视图：已排序的取值 + 计数，及其上的全部分布刻画。
 *
 * 与 SynchronousNumericStatistics 的分工：后者是惰性管道上的即时统计量，
 * 每次调用都会重新消费数据源；本类型在构造时一次性排序并持有数据，
 * 因此可以在 O(log n) 内回答任意分位数，并与直方图 / ECDF / KDE 共享同一份
 * 次序统计量，保证「分位数、箱边界、Q-Q 图」三者不互相矛盾。
 *
 * 实例不可变：构造后 Object.freeze，任何派生操作返回新对象。
 */
export class DistributionCollectable {

    private readonly values: Float64Array;      // 已排序
    private readonly count: bigint;
    protected readonly [DistributionCollectableSymbol]: symbol;

    /**
     * 从任意可迭代数值构造分布。
     *
     * 会复制输入并就地排序，因此不会持有调用方的数组。NaN 与 Infinity 被拒绝，
     * 因为任何分位数/矩在它们之上都无定义；空输入合法，此时所有标量型查询
     * 返回 Optional.empty()。
     *
     * @param values 待刻画的数值序列；元素必须有限
     * @throws {TypeError} 若任一元素不是有限数
     */
    public static use(values: Iterable<number>): DistributionCollectable;

    /**
     * 从已排序的数组构造，跳过排序。
     *
     * 调用方必须保证升序且无 NaN；本方法只做 O(n) 校验（相邻单调性），
     * 因此比 use 快一个 log 因子，适合已经排序过的数据。
     *
     * @param sorted 升序排列的有限数值
     * @throws {TypeError} 若存在非有限值
     * @throws {RangeError} 若数组非升序
     */
    public static useSorted(sorted: Iterable<number>): DistributionCollectable;

    /** 返回样本量。 */
    public getCount(): bigint;

    /** 返回最小值；空样本返回空 Optional。 */
    public getMinimum(): Optional<number>;

    /** 返回最大值；空样本返回空 Optional。 */
    public getMaximum(): Optional<number>;

    /**
     * 计算分位数。
     *
     * 默认 type-7，与 R quantile 的默认、NumPy quantile 的 "linear" 默认、
     * Excel PERCENTILE.INC 一致；类型 1–3 为阶跃函数，4–9 为线性插值。
     *
     * @param probability 概率 p ∈ [0, 1]
     * @param options 插值类型
     * @returns 分位数；空样本返回空 Optional
     * @throws {RangeError} 若 probability 不在 [0, 1] 内（不静默裁剪）
     */
    public quantile(probability: number, options?: QuantileOptions): Optional<number>;

    /**
     * 一次计算多个分位数，内部只遍历一次有序数组。
     *
     * @param probabilities 概率序列
     * @param options 插值类型
     * @returns 与输入同序的结果数组
     * @throws {RangeError} 若任一概率不在 [0, 1] 内
     */
    public quantiles(probabilities: Iterable<number>, options?: QuantileOptions): ReadonlyArray<Optional<number>>;

    /**
     * 构建直方图。
     *
     * 默认 "freedman-diaconis"（h = 2·IQR·n^(−1/3)），因为 Sturges 假设正态；
     * 但仍保留 "sturges" 以兼容 R hist 与教材。箱数受 maximumBins 约束，
     * 避免 FD 在离群点下把 k 推到十万级。
     *
     * @param options 分箱规则、闭合约定、箱数上限
     * @returns 不可变直方图；空样本返回零箱直方图
     * @throws {RangeError} 若显式边界少于 2 个、非严格递增，或箱数超过上限
     * @throws {TypeError} 若边界含非有限值
     */
    public histogram(options?: HistogramOptions): Histogram;

    /**
     * 构建经验分布函数。
     *
     * 返回的阶梯在 x_(k) 处右连续、每步 1/n；leftLimit 给出左极限，
     * 供 KS/AD 统计量使用。
     *
     * @returns 经验分布；空样本返回恒为 0 的退化阶梯
     */
    public empiricalDistribution(): EmpiricalDistribution;

    /**
     * 核密度估计。
     *
     * 默认 Gaussian 核 + Silverman 带宽 0.9·min(σ̂, IQR/1.34)·n^(−1/5)。
     * 数据支撑有界时请显式传 boundary，否则边界处会系统性低估
     * （实测 Exp(1) 在 x=0 处低估 54%）。
     *
     * @param options 核、带宽、网格与边界修正
     * @returns 密度估计对象，保留带宽与核以便复现
     * @throws {RangeError} 若带宽非正、gridSize < 2、或 cut < 0
     */
    public density(options?: DensityOptions): DensityEstimate;

    /**
     * 偏度。
     *
     * 默认 "G1"（正态下无偏，Excel/SPSS 口径）；"g1" 为矩估计，
     * "b1" 用无偏标准差的定义。三者对同一数据可差 17%。
     *
     * @param estimator 估计量口径
     * @returns 偏度；n < 2 或方差为零时为空 Optional
     */
    public skewness(estimator?: SkewnessEstimator): Optional<number>;

    /**
     * 峰度。
     *
     * 默认 "G2" 且 excess = true（Excel KURT / pandas 口径）；"g2" 为有偏矩估计
     * （SciPy 默认），"b2" 为 Pearson 定义（非超额）。同一数据 g2 与 G2 可差 33%。
     *
     * @param estimator 估计量口径
     * @param excess 是否减去 3（Fisher 定义）；默认 true
     * @returns 峰度；G2 需要 n ≥ 4，否则为空 Optional
     */
    public kurtosis(estimator?: KurtosisEstimator, excess?: boolean): Optional<number>;

    /**
     * 偏度/峰度的标准误。
     *
     * 正态参考：SE(g1) ≈ √(6n(n−1)/((n−2)(n+1)(n+3)))，SE(g2) ≈ √(24n(n−1)²/((n−3)(n−2)(n+3)(n+5)))。
     * 样本量不足时返回空 Optional，而不是 0。
     *
     * @returns 标准误；n < 3（偏度）或 n < 4（峰度）时为空
     */
    public skewnessStandardError(): Optional<number>;
    public kurtosisStandardError(): Optional<number>;

    /**
     * 一次性返回矩与形状的汇总，避免多次遍历。
     *
     * @returns 不可变的矩汇总对象
     */
    public moments(): MomentSummary;

    /**
     * 稳健统计汇总：中位数、MAD、IQR、截尾均值、Tukey 栅栏。
     *
     * @param options 截尾比例、取整方式、栅栏倍数
     * @returns 稳健汇总；空样本返回全部为空的汇总
     * @throws {RangeError} 若 trim 不在 [0, 0.5) 或 fence 非正
     */
    public robust(options?: RobustOptions): RobustSummary;

    /**
     * 中位数绝对偏差，默认乘 1.4826 以在正态下与 σ 可比。
     *
     * @param constant 一致性常数；默认 1.4826 = 1/Φ⁻¹(3/4)
     * @returns MAD；空样本返回空 Optional
     * @throws {RangeError} 若 constant 非正
     */
    public medianAbsoluteDeviation(constant?: number): Optional<number>;

    /**
     * 截尾均值。
     *
     * trim 比例的取整方式显式可选：truncate（⌊γn⌋，R mean(trim=) 的做法）
     * 或 interpolate（在相邻整数截尾水平间线性插值）。两者结果不同。
     *
     * @param options 截尾比例与取整方式
     * @returns 截尾均值；空样本返回空 Optional
     * @throws {RangeError} 若 trim 不在 [0, 0.5) 内
     */
    public trimmedMean(options?: RobustOptions): Optional<number>;

    /**
     * 基于 IQR 栅栏的离群点索引。
     *
     * 返回的是原始插入顺序中的 bigint 索引，因此调用方可以回溯到源数据。
     * 注意：必须先确定分位数类型（默认 type-7），否则栅栏会与 R/箱线图不一致。
     *
     * @param factor 栅栏倍数；默认 1.5，far-out 用 3
     * @returns 升序索引数组；样本量 < 4 时为空数组
     * @throws {RangeError} 若 factor 非正
     */
    public outlierIndices(factor?: number): ReadonlyArray<bigint>;

    /**
     * Shannon 熵（对直方图分箱后的离散分布）。
     *
     * 直方图熵是微分熵的有偏估计，偏差随箱数增加而恶化；因此本方法要求
     * 显式传入或复用同一个直方图，保证「熵」与「直方图」不脱节。
     *
     * @param histogram 分箱方案；省略时按默认 FD 规则重新分箱
     * @param options 对数底数
     * @returns 熵；空样本或单箱时返回 0
     * @throws {RangeError} 若 base ≤ 0 或 base = 1
     */
    public entropy(histogram?: Histogram, options?: { readonly base?: number }): number;

    /**
     * 与另一个分布的散度。
     *
     * "kl" 是 D(this ‖ other)，不对称；"jeffreys" 是对称化的和；
     * "jensen-shannon" 有界且 √JSD 是度量。两组分箱必须一致：
     * 本方法会把两个样本的取值并集喂给同一分箱规则，再各自计数。
     *
     * @param other 对照分布
     * @param measure 度量种类
     * @param options 底数与零概率平滑量
     * @returns 散度；JSD 恒有限，KL 在 other 的支撑不覆盖本分布时为 Infinity
     * @throws {TypeError} 若 other 不是 DistributionCollectable
     * @throws {RangeError} 若 epsilon < 0 或 base 非法
     */
    public divergence(other: DistributionCollectable, measure?: DivergenceMeasure, options?: DivergenceOptions): number;

    /**
     * 正态性检验。
     *
     * 默认 Anderson–Darling（对尾部更敏感，且参数估计后的临界值有标准表）。
     * 选择 "kolmogorov-smirnov" 时使用**参数已知**的临界值，仅当调用方
     * 自己指定 μ/σ 时才成立；"lilliefors" 才是"参数由样本估计"的正确版本。
     *
     * @param options 检验种类与显著性水平
     * @returns 检验报告
     * @throws {RangeError} 若样本量超出所选检验的适用范围
     *         （Shapiro–Wilk 要求 3 ≤ n ≤ 5000）
     * @throws {RangeError} 若 alpha 不在 (0, 1) 内
     */
    public normality(options?: NormalityOptions): NormalityReport;

    /**
     * 与其他分布比较是否相等：比较样本量、次序统计量与全部选项。
     *
     * @param other 对照对象
     * @returns 是否逐元素相等
     * @throws {TypeError} 若 other 不是 DistributionCollectable
     */
    public equals(other: DistributionCollectable): boolean;

    /** 返回升序数值副本。 */
    public toArray(): ReadonlyArray<number>;

    /** 渲染样本量、极值与是否有离群点。 */
    public toString(): string;   // "DistributionCollectable(n=200, [−3.1, 25.0])"
}
```

### 6.5 工厂与 collector 集成

```ts
/**
 * 创建一个分布值对象。
 *
 * @param values 待刻画的数值序列
 * @returns 不可变的 DistributionCollectable
 * @throws {TypeError} 若任一元素不是有限数
 */
export const useDistribution: (values: Iterable<number>) => DistributionCollectable;

/**
 * 创建一个把数值流收集为分布的 collector。
 *
 * 累加器是 Float64Array 的增长缓冲，finisher 里一次性排序并构造分布；
 * 因此中断语义与其它 collector 一致：中断后对已收集部分求分布。
 *
 * @param options 预留：可在此给出默认分箱与分位数选项
 * @returns 可直接传给 collect() 的 SynchronousCollector
 * @throws {TypeError} 若 options 含有未知字段
 */
export const useSynchronousDistribution: (
    options?: { readonly histogram?: HistogramOptions; readonly quantile?: QuantileOptions }
) => SynchronousCollector<number, DistributionAccumulator, DistributionCollectable>;
```

并在 `SynchronousNumericStatistics` 上新增一个桥接方法（**新增而非替换**，避免破坏 1.x 语义）：

```ts
/**
 * 物化为分布对象，供直方图 / 分位数 / 检验等跨调用复用的能力使用。
 *
 * 与 quantile() 等即时方法的区别：本方法只消费一次数据源，之后所有查询都在
 * 已排序的副本上进行；因此「先查 P50 再查 P99」不会重复消费可迭代对象。
 *
 * @param options 预置的分箱与分位数选项
 * @returns 不可变的 DistributionCollectable
 */
public toDistribution(options?: { /* 同上 */ }): DistributionCollectable;
```

### 6.6 错误契约

| 触发条件 | 异常 | 消息风格（与现有代码一致） |
|---|---|---|
| 元素非有限数 | `TypeError` | `"Distribution value must be a finite number."` |
| `probability ∉ [0,1]` | `RangeError` | `"Quantile probability must be within [0, 1]."` |
| `bins` 少于 2 或非递增 | `RangeError` | `"Histogram edges must be strictly increasing and contain at least two values."` |
| 箱数超过 `maximumBins` | `RangeError` | `"Histogram bin count exceeds the configured maximum."` |
| 带宽 ≤ 0 | `RangeError` | `"Bandwidth must be positive."` |
| `trim ∉ [0, 0.5)` | `RangeError` | `"Trim ratio must be within [0, 0.5)."` |
| `alpha ∉ (0,1)` | `RangeError` | `"Significance level must be within (0, 1)."` |
| Shapiro–Wilk 样本量越界 | `RangeError` | `"Shapiro-Wilk requires between 3 and 5000 observations."` |
| `epsilon < 0` | `RangeError` | `"Divergence epsilon must not be negative."` |
| `other` 类型不符 | `TypeError` | `"Divergence operand must be a DistributionCollectable."` |

**数据不足不抛异常**：`n` 太小、方差为零等属于「无定义」而非「调用错误」，返回 `Optional.empty()`。这条边界必须在文档里写死，否则调用方无法区分「数据不够」和「参数写错」。

---

## 7. 最值得优先实现的 5 个方法

排序依据：**（收益 / 成本）× 被下游依赖的程度**。

### 1) `quantile(probability, options?)` —— 先修正确性，再谈能力

- **理由**：现有实现（`semantic.ts:3877`）是类型 1 的最近秩，与 R/NumPy/Excel 的默认（类型 7）系统性不同；`p = 0.75, n = 8` 给出 `5.0` 而非 `5.5`。这不是"少一个功能"，是**已经存在的结果偏差**，而且 `interquartileRange()` 继承了它，进而污染 Tukey 栅栏 [11][12][13]。
- **成本**：极低。数据已排序时单次查询 `O(1)`，九种类型的实现都是同一套 `(j, g, γ)` 计算，约 40 行。
- **依赖**：ECDF 的逆、Q-Q 图、稳健汇总、直方图等频分箱全部依赖它。

### 2) `histogram(options?)` + `Histogram` / `HistogramBin` —— 分布刻画的地基

- **理由**：库里现在**没有任何分箱能力**，而直方图是密度、熵、KL/JS、χ² 拟合的共同输入。没有它，§2.5 的四个能力全部无法落地。
- **成本**：中等。等宽 `O(n + k)`；难点在规则实现与边界约定，而非算法。
- **必须一起交付的**：`getTotal() === getCount()` 的自检（保证 `Σm_i = n`，即 T8 不会发生）。
- **进阶**：箱数的数据驱动选择可以走惩罚似然路线（Birgé–Rozenholc 的 `k` 选择准则 [7]），作为 `rule` 之外的第二个可选策略。

### 3) `kurtosis(estimator, excess?)` / `skewness(estimator)` —— 消除跨工具对账失败

- **理由**：这是本报告里**最大的一处数值分歧**（`g2 = 15.051` vs `G2 = 19.998`，33%）。当前库只实现 `g2`，而 Excel/pandas/SPSS 用 `G2`，SciPy 默认 `g2`。用户拿本库结果去和 Excel 对账必然"发现 bug" [28][29][30][6]。
- **成本**：极低。三个定义之间只差一个含 `n` 的因子：`G2 = ((n−1)/((n−2)(n−3)))·((n+1)g2 + 6)`，`G1 = √(n(n−1))/(n−2)·g1`。顺带把标准误一起返回（`SE(g1)`、`SE(g2)` 都是闭式），让"这个峰度是否显著"可回答。
- **配套**：`n < 4` 时 `G2` 返回空 `Optional`（T20）。

### 4) `medianAbsoluteDeviation(constant?)` + `robust()` —— 用最小代价修掉"离群点盲"

- **理由**：只需一个中位数（`median()` 已存在）即可算 MAD，`O(n)`、无新依赖，却直接解决 T19（用 `sd` 做阈值在重尾数据上必然失效：`1..8,100` 的 `s = 31.916`，而 `3×MAD×1.4826 = 8.895`）[59][60]。
- **成本**：极低。截尾均值与栅栏同批实现，`RobustSummary` 一次返回。
- **注意**：必须把 `1.4826` 作为**显式参数**而不是硬编码常数，且文档里写明它是渐近一致性常数（小样本下与 `sd` 本就不同，`n = 9` 时差 8%）。

### 5) `empiricalDistribution()` —— 让"P(X ≤ x)"成为一等公民

- **理由**：分布类问题的原点是"这个值在分布里的位置"。ECDF 是唯一能直接回答 `P(X ≤ x)` 且不需要任何分布假设的对象；它同时是 Q-Q 图、KS/AD 统计量、分位数（类型 1/4）的共同底座 [17]。
- **成本**：低（排序已在构造时完成），但**必须一并实现 `leftLimit()`**：KS 的 `D_n = sup|F_n − F|` 需要同时取右极限与左极限，只实现 `evaluate` 会让 KS 统计量系统性偏小。
- **为什么不是 KDE**：KDE 的复杂度不在公式，在**带宽选择 + 边界处理**两个开放问题（§2.3.3–2.3.4）。在 `boundary` 与 `bandwidth` 的语义定稿前上线，等于把"看起来平滑但边界错了 54%"的图交给用户。

**明确推迟**：`density`（依赖带宽/边界决策）、`entropy`/`divergence`（依赖直方图契约）、`normality`（需要临界值表，表面积大且易错）。三者都应在 2、5 落地之后再做。

---

## 8. 未能验证 / 已知限制

| # | 事项 | 状态 |
|---|---|---|
| 1 | SAS 的默认分位数类型 | **来源冲突**：R 手册称 type 2 为 SAS 默认 [11]，Wikipedia 称 SAS 在约 2010 年前默认 type 3 [13]。两者不可同时为真（可能对应不同版本），**本文不采用任何 SAS 默认值断言**。 |
| 2 | Miller–Madow 修正的原始出处 | Miller (1955) 为书章，无 DOI，未读到原文；公式 `+(K̂−1)/(2n)` 由 Wikipedia 词条转引 [34]，本文只做了数值一致性校验（§2.5.1），未做逐年核对。 |
| 3 | Q–Q 图的 plotting positions 具体公式 | Wikipedia 词条只给出"存在多种 plotting positions"并链接到独立条目 [51]，未抓取该条目，故本文不给出 `(k−0.5)/n` 之类具体常数。 |
| 4 | SciPy `shapiro` 对 `n > 5000` 的行为 | 只验证了 R 的 3–5000 限制 [44]，未抓取 SciPy `shapiro` 文档，故不引用。 |
| 5 | pandas `kurt` 与 `G2` 的严格等价 | 只验证了文档措辞「unbiased kurtosis」[58] 与 Wikipedia 的"Excel/SPSS/SAS 使用 G2" [29]；等价性是**推断**，未逐行核对其源码。 |
| 6 | NumPy `auto` 的行为 | 只在**本机 numpy 2.3.5** 上读源码 + 实测（§4 T12）；其它版本的行为未验证，文档中已注明版本。 |
| 7 | 性能数字 | 本文只给复杂度，未做基准测试（无 Node 运行时；`node` 不在 PATH，Python 侧只跑数值）。 |
| 8 | 代理可用性 | 全程可用；`export.arxiv.org/api` 间歇 503/429，故未用于任何结论。若后续复现失败，属代理侧限制，不影响本文结论（全部来源已在附录 B 记录状态码）。 |

**一处已修正的错误（保留以示核验有效）**：初稿曾把 Birgé–Rozenholc (2006) 的 DOI 记为 `10.1051/ps:2006002`。Crossref 查询返回的是另一篇文章（Fromont & Lévy-Leduc，激光测振信号检测）。经题名检索修正为 **`10.1051/ps:2006001`**（ESAIM: P&S 10:24–45）[7]。这说明"凭记忆写 DOI"是本任务中最容易出错的一步，必须逐个走 Crossref。

---

## 9. 参考文献

> 全部条目在本次调研中经代理实际抓取或经 Crossref 元数据核验；DOI 均返回 200。抓取状态见附录 B。

**分箱**

[1] Sturges, H. A. (1926). The Choice of a Class Interval. *JASA* 21(153):65–66. https://doi.org/10.1080/01621459.1926.10502161
[2] Scott, D. W. (1979). On optimal and data-based histograms. *Biometrika* 66(3):605–610. https://doi.org/10.1093/biomet/66.3.605
[3] Freedman, D., Diaconis, P. (1981). On the histogram as a density estimator: L2 theory. *Zeitschrift für Wahrscheinlichkeitstheorie und Verwandte Gebiete* 57(4):453–476. https://doi.org/10.1007/BF01025868
[4] Scott, D. W. (2009). Sturges' rule. *WIREs Computational Statistics* 1(3):303–306. https://doi.org/10.1002/wics.35
[5] Doane, D. P. (1976). Aesthetic Frequency Classifications. *The American Statistician* 30(4):181–183. https://doi.org/10.1080/00031305.1976.10479172
[6] Doane, D. P., Seward, L. E. (2011). Measuring Skewness: A Forgotten Statistic? *Journal of Statistics Education* 19(2). https://doi.org/10.1080/10691898.2011.11889611
[7] Birgé, L., Rozenholc, Y. (2006). How many bins should be put in a regular histogram. *ESAIM: Probability and Statistics* 10:24–45. https://doi.org/10.1051/ps:2006001
[8] Wikipedia: Histogram. https://en.wikipedia.org/wiki/Histogram
[9] Wikipedia: Freedman–Diaconis rule. https://en.wikipedia.org/wiki/Freedman%E2%80%93Diaconis_rule

**分位数**

[10] Hyndman, R. J., Fan, Y. (1996). Sample Quantiles in Statistical Packages. *The American Statistician* 50(4):361–365. https://doi.org/10.1080/00031305.1996.10473566
[11] R Core Team. *Sample Quantiles* (`?quantile`, stats 4.6.0). https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html
[12] NumPy. `numpy.quantile`. https://numpy.org/doc/stable/reference/generated/numpy.quantile.html
[13] Wikipedia: Quantile. https://en.wikipedia.org/wiki/Quantile
[14] Hyndman, R. J. (2016). Sample quantiles 20 years later. https://robjhyndman.com/hyndsight/sample-quantiles-20-years-later/
[15] Langford, E. (2006). Quartiles in Elementary Statistics. *Journal of Statistics Education* 14(3). https://doi.org/10.1080/10691898.2006.11910589
[16] Makkonen, L., Pajari, M. (2014). Defining Sample Quantiles by the True Rank Probability. *Journal of Probability and Statistics* 2014:1–6. https://doi.org/10.1155/2014/326579

**经验分布与密度**

[17] Wikipedia: Empirical distribution function. https://en.wikipedia.org/wiki/Empirical_distribution_function
[18] Wikipedia: Kernel density estimation. https://en.wikipedia.org/wiki/Kernel_density_estimation
[19] Silverman, B. W. (1986). *Density Estimation for Statistics and Data Analysis*. Chapman & Hall. DOI（CRC 2018 重印版）：https://doi.org/10.1201/9781315140919
[20] Scott, D. W. (2015). *Multivariate Density Estimation: Theory, Practice, and Visualization* (2nd ed.). Wiley. https://doi.org/10.1002/9781118575574
[21] R Core Team. *Bandwidth Selectors for Kernel Density Estimation* (`?bw.nrd`). https://stat.ethz.ch/R-manual/R-devel/library/stats/html/bandwidth.html
[22] R Core Team. *Kernel Density Estimation* (`?density`). https://stat.ethz.ch/R-manual/R-devel/library/stats/html/density.html
[23] Sheather, S. J., Jones, M. C. (1991). A Reliable Data-Based Bandwidth Selection Method for Kernel Density Estimation. *JRSS B* 53(3):683–690. https://doi.org/10.1111/j.2517-6161.1991.tb01857.x
[24] Botev, Z. I., Grotowski, J. F., Kroese, D. P. (2010). Kernel density estimation via diffusion. *Annals of Statistics* 38(5):2916–2957. https://doi.org/10.1214/10-AOS799
[25] Jones, M. C. (1993). Simple boundary correction for kernel density estimation. *Statistics and Computing* 3(3):135–146. https://doi.org/10.1007/BF00147776
[26] Chen, S. X. (2000). Probability Density Function Estimation Using Gamma Kernels. *Annals of the Institute of Statistical Mathematics* 52(3):471–480. https://doi.org/10.1023/A:1004165218295
[27] Zambom, A. Z., Dias, R. (2013). A Review of Kernel Density Estimation with Applications to Econometrics. arXiv:1212.2812. https://arxiv.org/abs/1212.2812 ｜ 全文（本次实际读取）：https://ar5iv.labs.arxiv.org/html/1212.2812

**矩与形状**

[28] Wikipedia: Skewness. https://en.wikipedia.org/wiki/Skewness
[29] Wikipedia: Kurtosis. https://en.wikipedia.org/wiki/Kurtosis
[30] Joanes, D. N., Gill, C. A. (1998). Comparing measures of sample skewness and kurtosis. *JRSS D (The Statistician)* 47(1):183–189. https://doi.org/10.1111/1467-9884.00122
[31] SciPy. `scipy.stats.skew`. https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.skew.html
[32] SciPy. `scipy.stats.kurtosis`. https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.kurtosis.html

**熵与散度**

[33] Wikipedia: Entropy (information theory). https://en.wikipedia.org/wiki/Entropy_(information_theory)
[34] Wikipedia: Entropy estimation. https://en.wikipedia.org/wiki/Entropy_estimation
[35] Kraskov, A., Stögbauer, H., Grassberger, P. (2004). Estimating mutual information. *Phys. Rev. E* 69:066138. https://doi.org/10.1103/PhysRevE.69.066138 ｜ 全文（本次实际读取，含 Eq. 4/19/20）：https://ar5iv.labs.arxiv.org/html/cond-mat/0305641
[36] Paninski, L. (2003). Estimation of Entropy and Mutual Information. *Neural Computation* 15(6):1191–1253. https://doi.org/10.1162/089976603321780272
[37] Kullback, S., Leibler, R. A. (1951). On Information and Sufficiency. *Annals of Mathematical Statistics* 22(1):79–86. https://doi.org/10.1214/aoms/1177729694
[38] Lin, J. (1991). Divergence measures based on the Shannon entropy. *IEEE Trans. Information Theory* 37(1):145–151. https://doi.org/10.1109/18.61115
[39] Wikipedia: Kullback–Leibler divergence. https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence
[40] Wikipedia: Jensen–Shannon divergence. https://en.wikipedia.org/wiki/Jensen%E2%80%93Shannon_divergence
[41] SciPy. `scipy.stats.entropy`. https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.entropy.html

**拟合与检验**

[42] Shapiro, S. S., Wilk, M. B. (1965). An analysis of variance test for normality (complete samples). *Biometrika* 52(3–4):591–611. https://doi.org/10.1093/biomet/52.3-4.591
[43] Wikipedia: Shapiro–Wilk test. https://en.wikipedia.org/wiki/Shapiro%E2%80%93Wilk_test
[44] R Core Team. *Shapiro-Wilk Normality Test* (`?shapiro.test`). https://stat.ethz.ch/R-manual/R-devel/library/stats/html/shapiro.test.html
[45] Anderson, T. W., Darling, D. A. (1952). Asymptotic Theory of Certain "Goodness of Fit" Criteria Based on Stochastic Processes. *Annals of Mathematical Statistics* 23(2):193–212. https://doi.org/10.1214/aoms/1177729437
[46] Wikipedia: Anderson–Darling test. https://en.wikipedia.org/wiki/Anderson%E2%80%93Darling_test
[47] Stephens, M. A. (1974). EDF Statistics for Goodness of Fit and Some Comparisons. *JASA* 69(347):730–737. https://doi.org/10.1080/01621459.1974.10480196
[48] Wikipedia: Kolmogorov–Smirnov test. https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test
[49] Lilliefors, H. W. (1967). On the Kolmogorov-Smirnov Test for Normality with Mean and Variance Unknown. *JASA* 62(318):399–402. https://doi.org/10.1080/01621459.1967.10482916
[50] Wikipedia: Lilliefors test. https://en.wikipedia.org/wiki/Lilliefors_test
[51] Wikipedia: Q–Q plot. https://en.wikipedia.org/wiki/Q%E2%80%93Q_plot
[52] Wikipedia: Maximum likelihood estimation. https://en.wikipedia.org/wiki/Maximum_likelihood_estimation
[53] Wikipedia: Method of moments (statistics). https://en.wikipedia.org/wiki/Method_of_moments_(statistics)

**数值约定**

[54] Wikipedia: Variance. https://en.wikipedia.org/wiki/Variance
[55] Wikipedia: Algorithms for calculating variance. https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance
[56] R Core Team. *Standard Deviation* (`?sd`). https://stat.ethz.ch/R-manual/R-devel/library/stats/html/sd.html
[57] NumPy. `numpy.var`. https://numpy.org/doc/stable/reference/generated/numpy.var.html
[58] pandas. `pandas.Series.kurt`. https://pandas.pydata.org/docs/reference/api/pandas.Series.kurt.html

**稳健统计**

[59] Wikipedia: Median absolute deviation. https://en.wikipedia.org/wiki/Median_absolute_deviation
[60] R Core Team. *Median Absolute Deviation* (`?mad`). https://stat.ethz.ch/R-manual/R-devel/library/stats/html/mad.html
[61] Rousseeuw, P. J., Croux, C. (1993). Alternatives to the Median Absolute Deviation. *JASA* 88(424):1273–1283. https://doi.org/10.1080/01621459.1993.10476408
[62] Wikipedia: Interquartile range. https://en.wikipedia.org/wiki/Interquartile_range
[63] Wikipedia: Truncated mean. https://en.wikipedia.org/wiki/Truncated_mean
[64] Wikipedia: Robust statistics. https://en.wikipedia.org/wiki/Robust_statistics

**实现对照**

[65] NumPy. `numpy.histogram`（"All but the last bin is half-open"）. https://numpy.org/doc/stable/reference/generated/numpy.histogram.html
[66] NumPy. `numpy.histogram_bin_edges`. https://numpy.org/doc/stable/reference/generated/numpy.histogram_bin_edges.html
[67] SciPy. `scipy.stats.gaussian_kde`（`bw_method` 默认 `"scott"`）. https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gaussian_kde.html
[68] SciPy. `scipy.stats.median_abs_deviation`. https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.median_abs_deviation.html
[69] SciPy. `scipy.stats.anderson`（`dist='norm'` 使用参数估计后的临界值）. https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.anderson.html

---

## 附录 A：可复现实验

运行环境：本机 bundled Python 3 + NumPy 2.3.5 / pandas 3.0.1（`node` 不在 PATH，故实验全部用 Python；算法与 TS 实现无关，只验证数值结论）。脚本经 `--proxy http://127.0.0.1:15236` 无关，纯本地计算。

### A.1 脚本（精简版，覆盖正文全部 [C] 数值）

```python
import numpy as np
from math import erf, sqrt

# --- 峰度/偏度三定义（T1-T2, §2.4.3）---
x = np.array([0,3,4,1,2,3,0,2,1,3,2,0,2,2,3,2,5,2,3,999], float)
n, m = x.size, x.mean()
m2, m3, m4 = (np.mean((x-m)**k) for k in (2,3,4))
s = x.std(ddof=1)
print("g1", m3/m2**1.5, "b1", m3/s**3, "G1", sqrt(n*(n-1))/(n-2)*(m3/m2**1.5))
print("g2", m4/m2**2-3, "b2", m4/s**4, "G2", (n-1)/((n-2)*(n-3))*((n+1)*(m4/m2**2-3)+6))

# --- 九种分位数（§2.2.2, T4-T5）---
xq = np.array([2,4,4,4,5,5,7,9], float)
for i, meth in enumerate(["inverted_cdf","averaged_inverted_cdf","closest_observation",
        "interpolated_inverted_cdf","hazen","weibull","linear",
        "median_unbiased","normal_unbiased"], 1):
    print(i, meth, [round(float(np.quantile(xq,p,method=meth)),3) for p in (0.1,0.25,0.5,0.75,0.9)])

# --- 分箱规则（§2.1.5, T9, T12）---
rng = np.random.default_rng(1)
a0 = rng.normal(0,1,200); a1 = np.concatenate([rng.normal(0,1,199), [25.0]])
for a in (a0, a1):
    n, ptp, sd = a.size, np.ptp(a), a.std(ddof=1)
    iqr = np.subtract(*np.percentile(a,[75,25]))
    print(n, "sturges", int(np.ceil(np.log2(n))+1),
          "scott", int(np.ceil(ptp/(3.49*sd/n**(1/3)))),
          "fd", int(np.ceil(ptp/(2*iqr/n**(1/3)))),
          "numpy_auto_bins", np.histogram_bin_edges(a,bins="auto").size-1)

# --- 稳健统计（§2.7.1, T19）---
for a in (np.arange(1,10.), np.concatenate([np.arange(1,9.),[100.]])):
    print("mean", a.mean(), "median", np.median(a), "sd", a.std(ddof=1),
          "MAD", np.median(np.abs(a-np.median(a))))

# --- KL/JS（§2.5.3, T13-T14）---
kl = lambda p,q: float(np.sum(p*np.log(p/q)))
P, Q = np.array([.5,.5]), np.array([.9,.1]); M = (P+Q)/2
print("KL(P||Q)", kl(P,Q), "KL(Q||P)", kl(Q,P), "JSD", .5*kl(P,M)+.5*kl(Q,M))

# --- KDE 边界泄漏（§2.3.4, T15）---
xe = np.random.default_rng(3).exponential(1.0, 20)
sd, iqr = xe.std(ddof=1), np.subtract(*np.percentile(xe,[75,25]))
h = 0.9*min(sd, iqr/1.34)*xe.size**-0.2
kde = lambda g: (np.exp(-0.5*((g-xe)/h)**2).sum()/(xe.size*h*sqrt(2*np.pi)))
print("h", h, "f_hat(0)", kde(np.array([0.0]))[0])

# --- 直方图熵偏差（§2.5.1, T11）---
xu = np.random.default_rng(7).uniform(0,1,200)
for k in (4,16,64):
    c,e = np.histogram(xu, bins=k, range=(0,1)); p = c[c>0]/c.sum()
    print("k",k,"H", -np.sum(p*np.log(p))+np.log(e[1]-e[0]))

# --- KS：参数已知 vs 参数估计（§2.6.3, T6）---
N, nn = 4000, 50; d_fixed = np.empty(N); d_est = np.empty(N); ii = np.arange(1,nn+1)
for i in range(N):
    srt = np.sort(np.random.default_rng(2000+i).normal(0,1,nn))
    F = np.array([0.5*(1+erf(v/sqrt(2))) for v in srt])
    d_fixed[i] = max(np.max(ii/nn-F), np.max(F-(ii-1)/nn))
    z = (srt-srt.mean())/srt.std(ddof=1)
    Fz = np.array([0.5*(1+erf(v/sqrt(2))) for v in z])
    d_est[i] = max(np.max(ii/nn-Fz), np.max(Fz-(ii-1)/nn))
print("q95 fixed", np.quantile(d_fixed,.95), "q95 est", np.quantile(d_est,.95),
      "P>1.36/sqrt(n) fixed", np.mean(d_fixed>1.36/sqrt(nn)), "est", np.mean(d_est>1.36/sqrt(nn)))
```

### A.2 输出（原样抄录）

```text
n=20 mean=51.950000 s(n-1)=222.916193 m2(n)=47207.047500
g1 = 4.129251   b1 = 3.823462   G1 = 4.471885
g2 = 15.051427   b2 = 13.291412   G2 = 19.998429   pearson b2+3= 16.291412
SE(g1)~0.512103  SE(g2)~0.992384
G2-g2 = 4.947002   G1-g1 = 0.342634   G1/b1 = 1.169591

[benign n=20 normal, seed 0] g1=-0.422766 G1=-0.457846 diff=-0.035080
                             g2= 0.186034 G2= 0.615123 diff= 0.429089

type  method                      p=0.1    p=0.25   p=0.5    p=0.75   p=0.9
1     inverted_cdf                 2.000   4.000   4.000   5.000   9.000
2     averaged_inverted_cdf        2.000   4.000   4.500   6.000   9.000
3     closest_observation          2.000   4.000   4.000   5.000   7.000
4     interpolated_inverted_cdf    2.000   4.000   4.000   5.000   7.400
5     hazen                        2.600   4.000   4.500   6.000   8.400
6     weibull                      2.000   4.000   4.500   6.500   9.000
7     linear                       3.400   4.000   4.500   5.500   7.600
8     median_unbiased              2.333   4.000   4.500   6.167   8.667
9     normal_unbiased              2.400   4.000   4.500   6.125   8.600

[ties x=[1,1,1,1,100]] type3 p90=1.000 ; type4 p90=50.500 ; type7 p90=60.400 ; others p90=100.000

[normal n=200]        sturges=9  scott=11 (h=0.553) fd=14 (h=0.413) doane=10 rice=12 sqrt=15 terrell=8
  numpy 'sturges': 9 bins | 'scott': 11 | 'fd': 14 | 'auto': 14
[normal+outlier n=200] sturges=9 scott=24 (h=1.186) fd=66 (h=0.416) doane=15 rice=12 sqrt=15 terrell=8
  numpy 'sturges': 9 bins | 'scott': 24 | 'fd': 66 | 'auto': 29

[1..9]      mean=5.000  median=5.000 sd=2.739  MAD=2.000 MAD*1.4826=2.965 IQR=4.000
[1..8,100]  mean=15.111 median=5.000 sd=31.916 MAD=2.000 MAD*1.4826=2.965 IQR=4.000

KL(P||Q)=0.510826 nats = 0.736966 bits
KL(Q||P)=0.368064 nats = 0.531004 bits
JSD=0.101749 nats = 0.146793 bits ; sqrt(JSD)=0.318982
disjoint supports: JSD=0.693147 nats (= 1 bit)

KDE: n=20 sd=0.8728 iqr=1.0495 h=0.3872
x=0.00 kde=0.4633 true=1.0000 reflection=0.9265
mass leaked below 0 ~ 0.1491

entropy (U(0,1), n=200): k=4 -0.0036 | k=8 -0.0088 | k=16 -0.0417 | k=32 -0.0688 | k=64 -0.1324

KS n=50: fixed parameters q95=0.1865, P(D>1.36/sqrt(n))=0.0413
         estimated params q95=0.1222, P(D>1.36/sqrt(n))=0.0000
```

### A.3 NumPy `auto` 的源码证据

本机 `numpy/lib/_histograms_impl.py` 中：

```python
def _hist_bin_auto(x, range):
    """... uses the minimum width of a relaxed Freedman-Diaconis and Sturges
    estimators if the FD bin width does not result in a large number of bins.
    The relaxed Freedman-Diaconis estimator limits the bin width to half the
    sqrt estimated to avoid small bins."""
    fd_bw = _hist_bin_fd(x, range)
    sturges_bw = _hist_bin_sturges(x, range)
    sqrt_bw = _hist_bin_sqrt(x, range)
    fd_bw_corrected = max(fd_bw, sqrt_bw / 2)
    return min(fd_bw_corrected, sturges_bw)
```

手算核对（含离群点数据，`ptp = 27.4576`，`n = 200`）：`sqrt_bw = ptp/√n = 1.9415`，`sqrt_bw/2 = 0.9708`，`fd_bw = 0.4160` → `fd_bw_corrected = 0.9708`，`sturges_bw = 3.0508` → `width = 0.9708` → `ceil(27.4576/0.9708) = 29` 箱，与实测 `29` 完全吻合 [C]，证实 T12。

---

## 附录 B：来源抓取记录

| 来源 | URL 前缀 | HTTP | 用途 |
|---|---|---|---|
| Wikipedia（24 条） | `en.wikipedia.org/w/index.php?action=raw` | 200（首次 8 条 429，退避后 200） | 定义、公式、软件对照 |
| R 手册 4.6.0（6 页） | `stat.ethz.ch/R-manual/R-devel/library/stats/html/` | 200 | `quantile` / `density` / `bandwidth` / `mad` / `shapiro.test` / `sd` |
| NumPy 文档（4 页） | `numpy.org/doc/stable/reference/generated/` | 200 | `quantile` / `histogram` / `histogram_bin_edges` / `var` |
| SciPy 文档（6 页） | `docs.scipy.org/doc/scipy/reference/generated/` | 200 | `skew` / `kurtosis` / `gaussian_kde` / `entropy` / `median_abs_deviation` / `anderson` |
| pandas 文档（1 页） | `pandas.pydata.org/docs/reference/api/` | 200 | `Series.kurt` |
| Crossref（26 个 DOI/题名） | `api.crossref.org/works/` | 200 | 逐条核验标题/作者/卷期页 |
| arXiv（2 篇全文） | `ar5iv.labs.arxiv.org/html/` | 200 | Kraskov Eq.4/19/20；KDE 综述的边界偏差 |
| arXiv API | `export.arxiv.org/api/query` | 200 → 503/429 | **未用于结论** |

所有 DOI 的解析链接均为 `https://doi.org/<DOI>` 形式。注意：`doi.org` 对脚本请求返回 **403**（反爬），因此 DOI 的**有效性**是通过 `api.crossref.org/works/<DOI>` 的元数据（标题/作者/卷/期/页）逐条核验的，而不是靠 200 状态码；其余非 DOI 链接均返回 200。

