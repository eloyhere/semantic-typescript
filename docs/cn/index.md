---
layout: home

hero:
  name: Semantic-TypeScript
  text: 类型安全的流处理框架
  tagline: 优雅简化你的流处理世界
  actions:
    - theme: brand
      text: 开始使用
      link: /guide/about
    - theme: alt
      text: API 参考
      link: /api/

features:
  - title: 类型安全的流处理
    details: 完整的 TypeScript 类型推导，编译时保证管道安全。
  - title: 智能背压机制
    details: 推拉模式双向通道，自动流量控制，防止内存溢出。
  - title: 防泄漏事件流
    details: 自动资源管理，监听器自动清理，无需手动取消订阅。
  - title: 内置统计分析
    details: 开箱即用的数值分析，支持平均值、方差、标准差等。
  - title: 统一同步异步
    details: 相同的 API 处理同步和异步数据流，学习成本更低。
  - title: 惰性求值优化
    details: 按需计算，短路优化，性能卓越。
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #bd34fe50 10%, #41d1ff50 100%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>
