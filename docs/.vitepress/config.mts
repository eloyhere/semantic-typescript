import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Semantic-TypeScript',
  description: 'Flow, Indexed. Your data, under precise control.',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', href: '/logo.ico' }]
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        outline: [2, 5],

        nav: [
          { text: 'Home', link: '/' },
          { text: 'Guide', link: '/guide/about' }
        ],

        sidebar: {
          '/guide/': [
            {
              text: 'About',
              items: [
                { text: 'Overview', link: '/guide/about' },
                { text: 'Installation', link: '/guide/installation' },
                { text: 'Quick Start', link: '/guide/quick-start' },
                { text: 'Changelog', link: '/guide/changelog' },
                { text: 'FAQ', link: '/guide/faq' }
              ]
            },
            {
              text: 'Guide',
              items: [
                { text: 'Core Concepts', link: '/guide/core-concepts' },
                { text: 'Important Rules', link: '/guide/important-rules' },
                { text: 'Performance', link: '/guide/performance' },
                { text: 'Comparison', link: '/guide/comparison' }
              ]
            },
            {
              text: 'Reference',
              items: [
                { text: 'Semantic Functions', link: '/guide/semantics' },
                { text: 'Collector Functions', link: '/guide/collectors' },
                { text: 'Type Guards', link: '/guide/guards' }
              ]
            }
          ] 
        },

        socialLinks: [
          { icon: 'github', link: 'https://github.com/eloyhere/semantic-typescript' }
        ],

        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © 2025-present Eloy Kim'
        },

        search: {
          provider: 'local'
        }
      }
    },
    cn: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/cn/',
      themeConfig: {
        outline: [2, 5],

        nav: [
          { text: '首页', link: '/cn/' },
          { text: '指南', link: '/cn/guide/about' }
        ],

        sidebar: {
          '/cn/guide/': [
            {
              text: '关于',
              items: [
                { text: '概述', link: '/cn/guide/about' },
                { text: '安装', link: '/cn/guide/installation' },
                { text: '快速开始', link: '/cn/guide/quick-start' },
                { text: '更新历史', link: '/cn/guide/changelog' },
                { text: '常见问题', link: '/cn/guide/faq' }
              ]
            },
            {
              text: '指南',
              items: [
                { text: 'Semantic', link: '/cn/guide/semantics-intro' },
                { text: 'Collectable', link: '/cn/guide/collectables-intro' },
                { text: 'Collector', link: '/cn/guide/collectors-intro' },
                { text: '推拉模式', link: '/cn/guide/push-pull-pattern' },
                { text: '重要规则', link: '/cn/guide/important-rules' },
                { text: '性能特征', link: '/cn/guide/performance' },
                { text: '对比 RxJS', link: '/cn/guide/comparison' }
              ]
            },
            {
              text: '参考',
              items: [
                { text: 'Semantic 函数', link: '/cn/guide/semantics' },
                { text: 'Collector 函数', link: '/cn/guide/collectors' },
                { text: '类型守卫', link: '/cn/guide/guards' }
              ]
            }
          ] 
        },

        socialLinks: [
          { icon: 'github', link: 'https://github.com/eloyhere/semantic-typescript' }
        ],

        footer: {
          message: '基于 MIT 许可证发布。',
          copyright: 'Copyright © 2025-present eloyhere'
        },

        search: {
          provider: 'local'
        }
      }
    },
    // tw: {
    //   label: '繁體中文',
    //   lang: 'zh-TW',
    //   link: '/tw/',
    //   themeConfig: {
    //     outline: [2, 5],

    //     nav: [
    //       { text: '首頁', link: '/tw/' },
    //       { text: '指南', link: '/tw/guide/about' }
    //     ],

    //     sidebar: {
    //       '/tw/guide/': [
            
    //       ] 
    //     },

    //     socialLinks: [
    //       { icon: 'github', link: 'https://github.com/eloyhere/semantic-typescript' }
    //     ],

    //     footer: {
    //       message: '基於 MIT 授權發布。',
    //       copyright: 'Copyright © 2025-present Eloy Kim'
    //     },

    //     search: {
    //       provider: 'local'
    //     }
    //   }
    // },
    // de: {
    //   label: 'Deutsch',
    //   lang: 'de-DE',
    //   link: '/de/',
    //   themeConfig: {
    //     outline: [2, 5],

    //     nav: [
    //       { text: 'Startseite', link: '/de/' },
    //       { text: 'Leitfaden', link: '/de/guide/about' }
    //     ],

    //     footer: {
    //       message: 'Veröffentlicht unter der MIT-Lizenz.',
    //       copyright: 'Copyright © 2025-present Eloy Kim'
    //     },

    //     search: {
    //       provider: 'local'
    //     }
    //   }
    // },
    // es: {
    //   label: 'Español',
    //   lang: 'es-ES',
    //   link: '/es/',
    //   themeConfig: {
    //     outline: [2, 5],

    //     nav: [
    //       { text: 'Inicio', link: '/es/' },
    //       { text: 'Guía', link: '/es/guide/about' }
    //     ],

    //     footer: {
    //       message: 'Publicado bajo la licencia MIT.',
    //       copyright: 'Copyright © 2025-present Eloy Kim'
    //     },

    //     search: {
    //       provider: 'local'
    //     }
    //   }
    // },
    // fr: {
    //   label: 'Français',
    //   lang: 'fr-FR',
    //   link: '/fr/',
    //   themeConfig: {
    //     outline: [2, 5],

    //     nav: [
    //       { text: 'Accueil', link: '/fr/' },
    //       { text: 'Guide', link: '/fr/guide/about' }
    //     ],

    //     footer: {
    //       message: 'Publié sous la licence MIT.',
    //       copyright: 'Copyright © 2025-present Eloy Kim'
    //     },

    //     search: {
    //       provider: 'local'
    //     }
    //   }
    // },
    // jp: {
    //   label: '日本語',
    //   lang: 'ja-JP',
    //   link: '/jp/',
    //   themeConfig: {
    //     outline: [2, 5],

    //     nav: [
    //       { text: 'ホーム', link: '/jp/' },
    //       { text: 'ガイド', link: '/jp/guide/about' }
    //     ],

    //     footer: {
    //       message: 'MITライセンスでリリース。',
    //       copyright: 'Copyright © 2025-present Eloy Kim'
    //     },

    //     search: {
    //       provider: 'local'
    //     }
    //   }
    // },
    // kr: {
    //   label: '한국어',
    //   lang: 'ko-KR',
    //   link: '/kr/',
    //   themeConfig: {
    //     outline: [2, 5],

    //     nav: [
    //       { text: '홈', link: '/kr/' },
    //       { text: '가이드', link: '/kr/guide/about' }
    //     ],

    //     footer: {
    //       message: 'MIT 라이선스로 릴리스.',
    //       copyright: 'Copyright © 2025-present Eloy Kim'
    //     },

    //     search: {
    //       provider: 'local'
    //     }
    //   }
    // },
    // ru: {
    //   label: 'Русский',
    //   lang: 'ru-RU',
    //   link: '/ru/',
    //   themeConfig: {
    //     outline: [2, 5],

    //     nav: [
    //       { text: 'Главная', link: '/ru/' },
    //       { text: 'Руководство', link: '/ru/guide/about' }
    //     ],

    //     footer: {
    //       message: 'Выпущено под лицензией MIT.',
    //       copyright: 'Copyright © 2025-present Eloy Kim'
    //     },

    //     search: {
    //       provider: 'local'
    //     }
    //   }
    // }
  }
})
