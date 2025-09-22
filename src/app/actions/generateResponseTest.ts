'use server';

import { queryWatson } from "@/services/watsonService";


export async function generateResponse(prompt: string): Promise<string> {
  return await queryWatson(prompt);
}
