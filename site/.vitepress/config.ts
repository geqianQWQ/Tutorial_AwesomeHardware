import { defineConfig } from 'vitepress'
import mathjax3 from 'markdown-it-mathjax3'
import { viteHardwareEscape } from './plugins/vite-escape-hardware'
import { fencePlugin } from './plugins/fence-plugin'
import { mathjaxSafe } from './plugins/mathjax-safe'

// 章节标题映射：chXX -> 侧边栏显示名
const ch = {
  ch01: '第 1 章 能量变换的艺术与代价',
  ch01_1: '1.1 能量处理的几条路',
  ch01_2: '1.2 电力电子的应用战场',
  ch01_3: '1.3 电力电子的底层拼图',
  ch02: '第 2 章 稳态变换器分析原理',
  ch03: '第 3 章 稳态等效电路建模：损耗与效率',
  ch04: '第 4 章 当理想开关遇到物理现实',
  ch05: '第 5 章 当波形不再连续',
  ch06: '第 6 章 变换器电路',
  ch07: '第 7 章 交流等效电路建模',
  ch08: '第 8 章 变换器传递函数',
  ch09: '第 9 章 控制器设计',
  ch10: '第 10 章 磁性基础理论',
  ch11: '第 11 章 铜与铁的博弈',
  ch12: '第 12 章 变压器设计：当磁芯开始发烫',
  ch13: '第 13 章 面向设计的分析技术：反馈定理',
  ch14: '第 14 章 电路平均法与平均开关模型',
  ch15: '第 15 章 断续导通模式（DCM）的建模',
  ch16: '第 16 章 额外元件定理',
  ch17: '第 17 章 输入滤波器设计',
  ch18: '第 18 章 电流编程控制（CPM）',
  ch19: '第 19 章 数字控制的代价与力量',
  ch20: '第 20 章 非正弦系统里的功率与谐波',
  ch21: '第 21 章 脉宽调制整流器',
  ch22: '第 22 章 谐振变换',
  ch23: '第 23 章 软开关技术',
}

// 生成侧边栏条目（link 为不带 .md 的相对路径）
const item = (key: string) => ({
  text: ch[key as keyof typeof ch],
  link: `/power-electronics/${key}`,
})

export default defineConfig({
  lang: 'zh-CN',
  // 部署到 GitHub Pages 项目页 Charliechen114514.github.io/Tutorial_AwesomeHardware/
  base: '/Tutorial_AwesomeHardware/',
  // 源文件在根 tutorials/（参考 Tutorial_AwesomeQt 的 srcDir:'../tutorial' 模式：
  // 内容目录在根，site/ 只放 .vitepress 配置，根无散落 md）
  srcDir: '../tutorials',
  title: 'AwesomeHardware',
  titleTemplate: '硬件学习笔记',
  description:
    '面向嵌入式学习者的硬件学习笔记站——电路基础、模电数电、PCB、传感器、接口协议与板级调试',
  lastUpdated: true,
  cleanUrls: true,

  vite: {
    plugins: [viteHardwareEscape()],
  },

  // mathjax 渲染产物是 <mjx-container>...</mjx-container>（含连字符）。Vue 模板编译器默认会把
  // 不认识的标签当「未注册组件」，SSR 时渲染成空 <!---->，公式就消失了。把含 `-` / `.` 的标签
  // 声明为自定义元素，Vue 才会原样保留 mathjax 输出（与姊妹项目 Tutorial_AwesomeModernCPP 一致）。
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag: string) => tag.includes('-') || tag.includes('.'),
      },
    },
  },

  head: [
    ['meta', { name: 'theme-color', content: '#516be8' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],

  markdown: {
    config(md) {
      // 公式：mathjax3 渲染，mathjaxSafe 给坏语法兜底（渲染失败降级为原文而非崩 build）。
      md.use(mathjax3)
      mathjaxSafe(md)
      // ```math → 交 mathjax；```spice → 纯文本标注（绕开 Shiki 的语言未加载警告）。
      md.use(fencePlugin)
    },
  },

  themeConfig: {
    siteTitle: 'AwesomeHardware · 硬件学习笔记',

    nav: [
      { text: '电源与功率变换', link: '/power-electronics/ch01' },
      { text: '关于本站', link: '/about' },
    ],

    sidebar: {
      '/power-electronics/': [
        {
          text: '起步：能量、效率与开关',
          collapsed: false,
          items: [
            item('ch01'),
            item('ch02'),
            item('ch03'),
            item('ch04'),
            item('ch05'),
          ],
        },
        {
          text: '变换器电路与建模',
          collapsed: false,
          items: [item('ch06'), item('ch07'), item('ch08'), item('ch09')],
        },
        {
          text: '磁元件设计',
          collapsed: false,
          items: [item('ch10'), item('ch11'), item('ch12')],
        },
        {
          text: '面向设计的分析技术',
          collapsed: false,
          items: [item('ch13'), item('ch14'), item('ch15'), item('ch16'), item('ch17')],
        },
        {
          text: '闭环控制',
          collapsed: false,
          items: [item('ch18'), item('ch19')],
        },
        {
          text: '谐波、整流与软开关',
          collapsed: false,
          items: [item('ch20'), item('ch21'), item('ch22'), item('ch23')],
        },
      ],
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索笔记', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '找不到结果',
            resetButtonTitle: '清除查询',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },

    outline: { label: '本页导航', level: [2, 3] },

    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    socialLinks: [{ icon: 'github', link: 'https://github.com/' }],

    footer: {
      message: '面向嵌入式学习者的硬件学习笔记',
      copyright:
        '本站内容为结合个人理解整理的学习笔记，不涉及对原书的复制或翻译。',
    },
  },
})
