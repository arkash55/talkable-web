// src/app/services/ibmService.ts
/**
 * Mock IBM API service for generating responses
 */
export async function getIBMResponses(transcript: string): Promise<string[]> {
  console.log('Sent to IBM API:', transcript);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // Return 6 mock responses
  return [
    `I understand you said: "${transcript}". Tell me more about that.`,
    `Based on "${transcript}", I think you're interested in exploring this topic further.`,
    `Let me respond to "${transcript}" with some additional information.`,
    `I'd like to understand more about what you meant by "${transcript}".`,
    `That's an interesting point about "${transcript}". Let's discuss it further.`,
    `"${transcript}" is something I can help with. What specific details do you need?`,
  ];
}
