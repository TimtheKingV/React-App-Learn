import { db } from './firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';

export interface Exercise {
  id: string; // Add id to the interface
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  subject: 'Mathematics' | 'Physics' | 'Chemistry';
  totalExercises: number;
  exerciseChecklist: string[];
  context: {
    id: string;
    content: string;
  };
  subExercises: {
    id: string;
    question: string;
    correctAnswer: string;
    order: number;
    isSubPart: boolean;
    contextId: string | null;
    relatedParts: string[] | null;
    originalNumber: string;
  }[];
  validationResults: {
    totalExercisesFound: number;
    allExercisesExtracted: boolean;
    missingExercises: string[];
    validationChecks: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export async function saveExerciseAnalysis(
  userId: string,
  documentId: string,
  analysis: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  try {
    const exerciseRef = doc(collection(db, 'users', userId, 'exercises'), documentId);
    await setDoc(exerciseRef, {
      ...analysis,
      id: documentId, // Add the document ID to the saved data
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving exercise analysis:', error);
    throw error;
  }
}

export async function fetchExercises(userId: string): Promise<Exercise[]> {
  try {
    console.log('Fetching exercises for user:', userId);
    const exercisesRef = collection(db, 'users', userId, 'exercises');
    const exercisesSnapshot = await getDocs(exercisesRef);
    
    const exercises = exercisesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Exercise[];

    console.log('Fetched exercises:', exercises);
    return exercises;
  } catch (error) {
    console.error('Error fetching exercises:', error);
    throw error;
  }
}