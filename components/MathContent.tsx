import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useMathWebView } from './hooks/useMathWebView';

interface MathContentProps {
  content: string;
  maxWidth: number;
  displayMode?: boolean;
}

export default function MathContent({ content, maxWidth, displayMode = false }: MathContentProps) {
  const { webViewWidths, generateWebViewContent, handleWebViewMessage } = useMathWebView(maxWidth);

  const preprocessTeX = (tex: string): string => {
    return tex
      // Handle fractions with proper spacing
      .replace(/\\frac{([^}]+)}{([^}]+)}/g, (_, num, den) => {
        const processedNum = num.trim();
        const processedDen = den.trim();
        return `\\frac{${processedNum}}{${processedDen}}`;
      })
      // Handle square roots
      .replace(/\\sqrt{([^}]+)}/g, '\\sqrt{$1}')
      // Handle text mode with proper spacing
      .replace(/\\text{([^}]+)}/g, (_, text) => `\\text{${text.trim()}}`)
      // Handle parentheses
      .replace(/\\left/g, '\\left')
      .replace(/\\right/g, '\\right')
      // Handle multiplication dot
      .replace(/\\cdot/g, '\\cdot')
      // Handle function notation
      .replace(/\\f{([^}]+)}/g, 'f($1)')
      // Handle special characters
      .replace(/\\backslash/g, '\\')
      // Clean up extra whitespace while preserving intentional spaces
      .replace(/\s+/g, ' ')
      .trim();
  };

  const renderMathWebView = (tex: string, isDisplayMode: boolean = false, index: number) => {
    try {
      const cleanTex = preprocessTeX(tex);
      const key = `${cleanTex}-${index}`;
      const currentWidth = webViewWidths[key] || (isDisplayMode ? maxWidth : undefined);
      const webViewContent = generateWebViewContent(cleanTex, isDisplayMode, key);

      return (
        <View 
          key={key}
          style={[
            isDisplayMode ? styles.blockMathWrapper : styles.inlineMathWrapper,
            currentWidth ? { width: currentWidth } : { flex: 1 }
          ]}
        >
          <WebView
            source={{ html: webViewContent }}
            style={[
              styles.mathWebView,
              isDisplayMode ? styles.blockMathWebView : styles.inlineMathWebView,
            ]}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onMessage={(event) => handleWebViewMessage(key, JSON.parse(event.nativeEvent.data))}
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

  const renderContent = () => {
    if (displayMode) {
      // Render the entire content as display math
      return renderMathWebView(content, true, 0);
    }

    // First, normalize the content to ensure consistent delimiters
    const normalizedContent = content
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');

    // Split content by math delimiters while preserving the delimiters
    const parts = normalizedContent.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        // Display math
        const tex = part.slice(2, -2).trim();
        return (
          <View key={`block-${index}`} style={styles.blockMathContainer}>
            {renderMathWebView(tex, true, index)}
          </View>
        );
      } else if (part.startsWith('$') && part.endsWith('$')) {
        // Inline math
        const tex = part.slice(1, -1).trim();
        return (
          <View key={`inline-${index}`} style={styles.inlineMathContainer}>
            {renderMathWebView(tex, false, index)}
          </View>
        );
      } else if (part.trim()) {
        // Regular text (only if not empty)
        return <Text key={`text-${index}`} style={styles.text}>{part}</Text>;
      }
      return null;
    });
  };

  return <View style={styles.container}>{renderContent()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 24,
  },
  blockMathContainer: {
    width: '100%',
    marginVertical: 16,
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
});