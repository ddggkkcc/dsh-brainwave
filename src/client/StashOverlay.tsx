/**
 * shell.overlay 浮窗（api-contract.md §2.1）：Notion 式选区菜单 + 标签墙抽屉。
 *
 * 选区捕获（api-contract.md §2.3，本文件只做 L0/L2 与触发时机，L1 归属见 selectionScope.ts）：
 * - 触发：mouseup 单次定位（不跟拖选抖动）；键盘选区 selectionchange 250ms 防抖；
 *   scroll（捕获）/ 选区折叠 / Escape 立即收起（100ms 淡出）；
 * - 反馈：收藏成功菜单就地变形「已收藏」800ms 再淡出（FR-4.3，不依赖面板开合）。
 *
 * UI：docs/design/stash-ui-redesign.html v1 —— 暖石墨三层底 × 鼠尾草绿单一强调色，
 * 半透明 hairline（面板只留一条分隔线，分区靠留白），字重只用 400/500，emoji 全部
 * 换线性 SVG。样式走注入的 <style>（dsh-stash- 前缀类名）而非内联对象——hover、
 * keyframes 动效（面板 180ms scale .97→1、菜单 140ms 淡入上浮、骨架屏、spinner）
 * 内联样式表达不了。MVP 硬编码深色（范围纪律：主题适配二期仅换 token 值）。
 * @module @dsh-external/dsh-stash/StashOverlay
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol'
import type { StashItem } from '../host/types.js'
import { isEditable, type ConversationScope } from './selectionScope.js'

/** ctx.remote.stash（transport 信封包业务信封，双层判 ok，见 api-remotes 控制器范式）。 */
type StashRemote = TypertRemoteNamespaceMap['stash']

interface SelectionMenu {
  readonly x: number
  readonly y: number
  readonly placement: 'top' | 'bottom'
  readonly text: string
  readonly phase: 'actions' | 'collected' | 'exiting'
}

/** 键盘选区防抖：Shift+方向键没有 mouseup，稳定后才出现菜单。 */
const KEYBOARD_SETTLE_MS = 250
/** 收藏后就地变形停留时长，之后淡出并清空选区。 */
const COLLECTED_LINGER_MS = 800
/** 菜单淡出时长。 */
const MENU_EXIT_MS = 100

/* ── 设计令牌（docs/design/stash-ui-redesign.html，改动先回设计稿）── */
const T = {
  bg: '#21201f',
  bgRaised: '#2a2927',
  bgInset: '#171615',
  text1: '#ece8e2',
  text2: '#a9a29a',
  text3: '#736d65',
  line: 'rgba(236, 232, 226, 0.08)',
  line2: 'rgba(236, 232, 226, 0.14)',
  sage: '#a3b8a6',
  sageInk: '#1d221e',
  sageTint: 'rgba(163, 184, 166, 0.13)',
  sageLine: 'rgba(163, 184, 166, 0.38)',
  sageText: '#c9d8cb',
  rose: '#c99292',
} as const

const CSS = `
.dsh-stash-root { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; pointer-events: none; }
@keyframes dsh-stash-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes dsh-stash-panel-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes dsh-stash-fade-out { to { opacity: 0; } }
@keyframes dsh-stash-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes dsh-stash-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .dsh-stash-menu, .dsh-stash-panel, .dsh-stash-fab, .dsh-stash-toast { animation: none !important; transition: none !important; }
}

.dsh-stash-menu {
  position: fixed; z-index: 2147483001; display: flex; padding: 4px;
  background: rgba(33, 32, 31, 0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 0.5px solid ${T.line2}; border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4); pointer-events: auto;
  animation: dsh-stash-in 0.14s cubic-bezier(0.2, 0, 0, 1);
}
.dsh-stash-menu.exiting { animation: dsh-stash-fade-out ${MENU_EXIT_MS}ms ease forwards; pointer-events: none; }
.dsh-stash-menu-item {
  display: flex; align-items: center; gap: 5px; padding: 5px 10px; border: none;
  border-radius: 6px; background: transparent; color: ${T.text1};
  font-size: 12px; font-family: inherit; cursor: pointer; white-space: nowrap;
}
.dsh-stash-menu-item + .dsh-stash-menu-item {
  border-left: 0.5px solid ${T.line2}; border-radius: 0 6px 6px 0; margin-left: 4px; padding-left: 12px;
}
.dsh-stash-menu-item:hover { background: rgba(236, 232, 226, 0.08); }
.dsh-stash-menu-item.muted { color: ${T.text2}; }
.dsh-stash-menu-done { display: flex; align-items: center; gap: 6px; padding: 5px 14px; color: ${T.sage}; font-size: 12px; }

.dsh-stash-fab {
  pointer-events: auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 38px; height: 38px; padding: 0; border-radius: 999px; overflow: hidden;
  background: ${T.bg}; border: 0.5px solid ${T.line2}; color: ${T.text2};
  cursor: pointer; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  transition: width 0.18s cubic-bezier(0.2, 0, 0, 1), background 0.18s cubic-bezier(0.2, 0, 0, 1), color 0.18s cubic-bezier(0.2, 0, 0, 1);
}
.dsh-stash-fab:hover { width: 96px; background: ${T.bgRaised}; color: ${T.text1}; }
.dsh-stash-fab-label { opacity: 0; white-space: nowrap; font-size: 12px; transition: opacity 0.18s cubic-bezier(0.2, 0, 0, 1) 0.04s; }
.dsh-stash-fab:hover .dsh-stash-fab-label { opacity: 1; }

.dsh-stash-panel {
  pointer-events: auto; display: flex; flex-direction: column; width: 372px; max-height: 70vh;
  background: ${T.bg}; color: ${T.text1}; border: 0.5px solid ${T.line2}; border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);
  overflow: hidden; font-size: 13px; font-family: inherit;
  animation: dsh-stash-panel-in 0.18s cubic-bezier(0.2, 0, 0, 1); transform-origin: 100% 100%;
}
.dsh-stash-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px 0; }
.dsh-stash-head-title { font-size: 13px; font-weight: 500; letter-spacing: 0.01em; }
.dsh-stash-head-count { font-size: 12px; color: ${T.text3}; font-variant-numeric: tabular-nums; }
.dsh-stash-head .spacer { flex: 1; }
.dsh-stash-tbtn {
  background: none; border: none; color: ${T.text3}; font-size: 12px; font-family: inherit;
  padding: 4px 8px; border-radius: 6px; cursor: pointer;
  transition: background 0.12s cubic-bezier(0.2, 0, 0, 1), color 0.12s cubic-bezier(0.2, 0, 0, 1);
}
.dsh-stash-tbtn:hover:not(:disabled) { color: ${T.text1}; background: ${T.bgRaised}; }
.dsh-stash-tbtn:disabled { opacity: 0.4; cursor: default; }
.dsh-stash-tbtn.danger:hover:not(:disabled) { color: ${T.rose}; background: rgba(201, 146, 146, 0.09); }

.dsh-stash-ask { padding: 14px 16px 4px; }
.dsh-stash-ask-row { display: flex; gap: 8px; }
.dsh-stash-input {
  flex: 1; min-width: 0; height: 32px; padding: 0 10px;
  background: ${T.bgInset}; border: 0.5px solid transparent; border-radius: 8px;
  color: ${T.text1}; font-size: 13px; font-family: inherit; outline: none;
  transition: border-color 0.15s cubic-bezier(0.2, 0, 0, 1);
}
.dsh-stash-input::placeholder { color: ${T.text3}; }
.dsh-stash-input:focus { border-color: ${T.sageLine}; }
.dsh-stash-go {
  width: 32px; height: 32px; border-radius: 8px; border: none; cursor: pointer;
  background: ${T.sage}; color: ${T.sageInk};
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s cubic-bezier(0.2, 0, 0, 1);
}
.dsh-stash-go:hover:not(:disabled) { background: #b3c6b5; }
.dsh-stash-go:disabled { opacity: 0.6; cursor: default; }
.dsh-stash-spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(29, 34, 30, 0.3); border-top-color: ${T.sageInk};
  animation: dsh-stash-spin 0.7s linear infinite;
}
.dsh-stash-ctx { display: flex; align-items: center; gap: 7px; margin-top: 10px; font-size: 12px; color: ${T.text2}; cursor: pointer; user-select: none; }
.dsh-stash-ctx input { accent-color: ${T.sage}; width: 13px; height: 13px; margin: 0; }

.dsh-stash-answer { margin: 12px 16px 4px; padding: 2px 0 2px 12px; border-left: 2px solid ${T.sageLine}; font-size: 12.5px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; max-height: 24vh; overflow-y: auto; overscroll-behavior: contain; }
.dsh-stash-skeleton { display: flex; flex-direction: column; gap: 8px; }
.dsh-stash-sk { height: 10px; border-radius: 4px; background: ${T.bgRaised}; animation: dsh-stash-pulse 1.2s ease-in-out infinite; }
.dsh-stash-sk:nth-child(2) { width: 82%; animation-delay: 0.15s; }
.dsh-stash-sk:nth-child(3) { width: 64%; animation-delay: 0.3s; }

.dsh-stash-hr { height: 0.5px; background: ${T.line}; margin: 14px 16px 0; }
.dsh-stash-tags-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 0; }
.dsh-stash-tags-hint { font-size: 12px; color: ${T.text3}; font-variant-numeric: tabular-nums; }
.dsh-stash-tags-head .ops { display: flex; gap: 2px; }
.dsh-stash-tags {
  display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start;
  padding: 12px 16px 16px; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  max-height: 40vh; /* 兜底：即使宿主环境令面板 max-height 失效，标签区自身仍出滚动条 */
}
.dsh-stash-tags::-webkit-scrollbar { width: 4px; }
.dsh-stash-tags::-webkit-scrollbar-thumb { background: ${T.line2}; border-radius: 2px; }
.dsh-stash-tag {
  display: inline-flex; align-items: center; max-width: 100%; height: 28px; padding: 0 11px;
  border-radius: 999px; background: transparent; border: 0.5px solid ${T.line2};
  color: ${T.text1}; font-size: 12px; line-height: 16px; cursor: pointer; user-select: none;
  transition: background 0.12s cubic-bezier(0.2, 0, 0, 1), border-color 0.12s cubic-bezier(0.2, 0, 0, 1), color 0.12s cubic-bezier(0.2, 0, 0, 1);
}
.dsh-stash-tag:hover { background: ${T.bgRaised}; }
.dsh-stash-tag .txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.dsh-stash-tag.sel { background: ${T.sageTint}; border-color: ${T.sageLine}; color: ${T.sageText}; }
.dsh-stash-tag .dot { width: 5px; height: 5px; border-radius: 50%; background: ${T.sage}; margin-right: 7px; flex: none; }
.dsh-stash-empty { padding: 26px 0 30px; text-align: center; color: ${T.text3}; font-size: 12px; width: 100%; }
.dsh-stash-empty .ic { display: flex; justify-content: center; margin-bottom: 10px; opacity: 0.7; }

.dsh-stash-toast {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 5;
  display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px;
  background: rgba(33, 32, 31, 0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 0.5px solid ${T.line2}; font-size: 12px; color: ${T.text1};
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4); white-space: nowrap;
  animation: dsh-stash-in 0.16s cubic-bezier(0.2, 0, 0, 1);
}
`

/* ── 线性 SVG 图标（替代 emoji）── */
function IconDrawer({ size = 14, color = 'currentColor' }: { size?: number, color?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h16v11H4z" /><path d="M4 9l2.5-5h11L20 9" /><path d="M10 13.5h4" />
    </svg>
  )
}
function IconAsk({ size = 13, color = 'currentColor' }: { size?: number, color?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7" /><path d="M9 7h8v8" />
    </svg>
  )
}
function IconCheck({ size = 12, color = 'currentColor' }: { size?: number, color?: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 5" />
    </svg>
  )
}

/** 哨兵探针组件（api-contract.md §2.3 L1）：挂进 conversation.chat.node，
 * 每条消息一个，DOM 根登记进 ConversationScope；display:none 不影响树位置。 */
export function createConversationProbe(scope: ConversationScope): () => ReactElement {
  return function ConversationProbe(): ReactElement {
    const ref = useRef<HTMLSpanElement | null>(null)
    useEffect(() => {
      const el = ref.current
      if (el === null) return
      return scope.registerProbe(el)
    }, [])
    return <span ref={ref} aria-hidden="true" style={{ display: 'none' }} />
  }
}

export function createStashOverlay(remote: StashRemote, scope: ConversationScope): () => ReactElement {
  return function StashOverlay(): ReactElement {
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState<StashItem[]>([])
    const [menu, setMenu] = useState<SelectionMenu | null>(null)
    const [query, setQuery] = useState('')
    const [includeContext, setIncludeContext] = useState(true)
    const [askState, setAskState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
    const [answer, setAnswer] = useState('')
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
    const [toast, setToast] = useState<string | null>(null)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const collectedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    /** 「已收藏」变形进行中（事件处理器里要读，不能依赖异步的 state） */
    const collectedRef = useRef(false)

    useEffect(() => {
      return () => {
        if (toastTimer.current !== undefined) clearTimeout(toastTimer.current)
        if (hideTimer.current !== undefined) clearTimeout(hideTimer.current)
        if (collectedTimer.current !== undefined) clearTimeout(collectedTimer.current)
        if (settleTimer.current !== undefined) clearTimeout(settleTimer.current)
      }
    }, [])

    const showToast = (message: string): void => {
      setToast(message)
      if (toastTimer.current !== undefined) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 2000)
    }

    const refreshList = (): void => {
      remote.list().then((carried) => {
        if (!carried.ok) { showToast('请求失败，请重试'); return }
        if (!carried.value.ok) { showToast(carried.value.error.message); return }
        setItems([...carried.value.value])
      }).catch(() => showToast('请求失败，请重试'))
    }

    // 打开时刷新抽屉
    useEffect(() => {
      if (open) refreshList()
    }, [open])

    // 点击面板外空白折叠（选区菜单与 FAB 都在 rootRef 内，不受影响）
    useEffect(() => {
      if (!open) return
      const onPointerDown = (event: MouseEvent): void => {
        if (rootRef.current === null) return
        if (event.target instanceof Node && rootRef.current.contains(event.target)) return
        setOpen(false)
      }
      document.addEventListener('mousedown', onPointerDown)
      return () => document.removeEventListener('mousedown', onPointerDown)
    }, [open])

    /** 菜单收起（100ms 淡出）；幂等，可被随后的 evaluate 打断。 */
    const requestHideMenu = (): void => {
      if (hideTimer.current !== undefined) clearTimeout(hideTimer.current)
      setMenu(prev => prev === null || prev.phase === 'exiting' ? prev : { ...prev, phase: 'exiting' })
      hideTimer.current = setTimeout(() => {
        setMenu(null)
        hideTimer.current = undefined
      }, MENU_EXIT_MS + 20)
    }

    // 选区捕获（§2.3）：mouseup 单次定位 + 键盘选区防抖 + L0/L1/L2 三层漏斗
    useEffect(() => {
      const evaluate = (): void => {
        const sel = window.getSelection()
        if (sel === null || sel.rangeCount === 0 || sel.anchorNode === null || sel.isCollapsed) { requestHideMenu(); return }
        if (rootRef.current?.contains(sel.anchorNode) === true) { requestHideMenu(); return } // L0 面板内
        if (isEditable(sel.anchorNode)) { requestHideMenu(); return } // L0 可编辑区
        const text = sel.toString().trim()
        if (text.length === 0) { requestHideMenu(); return } // L0 空文本
        if (!scope.contains(sel.anchorNode)) { requestHideMenu(); return } // L1 容器归属
        const rect = sel.getRangeAt(0).getBoundingClientRect() // L2 内容校验
        if (rect.width === 0 && rect.height === 0) { requestHideMenu(); return }
        const menuWidth = 190
        const menuHeight = 34
        const gap = 8
        const x = Math.min(Math.max(rect.left + rect.width / 2, menuWidth / 2 + 8), window.innerWidth - menuWidth / 2 - 8)
        let placement: 'top' | 'bottom' = 'top'
        let y = rect.top - gap
        if (y - menuHeight < 8) {
          placement = 'bottom'
          y = rect.bottom + gap
        }
        // 新选区出现即取消「已收藏」变形的残留定时器（避免 800ms 后误杀新菜单/选区）
        if (collectedTimer.current !== undefined) { clearTimeout(collectedTimer.current); collectedTimer.current = undefined }
        collectedRef.current = false
        if (hideTimer.current !== undefined) { clearTimeout(hideTimer.current); hideTimer.current = undefined }
        // 坐标与文本都没变就不重设——防抖路径重复 evaluate 不重启入场动画
        setMenu(prev => {
          if (prev !== null && prev.phase === 'actions' && prev.text === text
            && prev.x === x && prev.y === y && prev.placement === placement) return prev
          return { x, y, placement, text, phase: 'actions' }
        })
      }

      const onSelectionChange = (): void => {
        const sel = window.getSelection()
        const collapsed = sel === null || sel.rangeCount === 0 || sel.isCollapsed || sel.toString().trim().length === 0
        if (collapsed) {
          if (settleTimer.current !== undefined) { clearTimeout(settleTimer.current); settleTimer.current = undefined }
          // 「已收藏」变形期间清空选区是主动行为，别把变形打断
          if (!collectedRef.current) requestHideMenu()
          return
        }
        // 键盘选区路径：稳定 KEYBOARD_SETTLE_MS 后才出现（拖选过程中的高频事件只重置计时器）
        if (settleTimer.current !== undefined) clearTimeout(settleTimer.current)
        settleTimer.current = setTimeout(() => {
          settleTimer.current = undefined
          evaluate()
        }, KEYBOARD_SETTLE_MS)
      }

      const onMouseUp = (event: MouseEvent): void => {
        if (rootRef.current !== null && event.target instanceof Node && rootRef.current.contains(event.target)) return
        if (settleTimer.current !== undefined) { clearTimeout(settleTimer.current); settleTimer.current = undefined }
        evaluate()
      }

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return
        requestHideMenu()
        setOpen(false) // Esc 同时折叠抽屉面板
      }

      document.addEventListener('mouseup', onMouseUp)
      document.addEventListener('selectionchange', onSelectionChange)
      document.addEventListener('scroll', requestHideMenu, true)
      document.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('mouseup', onMouseUp)
        document.removeEventListener('selectionchange', onSelectionChange)
        document.removeEventListener('scroll', requestHideMenu, true)
        document.removeEventListener('keydown', onKeyDown)
        if (settleTimer.current !== undefined) clearTimeout(settleTimer.current)
      }
    }, [])

    const clearPageSelection = (): void => {
      const sel = window.getSelection()
      if (sel !== null) sel.removeAllRanges()
    }

    const collect = (text: string): void => {
      remote.save({ text, source: 'selection' }).then((carried) => {
        if (!carried.ok) { showToast('请求失败，请重试'); return }
        if (!carried.value.ok) { showToast(carried.value.error.message); return }
        // FR-4.3：反馈不依赖面板开合——菜单本体变形「已收藏」，800ms 后淡出并清选区
        setMenu(prev => prev === null ? prev : { ...prev, phase: 'collected' })
        collectedRef.current = true
        if (collectedTimer.current !== undefined) clearTimeout(collectedTimer.current)
        collectedTimer.current = setTimeout(() => {
          setMenu(null)
          collectedTimer.current = undefined
          collectedRef.current = false
          clearPageSelection()
        }, COLLECTED_LINGER_MS)
        showToast('已收藏')
        refreshList()
      }).catch(() => showToast('请求失败，请重试'))
    }

    const startAsk = (text: string): void => {
      setQuery(text)
      setMenu(null)
      clearPageSelection()
      setOpen(true)
    }

    /**
     * 追问文本组装（FR-3.2 + FR-3.3）：选中标签内容 + 输入框追加问题。
     * 单标签直接拼接（「AskRequest.sessionId」+「是什么」→「AskRequest.sessionId是什么」），
     * 多标签用 --- 分隔后再拼接输入内容。
     */
    const buildQuery = (): string => {
      const typed = query.trim()
      const selected = selectedItems.map(item => item.text).join('\n---\n')
      if (selected.length === 0) return typed
      if (typed.length === 0) return selected
      return selected + typed
    }

    const ask = (text?: string): void => {
      const q = (text ?? buildQuery()).trim()
      if (q.length === 0) { showToast('请输入或选中要追问的内容'); return }
      setQuery(q)                // 物化最终追问文本到输入框（透明化：用户看得到实际问了什么）
      setSelectedIds(new Set())  // 选中已被消费进 query，清空避免重复追问时内容翻倍
      setAskState('pending')
      remote.ask({ query: q, includeContext }).then((carried) => {
        if (!carried.ok) { setAnswer('请求失败，请重试'); setAskState('error'); return }
        if (!carried.value.ok) { setAnswer(carried.value.error.message); setAskState('error'); return }
        setAnswer(carried.value.value.answer)
        setAskState('done')
      }).catch(() => { setAnswer('请求失败，请重试'); setAskState('error') })
    }

    const toggleTag = (id: string): void => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }

    const selectedItems = items.filter(item => selectedIds.has(item.id))
    const allSelected = items.length > 0 && selectedItems.length === items.length

    const toggleSelectAll = (): void => {
      setSelectedIds(allSelected ? new Set() : new Set(items.map(item => item.id)))
    }

    const askSelected = (): void => {
      if (selectedItems.length === 0) return
      ask(buildQuery()) // 含选中内容 + 输入框追加问题（与「问」按钮同一组装规则）
    }

    const deleteSelected = (): void => {
      if (selectedItems.length === 0) return
      Promise.all(selectedItems.map(item => remote.delete({ id: item.id }))).then((results) => {
        const failed = results.some(carried => !carried.ok || !carried.value.ok)
        if (failed) showToast('部分删除失败')
        else showToast('已删除')
        setSelectedIds(new Set())
        refreshList()
      }).catch(() => showToast('请求失败，请重试'))
    }

    return (
      <div ref={rootRef} className="dsh-stash-root">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />

        {menu !== null && (
          <div
            className={`dsh-stash-menu${menu.phase === 'exiting' ? ' exiting' : ''}`}
            style={{ left: menu.x, top: menu.y, transform: menu.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}
            onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
            onMouseUp={(event) => event.stopPropagation()}
          >
            {menu.phase === 'collected' ? (
              <span className="dsh-stash-menu-done"><IconCheck /> 已收藏</span>
            ) : (
              <>
                <button className="dsh-stash-menu-item" onClick={() => collect(menu.text)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#8fb0ff" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 2h8v12l-4-3-4 3z" />
                  </svg>
                  加入抽屉
                </button>
                <button className="dsh-stash-menu-item muted" onClick={() => startAsk(menu.text)}>
                  <IconAsk size={12} />
                  追问
                </button>
              </>
            )}
          </div>
        )}

        {open ? (
          <div className="dsh-stash-panel">
            {toast !== null && (
              <div className="dsh-stash-toast"><IconCheck color={T.sage} /> {toast}</div>
            )}
            <div className="dsh-stash-head">
              <span style={{ color: T.sage, display: 'flex' }}><IconDrawer /></span>
              <span className="dsh-stash-head-title">随手抽屉</span>
              <span className="dsh-stash-head-count">{items.length} 条</span>
              <span className="spacer" />
              <button className="dsh-stash-tbtn" onClick={() => setOpen(false)}>收起</button>
            </div>

            <div className="dsh-stash-ask">
              <div className="dsh-stash-ask-row">
                <input
                  className="dsh-stash-input"
                  value={query}
                  placeholder="输入追问，或选中正文后点「追问」…"
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') ask() }}
                />
                <button className="dsh-stash-go" disabled={askState === 'pending'} onClick={() => ask()}>
                  {askState === 'pending' ? <span className="dsh-stash-spinner" /> : <IconAsk />}
                </button>
              </div>
              <label className="dsh-stash-ctx">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={event => setIncludeContext(event.target.checked)}
                />
                加入对话上下文（两种模式都不写入主会话）
              </label>
              {askState === 'pending' && (
                <div className="dsh-stash-answer" style={{ padding: 0, borderLeft: 'none' }}>
                  <div className="dsh-stash-skeleton"><div className="dsh-stash-sk" /><div className="dsh-stash-sk" /><div className="dsh-stash-sk" /></div>
                </div>
              )}
              {askState !== 'idle' && askState !== 'pending' && <div className="dsh-stash-answer">{answer}</div>}
            </div>

            <div className="dsh-stash-hr" />

            <div className="dsh-stash-tags-head">
              <span className="dsh-stash-tags-hint">
                {selectedItems.length > 0 ? `已选 ${selectedItems.length} 条，将与输入内容合并追问` : '点选标签，可单选 / 多选'}
              </span>
              <span className="ops">
                <button className="dsh-stash-tbtn" onClick={toggleSelectAll}>{allSelected ? '清空' : '全选'}</button>
                <button className="dsh-stash-tbtn" disabled={selectedItems.length === 0} onClick={askSelected}>追问选中</button>
                <button className="dsh-stash-tbtn danger" disabled={selectedItems.length === 0} onClick={deleteSelected}>删除</button>
              </span>
            </div>
            <div className="dsh-stash-tags">
              {items.length === 0 ? (
                <div className="dsh-stash-empty">
                  <div className="ic"><IconDrawer size={20} color={T.text3} /></div>
                  去正文划选一段文字，这里替你收着
                </div>
              ) : (
                items.map(item => {
                  const selected = selectedIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      className={`dsh-stash-tag${selected ? ' sel' : ''}`}
                      title={item.text}
                      onClick={() => toggleTag(item.id)}
                    >
                      {selected && <span className="dot" />}
                      <span className="txt">{item.text}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <button className="dsh-stash-fab" onClick={() => setOpen(true)} title="随手抽屉">
            <IconDrawer size={15} />
            <span className="dsh-stash-fab-label">抽屉{items.length > 0 ? ` · ${items.length}` : ''}</span>
          </button>
        )}
      </div>
    )
  }
}
