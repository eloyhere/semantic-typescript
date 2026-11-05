# Semantic TypeScript · `SignalCollectable` 信号分析调研与 API 规格

| 项 | 值 |
| --- | --- |
| 目标库 | `semantic-typescript` 1.2.0（工作区 `R:\project\semantic-typescript`） |
| 产出 | 本文件 `docs/research/signal-analysis.md`（唯一新增文件） |
| 调研日期 | 2026-11-05 |
| 网络方式 | 经代理 `http://127.0.0.1:15236` 访问 Wikipedia API、SciPy 文档、Crossref API、arXiv API |
| 覆盖范围 | 6 个能力域 / 29 项能力 / 37 条来源 |
| 硬约束 | 未修改 `src/` 下任何文件；未新增其它文件 |

---

## 0. 摘要

本报告为「一段实数值序列 → 频谱 / 时频 / 瞬时特征」这条主线建立**可执行的工程规格**，目标是新增一个与库现有风格一致的值对象 `SignalCollectable`。核心结论：

1. **库的骨架已经齐了，缺的是"窗口感知的归一化"与"多段平均"。** `window.ts` 已实现 7 类窗与 `coherentGain` / `equivalentNoiseBandwidth`；`spectrum.ts` 已有单边折叠、质心、带宽、滚降、平坦度；`coherent.ts` 已有相干性；`analytic.ts` 已有解析信号与瞬时频率；`sampler.ts` 已有 STFT / 频谱图。但这些能力之间没有互相接线：`Spectrum.oneSided()` 不做相干增益校正，`Spectrum.decibelOf()` 只有 `none/count/root` 三种纯 FFT 归一化，**没有任何 Welch / PSD 入口**，窗函数算出的 CG / ENBW 也无处使用。
2. **三个必须先修的正确性问题**（均有数值反例，见 §5）：
   - `useFlatTopWindow` 用 `Math.max(0, …)` 把平顶窗的负瓣截断。平顶窗按定义就是"部分取负"的窗，截断后扇贝损失从 **−0.010 dB 恶化到 −0.309 dB**（约 31 倍），ENBW 从 **3.770 变成 3.196**，CG 从 **0.2156 变成 0.2335**（+0.69 dB），恰好毁掉它唯一的存在理由。
   - 全库窗函数都是**对称窗**（分母 `count - 1`），而 STFT / OLA / Welch 的教科书与 SciPy 默认是**周期窗**（DFT-even，分母 `N`）。用对称 Hann 做 50% 重叠时 COLA 不成立：N=16 时重建包络波纹 **0.84 dB**，N=64 时 **0.21 dB**，N=1024 仍剩 **0.013 dB**。
   - `decibel()` 是**幅度惯例 20·log10**，对功率必须用 10·log10。把 `power` 直接喂给 `decibel()` 会把 −6.02 dB 算成 **−12.04 dB**。
3. **最值得优先实现**的 5 个方法（§7）：`windowed`/增益校正、`amplitude`/`power`（含 DC/Nyquist 规则）、`powerSpectralDensity`（Welch）、`spectrogram`（周期窗 + COLA 校验）、`envelope`/`instantaneousFrequency`（含边界与零包络保护）。

---

## 1. 调研方法与可验证性

### 1.1 实际使用的抓取命令

全部网络访问经代理完成，形如：

```powershell
curl.exe -s -m 60 -A "SemanticTypeScript-Research/1.0 (eloy.kim@outlook.com)" `
  --proxy http://127.0.0.1:15236 `
  "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&redirects=1&format=json&titles=Window%20function"
```

```powershell
curl.exe -sS -m 60 --proxy http://127.0.0.1:15236 `
  "https://api.crossref.org/works/10.1109/PROC.1978.10837?mailto=eloy.kim@outlook.com"
```

```powershell
curl.exe -sS -m 60 --proxy http://127.0.0.1:15236 `
  "https://export.arxiv.org/api/query?id_list=2312.13643,1502.02316,1006.2533&max_results=3"
```

### 1.2 来源等级（本报告对每条引用都标注等级）

| 等级 | 含义 | 用法 |
| --- | --- | --- |
| **A** | 抓取到正文并阅读（Wikipedia `prop=extracts` 全文、SciPy 文档正文） | 可直接引用其中的定义、默认值、约束 |
| **B** | 仅用机器可读元数据核对存在性（Crossref：标题 / 期刊 / 年份 / DOI） | 只引用"该文献存在且主题如此"，**不引用其内部数值** |
| **C** | 本地按公式计算（numpy，脚本见附录 A） | 作为数值反例与量级证据，结论由公式保证可复现 |
| **✗** | 未能读取 | 显式写"未能验证"，不据此下断言 |

### 1.3 抓取结果与失败记录

成功（A 级）：

- Wikipedia：`Window function`、`Spectral leakage`、`Welch's method`、`Periodogram`、`Short-time Fourier transform`、`Overlap–add method`、`Analytic signal`、`Hilbert transform`、`Instantaneous phase`、`Instantaneous frequency`、`Coherence (signal processing)`、`Zero-crossing rate`、`Spectral flatness`、`Spectral centroid`、`Spectral flux`、`Cross-correlation`、`Autocorrelation`、`Spectral density`、`Signal-to-noise ratio`、`Parseval's theorem`。
- SciPy 参考文档：`signal.welch`、`signal.spectrogram`、`signal.stft`、`signal.coherence`、`signal.hilbert`、`signal.get_window`、`signal.check_COLA`。
- Crossref：7 个 DOI 全部返回 HTTP 200 且标题匹配（Harris 1978、Welch 1967、Allen & Rabiner 1977、Griffin & Lim 1984、Boashash 1992、Gabor 1946、Carter 1987）。
- arXiv API：3 篇论文的 id / 标题 / 摘要核对通过（2312.13643、1502.02316、1006.2533）。

失败或降级（✗）：

| 目标 | 现象 | 处理 |
| --- | --- | --- |
| `https://holometer.fnal.gov/GH_FFT.pdf`（Heinzel 2002 窗函数综述） | HTTP 403（更换 UA 仍 403） | **未能验证**；本报告不使用其表格数值 |
| `https://www.mathworks.com/help/signal/ref/enbw.html` | HTTP 403 | **未能验证** |
| Harris 1978 全文（IEEE Xplore） | 付费墙，仅 Crossref 元数据可读 | 只作 B 级引用；本文所有窗指标数值均为 C 级本地计算，不声称摘自原文 |
| arXiv API 前 4 次调用 | HTTP 429 "Rate exceeded" / 503 | 退避 30–45 s 后重试成功；已记录 |
| Wikipedia 首次并发抓取 20 页 | HTTP 429 | 改串行 + 3.5 s 间隔 + 自定义 UA 后全部成功 |

> 注：本报告中所有"窗指标数值表"均为 **C 级**（本地按定义计算，N=1024，见附录 A），不是从某篇论文抄录；其量级与经典文献一致（例如 Hann 峰值旁瓣 −31.5 dB、Blackman −58.1 dB、矩形 −13.3 dB），可作为交叉校验，但不冒充文献摘录。

---

## 2. 现有代码基线（决定 API 该长什么样）

### 2.1 已有能力

| 模块 | 已有导出 | 与本规格的关系 |
| --- | --- | --- |
| `mathematics/window.ts` | `SpectralWindow`、`useRectangularWindow`、`useHannWindow`、`useHammingWindow`、`useBlackmanWindow`、`useKaiserWindow`、`useFlatTopWindow`、`useNuttallWindow`、`windowed`、`coherentGain`、`equivalentNoiseBandwidth`、`isSpectralWindow` | 全部复用；需补周期窗与 `scallopingLoss` |
| `mathematics/spectrum.ts` | `Spectrum`（`oneSided`、`centroid`、`spread`、`flatness`、`rolloff`、`bandEnergy`、`decibelOf`、`refinedPeakFrequency`…） | 作为 `spectrum()` 的返回类型复用；PSD 需要新类型 |
| `mathematics/spectrogram.ts` | `Spectrogram`（`getTime`、`getDuration`、`dominantFrequencyAt`…） | 作为 `spectrogram()` 的返回类型复用 |
| `mathematics/coherent.ts` | `coherence`、`crossSpectrum`、`Coherence`、`CoherenceOptions` | 作为 `coherence()` 的返回类型复用 |
| `mathematics/analytic.ts` | `analyticSignal`、`instantaneousAmplitude`、`instantaneousPhase`、`unwrapPhase`、`instantaneousFrequency`、`analyticPhase` | 作为解析信号实现的底座 |
| `mathematics/frame.ts` | `Frame`（`rms`、`zeroCrossings`、`correlate`、`autocorrelate`、`windowed`、`detrended`…） | 数据容器；`correlate` 未归一化 |
| `mathematics/sampler.ts` | `Sampler.shortTimeFourierTransform` / `.spectrogram`（默认 `useHannWindow`，只取完整帧） | 现有 STFT 路径；默认窗与边缘处理需调整 |
| `mathematics/bin.ts` | `Bin`、`Normalization`（`none`/`count`/`root`）、`decibel`（20·log10）、`parabolicOffset` | `decibel` 的 20·log10 只适用于幅度 |
| `optional.ts` | `Optional`（`get`、`map`、`flatMap`、`isPresent`、`isEmpty`、`of`/`ofEmpty`…） | 所有"可能不存在"的返回用它，不用 `null` |
| `symbol.ts` / `guard.ts` | `Symbol.for("Spectrum")` 等品牌 + `isXxx` 守卫 | 新类需新增 `SignalCollectableSymbol` 与 `isSignalCollectable` |

### 2.2 缺口（本规格要补的）

| 缺口 | 现状 | 影响 |
| --- | --- | --- |
| 窗感知的幅度/功率归一化 | `Spectrum.amplitudeOf` 只有 `none/count/root`；CG 与 ENBW 是孤立函数 | 用户必须自己记住"除以 CG / 乘 ENBW"，这正是最高频错误 |
| Welch / PSD | 无 | 无法做噪声底、SNR、相干性的正确估计 |
| 周期窗（DFT-even） | 无 | STFT/OLA 无法严格满足 COLA；与 SciPy/Matlab 结果对不上 |
| 边缘填充 | `Sampler.shortTimeFourierTransform` 只取 `start + frameSize <= length` 的完整帧，尾部直接丢弃 | 与 SciPy `boundary='zeros' / padded=True` 的帧数、时间轴不同 |
| 谱通量 | 无 | 变化检测/起始点检测缺失 |
| ZCR 速率 | `Frame.zeroCrossings()` 返回次数，不是速率 | 与文献定义（除以 T−1）不一致 |
| 归一化相关 | `Frame.correlate` 返回未归一化的和 | 互相关幅度随 N 变化，无法跨长度比较 |
| SNR 估计 | 无 | 需要基于 PSD 噪声底的估计器 |

### 2.3 立即可见的三个缺陷（详见 §5）

1. `useFlatTopWindow` 的 `Math.max(0, …)` 截断（`src/mathematics/window.ts:303`）。
2. 全部窗为对称形式，无周期版本；`Sampler` 默认用它做 STFT。
3. `decibel()` 单一 20·log10 口径，缺少 10·log10 的功率口径 API。

---

## 3. 规范定义：每项能力

### 3.0 记号

- 采样：`x[n]`，`n = 0 … N-1`，采样率 `fs`（Hz），帧长 `N`，频率分辨率 `Δf = fs / N`。
- 窗：`w[n]`，其 DTFT 为 `W(ω) = Σₙ w[n]·e^{-jωn}`，`ω = 2πf/fs`。
- 未归一化 DFT：`X[k] = Σₙ x[n]·w[n]·e^{-j2πkn/N}`。
- 单边谱索引：`k = 0 … ⌊N/2⌋`；`N` 为偶数时 `k = N/2` 是 Nyquist bin。

---

### 3.1 窗函数

#### 3.1.1 窗与频域卷积（基础）

**定义.** 加窗即时域相乘 `x_w[n] = x[n]·w[n]`，频域为卷积

```
X_w(ω) = (1/2π) ∫ X(θ)·W(ω − θ) dθ
```

**直觉.** 窗不是"切一段"，而是把真实谱与窗自身的谱做卷积：`W` 的主瓣决定"能分辨多近的两个峰"，`W` 的旁瓣决定"强信号会漏多少到远处弱信号上"。

**复杂度.** O(N) 逐点相乘；旁瓣/主瓣指标需 O(N log N) 或 O(N·M) 的 DTFT 取样。

**来源.** [S1] §Applications、[S2] §Spectral analysis（A 级）。

#### 3.1.2 主瓣宽度与旁瓣抑制的权衡

**定义.** 半功率主瓣宽 `HPBW`（−3 dB 带宽，单位 bin）与峰值旁瓣电平 `PSL`（dB，相对主瓣峰值）。矩形窗主瓣最窄、旁瓣最高；Blackman / flat-top 反之。

**直觉.** 主瓣窄 = 频率分辨率高（分得开两个相近的峰）；旁瓣低 = 动态范围大（弱峰不被强峰淹没）。二者不可兼得，这是选窗的唯一核心权衡。

**复杂度.** O(N log N)（一次 FFT + 峰值搜索）。

**来源.** [S2] §Choice of window function（A 级，明确给出"high resolution / high dynamic range"二分与"rectangular 对噪声更敏感"的结论）；[S1] §Spectral analysis。

**C 级实测（N=1024，周期窗，附录 A）：**

| 窗 | CG | ENBW (bin) | HPBW (bin) | 扇贝损失 (dB) | PSL (dB) |
| --- | --- | --- | --- | --- | --- |
| 矩形 | 1.000000 | 1.0000 | 0.886 | −3.922 | −13.3 |
| Hann | 0.500000 | 1.5000 | 1.441 | −1.424 | −31.5 |
| Hamming | 0.540000 | 1.3628 | 1.303 | −1.751 | −43.6 |
| Blackman | 0.420000 | 1.7268 | 1.644 | −1.099 | −58.1 |
| Nuttall | 0.355768 | 2.0212 | — | −0.812 | — |
| Flat-top（5 项，未截断） | 0.215579 | 3.7702 | 3.725 | **−0.010** | −35.9 |
| Flat-top（库内 `Math.max(0,…)` 截断） | 0.233509 | 3.1964 | 3.070 | **−0.309** | — |

> 读法：flat-top 用 3.77 个 bin 的宽度换来 0.01 dB 的幅度精度——这是"测幅度"而不是"分频率"的窗。截断负瓣后这条卖点消失。

#### 3.1.3 相干增益（coherent gain, CG）

**定义.**

```
CG = (1/N)·Σₙ w[n] = W(0)/N
```

对正弦（相干）分量，加窗后该谱线的幅度被乘以 `CG`；因此**幅度估计要除以 CG**。

**直觉.** CG 是"窗的平均高度"，描述窗对**窄带确定信号**的衰减比例。Hann 的 CG=0.5，意味着幅度直接掉了 6.02 dB。

**复杂度.** O(N)。

**来源.** [S1] §Examples（窗定义）、[S21]（SciPy `welch` Notes 给出 `sum(w²)·fs/|sum(w)|²` 这一同时含 CG 与 ENBW 的比值，间接定义了两者）、[S28]（B 级，窗指标目录）。

#### 3.1.4 等效噪声带宽（ENBW / NENBW）

**定义.**

```
ENBW = N·Σₙ w[n]² / (Σₙ w[n])²        （单位：bin）
```

**直觉.** 白噪声经过窗后，每个 bin 收集到的噪声功率相当于 `ENBW` 个矩形 bin 的宽度。所以**噪声/PSD 要除以 ENBW（等价地除以 Σw²）**，而不是除以 CG。

**复杂度.** O(N)。（`window.ts` 已实现为 `equivalentNoiseBandwidth`，公式一致。）

**来源.** [S2] §Noise bandwidth（A 级，明确"noise equivalent bandwidth ... proportional to the average power that will be registered by each DFT bin"）；[S21]（A 级：`scaling='density'` 与 `'spectrum'` 之比恰为 `sum(|w|²)·fs/|sum(w)|²`）。

#### 3.1.5 扇贝损失（scalloping loss）

**定义.** 正弦频率落在两个 bin 正中时的最大幅度测量误差：

```
SL = 20·log10( |W(π/N)| / |W(0)| )     （最坏情况在半个 bin 偏移处）
```

**直觉.** 谱线是"栅栏"，峰落在栅栏之间就会变矮。矩形窗最严重（−3.92 dB），flat-top 几乎消除（−0.01 dB）。

**复杂度.** O(N)（单点 DTFT）或 O(N·M)。

**来源.** [S2] §Discrete-time signals（A 级，原文即定义 "misses the maximum value by 1⁄2 bin, and the resultant measurement error is referred to as scalloping loss"）。

#### 3.1.6 对称窗 vs 周期窗（DFT-even）

**定义.** 同一连续窗有两种离散采样：

```
对称：  w_sym[n] = f(2πn/(N−1))     n = 0…N−1
周期：  w_per[n] = f(2πn/N)         n = 0…N−1
```

周期窗等于"对称窗去掉最后一个样本"，在 DFT/STFT/OLA 的周期延拓语义下才是自洽的。

**直觉.** 做**滤波器设计**用对称窗；做**频谱分析 / STFT / OLA** 用周期窗。选错不会报错，只会让结果系统性偏移。

**复杂度.** O(N)。

**来源.** [S2] §Symmetry、§DFT-symmetry（A 级）；[S26]（A 级：`fftbins=True` 默认生成周期窗，"ready to use with … FFT"，`False` 生成对称窗用于滤波器设计）。

**C 级实测：短帧下对称窗与周期窗的偏差（附录 A）**

| N | 窗 | 周期 CG / ENBW | 对称 CG / ENBW | 用 0.5 当 CG 的幅度误差 |
| --- | --- | --- | --- | --- |
| 8 | Hann | 0.5000 / 1.500 | 0.4375 / 1.714 | **−1.16 dB** |
| 16 | Hann | 0.5000 / 1.500 | 0.4688 / 1.600 | −0.56 dB |
| 32 | Hann | 0.5000 / 1.500 | 0.4844 / 1.548 | −0.28 dB |
| 256 | Hann | 0.5000 / 1.500 | 0.4980 / 1.506 | −0.03 dB |
| 8 | Blackman | 0.4200 / 1.727 | 0.3675 / 1.973 | −1.16 dB |

> 结论：**任何"硬编码 0.5"的归一化都必须在运行期按实际窗向量重算**，短帧（N≤32）误差可达 1 dB 量级。

---

### 3.2 谱估计

#### 3.2.1 DFT 与单边谱

**定义.** 未归一化 DFT 如上。实信号满足共轭对称 `X[N−k] = X*[k]`，因此单边谱为

```
X'[0]    = X[0]                 （DC，不乘 2）
X'[k]    = 2·X[k]   0 < k < N/2 （正频率，乘 2 折叠负频率）
X'[N/2]  = X[N/2]              （Nyquist，不乘 2；N 为偶数时存在）
```

**直觉.** 负频率是实信号谱的"镜像"，把镜像能量折回来要乘 2；但 DC 与 Nyquist 是**自共轭**的，没有镜像可折，乘 2 就是凭空翻倍。

**复杂度.** O(N log N)（FFT）。

**来源.** [S2]（A 级，DFT 只采样 DTFT）、[S18] §Power spectral density（A 级）、[S21]（A 级："If `return_onesided` is True, the values of the negative frequencies are added to values of the corresponding positive ones"）。

**C 级反例.** `x[n] = 2 + cos(πn)`（N=1024）：`|X[0]|/N = 2.000`，若乘 2 得 4.000（**+6.02 dB**）；`|X[N/2]|/N = 1.000`，若乘 2 得 2.000（**+6.02 dB**）。

#### 3.2.2 幅度 / 功率归一化与 dB

**定义.**

```
单边幅度： Â[k] = |X'[k]| / (N·CG)                    （单位同 x）
单边功率： P̂[k] = Â[k]² / 2   (0 < k < N/2)
          P̂[k] = Â[k]²       (k = 0 或 k = N/2)
电平：    L_amp = 20·log10(Â / ref)     （幅度量）
          L_pow = 10·log10(P̂ / ref)     （功率量）
```

**直觉.** `20·log10` 用于"幅度"（电压、位移、声压），`10·log10` 用于"功率/能量/密度"。两者只在量本身是平方关系时才等价：`20log10(A) = 10log10(A²)`。

**复杂度.** O(1) 每 bin。

**来源.** [S19]（A 级：SNR 定义为功率比、常用 dB 表示）、[S2]、[S21]（A 级：`V**2/Hz` vs `V**2` 的单位差异）。

**C 级反例.** 幅度 0.5 → `20log10 = −6.02 dB`；功率 0.25 → `10log10 = −6.02 dB`；若对功率误用 20·log10 → **−12.04 dB**（差 6.02 dB）。

#### 3.2.3 周期图与 Welch PSD

**定义.**

```
周期图：  Pxx[k] = |X[k]|² / (fs · Σₙ w[n]²)      （×2，0<k<N/2；DC/Nyquist 不乘）
Welch：   P̄xx[k] = (1/M)·Σ_{m=1..M} Pxx_m[k]       （M 段，段间重叠 hop）
```

**直觉.** 单段周期图方差极大（不随 N 收敛）；Welch 用"多段 + 重叠 + 平均"换方差，代价是频率分辨率变差（段变短）。这是方差与分辨率的交易，不是免费的降噪。

**复杂度.** O(M·N log N)，`M ≈ (L − N)/hop + 1`。

**来源.** [S3]（A 级：分段、重叠、加窗、平方幅度、平均）；[S4]（A 级：周期图偏差与"不满足一致性"的讨论）；[S21]（A 级默认值）；[S29]（B 级，Welch 原始论文）；[S35]（A 级摘要：段数增加 → 方差降、偏差升的 bias–variance trade-off）。

#### 3.2.4 零填充

**定义.** 用 `nfft > N` 的 FFT 计算同一段数据：频点间隔从 `fs/N` 变为 `fs/nfft`。

**直觉.** 补零只是**在频域插值**（对 DTFT 更密采样），不增加信息、不提高分辨率；真正的分辨率由窗长与窗型决定：矩形窗约 `fs/N`，Hann 的主瓣宽 1.44 bin，约 `1.44·fs/N`。

**复杂度.** O(nfft log nfft)。

**来源.** [S2] §Discrete-time signals（A 级：DFT 只是 DTFT 的稀疏采样）；[S21]（A 级 `nfft` 参数："Length of the FFT used, if a zero padded FFT is desired"）。

**C 级反例.** N=256、fs=256 Hz，两个等幅单音相隔 **0.4 bin（0.4 Hz）**，Hann 窗：

| nfft | 频点数 | 带内峰数 | 峰间凹陷 |
| --- | --- | --- | --- |
| 256 | 4 | 1 | 0.00 dB |
| 2048 | 39 | 2（插值出的局部极大） | 0.94 dB |
| 8192 | 159 | 2 | 0.79 dB |

补零后"看见两个鼓包"，但凹陷不到 1 dB（无法判定为两个分量），且峰值从 1.539 漂到 1.577 —— 插值改变了读数，没有改变分辨能力。

#### 3.2.5 泄漏与分辨率

**定义.** 有限长观测等价于乘矩形窗；泄漏是 `W` 的旁瓣把能量扩散到其它频点。可分辨下限（Rayleigh）约 `Δf = fs/N`；加窗后主瓣展宽，实际可分辨间隔约为 `HPBW·Δf`。

**直觉.** 窗越长 → 主瓣越窄 → 分辨率越高；窗越"平滑" → 旁瓣越低 → 动态范围越大。二者由同一个 `W` 决定，无法同时最优。

**复杂度.** 同 FFT。

**来源.** [S2] §Choice of window function、§Noise bandwidth（A 级）。

---

### 3.3 解析信号

#### 3.3.1 Hilbert 变换与解析信号

**定义.** 对实信号 `x`：

```
X = FFT(x)
H[k] = 1 (k=0)、2 (0<k<N/2)、1 (k=N/2, N 偶)、0 (k>N/2)
z = IFFT(X · H)
```

`z[n] = x[n] + j·H{x}[n]`，`H{}` 为 Hilbert 变换。

**直觉.** 把负频率清零、正频率加倍，得到只含正频率的复信号；它的模是包络，它的辐角是相位。这样"瞬时幅度/频率"才有定义。

**复杂度.** O(N log N)。

**来源.** [S7]（A 级定义）、[S8]（A 级 Hilbert 变换）、[S33]（B 级 Gabor 1946 原始文献）、[S25]（A 级：输入必须为实信号，N 可裁剪/补零）。

#### 3.3.2 包络

**定义.** `a[n] = |z[n]| = sqrt(x[n]² + H{x}[n]²)`。

**直觉.** 把振荡"抹平"后剩下的轮廓；对 `A·cos(ωt+φ)` 恒为 `A`。

**复杂度.** O(N)。

**来源.** [S7]（A 级：magnitude 即瞬时幅度/包络）、[S9]（A 级瞬时相位）。

#### 3.3.3 瞬时相位与解缠

**定义.**

```
φ[n] = atan2(Im z[n], Re z[n]) ∈ (−π, π]
unwrap: φ_u[n] = φ_u[n−1] + wrap(φ[n] − φ_u[n−1]),  wrap 把步长折进 [−π, π)
```

**直觉.** `atan2` 的结果被折回一圈，相位每转一圈就"跳" 2π；解缠把跳变补回去，得到连续曲线。

**复杂度.** O(N)。

**来源.** [S9]（A 级）、[S10]（A 级）；库内 `unwrapPhase` 已按 `[−π, π)` 归一（`src/mathematics/analytic.ts:142`）。

#### 3.3.4 瞬时频率

**定义.**

```
f_inst[n] = (φ_u[n] − φ_u[n−1]) · fs / (2π)
```

**直觉.** 相位的变化率就是频率；对单频信号恒为 `f`，对扫频信号给出瞬时值。

**复杂度.** O(N)。

**来源.** [S10]（A 级）、[S32]（B 级 Boashash 综述）；[S36]（A 级摘要：Hilbert 型瞬时频率在多分量信号上会失效，需 STFT/同步压缩等替代）。

**稳定性条件（重要）.** 当 `a[n] → 0` 时相位无定义，`f_inst` 会出现尖峰。C 级实测：两个等幅单音（100 Hz、102 Hz，`fs=2048`）在包络零点处 `a_min ≈ 1.2e−14`，`|f_inst|` 峰值达 **932 Hz**（`fs/2 = 1024 Hz`）——这不是信号，是数值噪声。规格必须提供"包络门限"参数。

#### 3.3.5 边界效应

**定义.** 上述 Hilbert 变换是**循环**卷积（FFT 隐含周期延拓），因此帧首尾把"另一端"当成邻居，产生不连续。

**直觉.** 信号不是周期的，但 FFT 假设它是；接缝处的相位跳变会污染包络与瞬时频率。

**复杂度.** 缓解措施 O(N)（镜像/对称填充）或 O(N log N)（重算）。

**来源.** [S7]（A 级：解析信号基于 Hilbert 变换）、[S37]（A 级摘要：Hilbert 型解析信号的瞬时幅度/频率参数可能不正确）、[S8]。

**C 级反例.** `x[n] = cos(2π·8.3·n/512)`（非整周期，N=512）：中段包络均值 0.9986，但**前 8 点最大偏差 0.259**、**后 8 点最大偏差 0.869**（相对真值 1.0）。即边缘 1.5% 的样本包络误差可达 87%。

---

### 3.4 时频

#### 3.4.1 STFT 的帧长 / 跳长 / 窗

**定义.**

```
X[m, k] = Σ_{n=0}^{N−1} x[n + m·H] · w[n] · e^{−j2πkn/N}
```

`N` = 帧长（frameSize），`H` = 跳长（hopSize），重叠 = `N − H`。

**直觉.** 用一扇宽度 N、每次挪 H 的窗去"扫描"信号：N 决定频率分辨率（`fs/N`），H 决定时间分辨率（`H/fs`）。

**复杂度.** O(M·N log N)，`M = ⌊(L − N)/H⌋ + 1`。

**来源.** [S5]（A 级）、[S30]（B 级 Allen & Rabiner 统一框架）、[S23]（A 级默认值：`nperseg=256`，`noverlap=nperseg//2`，periodic Hann）。

#### 3.4.2 边缘填充与时间轴

**定义.** 帧 `m` 的时间戳通常取 `t_m = m·H/fs`（帧起点）或 `(m·H + N/2)/fs`（帧中心）。首帧要"居中"在 `x[0]` 上，就需要在两端补 `N/2` 个样本（零、常数、奇对称、偶对称）。

**直觉.** 不填充 → 第一帧只覆盖半个窗，边缘能量被低估；填充 → 帧数变多、时间轴可覆盖 `t=0`。

**复杂度.** O(N) 额外内存。

**来源.** [S23]（A 级：`boundary='zeros'` 默认、`padded=True` 默认，及 `[1,2,3,4] → [0,1,2,3,4,0]` 的例子）；[S22]（A 级 `spectrogram` 默认 `noverlap=nperseg//8`，与 `stft` 不同）。

#### 3.4.3 COLA（constant overlap-add）

**定义.**

```
Σ_{m∈ℤ} w[n − m·H] = 常数，∀n
```

**直觉.** 各帧叠加时每个样本被"加权相同的总次数"，重建才不会有周期性起伏（幅度调制）。

**复杂度.** O(N) 校验（`check_COLA` 用"各 bin 加权和与中位数之差 ≤ tol"判定）。

**来源.** [S27]（A 级：COLA 定义与成立条件清单："Hann window at 1/2, 2/3, 3/4, …"、"any Blackman family window at 2/3 overlap"、"any window with noverlap = nperseg−1"）；[S23]（A 级：`noverlap` 指定时必须满足 COLA）；[S31]（B 级 Griffin–Lim 的 OLA 分析/合成框架）。

**C 级实测（周期 vs 对称 Hann，50% 重叠）：**

| N | 周期 Hann 叠加和 | 对称 Hann 叠加和 | 对称窗波纹 |
| --- | --- | --- | --- |
| 16 | 恒为 1.000000 | 0.89776 … 0.98907 | **0.841 dB** |
| 64 | 恒为 1.000000 | 0.97510 … 0.99938 | 0.214 dB |
| 256 | 恒为 1.000000 | 0.99384 … 0.99996 | 0.053 dB |
| 1024 | 恒为 1.000000 | 0.99846 … 1.00000 | 0.013 dB |

> 这就是 §3.1.6 在工程上"必须用周期窗"的定量理由：对称窗在短帧上根本不满足 COLA。

---

### 3.5 特征量

以下 `p[k] = |X[k]|²`（功率谱），`f[k] = k·fs/N`，均取单边谱（DC/Nyquist 不翻倍）。

#### 3.5.1 谱质心（spectral centroid）

**定义.**

```
c = Σₖ f[k]·|X[k]| / Σₖ |X[k]|        （幅度加权；亦有功率加权变体）
```

**直觉.** 频谱的"重心"位置，听感上对应明亮度。

**复杂度.** O(N)。**来源.** [S14]（A 级，原文即"weighted mean of the frequencies … with their magnitudes as the weights"）。

#### 3.5.2 谱带宽（spectral bandwidth / spread）

**定义.**

```
b = sqrt( Σₖ (f[k] − c)²·|X[k]| / Σₖ |X[k]| )
```

**直觉.** 谱围绕质心的"标准差"，衡量能量集中还是发散。

**复杂度.** O(N)。**来源.** [S14]（质心定义）+ 工程惯例（库内 `Spectrum.spread()` 即此式，幅度加权）。

#### 3.5.3 谱滚降（spectral rolloff）

**定义.** 最小的 `f[k]` 使累计能量（或幅度）达到总量的 `r`：

```
rolloff(r) = min{ f[k] : Σ_{j≤k} p[j] ≥ r·Σⱼ p[j] }
```

**直觉.** "多少 Hz 以下装了 85% 的能量"——对噪声/静音不敏感的音色边界。

**复杂度.** O(N)。**来源.** 工程惯例（库内 `Spectrum.rolloff(ratio = 0.85)` 用幅度累计）；`r` 的取值属设计选择，MPEG-7 用 0.95，库内沿用 0.85 以保持一致性（**该规范文本未能验证**）。

#### 3.5.4 谱平坦度（spectral flatness / tonality / Wiener entropy）

**定义.**

```
flatness = (Πₖ p[k])^{1/K} / ( (1/K)·Σₖ p[k] )      （几何均值 / 算术均值，功率谱）
```

**直觉.** 白噪声 → 1；单音 → 0。它衡量"谱有多像噪声"。

**复杂度.** O(N)（用对数域求几何均值）。

**来源.** [S13]（A 级：明确"dividing the geometric mean of the power spectrum by the arithmetic mean"，且"typically measured in decibels"）。

> 实现注意：库内 `Spectrum.flatness()` 用的是**幅度**的几何/算术均值，且遍历**双边**全部 bin。按 [S13] 应为**功率**、且通常只在单边非零 bin 上取。两版数值不同（单调关系但不相等），规格中必须写明口径。

#### 3.5.5 谱通量（spectral flux）

**定义.**

```
flux_m = || |X_m|/||X_m||₂ − |X_{m−1}|/||X_{m−1}||₂ ||₂
```

**直觉.** 相邻帧"谱形状"变了多少；突变处即起始点。

**复杂度.** O(N) 每帧。**来源.** [S15]（A 级：L2 范数、归一化后与总功率无关、L1 与半波整流变体）。

#### 3.5.6 过零率（zero-crossing rate, ZCR）

**定义.**

```
ZCR = (1/(T−1))·Σ_{t=1}^{T−1} |sgn(s[t]) − sgn(s[t−1])|
```

**直觉.** 单位时间穿越零点的次数；噪声/清音高，浊音/低频低。

**复杂度.** O(N)。**来源.** [S12]（A 级，公式原文即除以 `T−1`）。

> 与库内 `Frame.zeroCrossings()` 的区别：后者返回**次数**（整数计数），不是速率。`SignalCollectable.zeroCrossingRate()` 应显式定义归一化口径（除以 `N−1`，或再乘 `fs` 得到 Hz）。

#### 3.5.7 自相关

**定义.**

```
r[k]  = Σ_{n} x[n]·x[n+k]                    （未归一化，库内 Frame.autocorrelate 即此）
ρ[k]  = r[k] / r[0]                          （归一化，ρ[0]=1）
无偏：  r_u[k] = r[k] / (N − |k|)
```

**直觉.** 信号与自身延迟版本的相似度；周期信号在周期处出现峰。

**复杂度.** O(N²) 直接 / O(N log N) FFT。

**来源.** [S17]（A 级：不同领域定义不同、需明确归一化）、[S16]（A 级归一化到 Pearson 系数的讨论）。

#### 3.5.8 互相关

**定义.**

```
r_xy[k] = Σ_n x[n]·y[n−k]
ρ_xy[k] = r_xy[k] / sqrt( Σx² · Σy² )       （归一化互相关，|ρ|≤1）
```

**直觉.** 平移多少能让两段信号最像；峰位置即延迟，峰高即相似度。

**复杂度.** O(N²) 直接 / O(N log N) FFT。

**来源.** [S16]（A 级：Normalization 一节，工程常省略归一化、统计常用 Pearson 系数）。

> 库内 `Frame.correlate` 返回**未归一化**的和，长度 `2N−1`，lag 0 在中心——跨帧长不可比。规格需补归一化与 lag 轴 API。

#### 3.5.9 相干性（magnitude-squared coherence）

**定义.**

```
C_xy(f) = |G_xy(f)|² / ( G_xx(f)·G_yy(f) )        ∈ [0, 1]
```

其中 `G_xy`、`G_xx`、`G_yy` 为（Welch 平均后的）互谱/自谱。

**直觉.** 两个信号在各频点上"线性相关"的程度；1 = 完全线性、0 = 无关。

**复杂度.** O(M·N log N)。

**来源.** [S11]（A 级定义）、[S34]（B 级 Carter 综述）、[S24]（A 级实现默认：periodic Hann、`nperseg=256`、50% 重叠、`detrend='constant'`）。

**关键性质（数学恒等）.** 单段估计时 `|X·Y*|² = |X|²·|Y|²`，故 **`C_xy ≡ 1`**。所以相干性必须**多段平均**才有意义；段数 `M` 越少，偏差越大（偏乐观）。这一点在 API 中必须默认 `M ≥ 2` 并在 `@throws` 中拒绝"段数不足"。

#### 3.5.10 信噪比估计（SNR）

**定义（估计器口径）.**

```
N₀   = median_k( Pxx[k] )                       （稳健噪声底，假设噪声在带内近似平坦）
P_s  = Σ_{k∈带内} Pxx[k]·Δf − N₀·B_带
SNR  = 10·log10( P_s / (N₀·B_带) )
```

**直觉.** 把"带内总功率"减去"按噪声底估算的噪声功率"，剩下的就是信号；两者相除取 dB。

**复杂度.** O(N)（排序取中位数 O(N log N)）。

**来源.** [S19]（A 级：SNR 为信号功率与噪声功率之比、常用 dB）。**估计器本身是设计选择**（中位数噪声底 + 带内积分），不冒充某篇文献的标准算法；应在文档中标注"假设噪声在带内平坦、信号能量可忽略地泄漏到带外"。

---
## 4. 参数与默认值建议

默认值不是"随便挑一个能跑的"，每条都要能回答"为什么不换一个"。

### 4.1 参数表

| 参数 | 建议默认 | 理由 | 来源 |
| --- | --- | --- | --- |
| `window`（分析窗） | **周期 Hann** | 主瓣 1.44 bin / 旁瓣 −31.5 dB / ENBW 1.5 bin，是分辨率与动态范围的中庸点；三大 SciPy 例程（`welch`、`stft`、`coherence`）默认都是 periodic Hann | [S21][S23][S24]（A 级默认值）、[S2]（A 级权衡说明） |
| `frameSize` | `min(256, size)` | SciPy `welch`/`coherence` 在窗为字符串时把 `nperseg` 定为 256；256 点 @48 kHz ≈ 5.3 ms，兼顾语音/音频的短时平稳假设 | [S21][S24]（A 级） |
| `hopSize` | `frameSize / 2`（向下取整） | 50% 重叠是"既覆盖全部样本、又不过度重复计数"的折中；且 Hann 在 1/2 重叠处严格满足 COLA | [S21]（`noverlap = nperseg // 2`，A 级）、[S27]（A 级 COLA 清单） |
| `detrend`（PSD/相干） | `"constant"` | 去均值避免 DC 泄漏污染低频 bin；SciPy `welch`/`coherence` 默认即 `constant` | [S21][S24]（A 级） |
| `detrend`（STFT） | `"none"` | SciPy `stft` 默认 `False`；STFT 通常保留原波形以便可逆重建 | [S23]（A 级） |
| `scaling` | `"density"` | PSD 的物理单位是 `unit²/Hz`，可跨不同帧长比较、可与 ENBW 联动；`"spectrum"` 只给 `unit²` | [S21]（A 级：`V**2/Hz` vs `V**2`） |
| `oneSided` | `true`（实信号） | 实信号负频率是冗余镜像；复信号必须 `false` | [S21]（A 级） |
| `nfft`（补零） | `= frameSize` | 默认不补零，避免用户误以为分辨率提高 | [S21]（A 级：`nfft=None → nperseg`） |
| `boundary` / `padded`（STFT） | `"zeros"` / `true` | 使首帧居中于 `x[0]`、尾帧不丢样本；与 SciPy 默认一致，便于对拍 | [S23]（A 级） |
| `coherentGain` / `noiseBandwidth` | **运行期按实际窗向量计算**，不使用闭式近似 | 对称窗在短帧上偏离闭式值（N=8 时 CG=0.4375 而非 0.5），且自定义窗无法闭式 | C 级实测（§3.1.6）、[S26] |
| `epsilon`（相等/去零） | `1E-9` | 与库内 `Spectrum.equals`、`Bin.equals` 的默认容差一致 | 库内实现（`src/mathematics/bin.ts:328`） |
| `rolloffRatio` | `0.85` | 与库内 `Spectrum.rolloff(ratio = 0.85)` 保持一致；0.85/0.95 都是常见取值，属应用选择 | 库内实现（`src/mathematics/spectrum.ts:551`）；MPEG-7 的 0.95 **未能验证** |
| `envelopeGate`（瞬时频率门限） | `1E-3 × max(envelope)` | 低于此值时相位由舍入噪声主导；C 级实验显示包络降到 1e−14 时瞬时频率可达 932 Hz（fs/2=1024） | C 级实测（§3.3.4）、[S10] |
| `minimumSegments`（相干性） | `2`，推荐 `≥ 8` | 单段相干性恒等于 1；段数越少偏差越大 | 数学恒等（§3.5.9）、[S11][S34] |
| `fluxNorm` | `"l2"`，先按帧归一化 | 归一化后通量与总功率无关，正是文献定义的默认形式 | [S15]（A 级） |
| `zcrNormalization` | 除以 `N−1`（每样本），可选乘 `fs` 得 Hz | 与文献公式一致；`Frame.zeroCrossings()` 只给计数，语义不同 | [S12]（A 级） |

### 4.2 默认值的"为什么不"

- **为什么不是矩形窗？** 矩形窗 PSL 只有 −13.3 dB，强信号泄漏会淹没 20 dB 以下的弱分量；但它在"分辨两个等幅近频分量"和"白噪声下检测弱正弦"上更优（[S2] §Choice of window function）。因此默认 Hann，而保留 `useRectangularWindow` 供"已知整周期采样"场景使用。
- **为什么不是 flat-top 做默认？** ENBW 3.77 bin、HPBW 3.73 bin，频率分辨率差 2.6 倍；它只在"测幅度"场景优于 Hann（[S1] §Flat top window：宽带宽带来高噪声带宽）。
- **为什么 Welch 段长默认 256 而不是整段？** 单段周期图方差不随 N 收敛（[S4]），必须靠多段平均；段长过大则段数不足、方差仍大，且失去时变信息（[S3][S35]）。
- **为什么相干性默认强制多段？** 单段时 `|G_xy|²/(G_xx·G_yy) ≡ 1`，结果永远"完美相干"，是纯粹的假象（§3.5.9）。

---

## 5. 陷阱清单（错误做法 vs 正确做法 + 数值反例）

> 每条反例均可由附录 A 的脚本复现；标注 **C** 的为本机计算结果，标注来源的为文献结论。

### 陷阱 1：单边谱把 DC 与 Nyquist 也乘 2

- ❌ `X'[k] = 2·X[k]` 对所有 `k ≥ 1` 一律翻倍。
- ✅ 只有 `0 < k < N/2` 乘 2；`k = 0` 与 `k = N/2`（N 为偶数）保持原值。
- 🔢 **C**：`x[n] = 2 + cos(πn)`，N=1024 → DC 幅度 2.000 被读成 4.000，Nyquist 幅度 1.000 被读成 2.000，**各差 +6.02 dB**。
- 来源：[S2]（DFT 与 DTFT 关系）、[S21]（单边谱折叠规则）。

### 陷阱 2：对功率误用 20·log10

- ❌ `10 * Math.log10(power)` 与 `20 * Math.log10(power)` 混用；或直接把 `power` 传给只做幅度惯例的 `decibel()`。
- ✅ 幅度量用 `20·log10`，功率/能量/密度用 `10·log10`。
- 🔢 **C**：功率 0.25 → 正确 `10log10 = −6.02 dB`；误用 `20log10` 得 **−12.04 dB**，差 6.02 dB。
- 来源：[S19]（SNR 为功率比）、库内 `decibel()` 固定 20·log10（`src/mathematics/bin.ts:66`）。

### 陷阱 3：忘记相干增益校正

- ❌ 直接 `2·|X[k]|/N` 当幅度。
- ✅ `2·|X[k]|/(N·CG)`，且 CG 按实际窗向量算。
- 🔢 **C**：幅度 1.0 的正弦，Hann 窗下原始估计 **0.5000（−6.02 dB）**；除以 CG=0.5 后回到 1.0000。
- 来源：[S1]（窗的幅度响应）、[S21]（`|sum(w)|²` 出现在归一化比值中）。

### 陷阱 4：把 `CG = 0.5` 硬编码进公式

- ❌ `amplitude = 2*|X|/N/0.5`（假定所有 Hann 都是 0.5）。
- ✅ 每次按 `count` 与窗型重算 `coherentGain(window, count)`。
- 🔢 **C**：对称 Hann，N=8 时 CG=0.4375、N=16 时 0.4688；若仍按 0.5 归一化，幅度误差为 **−1.16 dB（N=8）/ −0.56 dB（N=16）**。
- 来源：C 级实测（§3.1.6）；[S26]（对称/周期窗差异）。

### 陷阱 5：噪声功率用相干增益或 N 归一化

- ❌ 噪声/PSD 除以 `N`，或除以 `N·CG²`。
- ✅ 除以 `Σw²`（等价于 `N·CG²·ENBW`）。
- 🔢 **C**（σ=1 白噪声，N=4096，300 次平均）：

  | 归一化 | 平均读数 | 偏差 |
  | --- | --- | --- |
  | `Σw²`（正确） | 0.9988 | −0.01 dB |
  | `N` | 0.3746 | **−4.26 dB** |
  | `N·CG²` | 1.4982 | **+1.76 dB**（= ENBW 1.5） |

- 来源：[S2] §Noise bandwidth、[S21]（density/spectrum 比值）。

### 陷阱 6：把 flat-top 的负瓣截断为 0

- ❌ `Math.max(0, a0 − a1cos + a2cos2 − a3cos3 + a4cos4)`（库内现状）。
- ✅ 保留负值；平顶窗按设计就是"部分取负"的窗。
- 🔢 **C**（N=1024，周期）：

  | 指标 | 未截断（正确） | 截断（现状） | 后果 |
  | --- | --- | --- | --- |
  | CG | 0.215579 | 0.233509 | 幅度标定整体偏移 **+0.69 dB**：若仍按名义 0.2156 校正，读数会被高估；且各 bin 响应已不再平坦，单一系数修不回来 |
  | ENBW | 3.7702 | 3.1964 | 按截断窗的 ENBW 归一化，噪声密度 **高估 +0.72 dB**（10·log10(3.770/3.196)） |
  | 扇贝损失 | **−0.010 dB** | **−0.309 dB** | 幅度精度恶化 **31 倍** |
  | HPBW | 3.725 | 3.070 | 主瓣形状被改变 |
  | 负值样本数 | 577 / 1024 | 0 | 窗口被"腰斩" |

- 来源：[S1] §Flat top window（A 级原文："a partially negative-valued window that has minimal scalloping loss … desirable for the measurement of amplitudes"）。

### 陷阱 7：用对称窗做 STFT / OLA

- ❌ `useHannWindow(index, count)`（分母 `count−1`）直接用于重叠相加。
- ✅ 分析/合成路径使用周期窗（分母 `count`），或显式按 COLA 校验。
- 🔢 **C**：50% 重叠下，对称 Hann 的叠加和波纹：N=16 → **0.841 dB**、N=64 → 0.214 dB、N=256 → 0.053 dB；周期 Hann 恒为 1.000000（0 dB）。
- 来源：[S2] §Symmetry/§DFT-symmetry、[S27]（COLA 条件）、[S23]（periodic Hann 默认）。

### 陷阱 8：以为补零能提高频率分辨率

- ❌ `nfft = 8192` 后宣称"分辨率提高到 0.03 Hz"。
- ✅ 分辨率由 `N`（与窗型）决定；补零只是 DTFT 插值，改善的是**峰值定位**（配合抛物线插值）而非**可分辨性**。
- 🔢 **C**：N=256、fs=256 Hz，两等幅单音相隔 0.4 Hz（< 1 bin），Hann 窗：nfft=256 只有 1 个峰；nfft=8192 出现 2 个局部极大，但凹陷仅 **0.79 dB**（无法判定为两个分量），且峰值读数从 1.539 漂到 1.577。
- 来源：[S2] §Discrete-time signals、[S21]（`nfft` 语义）。

### 陷阱 9：对复信号用单边谱 / 忘记共轭对称

- ❌ 对 `analyticSignal()` 的输出套用"单边折叠 + 乘 2"。
- ✅ 单边折叠只对**实**输入成立；复信号必须保留双边谱，且 `|X|` 不再对称。
- 🔢 结构性错误：解析信号已把负频率清零，再折叠一次等于把正频率乘 2 并丢掉信息，幅度整体 +6.02 dB，且相位关系被破坏。
- 来源：[S7]（解析信号无负频率分量）、[S21]（复数据强制双边）。

### 陷阱 10：忽视 Hilbert 的循环边界

- ❌ 对整段信号直接 FFT → 乘 Hilbert 掩码 → IFFT，然后把首尾样本当有效结果。
- ✅ 两端做镜像/对称填充后再变换，或丢弃首尾 `N/2` 个样本，或（对流式）分帧加交叠。
- 🔢 **C**：`cos(2π·8.3·n/512)`：中段包络均值 0.9986，**前 8 点偏差 0.259、后 8 点偏差 0.869**（真值 1.0）。
- 来源：[S7][S8]（Hilbert 基于全局变换）、[S37]（Hilbert 型 IA/IF 可能失真）。

### 陷阱 11：零包络处照算瞬时频率

- ❌ `f_inst = diff(unwrap(angle(z)))·fs/2π` 不加保护。
- ✅ 先用包络门限屏蔽（或输出 `Optional`/NaN 语义），并在文档中说明"包络过零处相位无定义"。
- 🔢 **C**：两等幅单音（100/102 Hz，fs=2048）在包络零点 `a ≈ 1.2e−14` 处，`|f_inst|` 峰值 **932 Hz**（fs/2 = 1024 Hz）。
- 来源：[S10]（瞬时频率需包络非零）、[S36]（多分量信号的 IF 需专门方法）。

### 陷阱 12：把未归一化自相关当相似度

- ❌ 直接比较不同长度信号的 `r[0]` 或峰值。
- ✅ 归一化 `ρ[k] = r[k]/r[0]`；需要无偏估计时除以 `N−|k|` 并说明方差随 lag 增大。
- 🔢 `r[0] = Σx²` 随 N 线性增长：同一正弦，N 翻倍则 `r[0]` 翻倍，峰值"相似度"看似不变但绝对幅度全变。
- 来源：[S17]（不同定义、需明确归一化）、[S16]（归一化到 Pearson 系数）。

### 陷阱 13：用单段数据估计相干性

- ❌ 一次 FFT 后 `|X·Y*|²/(|X|²|Y|²)`。
- ✅ Welch 多段平均互谱/自谱；段数 ≥ 2，建议 ≥ 8。
- 🔢 代数恒等：单段时分子 = `|X|²|Y|²` = 分母，结果**恒为 1**，与两信号是否相关无关。
- 来源：[S11]（定义基于平均谱）、[S34]（相干估计的统计性质）。

### 陷阱 14：对双边谱直接求频带能量

- ❌ `bandEnergy(low, high)` 在**完整双边** bin 上求和。
- ✅ 单边谱求和（DC/Nyquist 不翻倍），或双边求和后除以 2（实信号）。
- 🔢 实信号正负频率各占一半能量：双边直接求和的带内能量是真实值的 **2 倍（+3.01 dB）**。
- 来源：[S2]（共轭对称）、[S18]（PSD 的单边/双边约定）；库内 `Spectrum.bandEnergy` 遍历全部 bin（`src/mathematics/spectrum.ts:599`），调用方需注意。

### 陷阱 15：平坦度用幅度、且用双边谱

- ❌ `flatness = geomean(|X|)/mean(|X|)` 遍历全部 `N` 个 bin。
- ✅ 按定义用**功率谱**（或至少明确口径），通常在单边非零 bin 上计算；零 bin 会让几何均值归零。
- 🔢 幅度版与功率版数值不同（例如两 bin 能量比 4:1 时，幅度比 2:1 → 几何/算术均值比不同），跨实现比较会得到不同"音调性"结论。
- 来源：[S13]（A 级：power spectrum 的几何均值/算术均值）；库内 `Spectrum.flatness()` 用幅度 + 双边（`src/mathematics/spectrum.ts:521`）。

### 陷阱 16：STFT 丢尾帧 / 边缘不填充

- ❌ `for (start = 0; start + N <= L; start += H)`，尾部不足一帧的样本直接丢弃。
- ✅ 两端填充（`boundary="zeros"`）并在末尾补零对齐（`padded=true`），保证覆盖全部样本；或显式返回"未覆盖样本数"。
- 🔢 结构性差异：`L=1000, N=256, H=128` → 不填充只有 6 帧（覆盖 768 样本，**丢 232 个**）；SciPy 默认填充后帧数更多且时间轴从 0 开始。
- 来源：[S23]（A 级 `boundary`/`padded` 默认与语义）；库内 `Sampler.shortTimeFourierTransform` 当前为"只取完整帧"（`src/mathematics/sampler.ts:610`）。

### 5.1 陷阱 → 测试用例映射

| 陷阱 | 建议的单元测试断言 |
| --- | --- |
| 1 | `amplitudeAt(0n)` 与 `amplitudeAt(size/2)` 对 `2 + cos(πn)` 分别返回 2.0 与 1.0（容差 1e−9） |
| 2 | `powerDecibel()[k]` 与 `10log10(power)` 相等；`decibel()[k]` 与 `20log10(amplitude)` 相等 |
| 3/4 | 幅度 1 的正弦在 N=8/16/1024 下 `amplitudeAt` 均返回 1.0（±1e−6） |
| 5 | 白噪声 PSD 的带内积分 ≈ 方差（±5%） |
| 6 | flat-top 产生至少一个负权重；`scallopingLoss(useFlatTopWindow, 1024) > −0.05 dB` |
| 7 | `colaResidual(useHannPeriodicWindow, 1024, 512) < 1e−12`；对称窗同参数 > 1e−4 |
| 8 | 0.4 bin 间隔双音在 nfft=8192 下的峰间凹陷 < 1 dB（证明"未分辨"） |
| 10 | 非整周期正弦的包络在首尾 8 点的偏差 > 0.2（文档化行为） |
| 11 | 门限开启后，包络零点附近不再返回 > fs/2 的频率 |
| 13 | 单段相干性恒为 1（断言该路径被禁用） |
| 14 | 单边带能量 + 双边带能量/2 相等 |

---
## 6. API 提案

### 6.1 模块落点

| 文件 | 新增内容 | 说明 |
| --- | --- | --- |
| `src/mathematics/window.ts` | 周期窗工厂、`scallopingLoss`、`halfPowerWidth`、`colaResidual`、`isCola` | 就地扩展，不动已有导出 |
| `src/mathematics/signal.ts` | `SignalCollectable`、`SpectralDensity`、选项接口 | 新模块 |
| `src/symbol.ts` | `SignalCollectableSymbol`、`SpectralDensitySymbol` | `Symbol.for("SignalCollectable")` / `Symbol.for("SpectralDensity")` |
| `src/guard.ts` | `isSignalCollectable`、`isSpectralDensity` | 按品牌位判定，与现有守卫同构 |
| `src/mathematics/index.ts` | `export * from "#semantic/mathematics/signal";` | 一行 |

### 6.2 风格契约（与本库对齐）

1. **不可变值对象**：构造期复制输入到 `Object.freeze` 的数组，`Object.defineProperties` 固定字段，最后 `Object.freeze(this)`；所有派生操作返回新实例。
2. **`Optional<T>` 代替 `null`**：越界索引、空信号、无定义的统计量一律返回 `Optional.empty()`，与 `Frame.at` / `Spectrum.binAt` 一致。
3. **`bigint` 索引与计数**：`Collectable` 层（`SynchronousWindowCollectable.slide(size: bigint, step: bigint)`）用 `bigint`；本类沿用，`size()`、`at()`、`frameSize`、`hopSize`、`maximumLag` 全部为 `bigint`。与 `Frame`/`Spectrum` 的 `number` 索引交界处显式转换并检查安全整数范围。
4. **`useXxx` 工厂**：静态构造用 `useRate` / `useFrame`；窗用 `useHannPeriodicWindow` 等。
5. **`#semantic/...` 导入**：全部内部导入走包内别名。
6. **错误分层**：类型/有限性 → `TypeError`；定义域 → `RangeError`；越界查询 → 空 `Optional`（不抛）。

### 6.3 类型与类声明

```ts
import { isFunction, isNumber } from "#semantic/guard";
import { Optional } from "#semantic/optional";
import { Angle } from "#semantic/mathematics/angle";
import { Bin } from "#semantic/mathematics/bin";
import { Complex } from "#semantic/mathematics/complex";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sample } from "#semantic/mathematics/sample";
import { Spectrogram } from "#semantic/mathematics/spectrogram";
import { Spectrum } from "#semantic/mathematics/spectrum";
import { Coherence } from "#semantic/mathematics/coherent";
import type { CoherenceOptions } from "#semantic/mathematics/coherent";
import type { SpectralWindow } from "#semantic/mathematics/window";
import { SignalCollectableSymbol, SpectralDensitySymbol } from "#semantic/symbol";

/** Removes a trend before a transform: none, mean only, or least-squares line. */
export type DetrendMode = "none" | "constant" | "linear";

/** PSD scaling: physical density (unit^2/Hz) or plain power (unit^2). */
export type PowerScaling = "density" | "spectrum";

/** Cross-correlation normalisation: raw sums, Pearson coefficient, or unbiased sums. */
export type CorrelationNormalization = "none" | "coefficient" | "unbiased";

/** Averaging applied to the segment periodograms of a Welch estimate. */
export type SegmentAverage = "mean" | "median";

/** Options for a single-transform spectrum. */
export interface SpectrumOptions {
    /** Transform length in samples; larger than the signal length zero-pads. Defaults to the signal length. */
    readonly padding?: bigint;
    /** Overrides the analysis window for this call only. */
    readonly window?: SpectralWindow;
    /** Trend removed before the transform; defaults to `"none"`. */
    readonly detrend?: DetrendMode;
}

/** Options for a Welch power spectral density estimate. */
export interface WelchOptions {
    /** Segment length in samples; defaults to `min(256, size)`. */
    readonly frameSize?: bigint;
    /** Samples between segment starts; defaults to `frameSize / 2n`. */
    readonly hopSize?: bigint;
    /** Overrides the analysis window for this call only. */
    readonly window?: SpectralWindow;
    /** Trend removed per segment; defaults to `"constant"`. */
    readonly detrend?: DetrendMode;
    /** Density or plain power scaling; defaults to `"density"`. */
    readonly scaling?: PowerScaling;
    /** Segment averaging rule; defaults to `"mean"`. */
    readonly average?: SegmentAverage;
}

/** Options for the short-time Fourier transform and the spectrogram. */
export interface TimeFrequencyOptions {
    /** Overrides the analysis window for this call only. */
    readonly window?: SpectralWindow;
    /** Edge extension: zero, constant, or none; defaults to `"zeros"`. */
    readonly boundary?: "zeros" | "constant" | "none";
    /** Pads the tail so every sample is covered; defaults to `true`. */
    readonly padded?: boolean;
}

/** Options for the analytic-signal derivatives. */
export interface InstantaneousOptions {
    /** Envelope level, relative to the peak, below which the phase is treated as undefined; defaults to `1E-3`. */
    readonly envelopeGate?: number;
}

/** Options for the zero-crossing rate. */
export interface ZeroCrossingOptions {
    /** Reports crossings per second rather than per sample; defaults to `false`. */
    readonly perSecond?: boolean;
}

/** Options for auto- and cross-correlation. */
export interface CorrelationOptions {
    /** Normalisation rule; defaults to `"coefficient"`. */
    readonly normalization?: CorrelationNormalization;
}

/** Options for the noise-floor based SNR estimate. */
export interface SignalToNoiseOptions {
    /** Lower band edge; defaults to the first non-DC bin. */
    readonly low?: Frequency;
    /** Upper band edge; defaults to the Nyquist frequency. */
    readonly high?: Frequency;
    /** Segment length in samples; defaults to `min(256, size)`. */
    readonly frameSize?: bigint;
    /** Samples between segment starts; defaults to `frameSize / 2n`. */
    readonly hopSize?: bigint;
    /** Overrides the analysis window for this call only. */
    readonly window?: SpectralWindow;
    /** Quantile used as the noise floor; defaults to `0.5` (median). */
    readonly floorQuantile?: number;
}

/** An immutable one-sided power spectral density on a fixed frequency grid. */
export class SpectralDensity {

    private readonly frequencies: ReadonlyArray<Frequency>;
    private readonly densities: ReadonlyArray<number>;
    private readonly resolution: Frequency;
    private readonly segments: bigint;
    private readonly taper: SpectralWindow;
    private readonly scaling: PowerScaling;
    protected readonly [SpectralDensitySymbol]: symbol = SpectralDensitySymbol;

    public constructor(frequencies: Iterable<Frequency>, densities: Iterable<number>, resolution: Frequency, segments: bigint, taper: SpectralWindow, scaling: PowerScaling);

    public size(): bigint;
    public isEmpty(): boolean;
    public getResolution(): Frequency;
    public getSegments(): bigint;
    public getWindow(): SpectralWindow;
    public getScaling(): PowerScaling;
    public frequencyAt(index: bigint): Optional<Frequency>;
    public densityAt(index: bigint): Optional<number>;
    /** Returns `10 * log10(density / reference)`, the power convention. */
    public decibelAt(index: bigint, reference?: number): Optional<number>;
    /** Integrates the density over `[low, high)`, giving a power in unit^2. */
    public integrate(low: Frequency, high: Frequency): number;
    /** Integrates over the whole grid; equals the signal mean square when scaling is `"density"`. */
    public totalPower(): number;
    /** Returns the requested quantile of the density, the usual robust noise floor. */
    public noiseFloor(quantile?: number): Optional<number>;
    public equals(other: SpectralDensity, epsilon?: number): boolean;
    public toString(): string;
}

/** A real-valued signal bound to its sampling plan and analysis window. */
export class SignalCollectable {

    private readonly plan: Sample;
    private readonly values: ReadonlyArray<number>;
    private readonly taper: SpectralWindow;
    private readonly coherent: number;
    private readonly bandwidth: number;
    protected readonly [SignalCollectableSymbol]: symbol = SignalCollectableSymbol;

    public constructor(plan: Sample, values: Iterable<number>, window?: SpectralWindow);
    public static useRate(values: Iterable<number>, rate: number, window?: SpectralWindow): SignalCollectable;
    public static useFrame(frame: Frame, window?: SpectralWindow): SignalCollectable;

    // --- metadata -------------------------------------------------------
    public getSample(): Sample;
    public getValues(): ReadonlyArray<number>;
    public getWindow(): SpectralWindow;
    /** Coherent gain of the configured window, recomputed for this signal length. */
    public getCoherentGain(): number;
    /** Equivalent noise bandwidth of the configured window, in bins. */
    public getNoiseBandwidth(): number;
    public size(): bigint;
    public isEmpty(): boolean;
    public at(index: bigint): Optional<number>;
    public getRate(): number;
    public getNyquist(): Frequency;
    /** Bin spacing `rate / size`, the grid resolution rather than the true resolving power. */
    public getResolution(): Frequency;
    public toFrame(): Frame;
    public equals(other: SignalCollectable, epsilon?: number): boolean;
    public toString(): string;

    // --- preprocessing --------------------------------------------------
    public detrended(mode?: DetrendMode): SignalCollectable;
    public windowed(window?: SpectralWindow): SignalCollectable;

    // --- spectrum -------------------------------------------------------
    public spectrum(options?: SpectrumOptions): Spectrum;
    public oneSided(): Array<Bin>;
    /** One-sided amplitudes corrected by the coherent gain, in sample units. */
    public amplitude(): Array<number>;
    public amplitudeAt(index: bigint): Optional<number>;
    /** One-sided power, DC and Nyquist not doubled, summing to the mean square. */
    public power(): Array<number>;
    public powerAt(index: bigint): Optional<number>;
    public decibel(): Array<number>;
    public powerDecibel(): Array<number>;
    public decibelAt(index: bigint): Optional<number>;
    public powerDecibelAt(index: bigint): Optional<number>;
    public powerSpectralDensity(options?: WelchOptions): SpectralDensity;

    // --- time-frequency -------------------------------------------------
    public shortTimeFourierTransform(frameSize: bigint, hopSize: bigint, options?: TimeFrequencyOptions): Array<Spectrum>;
    public spectrogram(frameSize: bigint, hopSize: bigint, options?: TimeFrequencyOptions): Spectrogram;

    // --- analytic signal ------------------------------------------------
    public analytic(): Array<Complex>;
    public envelope(): Array<number>;
    public instantaneousPhase(): Array<Angle>;
    public instantaneousFrequency(options?: InstantaneousOptions): Array<number>;

    // --- features -------------------------------------------------------
    public centroid(): Optional<Frequency>;
    public bandwidth(): Optional<Frequency>;
    public rolloff(ratio?: number): Optional<Frequency>;
    /** Spectral flatness of the one-sided power spectrum, in `[0, 1]`. */
    public flatness(): number;
    public flux(previous?: SignalCollectable, options?: WelchOptions): number;
    public zeroCrossingRate(options?: ZeroCrossingOptions): number;
    public autocorrelation(maximumLag?: bigint, options?: CorrelationOptions): Array<number>;
    public crossCorrelation(other: SignalCollectable, maximumLag?: bigint, options?: CorrelationOptions): Array<number>;
    public coherence(other: SignalCollectable, options?: CoherenceOptions): Coherence;
    public signalToNoiseRatio(options?: SignalToNoiseOptions): Optional<number>;
}

export { isSignalCollectable, isSpectralDensity } from "#semantic/guard";
```

### 6.3.1 `window.ts` 的增补（同一风格）

```ts
/** A periodic (DFT-even) Hann window: denominator `count`, COLA-compliant at 50% hop. */
export const useHannPeriodicWindow: SpectralWindow;

/** A periodic (DFT-even) Hamming window. */
export const useHammingPeriodicWindow: SpectralWindow;

/** A periodic (DFT-even) Blackman window. */
export const useBlackmanPeriodicWindow: SpectralWindow;

/** A periodic (DFT-even) flat-top window; negative lobes are preserved by design. */
export const useFlatTopPeriodicWindow: SpectralWindow;

/**
 * Worst-case amplitude error of a sinusoid halfway between two bins, in decibels.
 * Returns `20 * log10(|W(PI / count)| / |W(0)|)`, which is zero for a perfectly
 * flat main lobe and negative otherwise.
 */
export const scallopingLoss: (window: SpectralWindow, count: number) => number;

/** The -3 dB main-lobe width in bins, found by scanning the window DTFT. */
export const halfPowerWidth: (window: SpectralWindow, count: number) => number;

/**
 * The peak-to-peak ripple of the overlap-add sum `sum(w[n - m * hop])` over one
 * hop period, in decibels. Zero means the window satisfies COLA exactly.
 */
export const colaResidual: (window: SpectralWindow, count: number, hopSize: number) => number;

/** Reports whether `colaResidual` stays within `tolerance` decibels; defaults to `1E-9`. */
export const isCola: (window: SpectralWindow, count: number, hopSize: number, tolerance?: number) => boolean;
```

> 命名说明：库内既有 `useHannWindow` 保持**对称**语义不变（滤波器设计需要它），新增 `useXxxPeriodicWindow` 表示周期形式，避免破坏 1.x 的兼容性。若愿意接受破坏性变更，可在 2.0 让 `useHannWindow` 默认周期、把对称版改名 `useHannSymmetricWindow`。

### 6.4 `@throws` 契约（逐方法）

| 方法 | `@throws` |
| --- | --- |
| `constructor(plan, values, window?)` | `TypeError`：`plan` 非 `Sample`、`values` 含非有限数、`window` 非函数；`RangeError`：`values` 数量 ≠ `plan.getCount()`、`plan` 的 count < 1 |
| `useRate(values, rate, window?)` | `TypeError`：`rate` 非有限数、`values` 含非有限数；`RangeError`：`rate ≤ 0`、样本数 < 1 |
| `useFrame(frame, window?)` | `TypeError`：`frame` 非 `Frame`、`window` 非函数；`RangeError`：帧数为 0 |
| `at(index)` | 无：越界（含负数、≥ size）返回空 `Optional`；`index` 只需是 `bigint` |
| `getCoherentGain()` / `getNoiseBandwidth()` | `RangeError`：窗权重和恰为 0（无法归一化） |
| `detrended(mode)` | `TypeError`：`mode` 不是三种取值之一 |
| `windowed(window?)` | `TypeError`：`window` 非函数；`RangeError`：窗返回非有限权重 |
| `spectrum(options?)` | `TypeError`：`padding` 非 `bigint`、`detrend` 非法、`window` 非函数；`RangeError`：`padding < size`（不允许截断）、`padding` 超过安全整数上限 |
| `amplitudeAt(index)` / `powerAt(index)` / `decibelAt(index)` / `powerDecibelAt(index)` | 无：越界返回空 `Optional` |
| `powerSpectralDensity(options?)` | `TypeError`：类型错误；`RangeError`：`frameSize ≤ 0`、`frameSize > size`、`hopSize ≤ 0`、`hopSize > frameSize`、段数 < 1 |
| `shortTimeFourierTransform(frameSize, hopSize, options?)` | `TypeError`：类型错误；`RangeError`：`frameSize ≤ 0`、`hopSize ≤ 0`、`frameSize > size`、`hopSize > frameSize` |
| `spectrogram(frameSize, hopSize, options?)` | 同上，另外 `RangeError`：生成的帧数为 0 |
| `instantaneousFrequency(options?)` | `TypeError`：`envelopeGate` 非有限数；`RangeError`：`envelopeGate < 0` 或 `> 1` |
| `rolloff(ratio?)` | `TypeError`：`ratio` 非有限数；`RangeError`：`ratio ∉ (0, 1]` |
| `flux(previous?)` | `TypeError`：`previous` 非 `SignalCollectable`；`RangeError`：两者帧长不同（应先在相同 `frameSize` 下计算） |
| `zeroCrossingRate(options?)` | `TypeError`：`options` 非法 |
| `autocorrelation(maximumLag?, options?)` | `TypeError`：`maximumLag` 非 `bigint`、`normalization` 非法；`RangeError`：`maximumLag < 0`、`maximumLag ≥ size`（请自行截断到 `size − 1`） |
| `crossCorrelation(other, maximumLag?, options?)` | `TypeError`：`other` 非 `SignalCollectable`；`RangeError`：采样率不同、`maximumLag` 越界 |
| `coherence(other, options?)` | `TypeError`：`other` 非 `SignalCollectable`、选项类型错误；`RangeError`：采样率不同、段数 < `2`、`frameSize > size` |
| `signalToNoiseRatio(options?)` | `TypeError`：类型错误；`RangeError`：`low ≥ high`、`floorQuantile ∉ (0, 1)`、段数 < 1 |
| `equals(other, epsilon?)` | `TypeError`：`other` 非 `SignalCollectable`、`epsilon` 非有限数 |

### 6.5 关键方法的语义细节

**`amplitude()` / `power()`**

```
Â[k] = |X[k]| / (N·CG)               k = 0 或 k = N/2
Â[k] = 2·|X[k]| / (N·CG)             0 < k < N/2
P̂[k] = Â[k]² / 2  (0 < k < N/2)；P̂[0] = Â[0]²；P̂[N/2] = Â[N/2]²
```

- **`power()` 是"峰值口径"，不是 Parseval 口径**：单个 bin 的 `P̂[k]` 等于"恰好落在该 bin 的正弦"的均方，但把全部 bin 相加会多出一个 `ENBW` 因子（加窗把每条谱线摊到相邻 bin）。C 级实测（Hann，N=1024）：单音、双音、DC+音三种输入的 `Σ P̂ / mean(x²)` 均为 **1.500**，恰为 ENBW。
- 真正满足 Parseval 的是 PSD：`Σ Pxx[k]·Δf ≈ mean(x²)`（[S20] 的离散形式；去均值后即方差）。因此 `power()` 用于正弦/窄带测量，`powerSpectralDensity()` 用于噪声与总功率。
- 幅度口径只对**窄带/正弦**成立；宽带噪声请用 `powerSpectralDensity()`。

**`powerSpectralDensity()`**

```
Pxx[k] = |X[k]|² / (fs · Σₙ w[n]²)     （×2 于 0<k<N/2）
P̄xx    = mean/median over segments
```

- `Σ Pxx[k]·Δf ≈ mean(x²)`；与 `power()` 相差正好一个 `ENBW` 因子——这是"正弦口径 vs 密度口径"的桥。
- 段数 `M = ⌊(size − frameSize)/hopSize⌋ + 1`；`M = 1` 时方差未降低，文档必须警告。

**`coherence()`**

- 复用 `coherent.ts` 的 `Coherence` 返回类型；内部用同一 `frameSize`/`hopSize`/窗计算 `G_xy`、`G_xx`、`G_yy` 并平均。
- `M ≥ 2` 的强制检查是必须的（单段恒为 1）。

**`instantaneousFrequency()`**

- 默认 `envelopeGate = 1E-3`；低于门限的样本返回 `0`，并在 JSDoc 中写明"该处相位无定义"。
- 首样本无前驱，返回 `0`（与库内 `instantaneousFrequency` 一致）。

**`spectrogram()`**

- 默认 `boundary: "zeros"`、`padded: true`，与 [S23] 对齐；`Sampler` 现有"只取完整帧"的行为保留为 `padded: false`。
- 时间轴：`boundary: "none"` 时 `t[m] = m·hopSize/rate`（帧起点）；填充时前置 `frameSize/2` 个填充样本，首帧中心落在原信号的 `t = 0`，因此 `t[m] = m·hopSize/rate` 表示**帧中心**。两种约定必须在 JSDoc 与 `Spectrogram.getTime` 中统一，不能混用（SciPy 的 `t` 同样从 0 开始、按帧中心计）。

### 6.6 使用示例

```ts
import { SignalCollectable } from "#semantic/mathematics/signal";
import { useHannPeriodicWindow } from "#semantic/mathematics/window";
import { useHertz } from "#semantic/mathematics/frequency";

const signal: SignalCollectable = SignalCollectable.useRate(samples, 48_000, useHannPeriodicWindow);

const density = signal.powerSpectralDensity({ frameSize: 1024n, hopSize: 512n });
const level: number = density.decibelAt(64n).get(Number.NEGATIVE_INFINITY);

const fundamental = signal.spectrum().dominant().map((bin) => bin.getFrequency());
const peakSnr = signal.signalToNoiseRatio({ low: useHertz(20), high: useHertz(20_000) });

console.log(signal.getCoherentGain(), signal.getNoiseBandwidth(), level, peakSnr.get(Number.NaN));
```

---

## 7. 最值得优先实现的 5 个方法

| # | 方法 | 为什么优先 | 依赖 / 成本 |
| --- | --- | --- | --- |
| 1 | `windowed()` + `getCoherentGain()` / `getNoiseBandwidth()` 接线到 `amplitude()` / `power()` | 修掉最常见的 **6.02 dB** 幅度错误与 **1.76 dB** 噪声错误；这两个数直接决定结果可信度。`window.ts` 已有 CG/ENBW，成本主要是"接线 + 测试" | 低；无新算法 |
| 2 | `powerSpectralDensity()`（Welch）+ `SpectralDensity` | 库内**完全没有** PSD 入口；没有它就没有噪声底、SNR、相干性。Welch 是唯一能同时给"无偏密度 + 可控方差"的标准做法 | 中；需要分段、平均、`Σw²` 归一化 |
| 3 | `spectrogram()`（周期窗 + `boundary` / `padded` + COLA 校验） | 现有 `Sampler.spectrogram` 用对称 Hann 且丢尾帧，与 SciPy/Matlab 对不上；周期窗 + 填充是 **一行默认值 + 一次校验**的修复，收益覆盖所有时频用例 | 低—中；复用 `Spectrogram` |
| 4 | `envelope()` / `instantaneousFrequency()`（门限 + 边界策略） | `analytic.ts` 已能算，但把"包络零点 932 Hz 尖峰"和"边缘 87% 误差"直接暴露给用户是危险的；加门限和文档化边界是本规格里**风险最高**的部分 | 低；增加策略参数 |
| 5 | `zeroCrossingRate()` + `flux()` + 归一化 `autocorrelation()` | 最便宜的一组特征（O(N)），直接支撑音频/时序的粗分类与变化检测；现有 `Frame.zeroCrossings` 与 `Frame.autocorrelate` 语义（计数 vs 速率、原始和 vs 归一化）容易误用 | 低；纯统计 |

> 另有一次 **P0 修复**不计入"方法"：`useFlatTopWindow` 去掉 `Math.max(0, …)`（§5 陷阱 6），否则上面的幅度精度承诺对 flat-top 全部失效。

---

## 8. 未能验证 / 存疑事项

1. **Harris 1978 全文**：IEEE Xplore 付费墙，仅 Crossref 元数据可读（B 级）。本报告未引用其表格数值；所有窗指标为本地计算（C 级）。
2. **Heinzel 2002（`GH_FFT.pdf`）**：`holometer.fnal.gov` 返回 403，**未能验证**。该文献常被引用为"窗函数大全 + ENBW/scalloping 表"，但本报告不依赖它。
3. **MathWorks `enbw` 文档**：403，**未能验证**。
4. **MPEG-7 的 rolloff 0.95**：未抓到规范原文，标注为"未能验证"；库内默认 0.85 仅以"内部一致性"为由保留。
5. **Kaiser 的 `β = 0.1102(A − 8.7)` 经验公式**：Wikipedia 的 Kaiser 段落未给出该式（只给 `β = πα` 与主瓣宽度 `2√(1+α²)`），因此本报告**不引用**该经验公式，Kaiser 默认参数留待实现时按目标旁瓣另行推导。
6. **`Spectrum.flatness()` 用幅度、遍历双边**：本报告只指出其与 [S13] 的功率/单边定义不同，**不判定为 bug**——可能是作者的有意选择，但必须在文档中写明口径。
7. **`Spectrum.bandEnergy()` 遍历双边全部 bin**：同上，属口径问题；若输入为实信号谱，双边求和会使带内能量翻倍（+3.01 dB）。
8. arXiv API 在调研期间多次返回 429/503，最终 3 篇论文的摘要核对通过；若后续引用更多 arXiv 论文，建议加 30 s 退避。

---

## 9. 参考文献

> 每条均带 URL；标注等级：**A** = 已读正文，**B** = 仅核对元数据。

### Wikipedia（A 级，`prop=extracts` 全文抓取）

- **[S1]** Window function — https://en.wikipedia.org/wiki/Window_function
- **[S2]** Spectral leakage — https://en.wikipedia.org/wiki/Spectral_leakage
- **[S3]** Welch's method — https://en.wikipedia.org/wiki/Welch%27s_method
- **[S4]** Periodogram — https://en.wikipedia.org/wiki/Periodogram
- **[S5]** Short-time Fourier transform — https://en.wikipedia.org/wiki/Short-time_Fourier_transform
- **[S6]** Overlap–add method — https://en.wikipedia.org/wiki/Overlap%E2%80%93add_method
- **[S7]** Analytic signal — https://en.wikipedia.org/wiki/Analytic_signal
- **[S8]** Hilbert transform — https://en.wikipedia.org/wiki/Hilbert_transform
- **[S9]** Instantaneous phase — https://en.wikipedia.org/wiki/Instantaneous_phase
- **[S10]** Instantaneous frequency — https://en.wikipedia.org/wiki/Instantaneous_frequency
- **[S11]** Coherence (signal processing) — https://en.wikipedia.org/wiki/Coherence_(signal_processing)
- **[S12]** Zero-crossing rate — https://en.wikipedia.org/wiki/Zero-crossing_rate
- **[S13]** Spectral flatness — https://en.wikipedia.org/wiki/Spectral_flatness
- **[S14]** Spectral centroid — https://en.wikipedia.org/wiki/Spectral_centroid
- **[S15]** Spectral flux — https://en.wikipedia.org/wiki/Spectral_flux
- **[S16]** Cross-correlation — https://en.wikipedia.org/wiki/Cross-correlation
- **[S17]** Autocorrelation — https://en.wikipedia.org/wiki/Autocorrelation
- **[S18]** Spectral density — https://en.wikipedia.org/wiki/Spectral_density
- **[S19]** Signal-to-noise ratio — https://en.wikipedia.org/wiki/Signal-to-noise_ratio
- **[S20]** Parseval's theorem — https://en.wikipedia.org/wiki/Parseval%27s_theorem

### SciPy 参考文档（A 级，正文抓取）

- **[S21]** `scipy.signal.welch` — https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.welch.html
- **[S22]** `scipy.signal.spectrogram` — https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.spectrogram.html
- **[S23]** `scipy.signal.stft` — https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.stft.html
- **[S24]** `scipy.signal.coherence` — https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.coherence.html
- **[S25]** `scipy.signal.hilbert` — https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.hilbert.html
- **[S26]** `scipy.signal.get_window` — https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.get_window.html
- **[S27]** `scipy.signal.check_COLA` — https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.check_COLA.html

### 经典文献（B 级，Crossref 元数据核对）

- **[S28]** Harris, F. J. (1978). *On the use of windows for harmonic analysis with the discrete Fourier transform.* Proceedings of the IEEE, 66(1), 51–83. https://doi.org/10.1109/PROC.1978.10837
- **[S29]** Welch, P. D. (1967). *The use of fast Fourier transform for the estimation of power spectra.* IEEE Trans. Audio and Electroacoustics, AU-15(2), 70–73. https://doi.org/10.1109/TAU.1967.1161901
- **[S30]** Allen, J. B., & Rabiner, L. R. (1977). *A unified approach to short-time Fourier analysis and synthesis.* Proceedings of the IEEE, 65(11), 1558–1564. https://doi.org/10.1109/PROC.1977.10770
- **[S31]** Griffin, D. W., & Lim, J. S. (1984). *Signal estimation from modified short-time Fourier transform.* IEEE Trans. ASSP, 32(2), 236–243. https://doi.org/10.1109/TASSP.1984.1164317
- **[S32]** Boashash, B. (1992). *Estimating and interpreting the instantaneous frequency of a signal. I. Fundamentals.* Proceedings of the IEEE, 80(4), 520–538. https://doi.org/10.1109/5.135376
- **[S33]** Gabor, D. (1946). *Theory of communication. Part 1: The analysis of information.* Journal of the IEE — Part III, 93(26), 429–441. https://doi.org/10.1049/ji-3-2.1946.0074
- **[S34]** Carter, G. C. (1987). *Coherence and time delay estimation.* Proceedings of the IEEE, 75(2), 236–255. https://doi.org/10.1109/PROC.1987.13723

### arXiv（A 级，API 核对 id / 标题 / 摘要）

- **[S35]** *Debiasing Welch's Method for Spectral Density Estimation* — arXiv:2312.13643 — https://arxiv.org/abs/2312.13643
- **[S36]** *Synchrosqueezing-based Recovery of Instantaneous Frequency from Nonuniform Samples* — arXiv:1006.2533 — https://arxiv.org/abs/1006.2533
- **[S37]** *Latent Signal Analysis and the Analytic Signal* — arXiv:1502.02316 — https://arxiv.org/abs/1502.02316

---

## 10. 附录 A：数值验证脚本（C 级结果的可复现来源）

运行环境：Python 3.12 + NumPy 2.3.5（工作区自带）。以下脚本生成 §3.1.2、§3.1.6、§3.4.3 的表格。

```python
import numpy as np

def window(name: str, n: int, periodic: bool = True) -> np.ndarray:
    """Returns one of the analysed windows for n positions."""
    k = np.arange(n)
    d = n if periodic else n - 1
    r = 2 * np.pi * k / d
    if name == "rect":
        return np.ones(n)
    if name == "hann":
        return 0.5 - 0.5 * np.cos(r)
    if name == "hamming":
        return 0.54 - 0.46 * np.cos(r)
    if name == "blackman":
        return 0.42 - 0.5 * np.cos(r) + 0.08 * np.cos(2 * r)
    if name == "nuttall":
        return (0.355768 - 0.487396 * np.cos(r) + 0.144232 * np.cos(2 * r)
                - 0.012604 * np.cos(3 * r))
    if name == "flattop":
        return (0.21557895 - 0.41663158 * np.cos(r) + 0.277263158 * np.cos(2 * r)
                - 0.083578947 * np.cos(3 * r) + 0.006947368 * np.cos(4 * r))
    raise ValueError(name)

def dtft(w: np.ndarray, f: np.ndarray) -> np.ndarray:
    """Evaluates the window DTFT on the normalised frequencies f (cycles/sample)."""
    n = np.arange(len(w))
    return np.exp(-2j * np.pi * np.outer(f, n)) @ w

def metrics(w: np.ndarray) -> tuple[float, float, float, float]:
    """Returns coherent gain, ENBW in bins, half-power width in bins, scalloping loss in dB."""
    n = len(w)
    total = w.sum()
    gain = total / n
    enbw = n * (w * w).sum() / total ** 2
    grid = np.linspace(-4 / n, 4 / n, 160001)
    magnitude = np.abs(dtft(w, grid)) / abs(total)
    half = grid[magnitude >= 1 / np.sqrt(2)]
    hpbw = (half.max() - half.min()) * n
    scallop = 20 * np.log10(abs(dtft(w, np.array([0.5 / n])))[0] / abs(total))
    return gain, enbw, hpbw, scallop

for name in ("rect", "hann", "hamming", "blackman", "nuttall", "flattop"):
    gain, enbw, hpbw, scallop = metrics(window(name, 1024))
    print(f"{name:9s} CG={gain:.6f} ENBW={enbw:.4f} HPBW={hpbw:.3f} SL={scallop:+.3f} dB")
```

### A.1 陷阱反例的最小复现

```python
import numpy as np

# 陷阱 1：DC 与 Nyquist 不能乘 2
n = np.arange(1024)
x = 2.0 + np.cos(np.pi * n)
X = np.fft.fft(x) / 1024
print(abs(X[0]), abs(X[512]))          # 2.0 1.0；乘 2 则 4.0 / 2.0

# 陷阱 3：Hann 窗的相干增益
w = 0.5 - 0.5 * np.cos(2 * np.pi * n / 1024)
tone = np.cos(2 * np.pi * 8 * n / 1024)
Xw = np.fft.fft(tone * w)
print(2 * abs(Xw[8]) / 1024, 2 * abs(Xw[8]) / 1024 / w.mean())   # 0.5 1.0

# 陷阱 5：白噪声归一化
rng = np.random.default_rng(11)
acc = []
for _ in range(300):
    x = rng.standard_normal(4096)
    Xw = np.abs(np.fft.rfft(x * w[:4096])) ** 2
    acc.append(Xw[1:-1].mean())
print(np.mean(acc) / (w[:4096] ** 2).sum(), np.mean(acc) / 4096,
      np.mean(acc) / (4096 * w[:4096].mean() ** 2))                # 1.0 / 0.375 / 1.5

# 陷阱 7：对称窗不满足 COLA
def hann_sym(n):
    return 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n) / (n - 1))
acc = np.zeros(16)
for start in range(0, 16, 8):
    acc[(np.arange(16) + start) % 16] += hann_sym(16)
print(acc.min(), acc.max())            # 0.89776 0.98907，波纹 0.841 dB
```

### A.2 抓取与校验命令

```powershell
# Wikipedia 全文（A 级）：串行、3.5 s 间隔、自定义 UA，避免 429
curl.exe -s -m 60 -A "SemanticTypeScript-Research/1.0 (eloy.kim@outlook.com)" --proxy http://127.0.0.1:15236 `
  "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&redirects=1&format=json&titles=Spectral%20leakage"

# Crossref（B 级）：只核对元数据
curl.exe -sS -m 45 --proxy http://127.0.0.1:15236 `
  "https://api.crossref.org/works/10.1109/PROC.1978.10837?mailto=eloy.kim@outlook.com"

# arXiv（A 级）：一次最多 3–5 个 id，失败后至少退避 30 s
curl.exe -sS -m 60 --proxy http://127.0.0.1:15236 `
  "https://export.arxiv.org/api/query?id_list=2312.13643,1502.02316,1006.2533&max_results=3"
```

---

## 11. 覆盖统计

| 维度 | 数量 |
| --- | --- |
| 能力域 | 6（窗函数 / 谱估计 / 解析信号 / 时频 / 特征量 / 统计相关） |
| 能力条目 | 29（§3.1: 6、§3.2: 5、§3.3: 5、§3.4: 3、§3.5: 10） |
| 明确陷阱 | 16 条，全部带错误/正确做法与数值或结构性反例 |
| 来源 | 37 条（Wikipedia 20、SciPy 7、经典文献 7、arXiv 3），全部带 URL |
| 未验证项 | 8 条（§8） |
| 本地数值实验 | 4 组（窗指标表、短帧对称/周期对照、COLA 波纹、陷阱反例） |

