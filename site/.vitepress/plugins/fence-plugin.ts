import type { PluginSimple } from 'markdown-it'
import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token'

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * fence-plugin
 *
 * 解决两个 Shiki「语言未加载」警告：
 *   - ```math 围栏：本意是公式，应交给 mathjax 渲染，而不是被 Shiki 当代码高亮。
 *   - ```spice 围栏：SPICE 仿真网表，Shiki 没有这门语言。
 *
 * 做法同姊妹项目 Tutorial_AwesomeQt 的 mermaid-plugin.ts：在 core ruler 阶段
 * （tokenize 之后、render 之前）把目标围栏的 token.type 改成自定义类型，render
 * 分发键就不再是 'fence'，Shiki（它只覆盖 md.renderer.rules.fence）永远匹配不到，
 * 从而既不警告、也不被当普通代码块高亮。
 *
 *   - ```math  → token.type='math_block'：直接复用 markdown-it-mathjax3 注册的
 *                math_block 渲染规则，等价于把内容包进 `$$...$$`。
 *   - ```spice → token.type='spice_netlist'：本插件自带渲染规则，输出带语言标签的
 *                纯文本代码块（HTML 转义、不走 Shiki），保留 SPICE 标识便于样式区分。
 */
export const fencePlugin: PluginSimple = (md: MarkdownIt) => {
  md.core.ruler.push('hardware_fence_rewrite', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence') continue
      const lang = token.info.trim().toLowerCase()
      if (lang === 'math') {
        // 交给 mathjax 的块公式渲染规则（display 模式）。
        token.type = 'math_block'
        token.tag = ''
        token.block = true
        token.markup = '$$'
        token.info = ''
      } else if (lang === 'spice') {
        token.type = 'spice_netlist'
        token.tag = ''
        token.block = true
        token.info = ''
      }
    }
    return true
  })

  // —— SPICE 网表渲染：纯文本 + 语言标签，不做语法高亮 ——
  md.renderer.rules.spice_netlist = (tokens: Token[], idx: number) => {
    const raw = tokens[idx].content.replace(/\n$/, '')
    return (
      '<div class="language-spice vp-adaptive-theme">' +
      '<button class="copy" title="复制"></button>' +
      `<pre><code>${escapeHtml(raw)}</code></pre>` +
      '</div>'
    )
  }
}
