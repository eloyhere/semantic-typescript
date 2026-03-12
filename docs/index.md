---
layout: home

hero:
  name: Semantic-TypeScript
  text: Flow, Indexed.
  tagline: Your data, under precise control.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/about
    - theme: alt
      text: API Reference
      link: /api/

features:
  - title: Type-Safe Stream Processing
    details: Full TypeScript type inference ensures compile-time safety across your entire pipeline.
  - title: Smart Backpressure
    details: Push-pull dual channels with automatic flow control prevent memory overflow.
  - title: Leak-Proof Event Streams
    details: Automatic resource management with self-cleaning listeners, no manual unsubscribe needed.
  - title: Built-in Statistics
    details: Ready-to-use analytics including average, variance, standard deviation, and more.
  - title: Unified Sync & Async
    details: Same API for both synchronous and asynchronous streams, lower learning curve.
  - title: Lazy Evaluation
    details: On-demand computation with short-circuit optimization for superior performance.
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
