/**
 * `stash` remote 命名空间的 wire 类型（契约：docs/spec/api-contract.md §1）。
 * 本插件为外部插件，没有 typert-generator 生成的 face 文件；信封契约由本文件
 * 手工维护，与 src/client/remote.ts 的 wire schema 一一对应——任何签名变化
 * 先改契约文档，再同步这两处。
 * @module @dsh-external/dsh-stash/types
 */

import type { StashItem } from './storage.js'

export type { StashItem }

/** 保存请求。 */
export interface StashSaveRequest {
  /** 收藏文本，trim 后非空。 */
  readonly text: string
  /** 来源：会话 id / 'selection' / 备注（MVP 客户端传 'selection'）。 */
  readonly source?: string
}

/** 删除请求（幂等）。 */
export interface StashDeleteRequest {
  readonly id: string
}

/** 追问请求（MVP 一次性问答；两种模式都不写入主会话，见 ADR-008）。 */
export interface AskRequest {
  /** 组装好的追问文本（选中内容 + 可选自定义问题），非空。 */
  readonly query: string
  /** 是否加入当前对话上下文。 */
  readonly includeContext: boolean
  /** 当前页面对应会话；未提供时由宿主选择最近的活动会话。 */
  readonly sessionId?: string
}

/** 追问结果（MVP 一次性返回；二期可改流式）。 */
export interface AskResult {
  readonly answer: string
}

/** 统一信封：成功分支。 */
export interface StashSuccess<T> {
  readonly ok: true
  readonly value: T
}

/** 统一信封：失败分支（错误码见 api-contract.md §4）。 */
export interface StashRejected<E extends StashFailure> {
  readonly ok: false
  readonly error: E
}

/** 业务失败（message 面向客户端展示）。 */
export type StashFailure = StashTextBlank | StashQueryBlank | StashLlmError | StashStorageError

export interface StashTextBlank { readonly code: 'text-blank'; readonly message: string }
export interface StashQueryBlank { readonly code: 'query-blank'; readonly message: string }
export interface StashLlmError { readonly code: 'llm-error'; readonly message: string }
export interface StashStorageError { readonly code: 'storage-error'; readonly message: string }

export type StashListResult = StashSuccess<readonly StashItem[]> | StashRejected<StashStorageError>
export type StashSaveResult = StashSuccess<StashItem> | StashRejected<StashTextBlank | StashStorageError>
export type StashDeleteResult = StashSuccess<null> | StashRejected<StashStorageError>
export type StashAskResult = StashSuccess<AskResult> | StashRejected<StashQueryBlank | StashLlmError>
