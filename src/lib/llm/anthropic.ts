import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, LLMOptions, Message } from './types'

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async chat(messages: Message[], options: LLMOptions = {}): Promise<string> {
    const systemMessage = messages.find((m) => m.role === 'system')
    const userMessages = messages.filter((m) => m.role !== 'system')

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      system: systemMessage?.content,
      messages: userMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  }

  async *stream(messages: Message[], options: LLMOptions = {}): AsyncGenerator<string> {
    const systemMessage = messages.find((m) => m.role === 'system')
    const userMessages = messages.filter((m) => m.role !== 'system')

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      system: systemMessage?.content,
      messages: userMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text
      }
    }
  }
}
