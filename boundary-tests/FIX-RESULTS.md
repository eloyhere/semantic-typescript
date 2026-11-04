# 边界问题修复与验证

日期：2026-11-04；环境：Windows、Node v24.21.0、TypeScript 5.9.3。

已修复[初始报告](./REPORT.md)归并的29组确认问题，并处理关联的同类缺陷。生产代码修改严格限于以下8个文件：

- [factory.ts](../src/factory.ts)：Promise错误原样传播，正常短路成功完成；Blob消费异常取消与锁释放；Interval回调异常转为拒绝并清定时器、非有限参数校验；Subscription逐次消费创建独立订阅器、及时退订、同步发事件和重复键清理、保留首个异常并尽力完成清理、空键集正常完成；负步长区间、混合step类型检查；Unicode码点切片；useOf零参/变参声明。
- [guard.ts](../src/guard.ts)：字符串与具有迭代方法的函数满足Iterable检测。
- [hook.ts](../src/hook.ts)：生成器递增bigint索引；单参number随机函数遵守上界；遍历false中断向所有递归层传播。
- [hash.ts](../src/hash.ts)：合法类型掩码0n不再被回退覆盖。
- [同步semantic.ts](../src/synchronous/semantic.ts)：flat/flatMap内部立即响应下游中断并关闭迭代器、concat中断与索引；四参collect分派；投影range/quantile、nearest-rank/NaN校验；bigint统计先减基准避免公共大偏移丢失小差值。
- [同步collector.ts](../src/synchronous/collector.ts)：显式mapper始终执行；bigint总体方差与标准差舍入；join空输入/尾分隔符；单参log/error回调。
- [异步semantic.ts](../src/asynchronous/semantic.ts)：所有物化collectable统一共享ready Promise，原始来源拒绝可靠传给并发、完成后和重复终端消费；isEmpty与空极值结算；concat等待尾流并传播中断/异常；四参collect；Window正常短路；统计mapper、投影、nearest-rank和bigint公共偏移修复。
- [异步collector.ts](../src/asynchronous/collector.ts)：极值、reduce初始化与用户异常分开处理；拒绝即时观察而不吞掉最终错误；join格式；显式mapper；bigint总体方差/标准差；单参log/error。

## 验证结果

| 检查 | 结果 |
|---|---|
| 排除structure的生产构建 | 通过，tsc退出0；[专用配置](./tsconfig.fixes.json)继承原配置，仅排除src/structure |
| 默认node --test | 108/108通过：原55项 + 新同步17项 + 新异步24项 + 新工厂12项 |
| 同步边界 | 15/15叶子通过；Node统计含5个父聚合项为20/20 |
| 异步边界 | 65/65通过；原3个故障观测已改为正确行为回归，当前无“故障存在即PASS”用例 |
| 工具与统计边界 | 39/39通过 |
| TypeScript消费端 | 通过，原3条TS2554全部消失 |
| 全项目tsc --noEmit | 仅报structure并行开发文件的两条TS6133，见下文；未修改该目录 |

修复后边界共119项（同步新增1项flat无限内部迭代器），全部通过。测试数量按叶子统计，不重复计入同步父聚合项；默认108项与边界119项分开执行。

新增自动回归：[同步](../test/sync-regression.test.mjs)、[异步](../test/async-regression.test.mjs)、[工厂与工具](../test/factory-regression.test.mjs)。

逐例机器结果：[异步修复后](./async-after-results.json)、[工具修复后](./utilities-after-fixes.json)。历史失败JSON和分项报告保留，作为修复前证据。

## structure隔离

本次未编辑、新建、删除或覆盖任何structure目录内文件。所有生产编辑均为上述8个文件，子代理同样受此限制。构建前用`--listFilesOnly`确认排除后无structure编译单元，无其他模块引用该目录；构建仅生成其他模块产物。dist/structure编译前后SHA256相同。

用户正在并行修改src/structure，因此源码哈希发生变化不能用于判断本代理是否改动它；本次没有恢复或覆盖这些变化。

全项目无输出检查采样时，[collection.ts](../src/structure/collection.ts)有两条TS6133：第1行Optional和第3行IllegalStateError仅导入未使用。它们属于用户明确保留的工作区范围，未处理。其余生产模块及消费端类型检查均通过。这里没有运行会写入structure产物的默认全量构建。

## 复现命令

```powershell
$node = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node node_modules/typescript/lib/tsc.js --project boundary-tests/tsconfig.fixes.json
& $node --test
& $node --test boundary-tests/sync.boundary.mjs
& $node boundary-tests/async.boundary.mjs
& $node boundary-tests/utilities.boundary.mjs
& $node node_modules/typescript/lib/tsc.js --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022,DOM,DOM.Iterable boundary-tests/public-api.types.ts
```

## 保留的行为与限制

- bigint统计最终仍使用浮点近似并Math.round；公共大偏移已修复，数据跨度本身极大时仍受Number精度/范围限制。
- quantile对mapper后的结果排序，复杂度O(n log n)，端点0和1取最小/最大，空输入仍返回0或0n，但非法分位值始终拒绝。
- push中断谓词可能在accept前后调用，回调不应依赖精确调用次数；订阅在第N个接受事件后立即释放资源。
- useTraverse返回false现终止整个递归遍历；订阅supplier现每次消费惰性创建；空订阅键集正常完成。这些原契约未明确项已选择与惰性/短路模型一致的行为并覆盖回归。
- 尚未扩大到多Node版本、真实浏览器和长期负载验证。未修改package/tsconfig原配置，未提交或发布。
