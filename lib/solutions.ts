import { db } from './firebase';
import { collection, doc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface SolutionStep {
  number: number;
  description: string;
  explanation: string;
  math?: string;
}

export interface ExerciseSolution {
  exerciseId: string;
  subExerciseId: string;
  steps: SolutionStep[];
  hints: string[];
  finalAnswer: string;
  createdAt: string;
  updatedAt: string;
}

const SOLUTION_PROMPT = `Generate a detailed solution with steps and hints for the following math exercise. The exercise content is in mmd format (similar to LaTeX).

CRITICAL RULES:
1. Keep ALL math expressions in KaTeX format using $$ for display math and $ for inline math
2. Provide 2-5 clear, logical steps
3. Each step should:
   - Have a clear purpose
   - Build on previous steps
   - Include relevant calculations
4. Hints should:
   - Guide without revealing the solution
   - Focus on key concepts or approaches
   - Maximum of 2 hints per exercise
5. Preserve ALL mathematical notation exactly as given
6. Ensure final answer matches the exercise format
7. Check your answer for possbile mistakes
8. Always use the the same language as giving in the excercise. Also in your hints and solution steps. 

Format your response EXACTLY as follows:

{
  "steps": [
    {
      "number": 1,
      "description": "Brief description of the step",
      "explanation": "Detailed explanation of what we're doing",
      "math": "Mathematical work in KaTeX format"
    }
  ],
  "hints": [
    "First hint that guides without revealing the solution",
    "Second hint if needed"
  ],
  "finalAnswer": "The complete final answer in KaTeX format"
}`;

export async function generateSolution(exerciseContent: string): Promise<ExerciseSolution | null> {
  try {
    console.log('Generating solution for:', exerciseContent);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a precise mathematics tutor. Your solutions should be clear, step-by-step, and mathematically accurate. Structure your response with steps, hints, and a final answer. ALWAYS preserve mathematical notation exactly as given and use proper KaTeX formatting with $$ for display math and $ for inline math. Give your answer as json so it can be displayed in an application properly"
        },
        {
          role: "user",
          content: `${SOLUTION_PROMPT}\n\nExercise to solve:\n${exerciseContent}`
        }
      ],
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('No solution generated');
    }

    const parsedResponse = JSON.parse(response.choices[0].message.content);
    console.log('Generated solution:', parsedResponse);

    return {
      ...parsedResponse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ExerciseSolution;
  } catch (error) {
    console.error('Error generating solution:', error);
    throw error;
  }
}

export async function saveSolution(
  userId: string,
  exerciseId: string,
  subExerciseId: string,
  solution: Omit<ExerciseSolution, 'exerciseId' | 'subExerciseId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  try {
    console.log('Saving solution:', { userId, exerciseId, subExerciseId });
    
    const solutionRef = doc(
      collection(db, 'users', userId, 'exercises', exerciseId, 'solutions'),
      subExerciseId
    );
    
    await setDoc(solutionRef, {
      ...solution,
      exerciseId,
      subExerciseId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving solution:', error);
    throw error;
  }
}

export async function saveSolutionsBatch(
  userId: string,
  exerciseId: string,
  solutions: { subExerciseId: string; solution: ExerciseSolution }[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    solutions.forEach(({ subExerciseId, solution }) => {
      const solutionRef = doc(
        collection(db, 'users', userId, 'exercises', exerciseId, 'solutions'),
        subExerciseId
      );
      
      batch.set(solutionRef, {
        ...solution,
        exerciseId,
        subExerciseId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error saving solutions batch:', error);
    throw error;
  }
}

export async function fetchSolutions(
  userId: string,
  exerciseId: string
): Promise<ExerciseSolution[]> {
  try {
    console.log('Fetching solutions:', { userId, exerciseId });
    
    const solutionsRef = collection(
      db, 'users', userId, 'exercises', exerciseId, 'solutions'
    );
    const solutionsSnapshot = await getDocs(solutionsRef);
    
    return solutionsSnapshot.docs.map(doc => ({
      ...doc.data(),
      subExerciseId: doc.id,
    })) as ExerciseSolution[];
  } catch (error) {
    console.error('Error fetching solutions:', error);
    throw error;
  }
}