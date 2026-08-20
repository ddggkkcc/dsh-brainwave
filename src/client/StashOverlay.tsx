/**
 * shell.overlay 浮窗（api-contract.md §2.1）：Notion 式选区菜单 + 标签墙抽屉。
 * - 选区菜单：鼠标划选正文后，在选区附近浮出「加入抽屉 / 追问」两个动作；
 * - 抽屉内容：收藏以圆角标签排列，点击标签单选/多选，选中后可追问/删除；
 * - 层默认 click-through，浮窗容器须 pointer-events: auto；
 * - 常驻入口按钮（FR-4.2）M1 正式验收，M0 先落地最小开合；
 * - MVP 硬编码深色中性风（范围纪律：主题适配二期）。
 * @module @dsh-external/dsh-stash/StashOverlay
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol'
import type { StashItem } from '../host/types.js'

/** ctx.remote.stash（transport 信封包业务信封，双层判 ok，见 api-remotes 控制器范式）。 */
type StashRemote = TypertRemoteNamespaceMap['stash']

interface SelectionMenu {
  readonly x: number
  readonly y: number
  readonly placement: 'top' | 'bottom'
  readonly text: string
}

function isEditable(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  if (element === null) return false
  return element.closest('input, textarea, [contenteditable="true"], [contenteditable=""]') !== null
}

const style: Record<string, CSSProperties> = {
  floating: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 2147483000,
    pointerEvents: 'none',
  },
  pill: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: '#2b3245',
    color: '#e8eaf0',
    border: '1px solid #3a4254',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 13,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  menu: {
    position: 'fixed',
    zIndex: 2147483001,
    display: 'flex',
    gap: 6,
    padding: 6,
    background: '#2b3245',
    border: '1px solid #3a4254',
    borderRadius: 10,
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
    pointerEvents: 'auto',
  },
  menuButton: {
    padding: '5px 10px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  panel: {
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    width: 360,
    maxHeight: '70vh',
    background: '#1e2430',
    color: '#e8eaf0',
    border: '1px solid #3a4254',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    overflow: 'hidden',
    fontSize: 13,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #3a4254',
    fontSize: 14,
    fontWeight: 600,
  },
  section: { padding: '10px 14px', borderBottom: '1px solid #2a3140' },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '6px 8px',
    background: '#141924',
    color: '#e8eaf0',
    border: '1px solid #3a4254',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '6px 0',
    fontSize: 12,
    color: '#c6cdda',
  },
  primary: {
    padding: '6px 12px',
    background: '#3b6ef0',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  ghost: {
    padding: '4px 10px',
    background: 'transparent',
    color: '#9aa4b8',
    border: '1px solid #3a4254',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  danger: {
    padding: '4px 10px',
    background: 'transparent',
    color: '#e08b8b',
    border: '1px solid #5a3a3a',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '10px 12px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    alignContent: 'flex-start',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid #3a4254',
    background: '#232a3a',
    color: '#e8eaf0',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: '16px',
    transition: 'background 0.12s ease, border-color 0.12s ease',
  },
  tagSelected: {
    background: '#3b6ef0',
    borderColor: '#6d8dff',
    color: '#ffffff',
  },
  tagText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  },
  selectionBar: {
    flexBasis: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  selectionHint: { fontSize: 12, color: '#9aa4b8' },
  answer: {
    marginTop: 8,
    padding: '8px 10px',
    background: '#272f42',
    borderRadius: 6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  toast: {
    position: 'absolute',
    top: 44,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 12px',
    background: '#141924',
    border: '1px solid #3a4254',
    borderRadius: 999,
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  empty: { padding: '12px 0', textAlign: 'center', color: '#6b7486', fontSize: 12 },
}

export function createStashOverlay(remote: StashRemote): () => ReactElement {
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

    useEffect(() => {
      return () => {
        if (toastTimer.current !== undefined) clearTimeout(toastTimer.current)
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

    // 选区捕获：在选区附近浮出 Notion 式菜单（面板内 / 输入框内 / 可编辑区不捕获）
    useEffect(() => {
      const update = (): void => {
        const sel = window.getSelection()
        if (sel === null || sel.rangeCount === 0 || sel.anchorNode === null) { setMenu(null); return }
        if (rootRef.current?.contains(sel.anchorNode)) { setMenu(null); return }
        if (isEditable(sel.anchorNode)) { setMenu(null); return }
        const text = sel.toString().trim()
        if (text.length === 0) { setMenu(null); return }
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) { setMenu(null); return }
        const menuWidth = 168
        const menuHeight = 36
        const gap = 8
        const x = Math.min(Math.max(rect.left + rect.width / 2, menuWidth / 2 + 8), window.innerWidth - menuWidth / 2 - 8)
        let placement: 'top' | 'bottom' = 'top'
        let y = rect.top - gap
        if (y - menuHeight < 8) {
          placement = 'bottom'
          y = rect.bottom + gap
        }
        setMenu({ x, y, placement, text })
      }
      const hideMenu = (): void => setMenu(null)
      document.addEventListener('mouseup', update)
      document.addEventListener('selectionchange', update)
      document.addEventListener('scroll', hideMenu, true)
      return () => {
        document.removeEventListener('mouseup', update)
        document.removeEventListener('selectionchange', update)
        document.removeEventListener('scroll', hideMenu, true)
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
        setMenu(null)
        clearPageSelection()
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

    const ask = (text?: string): void => {
      const q = (text ?? query).trim()
      if (q.length === 0) { showToast('请输入或选中要追问的内容'); return }
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
      const joined = selectedItems.map(item => item.text).join('\n---\n')
      setQuery(joined)
      setSelectedIds(new Set())
      ask(joined)
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
      <div ref={rootRef} style={style.floating}>
        {menu !== null && (
          <div
            style={{ ...style.menu, left: menu.x, top: menu.y, transform: menu.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}
            onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
            onMouseUp={(event) => event.stopPropagation()}
          >
            <button style={{ ...style.menuButton, background: '#3b6ef0', color: '#ffffff' }} onClick={() => collect(menu.text)}>加入抽屉</button>
            <button style={{ ...style.menuButton, background: 'transparent', color: '#9aa4b8', border: '1px solid #3a4254' }} onClick={() => startAsk(menu.text)}>追问</button>
          </div>
        )}

        {open ? (
          <div style={style.panel}>
            {toast !== null && <div style={style.toast}>{toast}</div>}
            <div style={style.header}>
              <span>🗂 随手抽屉{items.length > 0 ? `（${items.length}）` : ''}</span>
              <button style={style.ghost} onClick={() => setOpen(false)}>收起</button>
            </div>

            <div style={style.section}>
              <div style={style.row}>
                <input
                  style={style.input}
                  value={query}
                  placeholder="输入追问内容，或选中正文后点「追问」…"
                  onChange={event => setQuery(event.target.value)}
                />
                <button style={style.primary} disabled={askState === 'pending'} onClick={() => ask()}>
                  {askState === 'pending' ? '…' : '问'}
                </button>
              </div>
              <label style={style.checkboxRow}>
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={event => setIncludeContext(event.target.checked)}
                />
                加入对话上下文（两种模式都不写入主会话）
              </label>
              {askState !== 'idle' && <div style={style.answer}>{answer}</div>}
            </div>

            <div style={style.tags}>
              {items.length === 0 ? (
                <div style={style.empty}>抽屉是空的，去正文里划选一段文字收藏吧</div>
              ) : (
                <>
                  <div style={style.selectionBar}>
                    <span style={style.selectionHint}>
                      {selectedItems.length > 0 ? `已选 ${selectedItems.length} 条` : '点选标签可单选 / 多选'}
                    </span>
                    <div style={style.row}>
                      <button style={style.ghost} onClick={toggleSelectAll}>{allSelected ? '清空' : '全选'}</button>
                      <button style={style.ghost} disabled={selectedItems.length === 0} onClick={askSelected}>追问选中</button>
                      <button style={style.danger} disabled={selectedItems.length === 0} onClick={deleteSelected}>删除选中</button>
                    </div>
                  </div>
                  {items.map(item => {
                    const selected = selectedIds.has(item.id)
                    return (
                      <div
                        key={item.id}
                        style={{ ...style.tag, ...(selected ? style.tagSelected : {}) }}
                        title={item.text}
                        onClick={() => toggleTag(item.id)}
                      >
                        <span style={style.tagText}>{item.text}</span>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        ) : (
          <button style={style.pill} onClick={() => setOpen(true)}>🗂 随手抽屉</button>
        )}
      </div>
    )
  }
}
