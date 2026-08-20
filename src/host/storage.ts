/**
 * 抽屉持久化：storage-domain 域声明与 zod schema（契约：docs/spec/data-model.md）。
 * @module @dsh-external/dsh-stash/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable } from './runtime.js'

/** 抽屉条目 schema（落盘校验；二期加 tags 属增量字段）。 */
export const stashItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  source: z.string().optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).readonly().refine(item => item.updatedAt >= item.createdAt)

export type StashItem = z.output<typeof stashItemSchema>

/** 抽屉域：全局单表 items，全局抽屉用固定 key 单行数组。 */
export const stashDomainSpec = defineDomain({
  name: 'stash',
  version: 0,
  tables: {
    items: domainTable(z.array(stashItemSchema)),
  },
})

/** 全局抽屉行的固定 key（跨会话全局抽屉，见 data-model.md 语义约束）。 */
export const DRAWER_KEY = 'drawer'
