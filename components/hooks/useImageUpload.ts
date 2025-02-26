import { useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { validateAnswer } from '../../lib/answerValidation';
import { processWithMathpix } from '../../lib/mathpix';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function useImageUpload(
  userId: string | undefined, 
  exerciseId: string, 
  subExerciseId: string,
  question: string,
  solution: string | null
) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [answerImage, setAnswerImage] = useState<string | null>(null);
  const [validation, setValidation] = useState<{
    isCorrect?: boolean;
    feedback?: string;
    mistakes?: string[];
    tips?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showError = (message: string) => {
    setUploadError(message);
    if (Platform.OS !== 'web') {
      Alert.alert('Upload Error', message);
    }
    console.error('Upload error:', message);
  };

  const validateFile = (file: File | Blob) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    if (!file.type.startsWith('image/')) {
      throw new Error(`Invalid file type: ${file.type}. Please select an image file.`);
    }
  };

  const requestPermissions = async () => {
    try {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraStatus.granted) {
        showError('Camera permission is required to take photos');
        return false;
      }

      const libraryStatus = await MediaLibrary.requestPermissionsAsync();
      if (!libraryStatus.granted) {
        showError('Photo library permission is required to select photos');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const uploadImage = async (uri: string) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Starting image upload process...');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      validateFile(blob);

      const filename = `answers/${userId}/${exerciseId}/${subExerciseId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      
      console.log('Uploading image to Firebase Storage...');
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Image uploaded successfully, URL:', downloadURL);

      // Process the answer with Mathpix
      if (solution) {
        console.log('Processing image with Mathpix...');
        const mathpixResult = await processWithMathpix(downloadURL, userId, filename);
        console.log('Mathpix processing result:', mathpixResult);

        if (mathpixResult.mmd) {
          console.log('Validating answer...');
          const validationResult = await validateAnswer(mathpixResult.mmd, question, solution, userId);
          setValidation(validationResult);
          console.log('Validation result:', validationResult);
        } else {
          console.warn('No MMD content received from Mathpix');
        }
      }

      return downloadURL;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      throw error;
    }
  };

  const handleImagePick = async () => {
    if (!userId) {
      showError('User not authenticated');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setValidation(null);

      if (Platform.OS === 'web') {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
        return;
      }

      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const downloadURL = await uploadImage(result.assets[0].uri);
        setAnswerImage(downloadURL);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to upload image';
      showError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId || !event.target.files || event.target.files.length === 0) return;

    try {
      setUploading(true);
      setUploadError(null);
      setValidation(null);

      const file = event.target.files[0];
      validateFile(file);
      
      const filename = `answers/${userId}/${exerciseId}/${subExerciseId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      console.log('Uploading web file to Firebase Storage...');
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      console.log('File uploaded successfully, URL:', downloadURL);
      
      // Process the answer with Mathpix
      if (solution) {
        console.log('Processing file with Mathpix...');
        const mathpixResult = await processWithMathpix(downloadURL, userId, filename);
        console.log('Mathpix processing result:', mathpixResult);

        if (mathpixResult.mmd) {
          console.log('Validating answer...');
          const validationResult = await validateAnswer(mathpixResult.mmd, question, solution, userId);
          setValidation(validationResult);
          console.log('Validation result:', validationResult);
        } else {
          console.warn('No MMD content received from Mathpix');
        }
      }

      setAnswerImage(downloadURL);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to upload image';
      showError(errorMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return {
    uploading,
    uploadError,
    answerImage,
    validation,
    fileInputRef,
    handleImagePick,
    handleFileChange,
    setAnswerImage,
  };
}