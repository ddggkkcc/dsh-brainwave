/**
 * 选区归属判定（api-contract.md §2.3 L1 层）：哨兵探针 + 容器归属。
 *
 * 设计原则：判定「选区是否落在对话内容容器内」用**归属法**而非排除法——
 * 排除法永远列不全宿主 chrome（侧边栏/标题栏/设置页/未来的新面板），
 * 归属法只回答一个问题：anchorNode 在不在消息流容器里。
 *
 * 容器锚点不依赖宿主 class（宿主改版即碎），而来自我们自己注入的结构信号：
 * - ≥2 个探针（挂在 conversation.chat.node，每条消息一个）的最近公共祖先
 *   = 消息列表容器——树结构的几何事实，宿主怎么改命名都成立；
 * - 仅 1 个探针：取探针最近的整幅可滚动祖先；
 * - 0 个探针（无会话 / keyed 槽位失效）：锚点侧启发式——选区位于
 *   高度 ≥50% 视口的可滚动容器内才放行；
 * - 容器解析失败：fail-open（放行，行为等同旧版），保住可用性。
 *
 * @module @dsh-external/dsh-stash/client/selectionScope
 */

/** 选区归属作用域：探针注册表 + 容器解析 + contains 判定。 */
export interface ConversationScope {
  /** 登记一个探针 DOM 根；返回注销函数（组件卸载时调用）。 */
  registerProbe(el: HTMLElement): () => void
  /** 判定选区锚点是否落在对话内容容器内（降级阶梯见模块注释）。 */
  contains(node: Node | null): boolean
}

/** input / textarea / contenteditable 内的选区不参与捕获。 */
export function isEditable(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  if (element === null) return false
  return element.closest('input, textarea, [contenteditable="true"], [contenteditable=""]') !== null
}

/** 最近公共祖先（LCA）：a 的祖先链入 Set，b 沿祖先链找第一个交点。 */
function lowestCommonAncestor(a: Element, b: Element): Element | null {
  const seen = new Set<Element>()
  let cur: Element | null = a
  while (cur !== null) {
    seen.add(cur)
    cur = cur.parentElement
  }
  cur = b
  while (cur !== null) {
    if (seen.has(cur)) return cur
    cur = cur.parentElement
  }
  return null
}

/** 最近的「整幅」可滚动祖先（overflow auto/scroll 且高度可观），跳过 body/html。 */
function nearestScrollable(el: Element): HTMLElement | null {
  let cur: Element | null = el.parentElement
  while (cur !== null) {
    if (cur instanceof HTMLElement && cur.tagName !== 'BODY' && cur.tagName !== 'HTML') {
      const overflowY = window.getComputedStyle(cur).overflowY
      if ((overflowY === 'auto' || overflowY === 'scroll') && cur.clientHeight >= 200) return cur
    }
    cur = cur.parentElement
  }
  return null
}

export function createConversationScope(): ConversationScope {
  const probes = new Set<HTMLElement>()
  let cache: Element | null = null
  let cacheDirty = true

  const resolveContainer = (): Element | null => {
    if (!cacheDirty) return cache
    const list = [...probes]
    if (list.length >= 2) cache = lowestCommonAncestor(list[0], list[1])
    else if (list.length === 1) cache = nearestScrollable(list[0])
    else cache = null
    cacheDirty = false
    return cache
  }

  return {
    registerProbe(el: HTMLElement): () => void {
      probes.add(el)
      cacheDirty = true // 虚拟化卸载/挂载都会引起容器变化，统一失效重算
      return () => {
        probes.delete(el)
        cacheDirty = true
      }
    },
    contains(node: Node | null): boolean {
      if (node === null) return false
      const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
      if (element === null) return false
      if (probes.size === 0) {
        // 降级：无探针 → 锚点侧启发式（主内容列 = 整幅可滚动容器）
        const scroller = nearestScrollable(element)
        return scroller !== null && scroller.clientHeight >= window.innerHeight * 0.5
      }
      const container = resolveContainer()
      if (container === null) return true // 探针在但解析失败 → fail-open
      return container.contains(element)
    },
  }
}
