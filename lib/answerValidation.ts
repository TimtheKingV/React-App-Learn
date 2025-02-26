import { processWithMathpix } from './mathpix';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface ValidationResult {
  isCorrect: boolean;
  feedback: string;
  mistakes?: string[];
  tips?: string[];
}

const VALIDATION_PROMPT = `Compare the student's answer with the correct solution and provide detailed feedback. Consider mathematical equivalence, not just exact matches.

CRITICAL RULES:
1. Compare the mathematical meaning, not just the syntax
2. Consider different but valid solution approaches
3. If incorrect:
   - Identify specific mistakes
   - Provide constructive feedback
   - Give personalized tips for improvement
4. If correct:
   - Validate the approach used
   - Mention any particularly good aspects
   - Suggest potential optimizations if applicable

Format your response EXACTLY as follows:

{
  "isCorrect": true/false,
  "feedback": "Overall assessment of the answer",
  "mistakes": [
    "List specific mistakes if any"
  ],
  "tips": [
    "Constructive suggestions for improvement"
  ]
}`;

export async function validateAnswer(
  imageUrl: string,
  exerciseQuestion: string,
  correctSolution: string,
  userId: string
): Promise<ValidationResult> {
  try {
    // First, process the image with Mathpix to get the mathematical content
    const mathpixResult = await processWithMathpix(imageUrl, userId, `answer_${Date.now()}.jpg`);
    
    if (!mathpixResult.mmd) {
      throw new Error('Failed to extract mathematical content from the image');
    }

    // Prepare the context for OpenAI
    const context = `
Exercise Question:
${exerciseQuestion}

Correct Solution:
${correctSolution}

Student's Answer (extracted from image):
${mathpixResult.mmd}
    `.trim();

    // Validate the answer using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a precise mathematics tutor evaluating student answers. Focus on understanding and mathematical correctness, not just exact matches. Provide constructive feedback and specific suggestions for improvement."
        },
        {
          role: "user",
          content: `${VALIDATION_PROMPT}\n\nContext to evaluate:\n${context}`
        }
      ],
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('No validation response generated');
    }

    const result = JSON.parse(response.choices[0].message.content);
    console.log('Validation result:', result);

    return result as ValidationResult;
  } catch (error) {
    console.error('Error validating answer:', error);
    throw error;
  }
}