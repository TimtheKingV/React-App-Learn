import { View, Text, StyleSheet, ScrollView, Pressable, Modal, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Exercise, fetchExercises } from '../../lib/exercises';
import { useAuthStore } from '../../stores/authStore';
import ExerciseViewer from '../../components/ExerciseViewer';

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      loadExercises();
    }
  }, [user]);

  const loadExercises = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const fetchedExercises = await fetchExercises(user.uid);
      setExercises(fetchedExercises);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!user) return;

    try {
      setRefreshing(true);
      const fetchedExercises = await fetchExercises(user.uid);
      setExercises(fetchedExercises);
    } catch (error) {
      console.error('Error refreshing exercises:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Exercises</Text>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={['#6366f1']}
            progressBackgroundColor="#ffffff"
          />
        }
      >
        {loading && !refreshing ? (
          <Text style={styles.emptyText}>Loading exercises...</Text>
        ) : exercises.length === 0 ? (
          <Text style={styles.emptyText}>
            No exercises found. Analyze a document to get started!
          </Text>
        ) : (
          exercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              style={({ pressed }) => [
                styles.exerciseCard,
                pressed && styles.exerciseCardPressed,
              ]}
              onPress={() => setSelectedExercise(exercise)}
            >
              <Text style={styles.exerciseTitle}>{exercise.title}</Text>
              <Text style={styles.exerciseDescription}>{exercise.description}</Text>
              <View style={styles.metadataContainer}>
                <Text style={styles.metadataItem}>Difficulty: {exercise.difficulty}</Text>
                <Text style={styles.metadataItem}>Subject: {exercise.subject}</Text>
                <Text style={styles.metadataItem}>
                  Total Exercises: {exercise.totalExercises}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!selectedExercise}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedExercise(null)}
      >
        {selectedExercise && (
          <ExerciseViewer
            exercise={selectedExercise}
            onClose={() => setSelectedExercise(null)}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 60,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    marginTop: 40,
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  exerciseTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  exerciseDescription: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metadataItem: {
    fontSize: 14,
    color: '#6366f1',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
});