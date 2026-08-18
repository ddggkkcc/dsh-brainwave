# 数据模型

> 抽屉持久化的数据定义。宿主侧负责 schema 校验与落盘。

---

## 存储方案

- **主方案**：`@deepseek-ai/dsh-storage-domain`（`defineDomain` + `domainTable`），zod schema 校验落盘，官方 `message-feedback` 同款，适合「生命周期绑定 / 持久」的数据。
- **备选**：`storage`（`dsh-storage-json`）JSON 服务，实现更简单，适合纯 MVP 快速验证。

> 决策：MVP 先用哪种，见 [`docs/issues/open-questions.md`](../issues/open-questions.md)。

---

## 抽屉条目 Schema（zod）

```ts
import { z } from "zod";

const stashItemSchema = z.object({
  id: z.uuid(),
  text: z.string().min(1),             // 收藏内容，非空
  source: z.string().optional(),       // 来源会话 id 或备注
  tags: z.array(z.string()).optional(),// 二期
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).refine((it) => it.updatedAt >= it.createdAt);
```

## 表 / 域声明

```ts
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";

const stashDomainSpec = defineDomain({
  name: "stash",
  version: 0,
  tables: {
    items: domainTable(z.array(stashItemSchema)),
  },
});
```

---

## 语义约束

- `id`：全局唯一（uuid），不依赖会话。
- `text`：只存原文，不自动截断（MVP）；超长可二期加上限。
- 条目与「来源会话」是弱关联（`source` 只存 id 文本，不强制外键）——抽屉是**跨会话的全局抽屉**。
- 删除即物理删除（MVP）；二期可考虑软删/归档。

---

## 版本与迁移

| 版本 | 变更 | 迁移 |
|---|---|---|
| 0 | 初版 `items` 表（id/text/source/tags/createdAt/updatedAt） | — |
| 1（二期） | 增加 `tags` 索引、按会话归档、软删除标志 | 待定 |

> 原则：schema 只增字段（向后兼容），破坏性变更升 version 并提供迁移。
