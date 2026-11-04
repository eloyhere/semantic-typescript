# 异步边界测试结果

运行环境：Windows，Node v24.21.0，主代理完成构建后的 dist。仅新增测试与结果文件，未修改生产代码/已有测试，未自行安装/构建。

- [独立测试脚本](./async.boundary.mjs)
- [逐例 JSON](./async-results.json)
- 最终全量运行：**65 total / 31 passed / 34 failed**，总进程退出码 1。
- 31 passed 包含 **3 个故障观测用例**（JSON `observation: true`），它们断言故障确实存在，不代表 API 正确。其余 28 个通过用例为正常行为控制。
- 下列强缺陷对应 30 个失败断言；契约待明确项对应另外 4 个失败断言。多个失败断言可能属于同一根因。
- 每例独立 spawn，`stdio: inherit`；内层 800ms 截止，外层 1800ms 强杀；常规 pending 检查 250ms。子进程测试完成即显式退出，没有保留测试定时器。没有用 stdio pipe。

完整运行命令（PowerShell，项目根目录）：

```powershell
& 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' 'boundary-tests/async.boundary.mjs'
```

最小隔离运行：在命令末尾追加 `--case <下表case>`。各 case 内的完整最小环境、assert 与 fixture 都在脚本中。简写 `collect(s)` 为 `useAsynchronousToArray().collect(s.source())`；`values(...x)` 为产生 x 的可重复异步 iterable 经 `useIterate` 包装。

## 已确认的强缺陷（去重根因）

| ID / 严重性 | 最小复现或 case | 预期与实际 | 源码原因 |
| --- | --- | --- | --- |
| A01 高：Promise 拒绝/回调异常丢失 | `collect(usePromise(Promise.reject(boom)))`；`promise.rejection-propagates`、`promise.callback-throw-propagates` | 预期消费 Promise reject 原始异常。实际 Node 默认策略触发 unhandled rejection 并退出；专门观测例捕获全局事件后证实消费 Promise 30ms 后仍 pending，unhandled 原因与原始异常相同。 | [factory.ts:289–299](../src/factory.ts#L289-L299)：`promise.then` 无 reject handler，then 内 accept/interrupt 异常也无人接收。 |
| A02 中：Promise 正常短路被当错误 | `collect(usePromise(Promise.resolve(1)).limit(0n))`；`promise.limit-zero-completes` | 预期正常返回 `[]`；实际 reject `Promise was interrupted.`。 | [factory.ts:291–292](../src/factory.ts#L291-L292)。README 说明 limit 是协议正常终止方式，见下方契约依据。 |
| A03 中：Blob 消费异常不取消流 | `blob.consumer-error-cancels`：Blob 子类返回带 cancel 计数的 ReadableStream，accept 抛异常 | 预期保留异常、取消未读完来源并释放锁；实际异常正确传播、锁释放，但 cancel 调用数 0。流仍可有未消费数据/资源。 | [factory.ts:95–99](../src/factory.ts#L95-L99)：只有 stoppable=true 才 cancel，accept 抛错不设置它。 |
| A04 中：Blob cancel 拒绝后 reader 锁残留 | `blob.cancel-error-still-releases-lock`：cancel 抛 boom，消费 `.limit(0n)` | 预期 boom reject 且 `stream.locked=false`；实际 boom 传播但 `locked=true`。 | [factory.ts:97–99](../src/factory.ts#L97-L99)：await cancel 抛错跳过 releaseLock。 |
| A05 高：异步 collectable 来源拒绝不传给终端 | `useIterate(failingAsyncIterable).toUnordered().toArray()`；`collectable.toUnordered.source-rejection`，以及 toOrdered/toWindow/toNumericStatistics 对应例 | 预期终端 reject 原始异常；实际触发 unhandled rejection，终端仍 pending。观测例捕获全局事件证实后一现象。已实测四类入口，Window/Statistics 继承 Ordered。 | [semantic.ts:1087–1113](../src/asynchronous/semantic.ts#L1087-L1113)、[semantic.ts:1400–1409](../src/asynchronous/semantic.ts#L1400-L1409)：构造器只有 `.then(success)`，无 reject 状态或 listener 通知。 |
| A06 高：完成后的 ordered.isEmpty 永不结算 | `const c=values().toOrdered(); await c.toArray(); await c.isEmpty()`；`collectable.ordered-isEmpty-after-complete-0/1` | 预期空 true、非空 false；实际两种均 250ms 仍 pending。完成前调用的控制例通过。 | [semantic.ts:1369–1374](../src/asynchronous/semantic.ts#L1369-L1374)：无 complete 分支，完成后只添加不会再次触发的 listener。 |
| A07 高：空 ordered 极值永不结算 | `const c=values().toOrdered(); await c.toArray(); await c.findMaximum()`；对应 maximum/minimum 两例 | 空值契约可选 reject/Optional，但必须结算；实际最大/最小均 250ms 仍 pending。测试只要求非超时 reject，不强制异常消息。 | [semantic.ts:1236–1246](../src/asynchronous/semantic.ts#L1236-L1246)、[semantic.ts:1258–1267](../src/asynchronous/semantic.ts#L1258-L1267)、[semantic.ts:1285–1316](../src/asynchronous/semantic.ts#L1285-L1316)：空 buffer 分支不 resolve/reject。 |
| A08 高：semantic concat 提前完成、尾流错误脱链 | `collect(values(1).concat(delayedValues2))`；`concat.semantic-awaits-second-source`、`concat.semantic-second-rejection-propagates` | 预期 `[1,2]`，尾流失败时 reject；实际仅 `[1]` 提前返回，尾流失败时消费 Promise 也已成功。 | [semantic.ts:47–52](../src/asynchronous/semantic.ts#L47-L52)：then 回调调用第二 generator 却没有 return/await。 |
| A09 高：collect 四参重载永远落入三参分支 | `collect.four-arguments-honors-interrupt`：`c.collect(()=>[], interrupt, append, identityFinisher)` | 预期中断后 `[1]`；实际 interrupt 被当 accumulator，append 被当 finisher，抛 `TypeError: a is not iterable`。 | [semantic.ts:655–666](../src/asynchronous/semantic.ts#L655-L666)：三参 isFunction 判断在四参前，无 argument4 排除。 |
| A10 高：通用异步 min/max collector 非空也拒绝 | `useAsynchronousFindMaximum().collect(values(2,3,1).source())`；`collector.maximum-nonempty`、`collector.minimum-nonempty` | 预期分别 3、1；实际均 reject `No element found.`。此项针对独立 collector；Ordered 自身非空极值路径不同。 | [collector.ts:384–396](../src/asynchronous/collector.ts#L384-L396)、[collector.ts:406–418](../src/asynchronous/collector.ts#L406-L418)：初始 accumulator 是 rejected Promise，后续仅 `.then` 无首元素初始化。 |
| A11 中：join 空输入损坏括号，三参留下尾分隔符 | `collector.join-empty`；`collector.join-custom-delimiters` | `useAsynchronousJoin()` 空输入预期 `[]`，实际 `]`；`useAsynchronousJoin('<','|','>')` 输入 1,2 预期 `<1|2>`，实际 `<1|2|>`。 | [collector.ts:491](../src/asynchronous/collector.ts#L491)、[collector.ts:503–507](../src/asynchronous/collector.ts#L503-L507)：无元素仍裁开括号；自定义三参分支 finisher 不裁 delimiter。 |
| A12 高：reduce 将用户异常当作未初始化吞掉 | `useAsynchronousReduce(()=>{throw boom}).collect(values(1,2,3).source())`；`collector.reduce-error-not-recovered-as-empty` | 预期 reject boom；实际 resolve 3。第二元素的 accumulator 抛错被第三元素的 catch 误当“初始空流拒绝”。 | [collector.ts:607–616](../src/asynchronous/collector.ts#L607-L616)：对每步 result 使用 catch 初始化，未区分初始 sentinel 与用户异常。 |
| A13 高：Interval 回调/interrupt 抛错变 uncaught | `collect(useInterval(5).map(()=>{throw boom}))`；`interval.callback-exception-rejects`、`interval.interrupt-exception-rejects` | 预期消费 Promise reject 并 clearInterval；实际 timer callback 异常越过 Promise 变成 uncaught exception，Node 子进程退出 1。 | [factory.ts:207–230](../src/factory.ts#L207-L230)：try 仅包定时器注册，异步 callback 无 try/catch/clear on error。 |
| A14 高：Subscription limit(N) 需第 N+1 次事件才完成清理 | `subscription.limit-boundary-cleans-without-extra-event`；设置 limit(1n) 后只 emit(1) | 预期已收到要求的1事件就 unsubscribe/unmount并结算；实际 listener 仍1、unmount 0、Promise pending。故障观测例再 emit(2) 才正常返回 `[1]` 并清理。 | [factory.ts:332–343](../src/factory.ts#L332-L343)、[factory.ts:373–384](../src/factory.ts#L373-L384)：只在 accept 前检查 interrupt，accept 完成后不再检查。README 明确写 after 5 events。 |
| A15 高：Subscription 事件回调/清理异常不拒绝消费 | `subscription.callback-exception-rejects-and-cleans`、`subscription.unmount-error-rejects` | 预期 map/unmount 抛错经消费 Promise reject，执行必要清理；实际异常同步抛回 emitter（若原生异步事件则成为全局异常），消费 Promise 无 reject 路径。 | [factory.ts:332–345](../src/factory.ts#L332-L345)、[factory.ts:373–386](../src/factory.ts#L373-L386)：handler 内无 try/catch；外层 try 仅能接注册阶段错误。 |
| A16 中：同步 subscribe 发事件后留监听器 | `subscription.synchronous-subscribe-emission-cleans`：subscribe 添加 listener 后立即调用 handler，limit(0n) | 预期短路完成且 listener 0；实际 Promise 成功 `[]`，listener 仍1。 | [factory.ts:346–347](../src/factory.ts#L346-L347)、[factory.ts:387–388](../src/factory.ts#L387-L388)：unsubscribe 映射晚于 subscribe 写入；同步 handler 已执行清理时映射尚空。 |
| A17 中：重复事件键清理漏 handler | `subscription.duplicate-event-keys-clean-all-handlers`：事件列表 `['event','event']`，limit(0n)，emit一次 | 预期所有已注册 handler 清理；实际两个 handler 只取消最后一个，遗留1。 | [factory.ts:372–388](../src/factory.ts#L372-L388)：每次建新 handler，但 Map 按 key 覆盖旧 handler，缺少去重/多值记录。 |
| A18 中：Window 正常短路 reject | `window.outer-limit-completes`、`window.inner-limit-completes` | outer `.slide(2n).limit(1n)` 预期只得到窗口 `[1,2]`；inner `.limit(1n)` 预期 `[1]`；实际均 reject `Interrupted.`。 | [semantic.ts:2015–2017](../src/asynchronous/semantic.ts#L2015-L2017)、[semantic.ts:2024–2026](../src/asynchronous/semantic.ts#L2024-L2026)：interrupt 为 true 当错误 reject，而其他常规来源按正常完成处理。 |

## 已测出现差异，但契约需要明确

这些失败不能直接与上表同等计为强缺陷。

| ID / 候选严重性 | case / 最小复现 | 预期假设、实际观测与不确定点 | 源码 |
| --- | --- | --- | --- |
| C01 低：非有限 Interval 参数 | `interval.invalid-nonfinite`，`useInterval(Infinity)` | 测试假设应 TypeError；实际构造成功。`useInterval(5, Infinity)` 源码同样允许，但本例第一断言已失败，未以单独例执行第二断言。Node 对超大定时值会钳到短时延；README 未规定有限参数要求，应作为验证缺口/契约待明确。 | [factory.ts:204](../src/factory.ts#L204) 仅比较大于0/大于等于0。 |
| C02 中：subscriber 工厂提前调用且跨并发消费共享 | `subscription.supplier-is-lazy-and-per-consumption`、`subscription.concurrent-consumers-get-independent-subscribers` | 工厂调用 `useSubscription` 时 made 已为1，尚未消费；两个并发消费后 made 仍1而非2。违背 README 宽泛的“source factory only wraps generator / Nothing runs until collectable”，但 README 没有明确 supplier per consumption 约定，共享实例是否设计如此需确认。已经确认共享事实，尚未建立特定用户 subscriber 数据损坏用例。 | [factory.ts:322](../src/factory.ts#L322) 在生成 semantic 前求 subscriber，闭包复用。 |
| C03 中：空订阅列表永远 pending | `subscription.empty-keys-completes`：`collect(useSubscription({}, supplier, []))` | 测试假设空来源应完成 `[]` 并unmount；实际 mount后250ms仍pending、无任何事件可触发清理。README 将 event source 描述为永不自行完成，未专门定义空事件列表行为，可选择正常空完成或拒绝参数，但当前悬挂需要文档契约判断。 | [factory.ts:367–398](../src/factory.ts#L367-L398)：空循环后未 resolve 或 unmount。 |

另：空极值 API 的“返回 Optional 还是 reject”文档与实际异步签名不一致，本报告 A07 只断言必须结算，没有把 Optional 差异算为独立缺陷。`useIterate` 包装同一个 async-generator 对象后的并发消费自然竞争 iterator；本测试使用可重放 async iterable 验证并发正常行为，没有把单次 iterator 不可重放视作缺陷。

## 契约依据与通过控制

- [README:51–55](../readme.md#L51-L55)：push 协议的 interrupt 是 back-pressure/termination 机制，不是错误。
- [README:115–129](../readme.md#L115-L129)：limit 控制迭代；collectable 执行一次，后续终端可重复读取。
- [README:184–202](../readme.md#L184-L202)：factory 包装 generator、Promise 单元素、Blob 分块副本、Subscription 停止边界。
- [README:236–246](../readme.md#L236-L246)：订阅 limit(5n) 示例写明 **auto-unsubscribes after 5 events**，支持 A14 的无额外事件预期。
- [README:457–478](../readme.md#L457-L478)：异步窗口应等待来源缓冲，尾部不完整窗口包含在内。
- [README:522–539](../readme.md#L522-L539)：异步终端 Promise 模型；用 limit/sub/takeWhile 定义停止边界。

28 个正常行为控制包括：Promise 单元素/空值/重复并发消费；Blob 空输入、精确与尾块、副本隔离、非法chunk、read失败锁释放、limit取消释放、并发消费；Iterate 空输入/拒绝传播/consumer异常关闭/limit关闭/并发重放；collectable 仅物化一次与并发终端、ordered并发终端、完成前isEmpty；async iterable concat limit；flatMap iterable与async limit及inner异常；Interval limit清理；Subscription 补一事件后清理及subscribe同步失败unmount；Window 空输入、尾部部分窗口、大步长和非法边界。
