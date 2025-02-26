import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Image, ScrollView, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Exercise } from '../lib/exercises';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import MathContent from './MathContent';
import { useImageUpload } from './hooks/useImageUpload';
import ExerciseSolution from './ExerciseSolution';
import { generateSolution, saveSolution, fetchSolutions, ExerciseSolution as Solution } from '../lib/solutions';

interface ExerciseViewerProps {
  exercise: Exercise;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export default function ExerciseViewer({ exercise, onClose }: ExerciseViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const x = useSharedValue(0);
  const maxWidth = Math.min(SCREEN_WIDTH - 40, 800);
  const { user } = useAuthStore();
  const currentExercise = exercise.subExercises[currentIndex];

  const {
    uploading,
    uploadError,
    answerImage,
    fileInputRef,
    handleImagePick,
    handleFileChange,
    setAnswerImage,
  } = useImageUpload(user?.uid, exercise.id, currentExercise.id);

  useEffect(() => {
    loadSolution();
  }, [currentIndex]);

  const loadSolution = async () => {
    if (!user) return;
    try {
      const solutions = await fetchSolutions(user.uid, exercise.id);
      const currentSolution = solutions.find(s => s.subExerciseId === currentExercise.id);
      setSolution(currentSolution || null);
    } catch (error) {
      console.error('Error loading solution:', error);
    }
  };

  const handleGenerateSolutions = async () => {
    if (!user) return;
    
    try {
      setGenerating(true);
      
      // Prepare all sub-exercises content
      const exerciseContents = exercise.subExercises.map(subExercise => ({
        id: subExercise.id,
        content: `
Question ${subExercise.originalNumber}:
${subExercise.question}

${subExercise.image ? `Image: ${subExercise.image}` : ''}
        `.trim()
      }));

      console.log('Generating solutions for all sub-exercises:', exerciseContents);
      
      // Generate solutions for all sub-exercises
      for (const { id, content } of exerciseContents) {
        const generatedSolution = await generateSolution(content);
        if (generatedSolution) {
          await saveSolution(user.uid, exercise.id, id, generatedSolution);
        }
      }

      // Reload the current solution
      await loadSolution();
    } catch (error) {
      console.error('Error generating solutions:', error);
    } finally {
      setGenerating(false);
    }
  };

  const updateIndex = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < exercise.subExercises.length) {
      setCurrentIndex(newIndex);
      x.value = 0;
      setAnswerImage(null);
      setSolution(null);
    }
  };

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      x.value = event.translationX;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        if (event.translationX > 0 && currentIndex > 0) {
          runOnJS(updateIndex)(currentIndex - 1);
        } else if (event.translationX < 0 && currentIndex < exercise.subExercises.length - 1) {
          runOnJS(updateIndex)(currentIndex + 1);
        } else {
          x.value = withSpring(0);
        }
      } else {
        x.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      )}
      
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6366f1" />
        </Pressable>
        <Text style={styles.title}>{exercise.title}</Text>
        <Text style={styles.progress}>
          {currentIndex + 1} / {exercise.subExercises.length}
        </Text>
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <ScrollView style={styles.scrollContent}>
            <View style={styles.exerciseContent}>
              {!solution && (
                <Pressable
                  style={({ pressed }) => [
                    styles.generateButton,
                    pressed && styles.buttonPressed,
                    generating && styles.buttonDisabled,
                  ]}
                  onPress={handleGenerateSolutions}
                  disabled={generating}
                >
                  <Ionicons 
                    name={generating ? "hourglass" : "bulb"} 
                    size={24} 
                    color="#ffffff" 
                  />
                  <Text style={styles.buttonText}>
                    {generating ? 'Generating Solution...' : 'Generate Solution'}
                  </Text>
                </Pressable>
              )}

              <View style={styles.questionContainer}>
                <Text style={styles.questionNumber}>Question {currentExercise.originalNumber}</Text>
                <View style={styles.questionContent}>
                  <MathContent content={currentExercise.question} maxWidth={maxWidth} />
                </View>
                {currentExercise.image && (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: currentExercise.image }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </View>

              {solution && (
                <View style={styles.solutionContainer}>
                  <ExerciseSolution
                    steps={solution.steps}
                    hints={solution.hints}
                    finalAnswer={solution.finalAnswer}
                    maxWidth={maxWidth}
                  />
                </View>
              )}

              <View style={styles.answerSection}>
                <Text style={styles.answerTitle}>Your Answer</Text>
                
                {uploadError && (
                  <Text style={styles.errorText}>{uploadError}</Text>
                )}
                
                {answerImage ? (
                  <View style={styles.answerImageContainer}>
                    <Image
                      source={{ uri: answerImage }}
                      style={styles.answerImage}
                      resizeMode="contain"
                    />
                    <Pressable
                      style={styles.retakeButton}
                      onPress={handleImagePick}
                    >
                      <Ionicons name="camera" size={20} color="#ffffff" />
                      <Text style={styles.buttonText}>Retake Photo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.uploadButton,
                      pressed && styles.buttonPressed,
                      uploading && styles.buttonDisabled,
                    ]}
                    onPress={handleImagePick}
                    disabled={uploading}
                  >
                    <Ionicons 
                      name={uploading ? "cloud-upload" : "camera"} 
                      size={24} 
                      color="#ffffff" 
                    />
                    <Text style={styles.buttonText}>
                      {uploading ? 'Uploading...' : 'Upload Answer Photo'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.navigationHints}>
            {currentIndex > 0 && (
              <View style={styles.navHint}>
                <Ionicons name="chevron-back" size={20} color="#94a3b8" />
                <Text style={styles.navText}>Swipe right for previous</Text>
              </View>
            )}
            {currentIndex < exercise.subExercises.length - 1 && (
              <View style={styles.navHint}>
                <Text style={styles.navText}>Swipe left for next</Text>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  progress: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  exerciseContent: {
    padding: 20,
  },
  generateButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  questionContainer: {
    flex: 1,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 12,
  },
  questionContent: {
    marginBottom: 16,
  },
  imageContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: 200,
  },
  solutionContainer: {
    marginTop: 24,
    marginBottom: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  navigationHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  navHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  answerSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  answerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  answerImageContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  answerImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#f1f5f9',
  },
  retakeButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default ExerciseViewer