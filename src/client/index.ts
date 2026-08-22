/**
 * 随手抽屉（Stash）客户端半身：挂载 stash Remote 贡献 + shell.overlay 浮窗。
 * 构建：npm run build:client（tsdown → lib/client.js，ModuleLoader.load 注册）。
 * 铁律（super-injector 实测）：① 用 ctx.slots 必须 export const inject 含 'slots'；
 * ② register 必须带 name 字段（= slot 名 'shell.overlay'）。
 * ③ 外层 fiber 声明 'slots' 仅为满足注入器骨架校验（不会在 apply 中直接使用），
 *    UI 子 fiber 仍声明 'remote.stash' + 'slots'（声明 'remote.stash' 的同 fiber
 *    不得同时自挂载，否则死锁）。
 *
 * 双 fiber 结构（官方 message-feedback 同款）：
 * - 命名空间只能经 `ctx.remote.$mount(贡献)` 安装，安装后才在根 scope 提供
 *   `remote.stash` 服务；而访问 `ctx.remote.stash` 属性必须在本 fiber 的 inject
 *   里声明该服务（否则 cordis 抛 "cannot get property ... without inject"），
 *   同 fiber 既自挂载又声明 = 死锁（挂载在 apply 里，apply 要等服务）。
 * - 因此外层 fiber 只挂载（inject: ['remote']），UI 放进 `ctx.inject` 子 fiber
 *   （声明 'remote.stash' + 'slots'），挂载完成前它会等待，完成后自动运行。
 * @module @dsh-external/dsh-stash/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { STASH_REMOTE } from './remote.js'
import { createConversationScope } from './selectionScope.js'
import { createConversationProbe, createStashOverlay } from './StashOverlay.js'

/** 外层 fiber：只负责挂载贡献；额外声明 'slots' 仅为过注入器骨架校验（不在本 fiber 使用）。 */
export const inject = ['remote', 'slots']

export async function apply(ctx: ClientContext): Promise<void> {
  // 1. 挂载 stash 命名空间（贡献校验通过后，根 scope 提供 remote.stash 服务）
  const unmount = await ctx.remote.$mount(STASH_REMOTE)
  ctx.effect(() => unmount, 'dsh-stash: remote.stash mount')

  // 2. 选区归属作用域（§2.3 L1）：探针注册表由浮窗与探针两个组件树共享
  const scope = createConversationScope()

  ctx.inject(['remote.stash', 'slots'], (ui) => {
    ui.effect(() => ui.slots.inject('shell.overlay', () => {
      const dispose = ui.slots.register({
        name: 'shell.overlay',
        id: 'stash',
        order: 100,
        label: '随手抽屉',
      }, createStashOverlay(ui.remote.stash, scope))
      return () => {
        dispose()
      }
    }), 'dsh-stash: shell.overlay')

    // 3. 哨兵探针（§2.3 L1 容器归属）：挂进 conversation.chat.node（keyed，每条消息一个）。
    //    槽位名失效/注册抛错不阻塞浮窗——归属判定自动走降级阶梯，仅 warn 一次（NFR-5）。
    ui.effect(() => {
      try {
        return ui.slots.inject('conversation.chat.node', () => {
          const dispose = ui.slots.register({
            name: 'conversation.chat.node',
            id: 'stash-probe',
            order: 100,
          }, createConversationProbe(scope))
          return () => {
            dispose()
          }
        })
      } catch (error) {
        console.warn('[dsh-stash] conversation.chat.node 槽位不可用，选区归属判定降级为启发式:', error)
        return () => {}
      }
    }, 'dsh-stash: conversation probe')
  })
}
