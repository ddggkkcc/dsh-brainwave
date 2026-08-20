/**
 * stash 命名空间的客户端 Remote 贡献（手写，与 typert-generator 生成的
 * typert.remote-client.js 同构）。客户端只能经 ctx.remote.$mount(贡献) 安装
 * 命名空间，且贡献强制 strict codec（src-json 会被 api-gateway 拒绝），
 * 因此外部插件必须自带 schema。schema 与 src/host/types.ts 一一对应，
 * 契约变更时两处同步（zod 对象默认剥掉未知键，增量字段向后兼容）。
 * @module @dsh-external/dsh-stash/client/remote
 */

import { z } from 'zod'
import type {
  RemoteResult,
  TypertRemoteContribution,
} from '@deepseek-ai/dsh-typert-protocol'
import type {
  AskRequest,
  AskResult,
  StashAskResult,
  StashItem,
  StashListResult,
  StashDeleteRequest,
  StashDeleteResult,
  StashSaveRequest,
  StashSaveResult,
} from '../host/types.js'

// —— wire schema（与 src/host/storage.ts、types.ts 同步维护）——

const stashItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  source: z.string().optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).readonly().refine(item => item.updatedAt >= item.createdAt)

const saveRequestSchema = z.object({
  text: z.string(),
  source: z.string().optional(),
}).readonly()

const deleteRequestSchema = z.object({ id: z.string() }).readonly()

const askRequestSchema = z.object({
  query: z.string(),
  includeContext: z.boolean(),
  sessionId: z.string().optional(),
}).readonly()

const askResultSchema = z.object({ answer: z.string() }).readonly()

const textBlankErrorSchema = z.object({
  code: z.literal('text-blank'),
  message: z.string(),
}).readonly()

const queryBlankErrorSchema = z.object({
  code: z.literal('query-blank'),
  message: z.string(),
}).readonly()

const llmErrorSchema = z.object({
  code: z.literal('llm-error'),
  message: z.string(),
}).readonly()

const storageErrorSchema = z.object({
  code: z.literal('storage-error'),
  message: z.string(),
}).readonly()

const listResultSchema = z.union([
  z.object({ ok: z.literal(true), value: z.array(stashItemSchema) }).readonly(),
  z.object({ ok: z.literal(false), error: storageErrorSchema }).readonly(),
])

const saveResultSchema = z.union([
  z.object({ ok: z.literal(true), value: stashItemSchema }).readonly(),
  z.object({ ok: z.literal(false), error: z.union([textBlankErrorSchema, storageErrorSchema]) }).readonly(),
])

const deleteResultSchema = z.union([
  z.object({ ok: z.literal(true), value: z.literal(null) }).readonly(),
  z.object({ ok: z.literal(false), error: storageErrorSchema }).readonly(),
])

const askResultEnvelopeSchema = z.union([
  z.object({ ok: z.literal(true), value: askResultSchema }).readonly(),
  z.object({ ok: z.literal(false), error: z.union([queryBlankErrorSchema, llmErrorSchema]) }).readonly(),
])

// —— 贡献（strict codec：参数与结果都经 schema 校验后过 wire）——

export const STASH_REMOTE: TypertRemoteContribution = Object.freeze({
  package: '@dsh-external/dsh-stash',
  descriptors: Object.freeze([
    {
      id: '@dsh-external/dsh-stash#stash/list',
      service: 'stash',
      namespace: 'stash',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: '@dsh-external/dsh-stash#StashListResult', schema: listResultSchema },
    },
    {
      id: '@dsh-external/dsh-stash#stash/save',
      service: 'stash',
      namespace: 'stash',
      method: 'save',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: '@dsh-external/dsh-stash#StashSaveRequest', schema: saveRequestSchema } },
      ],
      result: { mode: 'strict', typeSymbol: '@dsh-external/dsh-stash#StashSaveResult', schema: saveResultSchema },
    },
    {
      id: '@dsh-external/dsh-stash#stash/delete',
      service: 'stash',
      namespace: 'stash',
      method: 'delete',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: '@dsh-external/dsh-stash#StashDeleteRequest', schema: deleteRequestSchema } },
      ],
      result: { mode: 'strict', typeSymbol: '@dsh-external/dsh-stash#StashDeleteResult', schema: deleteResultSchema },
    },
    {
      id: '@dsh-external/dsh-stash#stash/ask',
      service: 'stash',
      namespace: 'stash',
      method: 'ask',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: '@dsh-external/dsh-stash#AskRequest', schema: askRequestSchema } },
      ],
      result: { mode: 'strict', typeSymbol: '@dsh-external/dsh-stash#StashAskResult', schema: askResultEnvelopeSchema },
    },
  ]),
})

// —— 客户端类型（与 typert-generator 生成的 remote-client d.ts 同构）——

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$dshStash {
    list: () => Promise<RemoteResult<StashListResult>>
    save: (request: StashSaveRequest) => Promise<RemoteResult<StashSaveResult>>
    delete: (request: StashDeleteRequest) => Promise<RemoteResult<StashDeleteResult>>
    ask: (request: AskRequest) => Promise<RemoteResult<StashAskResult>>
  }
  interface TypertRemoteMap {
    'stash/list': () => Promise<RemoteResult<StashListResult>>
    'stash/save': (request: StashSaveRequest) => Promise<RemoteResult<StashSaveResult>>
    'stash/delete': (request: StashDeleteRequest) => Promise<RemoteResult<StashDeleteResult>>
    'stash/ask': (request: AskRequest) => Promise<RemoteResult<StashAskResult>>
  }
  interface TypertRemoteNamespaceMap {
    stash: TypertRemoteNamespace$dshStash
  }
}
