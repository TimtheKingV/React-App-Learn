import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [topic, setTopic] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadTopic();
  }, []);

  const loadTopic = async () => {
    try {
      const savedTopic = await AsyncStorage.getItem('currentTopic');
      if (savedTopic) {
        setTopic(savedTopic);
      }
    } catch (error) {
      console.error('Error loading topic:', error);
    }
  };

  const saveTopic = async () => {
    try {
      await AsyncStorage.setItem('currentTopic', topic);
      router.back();
    } catch (error) {
      console.error('Error saving topic:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Modify Topic</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={topic}
          onChangeText={setTopic}
          placeholder="Enter your learning topic"
          placeholderTextColor="#94a3b8"
          multiline
        />
      </View>
      <Pressable style={styles.saveButton} onPress={saveTopic}>
        <Text style={styles.saveButtonText}>Save Topic</Text>
        <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 60,
    marginBottom: 30,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    fontSize: 18,
    color: '#1e293b',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});