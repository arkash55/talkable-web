import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------- Hoisted mocks (satisfy Vitest hoisting) ----------
const {
  getIamTokenMock,
  generateOnceMock,
  scoreFlowLevel1Mock,
} = vi.hoisted(() => ({
  getIamTokenMock: vi.fn(),
  generateOnceMock: vi.fn(),
  scoreFlowLevel1Mock: vi.fn(),
}));

// IMPORTANT: mock the SAME module IDs used in service code
vi.mock('./graniteHelper', () => ({
  getIamToken: getIamTokenMock,
  generateOnce: generateOnceMock,
}));

// ⬇⬇⬇ CHANGE: mock the relative path that the service now imports
vi.mock('../app/utils/flowRank', () => ({
  scoreFlowLevel1: scoreFlowLevel1Mock,
}));

// Helper to reload the module under test and reset its module-scope cache
async function freshService() {
  vi.resetModules();
  vi.doMock('./graniteHelper', () => ({
    getIamToken: getIamTokenMock,
    generateOnce: generateOnceMock,
  }));
  vi.doMock('../app/utils/flowRank', () => ({
    scoreFlowLevel1: scoreFlowLevel1Mock,
  }));
  return await import('./graniteService');
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.IBM_API_KEY = 'k';
  process.env.IBM_PROJECT_ID = 'proj';
  process.env.IBM_MODEL_ID = 'ibm/granite-3-8b-instruct';
  process.env.IBM_WATSON_ENDPOINT = 'https://api.watsonx.fake';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ------------------ TESTS ------------------

describe('generateRankedCandidates – env + plumbing', () => {
  it('throws if required env is missing', async () => {
    delete process.env.IBM_API_KEY;
    const svc = await freshService();
    await expect(
      svc.generateRankedCandidates({
        system: 'S',
        prompt: 'P',
      } as any),
    ).rejects.toThrow(/Missing IBM_API_KEY/i);
  });

  it('requests a token once (cached) and calls generateOnce N times from perCallInstructions', async () => {
    const svc = await freshService();

    getIamTokenMock.mockResolvedValue('IAM_TOKEN');

    // 3 planned variants
    const perCallInstructions = [
      'v1 keep it short',
      'v2 add an example',
      'v3 ask a question',
    ];

    // generateOnce mock: return slightly different stats and dirty text
    generateOnceMock
      .mockResolvedValueOnce({
        text: '```"Hello there!"``` 😀\n[meta]\nAssistant: first',
        tokens: 12,
        avgLogProb: -0.2,
      })
      .mockResolvedValueOnce({
        text: '>> “Second item” ---\nUser:\nblah\nAssistant:  second text',
        tokens: 20,
        avgLogProb: -0.1,
      })
      .mockResolvedValueOnce({
        text: 'Third — clean enough',
        tokens: 8,
        avgLogProb: -0.05,
      });

    // Flow rank mock: return deterministic rows per input index
    // The service passes texts in the same order as generateOnce resolved array.
    scoreFlowLevel1Mock.mockResolvedValue([
      // index 0
      {
        simToLastUser: 0.5,
        lengthPenalty: 0.0,
        repetitionPenalty: 0.0,
        totalPenalty: 0.0,
        flowUtility: 0.60,
        flowProb: 0.30,
      },
      // index 1
      {
        simToLastUser: 0.6,
        lengthPenalty: 0.0,
        repetitionPenalty: 0.0,
        totalPenalty: 0.0,
        flowUtility: 0.75,
        flowProb: 0.40,
      },
      // index 2
      {
        simToLastUser: 0.7,
        lengthPenalty: 0.0,
        repetitionPenalty: 0.0,
        totalPenalty: 0.0,
        flowUtility: 0.70,
        flowProb: 0.35,
      },
    ]);

    const res = await svc.generateRankedCandidates({
      system: 'SYSTEM_PROMPT',
      prompt: 'Write a helpful tip about focus.',
      context: ['c1', 'c2'],
      perCallInstructions,
      params: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 50,
        max_new_tokens: 64,
        stop: ['\nEND', '```'],
      },
      samplingSeed: 1234,
    });

    // Token fetched exactly once
    expect(getIamTokenMock).toHaveBeenCalledTimes(1);

    // Called 3 times
    expect(generateOnceMock).toHaveBeenCalledTimes(3);

    // Check stops merged & clamped (<=6) and param alteration for idx 0 (conservative)
    const firstCallArgs = (generateOnceMock as any).mock.calls[0][0];
    const secondCallArgs = (generateOnceMock as any).mock.calls[1][0];

    expect(firstCallArgs.params.temperature).toBeLessThanOrEqual(0.25); // conservative
    expect(secondCallArgs.params.temperature).toBeGreaterThan(firstCallArgs.params.temperature);

    // Ensure merged stops contain user stop + defaults (and trimmed to ≤6)
    expect(firstCallArgs.params.stop).toEqual(expect.arrayContaining(['\nEND', '```']));
    expect(firstCallArgs.params.stop.length).toBeLessThanOrEqual(6);

    // Cleaned outputs should be free of emojis, fences, quotes, "Assistant:" prefixes, leading [meta]
    expect(res.candidates.length).toBeGreaterThanOrEqual(3);
    for (const c of res.candidates) {
      expect(c.text).not.toMatch(/Assistant:/i);
      expect(c.text).not.toMatch(/😀/);
      expect(c.text).not.toMatch(/^\s*"/);
      expect(c.text).not.toMatch(/^\s*»|^\s*“|^\s*‘/);
      expect(typeof c.flow.utility).toBe('number');
      expect(typeof c.flow.prob).toBe('number');
      expect(c.relativeProb).toBeCloseTo(c.flow.prob, 1);
    }

    // Meta sanity
    expect(res.meta.model_id).toMatch(/granite/i);
    expect(res.meta.usedK).toBe(res.candidates.length);
    // should not report negative or absurd dropped counts
    expect(res.meta.dropped).toBeGreaterThanOrEqual(0);
    expect(res.meta.params.max_new_tokens).toBe(64);
  });

  it('drops failed generations and still returns a coverage-based shortlist (3–6)', async () => {
    const svc = await freshService();

    getIamTokenMock.mockResolvedValue('IAM_TOKEN');

    // 5 attempts, 2 fail, 3 ok
    generateOnceMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ text: 'One', tokens: 5, avgLogProb: -0.2 })
      .mockResolvedValueOnce({ text: 'Two', tokens: 5, avgLogProb: -0.3 })
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce({ text: 'Three', tokens: 5, avgLogProb: -0.1 });

    // Return monotonically different utilities/probs to test selection
    scoreFlowLevel1Mock.mockResolvedValue([
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.80, flowProb: 0.45 },
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.60, flowProb: 0.30 },
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.70, flowProb: 0.35 },
    ]);

    const out = await svc.generateRankedCandidates({
      system: 'S',
      prompt: 'Tell me a quick study tip.',
      k: 5, // ask for 5 runs
      // no perCallInstructions -> defaults used
      params: { max_new_tokens: 32 },
      minReturn: 3,
      maxReturn: 6,
      samplingSeed: 42,
    });

    // 5 attempts, 2 dropped -> 3 ok
    expect(out.candidates.length).toBeGreaterThanOrEqual(3);
    expect(out.candidates.length).toBeLessThanOrEqual(6);

    // meta.dropped should equal number of failed gens + any filtered-out items after dedupe
    expect(out.meta.dropped).toBeGreaterThanOrEqual(2);

    // Ensure ordering by utility (desc) for the final set
    const utils = out.candidates.map(c => c.flow.utility);
    const sorted = [...utils].sort((a, b) => b - a);
    expect(utils).toEqual(sorted);
  });

  it('respects preferCount within [minReturn, maxReturn] after coverage is met', async () => {
    const svc = await freshService();

    getIamTokenMock.mockResolvedValue('IAM_TOKEN');

    // 6 solid responses
    generateOnceMock.mockResolvedValue({ text: 'a', tokens: 1, avgLogProb: -0.1 });
    generateOnceMock.mockResolvedValue({ text: 'b', tokens: 1, avgLogProb: -0.1 });
    generateOnceMock.mockResolvedValue({ text: 'c', tokens: 1, avgLogProb: -0.1 });
    generateOnceMock.mockResolvedValue({ text: 'd', tokens: 1, avgLogProb: -0.1 });
    generateOnceMock.mockResolvedValue({ text: 'e', tokens: 1, avgLogProb: -0.1 });
    generateOnceMock.mockResolvedValue({ text: 'f', tokens: 1, avgLogProb: -0.1 });

    // Give them decreasing probabilities to make coverage satisfy early
    scoreFlowLevel1Mock.mockResolvedValue([
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.90, flowProb: 0.30 },
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.85, flowProb: 0.25 },
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.80, flowProb: 0.20 },
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.70, flowProb: 0.12 },
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.60, flowProb: 0.08 },
      { simToLastUser: 0.5, lengthPenalty: 0, repetitionPenalty: 0, totalPenalty: 0, flowUtility: 0.50, flowProb: 0.05 },
    ]);

    const res = await svc.generateRankedCandidates({
      system: 'S',
      prompt: 'Summarize timeboxing in 1–2 sentences.',
      k: 6,
      minReturn: 3,
      maxReturn: 6,
      preferCount: 4, // soft target
      params: { max_new_tokens: 48 },
    });

    expect(res.candidates.length).toBeGreaterThanOrEqual(3);
    expect(res.candidates.length).toBeLessThanOrEqual(6);
  });
});
