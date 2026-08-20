/**
 * 运行时 peer 解析器（模块同一性铁律的工程化保障）。
 *
 * 背景：外部插件经 junction/symlink 链入运行中 app。若 ESM 沿 symlink 路径
 * 加载 @deepseek-ai/*（某些启动模式/加载器会保留 symlink URL），插件会拿到
 * 第二份模块实例——typert-protocol 的 @Remote 标记 WeakMap 是模块级私有状态，
 * 宿主 gateway 用的是真实路径那份实例，读不到插件写入的 marker，所有调用
 * 报 invocation-unavailable（客户端表现为“请求失败，请重试”）。
 *
 * 方案：用 createRequire(import.meta.url).resolve()（CJS 默认 realpath）解出
 * 运行中 app 的真实文件路径，再以绝对 file URL 动态 import。这样插件与宿主
 * gateway 解析到同一份文件、同一模块实例，marker 对账一致。
 *
 * @module @dsh-external/dsh-stash/runtime
 */

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

/** 解析到运行中 app 的真实路径并 import（绕过 symlink 路径的模块分身）。 */
function importRuntime<T>(specifier: string): Promise<T> {
  return import(pathToFileURL(require.resolve(specifier)).href) as Promise<T>
}

export const { Service } = await importRuntime<typeof import('@deepseek-ai/cordis')>('@deepseek-ai/cordis')
export const { Remote, TypertRemoteService } = await importRuntime<typeof import('@deepseek-ai/dsh-typert-protocol')>('@deepseek-ai/dsh-typert-protocol')
export const { defineDomain, domainTable } = await importRuntime<typeof import('@deepseek-ai/dsh-storage-domain')>('@deepseek-ai/dsh-storage-domain')
export const { createMessage } = await importRuntime<typeof import('@deepseek-ai/dsh-llm')>('@deepseek-ai/dsh-llm')
