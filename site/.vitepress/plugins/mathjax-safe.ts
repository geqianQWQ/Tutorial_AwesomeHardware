import type MarkdownIt from 'markdown-it'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AssistiveMmlHandler } from 'mathjax-full/js/a11y/assistive-mml.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'

/**
 * mathjax-safe
 *
 * 三件事一并提供（在 `md.use(mathjax3)` 之后调用）：
 *
 * 1. 根治 MathJax 解析崩溃 —— 个别坏公式（如把 `\eta` 写成 `eta`、`\frac` 写成
 *    `rac`）会让 mathjax-full 的 TeX 解析器 throw `Cannot read properties of null
 *    (reading '4')`，直接终止整个 build。这里把渲染规则包一层 try/catch，失败时
 *    回退成「显示原始 LaTeX 文本」而不是抛异常（任务推荐 a 方案）。
 *
 * 2. 根治内存泄漏之一（handler 堆积）—— markdown-it-mathjax3 的 renderMath 对**每个
 *    公式**都新建 liteAdaptor 并调用 RegisterHTMLHandler / AssistiveMmlHandler，这些
 *    handler 会被注册进 mathjax 的全局列表且永不释放。这里改成**单例 adaptor + 单例
 *    MathDocument**，handler 只注册一次，全站公式复用。
 *
 * 3. 根治内存泄漏之二（juice）—— mathjax3 原版对每个公式都 `juice(html + stylesheet)`
 *    把 mathjax SVG 样式表内联到 SVG 上。juice 每次解析都泄漏，1.5 万公式 × 多轮渲染
 *    会把堆从 376MB 顶到 677MB 直至 OOM。而那块样式表对**所有公式都是完全相同的固定
 *    内容**，所以我们改成：renderMath 只输出裸 SVG（不再 juice、不再逐公式拼样式表），
 *    那块固定 CSS 由 `theme/mathjax-svg.css` 全局注入一次。视觉效果与逐公式 juice 内联
 *    完全一致（裸 SVG 的 mjx-container 仍带 display="true" 等属性，全局选择器照样命中）。
 *
 * 实现方式：保留 mathjax3 注册的「行内/块公式解析规则」（负责把 `$..$` / `$$..$$`
 *    切成 token），仅**覆盖它的两条渲染规则**，用下面的单例 renderMath 渲染。
 *
 * 用法：在 markdown.config 里先 `md.use(mathjax3)`，再 `mathjaxSafe(md)`。
 */

// —— 单例：全站只创建一次（止住 handler 堆积泄漏的关键）——
const adaptor = liteAdaptor()
const handler = RegisterHTMLHandler(adaptor)
AssistiveMmlHandler(handler)
const InputJax = new TeX({ packages: AllPackages })
const OutputJax = new SVG({ fontCache: 'none' })
const document = mathjax.document('', { InputJax, OutputJax })

/** 渲染单条公式（display: 是否块级）。只输出裸 SVG，样式交给 theme/mathjax-svg.css。 */
function renderMath(content: string, display: boolean): string {
  return adaptor.outerHTML(document.convert(content, { display }))
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// 去重：同一个坏公式只报告一次，避免 build 日志被刷屏。
const reported = new Set<string>()

function reportFailure(env: unknown, formula: string): void {
  if (reported.has(formula)) return
  reported.add(formula)
  const relPath = (env as { relativePath?: string } | undefined)?.relativePath ?? '?'
  const preview = formula.length > 80 ? formula.slice(0, 77) + '...' : formula
  console.warn(`[mathjax-safe] ${relPath}: 公式渲染失败，已降级为原文：${preview}`)
}

export function mathjaxSafe(md: MarkdownIt): void {
  const install = (ruleName: 'math_inline' | 'math_block', display: boolean): void => {
    // mathjax3 已注册同名规则；我们整条替换成单例 + 容错版本。
    md.renderer.rules[ruleName] = (tokens, idx, _opts, env) => {
      const content = tokens[idx].content ?? ''
      try {
        return renderMath(content, display)
      } catch {
        reportFailure(env, content)
        const escaped = escapeHtml(content)
        return display
          ? `<pre class="math-fallback"><code>$$${escaped}$$</code></pre>`
          : `<code class="math-fallback">$${escaped}$</code>`
      }
    }
  }

  install('math_inline', false)
  install('math_block', true)
}

