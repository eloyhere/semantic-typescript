# semantic-typescript 边界测试汇总

测试日期：2026-11-04。项目版本1.2.0；Windows；Node v24.21.0；TypeScript 5.9.3。

本次按用户要求派出两个独立子代理：同步流算子/索引/窗口，以及异步来源/异常/短路/资源清理。主代理负责工厂函数、统计、辅助工具、消费端类型声明及交叉复核。所有测试针对本地源码构建产物执行。

## 执行结果

| 范围 | 用例数 | 通过 | 失败 | 说明 |
|---|---:|---:|---:|---|
| TypeScript项目构建 | 1次 | 1次 | 0 | 使用项目本地tsc，退出码0 |
| [原有回归测试](../test/semantic.test.mjs) | 55 | 55 | 0 | 先构建再执行node --test，等价于项目test脚本步骤 |
| [同步边界测试](./sync.boundary.mjs) | 14 | 13 | 1 | 按叶子测试统计，不重复计算5个父测试聚合项 |
| [异步边界测试](./async.boundary.mjs) | 65 | 31 | 34 | 31中含3个专门断言故障现象存在的观测用例，正常行为控制通过28个 |
| [统计/工厂/辅助工具边界](./utilities.boundary.mjs) | 39 | 12 | 27 | 含相同根因的多种类型/同步异步变体，以及契约待确认与已知精度限制 |
| [TypeScript消费端示例](./public-api.types.ts) | 1次编译 | 0 | 1次 | 3条TS2554，useOf缺少零参数/多参数声明 |

新增运行时边界测试共118项：56通过、62失败。56通过中3项专门验证故障存在，其余53项为正常行为或当前行为控制。按分项根因归并，确认29组问题（同步1、异步18、统计/工具9、类型声明1）；另列设计限制与契约待确认项。

失败断言数量不等于独立缺陷数量；本文按实际影响分组，详见三个分项报告的根因和证据。故障观测用例即使PASS，也不能视作API行为正确。

## 优先处理的问题

| 优先级 | 问题与实际影响 | 复现证据 / 源码 |
|---|---|---|
| P1 | Promise、异步collectable来源拒绝未传给消费者，触发unhandled rejection，终端保持pending；默认Node策略下可导致进程退出 | 异步A01/A05；[factory.ts:289](../src/factory.ts#L289)、[异步semantic.ts:1087](../src/asynchronous/semantic.ts#L1087) |
| P1 | 已完成ordered收集器的isEmpty，以及空ordered的min/max不结算 | 异步A06/A07；[semantic.ts:1369](../src/asynchronous/semantic.ts#L1369)、[semantic.ts:1230](../src/asynchronous/semantic.ts#L1230)。主代理独立复跑isEmpty用例，250ms超时复现 |
| P1 | async concat第二个semantic没有await，尾流数据丢失，错误也可能脱链；应得[1,2]实际[1] | 异步A08；[semantic.ts:47](../src/asynchronous/semantic.ts#L47) |
| P1 | 四参async collect被三参分支匹配；通用async min/max非空仍拒绝；reduce可能把用户抛错吞掉并返回末元素 | 异步A09/A10/A12；[semantic.ts:655](../src/asynchronous/semantic.ts#L655)、[collector.ts:384](../src/asynchronous/collector.ts#L384)、[collector.ts:607](../src/asynchronous/collector.ts#L607) |
| P1 | Interval/Subscription的用户回调异常逃出消费Promise；订阅达到limit后需要额外一次事件才结算退订 | 异步A13–A15；[factory.ts:207](../src/factory.ts#L207)、[factory.ts:332](../src/factory.ts#L332) |
| P1 | 同步flatMap展开无限内部迭代器时无法响应下游limit(1)，隔离进程1500ms超时 | [同步报告](./sync-results.md)；[同步semantic.ts:189](../src/synchronous/semantic.ts#L189) |
| P1 | useRange负步长方向错误：文档降序示例返回空；相反方向可持续远离终点 | 工具U01–U03；[factory.ts:442](../src/factory.ts#L442)。本次对非收敛方向使用limit防止失控 |
| P1 | 数值输入显式mapper被忽略，sum/mean/median/variance可静默返回错误统计；range没有按映射后的值重新求极值 | 工具U18–U20/U33–U39；[同步collector.ts:684](../src/synchronous/collector.ts#L684)、[同步semantic.ts:1471](../src/synchronous/semantic.ts#L1471) |
| P1 | TypeScript消费者无法编译文档中的useOf(1,2,3)，零参数也无法编译，虽然运行时实现支持 | 消费端编译3条TS2554；[factory.ts:412](../src/factory.ts#L412) |

P1代表建议下一次发布前处理的挂起、异常脱链、数据错误或主要API阻断；P2为局部行为/校验/格式问题。本次没有将高优先级等同于安全漏洞，也未发现需要标注P0的已证实全面阻断。

## 其他已复现问题

- Promise `limit(0n)`与异步Window内外limit把正常短路当作错误拒绝。
- Blob消费方抛错时不cancel；cancel自身拒绝时reader锁未释放。
- 同步subscribe立即发事件、重复事件键两种情况下，订阅清理会漏handler。
- 异步join空输入得到`]`，自定义三参join留下尾部分隔符。
- nearest-rank分位数与文档示例相差一位：`[1,2,3,4]`的q(.5)返回3而非2，同步/异步和bigint均有对应失败。
- Unicode切片`useText('A😊B',1,2)`只返回一个高位代理字符`\ud83d`。
- useGenerator遗漏index递增；字符串虽符合Iterable类型却被isIterable/useFrom拒绝；单参数number随机函数忽略给定边界；NaN分位数未走统一输入校验。

完整最小复现、测试ID、预期/实际与源码位置见[异步报告](./async-results.md)及[统计与工具报告](./utilities-results.md)。同步结论见[同步报告](./sync-results.md)。

## 通过范围与测试边界

原有55项正常路径全部通过。新测试确认多项边界可用，包括空流和单元素控制、Blob尾块与副本隔离、部分错误路径锁释放、异步迭代器的正常关闭、可重放异步来源并发消费、Optional的0/false/空串/NaN、循环对象遍历可终止、常量与空样本统计、双参数随机边界。

以下只作为设计限制或待确认契约：

- bigint统计明确使用Number，超出安全整数范围后相邻差值可能消失。本次`[2^60,2^60+2]`方差/标准差为0n（数学值1n）。文档已有浮点声明，未计入强缺陷。
- maskOf('undefined')把合法0n当缺失回退到8n，尚未证明造成hash冲突；useTraverse返回false只停止当前递归层，全局停止契约需明确。
- Interval Infinity参数、subscriber工厂是否应惰性且每次消费独立、空订阅键列表如何结束，这些在报告中单列。

本次为本地Node边界测试，未覆盖真实浏览器原生事件集成、所有受支持Node版本、长期内存压力及完整属性组合穷举。250ms/800ms等待上限只用于本地确定性Promise用例；结合源码无settle分支与独立进程观测判断挂起，不以网络时延作推断。潜在无限迭代、全局异常和定时器用例在隔离进程内运行并设置强制超时。

## 复现方法与产物

```powershell
$node = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node node_modules/typescript/lib/tsc.js
& $node --test test/semantic.test.mjs
& $node --test boundary-tests/sync.boundary.mjs
& $node boundary-tests/async.boundary.mjs
& $node boundary-tests/utilities.boundary.mjs
& $node node_modules/typescript/lib/tsc.js --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022,DOM,DOM.Iterable boundary-tests/public-api.types.ts
```

失败脚本返回非零退出码是本次发现缺陷的结果。异步脚本可追加`--case CASE_ID`单独复现。工具与异步测试有[工具逐例JSON](./utilities-results.json)、[异步逐例JSON](./async-results.json)。

仅新增边界测试、证据和报告，并为测试安装开发依赖、生成构建产物；未修改生产源码、已有测试或依赖清单。测试在独立目录，未修改项目现有test脚本。环境PATH无git，未能用git status校验工作区基线；以上变更范围以本次实际文件操作为依据。
