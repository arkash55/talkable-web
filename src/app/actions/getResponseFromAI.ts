'use server';

import { generateAIResponses } from "@/services/watsonService";
import { Message } from "../types/types";




export async function getResponsesFromAI(conversation: Message[]) {
  const responses = await generateAIResponses(conversation);
  return responses;
}
