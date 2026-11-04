# 工厂、统计与辅助工具边界测试

测试日期：2026-11-04；Windows，Node v24.21.0，TypeScript 5.9.3。

[测试脚本](./utilities.boundary.mjs)共 39 项：12 通过，27 个期望断言失败。失败断言包含相同根因的同步/异步/number/bigint变体，以及下文单列的设计限制或待确认契约，不能当作 27 个独立缺陷。[逐例结果](./utilities-results.json)保存原始断言。

## 确认问题

| 编号 | 优先级 | 用例 | 最小复现与实际结果 | 预期与位置 |
|---|---|---|---|---|
| U-F01 | P1 | U01–U03 | `useRange(10n,0n,-5n).toUnordered().toArray()` → `[]`；相反方向 `useRange(0,5,-1).limit(5)` → `[0,-1,-2,-3,-4]` | README 明确承诺 `[10n,5n]`；循环始终判断 `i < end`，负步长可不收敛。见 [factory.ts:442](../src/factory.ts#L442) |
| U-F02 | P2 | U06–U07 | `isIterable('abc')` → false；`useFrom('A😊B')` 抛 Invalid arguments | 字符串符合 `Iterable<string>` 类型；guard先要求object导致拒绝。见 [guard.ts:38](../src/guard.ts#L38) |
| U-F03 | P2 | U08 | `useText('A😊B',1,2)` → `["\ud83d"]` | 文档称按码点处理、emoji为单个元素；带区间重载先substring再Array.from截断代理对。见 [factory.ts:529](../src/factory.ts#L529) |
| U-F04 | P2 | U10 | `useGenerator(['a','b','c'])` 输出索引 `[0n,0n,0n]` | 应为 `[0n,1n,2n]`，遗漏递增；useArrange也复用此helper。见 [hook.ts:193](../src/hook.ts#L193) |
| U-F05 | P2 | U14–U16 | `[1,2,3,4]` 的 `.quantile(.5)` → `3`；bigint及async同样 | README示例为2，且nearest-rank应为`max(ceil(q*n)-1,0)`。实现floor(q*n)。见 [同步:1577](../src/synchronous/semantic.ts#L1577)、[异步:1899](../src/asynchronous/semantic.ts#L1899) |
| U-F06 | P2 | U17 | `.quantile(NaN)` 抛普通Error `Uncaught error on quantile.` | 输入域检查漏NaN，未与越界统一为RangeError。见 [semantic.ts:1571](../src/synchronous/semantic.ts#L1571) |
| U-F07 | P1 | U18–U20 | `useFrom([-2,0,2]).toNumericStatistics().range(x=>x*x)` → `0`；bigint与async同样 | 映射值为[4,0,4]，range应4。仅映射原序列首尾，未重新求投影后极值。见 [同步:1471](../src/synchronous/semantic.ts#L1471)、[异步:1798](../src/asynchronous/semantic.ts#L1798) |
| U-F08 | P1 | U33–U39 | `[1,2]` 的 `.summate(x=>x*10)` →3（应30），average→1.5（应15），median→1.5（应15），variance→.25（应25）；bigint/async同样 | 数值输入直接使用element，绕过显式mapper。见 [collector.ts:684](../src/synchronous/collector.ts#L684)，同类分支遍布同步与异步收集器 |
| U-F09 | P2 | U30 | 固定`Math.random=()=>.5`后，`useRandom(.1)` →`Math.exp(-.5)`≈.60653，超出[0,.1) | README称uniform half-open range；单参数number分支完全忽略start。见 [hook.ts:75](../src/hook.ts#L75) |

P1：数据错误、非收敛或广泛影响的功能问题；P2：局部结果、类型契约或输入校验问题。

## 类型声明单独验证

[消费端示例](./public-api.types.ts)直接从dist导入，严格编译返回退出码1，出现3条TS2554：

- `useOf<number>()`：Expected 1 arguments, but got 0。
- `useOf(1,2,3)`：Expected 1 arguments, but got 3。
- `useOf({price:10},{price:30})`：Expected 1 arguments, but got 2。

单元素调用和`useFrom(string)`在同次编译无诊断；多元素调用运行时可正常执行。根因是 [factory.ts:412](../src/factory.ts#L412) 的UseOf声明只有单参数重载，未声明实际实现的rest参数，造成文档主要入口在TypeScript消费端不可编译。列为P1。

```powershell
$node = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node boundary-tests/utilities.boundary.mjs
& $node node_modules/typescript/lib/tsc.js --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022,DOM,DOM.Iterable boundary-tests/public-api.types.ts
```

## 已知设计限制与待确认契约（不混入确认缺陷）

- U21–U23：令`b=2n**60n`，`[b,b+2n]`的variance/standardDeviation返回0n，数学结果应1n。同步与异步均复现；源码先转Number丢失差值。README已说明bigint统计使用浮点计算，这是已知精度限制，建议文档明确安全范围或使用相对原点计算。见 [semantic.ts:1255](../src/synchronous/semantic.ts#L1255)。
- U11：`maskOf('undefined')`返回8n，注册表中却为0n。`||`把合法0n当作缺失。内部一致性问题确定，但mask数值对外契约未说明，暂列观察；未证明造成hash相等冲突。
- U29：`useTraverse({a:{x:1},b:2},()=>false)`仍访问b。stop只在当前递归层有效；文档没有明确false应全局还是局部停止，暂列契约待确认。见 [hook.ts:146](../src/hook.ts#L146)。

## 已通过的边界

零步长拒绝、相等区间为空、无区间Unicode文本、undefined/null hash可区分、碰撞数值distinct未丢元素、空统计返回0、常量样本方差/偏度/范围、Optional保留0/false/空串/NaN、空Optional不执行mapper、循环对象遍历可终止、双参数number/bigint随机结果在范围内、小数据方差与bigint舍入口径。
