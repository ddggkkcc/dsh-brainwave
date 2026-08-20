/**
 * 随手抽屉（Stash）宿主半身：全局抽屉 remote 命名空间 `stash`。
 * 条目经 storage-domain 持久化（list/save/delete）；ask 在 M1 接入
 * ctx.llm 与模型路由（roadmap R3）前返回占位答案。
 * 铁律：资源注册挂 ctx.effect；peerDependencies 范围声明。
 * @module @dsh-external/dsh-stash
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { GenerateOptions, Message, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import { createMessage, Remote, Service, TypertRemoteService } from './runtime.js'
import { DRAWER_KEY, stashDomainSpec } from './storage.js'
import type { StashItem } from './storage.js'
import { appendStashItem, normalizeStashText, removeStashItem } from './operations.js'
import type {
  AskRequest,
  StashAskResult,
  StashFailure,
  StashListResult,
  StashRejected,
  StashDeleteRequest,
  StashDeleteResult,
  StashSaveRequest,
  StashSaveResult,
  StashSuccess,
} from './types.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    stash: StashService
  }
}

/** 冰冻成功信封。 */
function success<T>(value: T): StashSuccess<T> {
  return Object.freeze({ ok: true, value })
}

/** 冰冻失败信封。 */
function rejected<E extends StashFailure>(error: E): StashRejected<E> {
  return Object.freeze({ ok: false, error: Object.freeze(error) })
}

/** 全局抽屉 remote 服务。 */
const MAX_CONTEXT_MESSAGES = 24
const MAX_CONTEXT_CHARS = 24000

type RouteLike = Pick<GenerateOptions, 'provider' | 'model' | 'reasoningEffort' | 'temperature' | 'maxTokens' | 'stop'>

type SessionLike = {
  requestHeader(): { config: RouteLike; system?: string; tools?: GenerateOptions['tools'] } | undefined
  deriveMessages(): readonly Message[]
}

type SessionsLike = {
  get(id: string): SessionLike | undefined
  list(): SessionLike[]
}

type DefaultModelLike = {
  currentSelection(): RouteLike
}

type LlmLike = {
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>
}

export class StashService extends TypertRemoteService {
  static inject = ['storageDomain', 'llm']

  private table?: KvTable<string, StashItem[]>
  /** Serialize the first-key materialization path as well as updates. */
  private writeChain: Promise<void> = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'stash')
  }

  /** 打开并持有抽屉域；随插件卸载关闭。 */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(stashDomainSpec)
    this.ctx.effect(() => async () => {
      await domain.close()
    }, 'dsh-stash.domainClose')
    this.table = domain.table('items')
  }

  /** 读整个抽屉；排在待完成写入之后，避免返回过期快照。 */
  @Remote('list')
  async list(): Promise<StashListResult> {
    try {
      return await this.enqueueWrite(() => success(this.requireTable().get(DRAWER_KEY) ?? []))
    } catch (error) {
      this.ctx.logger.warn('dsh-stash: list failed: %s', String(error))
      return rejected({ code: 'storage-error', message: '抽屉读取失败' })
    }
  }

  /** 收藏一条文本：text 非空；追加到全局抽屉（单行数组）。 */
  @Remote('save')
  async save(request: StashSaveRequest): Promise<StashSaveResult> {
    const text = normalizeStashText(request.text)
    if (text === undefined) {
      return rejected({ code: 'text-blank', message: '收藏内容不能为空' })
    }
    const now = Date.now()
    const item: StashItem = {
      id: randomUUID(),
      text,
      ...(request.source === undefined ? {} : { source: request.source }),
      createdAt: now,
      updatedAt: now,
    }
    try {
      await this.enqueueWrite(async () => {
        const table = this.requireTable()
        const current = table.get(DRAWER_KEY)
        if (current === undefined) await table.put(DRAWER_KEY, appendStashItem(undefined, item))
        else await table.update(DRAWER_KEY, items => appendStashItem(items, item))
      })
      return success(item)
    } catch (error) {
      this.ctx.logger.warn('dsh-stash: save failed: %s', String(error))
      return rejected({ code: 'storage-error', message: '抽屉保存失败' })
    }
  }

  /** 删除一条：幂等（不存在也成功）。 */
  @Remote('delete')
  async delete(request: StashDeleteRequest): Promise<StashDeleteResult> {
    try {
      await this.enqueueWrite(async () => {
        const table = this.requireTable()
        const current = table.get(DRAWER_KEY)
        if (current === undefined || !current.some(item => item.id === request.id)) return
        const next = removeStashItem(current, request.id)
        if (next === undefined) await table.delete(DRAWER_KEY)
        else await table.put(DRAWER_KEY, next)
      })
      return success(null)
    } catch (error) {
      this.ctx.logger.warn('dsh-stash: delete failed: %s', String(error))
      return rejected({ code: 'storage-error', message: '抽屉删除失败' })
    }
  }

  /**
   * 单轮临时追问：调用当前会话路由（没有会话时使用默认路由），
   * 不向主会话追加任何事件；includeContext=true 时只读取会话的派生消息。
   */
  @Remote('ask')
  async ask(request: AskRequest): Promise<StashAskResult> {
    const query = request.query.trim()
    if (query.length === 0) {
      return rejected({ code: 'query-blank', message: '请输入或选中要追问的内容' })
    }
    try {
      const session = request.includeContext ? this.resolveSession(request.sessionId) : undefined
      const header = session?.requestHeader()
      const defaultModel = this.ctx.get('agentDefaultModel') as DefaultModelLike | undefined
      const route = header?.config ?? defaultModel?.currentSelection()
      const llm = this.ctx.get('llm') as LlmLike | undefined
      if (route === undefined || llm === undefined) {
        return rejected({ code: 'llm-error', message: '当前没有可用的模型配置' })
      }

      const context = request.includeContext && session !== undefined
        ? this.contextMessages(session.deriveMessages(), route.provider, route.model)
        : []
      const user = createMessage({
        role: 'user',
        content: [{ type: 'text', text: query }],
        source: { kind: 'user' },
      })
      const options: GenerateOptions = {
        ...route,
        messages: [...context, user],
        ...(header?.system === undefined ? {} : { system: header.system }),
        ...(header?.tools === undefined ? {} : { tools: header.tools }),
      }
      let answer = ''
      for await (const chunk of llm.stream(options)) {
        if (chunk.type === 'text-delta') answer += chunk.text
        if (chunk.type === 'finish' && chunk.reason.kind === 'error') {
          return rejected({ code: 'llm-error', message: chunk.reason.failure.message })
        }
        if (chunk.type === 'finish' && chunk.reason.kind === 'aborted') {
          return rejected({ code: 'llm-error', message: chunk.reason.failure.message })
        }
      }
      if (answer.trim().length === 0) {
        return rejected({ code: 'llm-error', message: '模型没有返回可显示的答案' })
      }
      return success({ answer })
    } catch (error) {
      this.ctx.logger.warn('dsh-stash: ask failed: %s', String(error))
      return rejected({ code: 'llm-error', message: this.errorMessage(error) })
    }
  }

  private resolveSession(id: string | undefined): SessionLike | undefined {
    const sessions = this.ctx.get('sessions') as SessionsLike | undefined
    if (sessions === undefined) return undefined
    if (id !== undefined) return sessions.get(id)
    const live = sessions.list()
    return live.length === 0 ? undefined : live[live.length - 1]
  }

  private contextMessages(messages: readonly Message[], provider: string, model: string): Message[] {
    const selected = messages.slice(-MAX_CONTEXT_MESSAGES)
    const result: Message[] = []
    let chars = 0
    for (const message of selected) {
      const text = message.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text)
        .join('\\n')
        .trim()
      if (text.length === 0) continue
      if (chars + text.length > MAX_CONTEXT_CHARS) break
      chars += text.length
      result.push(createMessage({
        role: message.role,
        content: [{ type: 'text', text }],
        source: message.role === 'assistant'
          ? { kind: 'model', provider, model }
          : { kind: 'user' },
      }))
    }
    return result
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error && error.message.length > 0 ? error.message : '模型调用失败，请稍后重试'
  }

  /**
   * Serialize operations that may materialize or replace the drawer row.
   * storage-domain.update is atomic for existing keys, but the initial put
   * still needs the same queue to avoid two first writes overwriting each other.
   */
  private enqueueWrite<T>(operation: () => T | PromiseLike<T>): Promise<T> {
    const result = this.writeChain.then(operation, operation)
    this.writeChain = result.then(() => undefined, () => undefined)
    return result
  }

  /** 解析已初始化的表句柄，否则说明生命周期损坏。 */
  private requireTable(): KvTable<string, StashItem[]> {
    if (this.table === undefined) {
      throw new Error('dsh-stash: durable domain is not initialized')
    }
    return this.table
  }
}

export default StashService
