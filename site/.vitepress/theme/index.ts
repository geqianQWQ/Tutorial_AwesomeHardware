import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style.css'
import './mathjax-svg.css'

export default {
  extends: DefaultTheme,
} satisfies Theme
