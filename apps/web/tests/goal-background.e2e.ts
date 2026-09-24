import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { JobOutcome } from '@deepseek-ai/dsh-jobs'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'

const PROVIDER = 'goal-background-test'

class GoalAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'The work is complete.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

describe('web e2e: Goal waits for an owned Job', () => {
  let scaffold: WebScaffold | undefined

  afterEach(async () => {
    await scaffold?.close()
    scaffold = undefined
  })

  it('admits the next durable round after the real JobRegistry settles', async () => {
    scaffold = await launchWebScaffold()
    const ctx = scaffold.ctx
    const adapter = new GoalAdapter()
    ctx.effect(() => ctx.llm.registerAdapter([PROVIDER], adapter))
    const handle = await ctx.agents.create({
      sessionId: SessionId('goal-background-web-e2e'),
      meta: { cwd: scaffold.workspaceCwd },
      agentOptions: { provider: PROVIDER, model: 'scripted' },
      setup: agentCtx => ctx.agentPresets.mount(agentCtx).then(() => undefined),
    })
    const done = Promise.withResolvers<JobOutcome>()
    try {
      const agent = handle.agent
      const jobId = ctx.jobs.start({
        kind: 'bash',
        label: 'held work for Goal',
        owner: agent.id,
        run: () => ({ cancel: () => { done.resolve({ status: 'killed' }) }, done: done.promise }),
      })
      ctx.goals.create(agent, { objective: 'Finish after the owned Job', maxGoalRounds: 1 })
      await ctx.sessions.flush(agent.session)
      expect(ctx.jobs.get(jobId, agent.id).status).toBe('running')
      expect(agent.session.snapshotEvents().filter(event =>
        event.type === 'user/message' && event.data.source.kind === 'goal' && event.data.source.round > 0)).toEqual([])
      expect(ctx.goals.get(agent)).toMatchObject({ phase: 'active', roundsStarted: 0 })

      done.resolve({ status: 'completed' })
      await vi.waitFor(() => {
        expect(ctx.jobs.get(jobId, agent.id).status).toBe('completed')
        expect(ctx.goals.get(agent)?.roundsStarted).toBe(1)
      }, { timeout: 20_000 })
      expect(agent.session.snapshotEvents().filter(event =>
        event.type === 'user/message' && event.data.source.kind === 'goal' && event.data.source.round === 1)).toHaveLength(1)
      expect(adapter.requests.some(request => request.messages.some(message =>
        message.content.some(block => block.type === 'text' && block.text.includes('Finish after the owned Job'))))).toBe(true)
    } finally {
      done.resolve({ status: 'killed' })
      await handle.dispose()
    }
  }, 120_000)
})
