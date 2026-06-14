import type { Plugin } from 'vite'

/**
 * vite-escape-hardware
 *
 * 解决「电力电子正文里的 `<...>` 被 Vue 模板编译器当成未闭合 HTML 标签」
 * （build 报 `Element is missing end tag`）。
 *
 * 思路同姊妹项目 Tutorial_AwesomeQt 的 vite-escape-cpp.ts：在 vite transform
 * 阶段（markdown-it / Vue 编译之前）把「长得像非标准标签」的 `<...>` 转义成
 * `&lt;...&gt;`。但硬件笔记和 Qt 笔记有一处关键差异——
 *
 * 电力电子正文里大量出现形如 `$D<0.5$`、`$i<0$`、`$R_e<R$` 的**行内公式**，
 * 其中的 `<` 是数学比较运算符。这些 `<` 必须原样交给 mathjax，**绝不能转义**，
 * 否则 mathjax 收到 `$R_e&lt;R$` 会把 `&lt;` 当字面量渲染或解析报错。
 *
 * 因此本插件在转义前会先把「代码块 / 行内代码 / `$$..$$` 块公式 / `$..$` 行内公式」
 * 这四类区段**保护**起来，只对正文散文里的 `<...>` 做转义。
 *
 * 安全保证：
 *   - 只转义「成对的 `<...>`」且内部「长得像非标准标签」（字母起头、不含 ="/等
 *     真实 HTML 属性字符）。
 *   - HTML / Vue 组件 / MathJax 输出 / SVG 标签全部在白名单里，不会被误伤。
 *   - 不触碰任何代码块或公式区段。
 */

// 标准 HTML 标签 + VitePress/Vue 运行时产生的标签 + MathJax/SVG 输出标签。
// 转义时凡匹配到这些名字的一律放行。
const HTML_TAGS = new Set([
  'a','abbr','address','area','article','aside','audio',
  'b','base','bdi','bdo','blockquote','body','br','button',
  'canvas','caption','cite','code','col','colgroup',
  'data','datalist','dd','del','details','dfn','dialog','div','dl','dt',
  'em','embed','fieldset','figcaption','figure','footer','form',
  'h1','h2','h3','h4','h5','h6','head','header','hgroup','hr','html',
  'i','iframe','img','input','ins','kbd','label','legend','li','link',
  'main','map','mark','menu','meta','meter','nav','noscript',
  'object','ol','optgroup','option','output','p','picture','pre','progress',
  'q','rp','rt','ruby','s','samp','script','section','select','slot','small',
  'source','span','strong','style','sub','summary','sup',
  'table','tbody','td','template','textarea','tfoot','th','thead',
  'time','title','tr','track','u','ul','var','video','wbr',
  // VitePress / Vue 运行时自定义元素
  'client-only','content','doc-footer','doc-sidebar',
  'vp-code-group','vp-tab',
  // MathJax 输出（mathjax3 渲染产物 + 其 MathML）
  'mjx-container','mjx-assistive-mml','mjx-body','mjx-math','mjx-mrow','mjx-mi',
  'mjx-mo','mjx-mn','mjx-msup','mjx-msub','mjx-mfrac','mjx-munder','mjx-mover',
  'math','mrow','mi','mo','mn','msup','msub','mfrac','munder','mover','munderover',
  'mspace','mtext','ms','mpadded','mphantom','menclose','merror','mtable','mtr',
  'mtd','maligngroup','malignmark','mprescripts','none','msqrt','mroot','mfenced',
  'mstyle','semantics','annotation',
  // SVG（mathjax 也用 SVG 输出）
  'svg','path','g','rect','circle','line','polygon','polyline','text',
  'use','defs','clippath','lineargradient','radialgradient','stop',
  'desc','image','pattern','mask','marker','symbol','foreignobject',
])

// 已知的 Vue 组件（PascalCase）。散文里不会出现，这里只是兜底放行。
const VUE_COMPONENTS = new Set<string>([])

/**
 * 判断 `<...>` 内部那段字符串「长得像不像一个非标准标签」。
 * 像 `<i_L>`、`<v>`、`<Vgs>`、`<D>` 这种电力电子变量记号 → true（要转义）。
 * 真实 HTML 标签、带属性（= "/）的片段 → false（放行）。
 */
function looksLikeNonHtmlTag(inner: string): boolean {
  const trimmed = inner.trim()
  if (!trimmed) return false
  // 取首个 token 作为标签名（去掉可能的闭合斜杠、取空格/斜杠前部分）
  const tagName = trimmed.replace(/^\/+/, '').split(/[\s/]/)[0].toLowerCase()
  if (HTML_TAGS.has(tagName)) return false
  if (VUE_COMPONENTS.has(trimmed.replace(/^\/+/, '').split(/[\s/]/)[0])) return false
  // 字母/下划线起头，仅含标识符友好字符（不含 = " ' / 等属性字符）。
  // 允许下划线（<i_L>）、点（极少数）、逗号、空格。
  return /^[A-Za-z_][A-Za-z0-9_:,\s*&._-]*$/.test(trimmed)
}

/**
 * 把一行散文里「会被 Vue 误解析的 `<...>`」转义，但跳过行内代码与行内公式。
 * 区段切分用一条正则，匹配到的区段原样保留，其余区段才做 `<...>` 替换。
 */
function escapeProseLine(line: string): string {
  // 匹配优先级：行内代码 `..` > 块公式 $$..$$（同行） > 行内公式 $..$
  // 行内公式要求：$ 后不紧跟空白、闭合 $ 前不紧跟空白（与 mathjax 的 can_open/can_close 对齐）。
  const segmentRe = /(`[^`]*`|\$\$[^$\n]*\$\$|\$(?!\s)[^$\n]+?(?<!\s)\$)/
  const segments = line.split(segmentRe)
  return segments
    .map((seg, i) => {
      // 奇数下标 = 被正则捕获的保护区段（代码/公式），原样返回。
      if (i % 2 === 1) return seg
      // 偶数下标 = 散文，转义其中的 `<...>`。
      return seg.replace(/<([^<>\n]+)>/g, (match, inner: string) =>
        looksLikeNonHtmlTag(inner) ? `&lt;${inner.trim()}&gt;` : match
      )
    })
    .join('')
}

export function viteHardwareEscape(): Plugin {
  return {
    name: 'vite-hardware-escape',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.md')) return null

      const lines = code.split('\n')
      let inFence = false
      let fenceChar = ''
      let inMathBlock = false // 处于 $$...$$ 块公式内部
      let changed = false

      const result = lines.map((line) => {
        // —— 围栏代码块（``` / ~~~）——
        const fenceMatch = line.match(/^(\s*)(```+|~~~+)/)
        if (fenceMatch) {
          const marker = fenceMatch[2]
          if (!inFence) {
            inFence = true
            fenceChar = marker[0]
            return line
          }
          if (marker[0] === fenceChar && marker.length >= 3) {
            inFence = false
            fenceChar = ''
          }
          return line
        }
        if (inFence) return line

        // —— $$ 块公式定界（整行只有 $$ 或行首带 $$）——
        // 单行 $$..$$ 由 escapeProseLine 的区段正则保护；这里只管多行块。
        if (/^\s*\$\$\s*$/.test(line)) {
          inMathBlock = !inMathBlock
          return line
        }
        if (inMathBlock) return line

        const escaped = escapeProseLine(line)
        if (escaped !== line) changed = true
        return escaped
      })

      if (!changed) return null
      return { code: result.join('\n'), map: null }
    },
  }
}
