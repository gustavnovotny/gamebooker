// Mock the provider modules so we don't need real API keys
jest.mock('./anthropic', () => ({
  AnthropicProvider: jest.fn().mockImplementation(() => ({ type: 'anthropic' })),
}))
jest.mock('./openai', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({ type: 'openai' })),
}))

describe('getProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.resetModules()
  })

  it('returns AnthropicProvider when LLM_PROVIDER=anthropic', () => {
    process.env.LLM_PROVIDER = 'anthropic'
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_MODEL = 'claude-sonnet-4-6'
    const { getProvider } = require('./factory')
    const provider = getProvider()
    expect(provider.type).toBe('anthropic')
  })

  it('returns OpenAIProvider when LLM_PROVIDER=openai', () => {
    process.env.LLM_PROVIDER = 'openai'
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_MODEL = 'gpt-4o'
    const { getProvider } = require('./factory')
    const provider = getProvider()
    expect(provider.type).toBe('openai')
  })

  it('throws when LLM_PROVIDER is missing', () => {
    delete process.env.LLM_PROVIDER
    const { getProvider } = require('./factory')
    expect(() => getProvider()).toThrow(/LLM_PROVIDER/)
  })
})
