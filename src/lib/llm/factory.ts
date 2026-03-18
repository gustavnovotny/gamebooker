import type { LLMProvider } from './types'

export function getProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL

  if (!provider) throw new Error('LLM_PROVIDER environment variable is required')
  if (!apiKey) throw new Error('LLM_API_KEY environment variable is required')
  if (!model) throw new Error('LLM_MODEL environment variable is required')

  if (provider === 'anthropic') {
    const { AnthropicProvider } = require('./anthropic')
    return new AnthropicProvider(apiKey, model)
  }

  if (provider === 'openai') {
    const { OpenAIProvider } = require('./openai')
    return new OpenAIProvider(apiKey, model)
  }

  throw new Error(`Unknown LLM_PROVIDER: "${provider}". Use "anthropic" or "openai".`)
}
