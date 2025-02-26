import React, { useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, useWindowDimensions, Platform, Text, Pressable } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { WebView } from 'react-native-webview';
import katex from 'katex';
import { Exercise } from '../lib/exercises';
import { analyzeWithOpenAI } from '../lib/openai';
import { saveExerciseAnalysis } from '../lib/exercises';
import { useAuthStore } from '../stores/authStore';
import { Ionicons } from '@expo/vector-icons';

interface ContentViewerProps {
  content: string;
  exercise?: Exercise;
  documentId: string;
  onAnalysisComplete?: () => void;
}

export default function ContentViewer({ content, exercise, documentId, onAnalysisComplete }: ContentViewerProps) {
  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width - 40, 800);
  const [webViewWidths, setWebViewWidths] = useState<{[key: string]: number}>({});
  const resizeTimeouts = useRef<{[key: string]: NodeJS.Timeout}>({});
  const [analyzing, setAnalyzing] = useState(false);
  const { user } = useAuthStore();

  const handleAnalyze = async () => {
    if (!user) return;
    
    try {
      setAnalyzing(true);
      console.log('Starting content analysis...');
      
      const analysis = await analyzeWithOpenAI(content);
      if (analysis) {
        console.log('Analysis completed, saving results...');
        await saveExerciseAnalysis(user.uid, documentId, analysis);
        onAnalysisComplete?.();
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const preprocessContent = (rawContent: string): string => {
    return rawContent
      .replace(/\\section\*\{([^}]+)\}/g, '\n\n## $1\n\n')
      .replace(/\\title\{([^}]+)\}/g, '\n\n# $1\n\n')
      .replace(/\\author\{([^}]+)\}/g, '\n\n*By $1*\n\n')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '\\frac{$1}{$2}')
      .replace(/\\sqrt\{([^}]+)\}/g, '\\sqrt{$1}')
      .replace(/\\cdot/g, '\\cdot')
      .replace(/\\left/g, '\\left')
      .replace(/\\right/g, '\\right')
      .replace(/\\\[/g, '\n\n$$')
      .replace(/\\\]/g, '$$\n\n')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/(\$\$[^$]+\$\$)/g, '\n\n$1\n\n')
      .trim();
  };

  const renderMathWebView = (tex: string, displayMode: boolean = false, index: number) => {
    try {
      const cleanTex = tex
        .replace(/\\text\{([^}]+)\}/g, '\\text{$1}')
        .trim();

      const html = katex.renderToString(cleanTex, {
        displayMode,
        throwOnError: false,
        output: 'html',
        macros: {
          "\\f": "f(#1)",
        },
      });

      const key = `${tex}-${index}`;
      const currentWidth = webViewWidths[key] || (displayMode ? maxWidth : undefined);

      const webViewContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: ${displayMode ? 'center' : 'flex-start'};
                align-items: center;
                min-height: ${displayMode ? '100px' : '24px'};
                background-color: transparent;
                overflow: visible;
              }
              .katex { 
                font-size: ${displayMode ? '1.2em' : '1em'};
                line-height: 1.2;
                white-space: nowrap;
              }
              .katex-display { 
                margin: 0;
                padding: 8px 0;
                overflow-x: visible;
                overflow-y: visible;
                max-width: none;
              }
              .katex-html {
                white-space: nowrap;
                max-width: none;
                width: auto;
              }
              .katex-error {
                color: #ef4444;
                font-size: 0.9em;
              }
            </style>
          </head>
          <body>
            ${html}
            <script>
              let lastWidth = 0;
              const resizeObserver = new ResizeObserver(entries => {
                const width = Math.ceil(entries[0].contentRect.width);
                if (Math.abs(width - lastWidth) > 1) {
                  lastWidth = width;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'resize',
                    width: width + 16,
                    index: ${index},
                    key: '${key}'
                  }));
                }
              });
              resizeObserver.observe(document.body);
            </script>
          </body>
        </html>
      `;

      return (
        <View 
          key={key}
          style={[
            displayMode ? styles.blockMathWrapper : styles.inlineMathWrapper,
            currentWidth ? { width: currentWidth } : { flex: 1 }
          ]}
        >
          <WebView
            key={key}
            source={{ html: webViewContent }}
            style={[
              styles.mathWebView,
              displayMode ? styles.blockMathWebView : styles.inlineMathWebView,
            ]}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'resize' && data.key) {
                  if (resizeTimeouts.current[data.key]) {
                    clearTimeout(resizeTimeouts.current[data.key]);
                  }

                  resizeTimeouts.current[data.key] = setTimeout(() => {
                    setWebViewWidths(prev => {
                      const newWidth = Math.min(data.width, maxWidth * 2);
                      if (Math.abs((prev[data.key] || 0) - newWidth) > 1) {
                        return { ...prev, [data.key]: newWidth };
                      }
                      return prev;
                    });
                  }, 100);
                }
              } catch (error) {
                console.error('WebView message parsing error:', error);
              }
            }}
            onError={(syntheticEvent) => {
              console.warn('WebView error:', syntheticEvent.nativeEvent);
            }}
          />
        </View>
      );
    } catch (error) {
      console.error('KaTeX rendering error:', error);
      return <Text key={`error-${tex}-${index}`} style={styles.errorText}>{tex}</Text>;
    }
  };

  const rules = useMemo(() => ({
    text: (node: any) => {
      if (typeof node.content !== 'string') return null;

      const parts = node.content.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
      
      return (
        <Text>
          {parts.map((part: string, index: number) => {
            const key = `text-part-${index}`;
            if (part.startsWith('$$') && part.endsWith('$$')) {
              const tex = part.slice(2, -2).trim();
              return (
                <View key={key} style={styles.blockMathContainer}>
                  {renderMathWebView(tex, true, index)}
                </View>
              );
            }
            if (part.startsWith('$') && part.endsWith('$')) {
              const tex = part.slice(1, -1).trim();
              return (
                <View key={key} style={styles.inlineMathContainer}>
                  {renderMathWebView(tex, false, index)}
                </View>
              );
            }
            return <Text key={key}>{part}</Text>;
          })}
        </Text>
      );
    },
    image: (node: any) => {
      if (!node?.attributes?.src || typeof node.attributes.src !== 'string') {
        return null;
      }

      let imageUrl = node.attributes.src;
      if (imageUrl.startsWith('//')) {
        imageUrl = `https:${imageUrl}`;
      } else if (!imageUrl.startsWith('http')) {
        imageUrl = `https://${imageUrl}`;
      }

      return (
        <View key={`image-${imageUrl}`} style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { width: maxWidth, height: maxWidth * 0.75 }]}
            resizeMode="contain"
          />
        </View>
      );
    },
  }), [maxWidth]);

  const processedContent = useMemo(() => preprocessContent(content), [content]);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      horizontal={false}
    >
      <View style={styles.content}>
        {!exercise && (
          <Pressable
            style={({ pressed }) => [
              styles.analyzeButton,
              pressed && styles.buttonPressed,
              analyzing && styles.buttonDisabled,
            ]}
            onPress={handleAnalyze}
            disabled={analyzing}
          >
            <Ionicons 
              name={analyzing ? "hourglass" : "analytics"} 
              size={24} 
              color="#ffffff" 
            />
            <Text style={styles.buttonText}>
              {analyzing ? 'Analyzing...' : 'Analyze Content'}
            </Text>
          </Pressable>
        )}
        
        {exercise && (
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseTitle}>{exercise.title}</Text>
            <Text style={styles.exerciseDescription}>{exercise.description}</Text>
            <View style={styles.exerciseMetadata}>
              <Text style={styles.metadataItem}>Difficulty: {exercise.difficulty}</Text>
              <Text style={styles.metadataItem}>Subject: {exercise.subject}</Text>
              <Text style={styles.metadataItem}>Total Exercises: {exercise.totalExercises}</Text>
            </View>
          </View>
        )}

        <Markdown 
          style={markdownStyles}
          rules={rules}
        >
          {processedContent}
        </Markdown>
      </View>
    </ScrollView>
  );
}

const markdownStyles = {
  body: {
    color: '#1a1a1a',
    fontSize: 18,
    lineHeight: 28,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }),
  },
  paragraph: {
    marginVertical: 16,
  },
  heading1: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 24,
    color: '#111827',
  },
  heading2: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 20,
    color: '#111827',
  },
  heading3: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 16,
    color: '#111827',
  },
  list_item: {
    marginVertical: 8,
  },
  bullet_list: {
    marginVertical: 16,
  },
  ordered_list: {
    marginVertical: 16,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    padding: 20,
  },
  content: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  imageContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  image: {
    backgroundColor: '#f1f5f9',
  },
  blockMathContainer: {
    width: '100%',
    marginVertical: 24,
    minHeight: 100,
    alignItems: 'center',
  },
  inlineMathContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },
  blockMathWrapper: {
    minHeight: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  inlineMathWrapper: {
    minHeight: 24,
    backgroundColor: 'transparent',
  },
  mathWebView: {
    backgroundColor: 'transparent',
  },
  blockMathWebView: {
    height: 100,
  },
  inlineMathWebView: {
    height: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontStyle: 'italic',
  },
  exerciseInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  exerciseTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  exerciseDescription: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 16,
  },
  exerciseMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metadataItem: {
    fontSize: 14,
    color: '#6366f1',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  analyzeButton: {
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
});