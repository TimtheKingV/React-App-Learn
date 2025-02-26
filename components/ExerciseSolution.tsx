import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SolutionStep } from '../lib/solutions';
import MathContent from './MathContent';

interface ExerciseSolutionProps {
  steps: SolutionStep[];
  hints: string[];
  finalAnswer: string;
  maxWidth: number;
}

export default function ExerciseSolution({ 
  steps, 
  hints, 
  finalAnswer,
  maxWidth 
}: ExerciseSolutionProps) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hints</Text>
        {hints.map((hint, index) => (
          <View key={`hint-${index}`} style={styles.hintContainer}>
            <Text style={styles.hintNumber}>Hint {index + 1}</Text>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solution Steps</Text>
        {steps.map((step) => (
          <View key={`step-${step.number}`} style={styles.stepContainer}>
            <Text style={styles.stepNumber}>Step {step.number}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
            <Text style={styles.stepExplanation}>{step.explanation}</Text>
            {step.math && (
              <View style={styles.mathContainer}>
                <MathContent content={step.math} maxWidth={maxWidth} />
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Final Answer</Text>
        <View style={styles.answerContainer}>
          <MathContent content={finalAnswer} maxWidth={maxWidth} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  hintContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  hintNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  stepContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  stepExplanation: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 12,
  },
  mathContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
  },
  answerContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
});