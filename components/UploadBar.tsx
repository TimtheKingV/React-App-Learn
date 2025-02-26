import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { processWithMathpix } from '../lib/mathpix';

interface UploadBarProps {
  onNewDocument: (title: string, content: string) => void;
}

export default function UploadBar({ onNewDocument }: UploadBarProps) {
  const [uploading, setUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const { user } = useAuthStore();

  const handleUpload = async (file: Blob, filename: string) => {
    if (!user) return;

    try {
      setUploading(true);
      setProcessingStatus('Uploading file...');

      // Log file details
      console.log('File details:', {
        size: file.size,
        type: file.type,
        name: filename
      });

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size exceeds 5MB limit');
      }

      // Validate file type
      if (!file.type.match(/^(application\/pdf|image\/(jpeg|png|jpg))$/)) {
        throw new Error('Invalid file type. Please upload a PDF or image file (JPEG/PNG)');
      }

      const storageRef = ref(storage, `uploads/${user.uid}/${filename}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log('File uploaded successfully, processing with Mathpix...');
      setProcessingStatus('Processing with Mathpix...');
      
      const mathpixResult = await processWithMathpix(downloadURL, user.uid, filename);
      
      if (mathpixResult.mmd) {
        const title = filename.replace(/\.[^/.]+$/, "");
        onNewDocument(title, mathpixResult.mmd);
        setProcessingStatus('Content processed successfully!');
      } else {
        throw new Error('No content was generated from the file');
      }
    } catch (error: any) {
      console.error('Upload/Processing error:', error);
      const errorMessage = error.message || 'Error processing file';
      setProcessingStatus(`Error: ${errorMessage}`);
    } finally {
      setUploading(false);
      setTimeout(() => setProcessingStatus(''), 3000);
    }
  };

  const handleDocumentPick = async () => {
    if (!user) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const fileToUpload = Platform.OS === 'web' 
        ? await fetch(asset.uri).then(r => r.blob())
        : await fetch(asset.uri).then(r => r.blob());

      await handleUpload(fileToUpload, asset.name || `upload-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Document pick error:', error);
      setProcessingStatus('Error selecting file');
    }
  };

  const handleImagePick = async () => {
    if (!user) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setProcessingStatus('Permission to access media library was denied');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Log image details
        console.log('Selected image details:', {
          width: asset.width,
          height: asset.height,
          type: asset.type,
          uri: asset.uri
        });

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        // Log blob details
        console.log('Image blob details:', {
          size: blob.size,
          type: blob.type
        });

        const filename = `image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
        await handleUpload(blob, filename);
      }
    } catch (error) {
      console.error('Image pick error:', error);
      setProcessingStatus('Error selecting image');
    }
  };

  return (
    <View style={styles.container}>
      {processingStatus ? (
        <Text style={[
          styles.statusText,
          processingStatus.startsWith('Error') && styles.errorText
        ]}>
          {processingStatus}
        </Text>
      ) : null}
      <View style={styles.buttonContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.uploadButton,
            pressed && styles.buttonPressed,
            uploading && styles.buttonDisabled,
          ]}
          onPress={handleDocumentPick}
          disabled={uploading}>
          <Ionicons 
            name={uploading ? "cloud-upload" : "document"} 
            size={24} 
            color="#ffffff" 
          />
          <Text style={styles.buttonText}>
            {uploading ? 'Processing...' : 'Upload PDF'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.uploadButton,
            pressed && styles.buttonPressed,
            uploading && styles.buttonDisabled,
          ]}
          onPress={handleImagePick}
          disabled={uploading}>
          <Ionicons 
            name={uploading ? "cloud-upload" : "image"} 
            size={24} 
            color="#ffffff" 
          />
          <Text style={styles.buttonText}>
            {uploading ? 'Processing...' : 'Upload Image'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
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
  statusText: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#4b5563',
  },
  errorText: {
    color: '#ef4444',
  },
});