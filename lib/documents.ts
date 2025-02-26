import { storage } from './firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface PDFDocument {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}

const DOCUMENTS_STORAGE_KEY = 'user_documents';

export async function clearDocumentCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    console.log('Document cache cleared');
  } catch (error) {
    console.error('Error clearing document cache:', error);
  }
}

export async function saveDocument(userId: string, document: PDFDocument): Promise<void> {
  try {
    const existingDocs = await loadDocuments();
    const updatedDocs = [document, ...existingDocs];
    await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(updatedDocs));
  } catch (error) {
    console.error('Error saving document:', error);
    throw error;
  }
}

export async function loadDocuments(): Promise<PDFDocument[]> {
  try {
    const storedDocs = await AsyncStorage.getItem(DOCUMENTS_STORAGE_KEY);
    return storedDocs ? JSON.parse(storedDocs) : [];
  } catch (error) {
    console.error('Error loading documents:', error);
    return [];
  }
}

async function fetchDocument(item: any, userId: string): Promise<PDFDocument | null> {
  if (Platform.OS === 'web') {
    // For web, only try the direct path
    try {
      const path = `users/${userId}/mmd/${item.name}`;
      console.log('Web: Attempting to fetch from path:', path);
      
      const storageRef = ref(storage, path);
      const downloadURL = await getDownloadURL(storageRef);
      
      const response = await fetch(downloadURL);
      if (!response.ok) {
        console.log(`Failed to fetch content: ${response.status} ${response.statusText}`);
        return null;
      }

      const content = await response.text();
      if (!content) {
        console.log('Empty content received');
        return null;
      }

      // Clean up the filename for display
      const title = item.name
        .replace(/\.mmd$/, '')
        .replace(/\.pdf\.mmd$/, '.pdf')
        .replace(/\.pdf$/, '');

      return {
        id: item.name,
        title,
        content,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('Error fetching document:', error);
      return null;
    }
  } else {
    // For native platforms, try multiple paths
    const baseName = item.name
      .replace(/\.mmd$/, '')
      .replace(/\.pdf\.mmd$/, '.pdf')
      .replace(/\.pdf$/, '');

    const paths = [
      `users/${userId}/mmd/${item.name}`,
      `users/${userId}/mmd/${baseName}.mmd`,
      `users/${userId}/mmd/${baseName}.pdf.mmd`,
    ];

    for (const path of paths) {
      try {
        console.log(`Native: Attempting to fetch from path: ${path}`);
        const storageRef = ref(storage, path);
        const downloadURL = await getDownloadURL(storageRef);
        
        const response = await fetch(downloadURL);
        if (!response.ok) continue;

        const content = await response.text();
        if (!content) continue;

        return {
          id: item.name,
          title: baseName,
          content,
          timestamp: Date.now(),
        };
      } catch (error) {
        continue;
      }
    }
  }

  return null;
}

export async function fetchStoredDocuments(userId: string, forceRefresh = false): Promise<PDFDocument[]> {
  try {
    let localDocs: PDFDocument[] = [];
    
    // If not forcing refresh, try to load from local storage first
    if (!forceRefresh) {
      localDocs = await loadDocuments();
      console.log('Loaded local documents:', localDocs.length);
      
      // Return local docs if available and not forcing refresh
      if (localDocs.length > 0) {
        return localDocs;
      }
    }
    
    // Then attempt to fetch from Firebase Storage
    const mmdRef = ref(storage, `users/${userId}/mmd`);
    
    try {
      console.log('Fetching documents from Firebase Storage...');
      const filesList = await listAll(mmdRef);
      console.log('Files found in storage:', filesList.items.length);
      
      if (filesList.items.length === 0) {
        console.log('No files found in storage, clearing local cache');
        await clearDocumentCache();
        return [];
      }

      // Use Promise.all with a timeout for each document fetch
      const fetchWithTimeout = async (item: any) => {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Fetch timeout')), 30000); // 30 second timeout
        });

        try {
          const result = await Promise.race([
            fetchDocument(item, userId),
            timeoutPromise
          ]);
          return result;
        } catch (error) {
          console.error(`Timeout or error fetching ${item.name}:`, error);
          return null;
        }
      };

      const results = await Promise.all(
        filesList.items.map(item => fetchWithTimeout(item))
      );

      // Filter out null results
      const fetchedDocs = results.filter((doc): doc is PDFDocument => doc !== null);
      console.log(`Successfully fetched ${fetchedDocs.length} documents`);

      if (fetchedDocs.length > 0) {
        // Save to AsyncStorage for offline access
        await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(fetchedDocs));
        console.log('Saved fetched documents to AsyncStorage');
        return fetchedDocs;
      }
      
      // Clear cache if no documents were fetched
      await clearDocumentCache();
      return [];
      
    } catch (storageError: any) {
      console.error('Error accessing Firebase Storage:', storageError);
      if (storageError.code === 'storage/unauthorized') {
        console.error('Storage access unauthorized. Please check Firebase Storage rules.');
      }
      // Clear cache on error
      await clearDocumentCache();
      return [];
    }
    
  } catch (error) {
    console.error('Error in fetchStoredDocuments:', error);
    await clearDocumentCache();
    return [];
  }
}