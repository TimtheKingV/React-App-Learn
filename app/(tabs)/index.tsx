import { View, Text, StyleSheet, ScrollView, Modal, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import PDFCard from '../../components/PDFCard';
import ContentViewer from '../../components/ContentViewer';
import UploadBar from '../../components/UploadBar';
import { PDFDocument, fetchStoredDocuments, saveDocument, clearDocumentCache } from '../../lib/documents';
import { Exercise, fetchExercises } from '../../lib/exercises';
import { useAuthStore } from '../../stores/authStore';

export default function HomeScreen() {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<PDFDocument | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      loadDocuments(true); // Force refresh on initial load
      loadExercises();
    }
  }, [user]);

  const loadDocuments = async (forceRefresh = false) => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (forceRefresh) {
        await clearDocumentCache();
      }
      const docs = await fetchStoredDocuments(user.uid, forceRefresh);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExercises = async () => {
    if (!user) return;

    try {
      console.log('Loading exercises for user:', user.uid);
      const fetchedExercises = await fetchExercises(user.uid);
      console.log('Loaded exercises:', fetchedExercises);
      setExercises(fetchedExercises);
    } catch (error) {
      console.error('Error loading exercises:', error);
    }
  };

  const handleNewDocument = async (title: string, content: string) => {
    if (!user) return;

    const newDoc: PDFDocument = {
      id: Date.now().toString(),
      title,
      content,
      timestamp: Date.now(),
    };

    try {
      await saveDocument(user.uid, newDoc);
      setDocuments(prev => [newDoc, ...prev]);
    } catch (error) {
      console.error('Error saving new document:', error);
    }
  };

  const findExerciseForDocument = (doc: PDFDocument): Exercise | undefined => {
    const docId = doc.title.replace(/\.pdf$/, '');
    const exercise = exercises.find(ex => ex.id === docId);
    console.log('Finding exercise for document:', docId, 'Found:', exercise);
    return exercise;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Documents</Text>
      <ScrollView style={styles.scrollContainer}>
        {loading ? (
          <Text style={styles.emptyText}>Loading documents...</Text>
        ) : documents.length === 0 ? (
          <Text style={styles.emptyText}>
            Upload a PDF to get started
          </Text>
        ) : (
          documents.map(doc => (
            <PDFCard
              key={doc.id}
              title={doc.title}
              onPress={() => setSelectedDoc(doc)}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!selectedDoc}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDoc(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedDoc?.title}</Text>
            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedDoc(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
          {selectedDoc && (
            <ContentViewer 
              content={selectedDoc.content}
              documentId={selectedDoc.title.replace(/\.pdf$/, '')}
              exercise={findExerciseForDocument(selectedDoc)}
              onAnalysisComplete={loadExercises}
            />
          )}
        </View>
      </Modal>

      <UploadBar onNewDocument={handleNewDocument} />
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '500',
  },
});