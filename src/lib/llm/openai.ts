import OpenAI from 'openai'
import type { LLMProvider, LLMOptions, Message } from './types'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async chat(messages: Message[], options: LLMOptions = {}): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    return response.choices[0]?.message.content ?? ''
  }

  async *stream(messages: Message[], options: LLMOptions = {}): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    })

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta.content
      if (text) yield text
    }
  }
}
