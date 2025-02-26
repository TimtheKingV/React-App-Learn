import { useState, useRef } from 'react';
import katex from 'katex';

// Inlined KaTeX CSS with improved fraction styles
const KATEX_CSS = `
.katex {
  font-size: 1.1em;
  font-family: KaTeX_Main, Times New Roman, serif;
  line-height: 1.2;
  text-indent: 0;
  text-rendering: auto;
  border-color: currentColor;
}

.katex .mfrac {
  margin: 0.4em 0;
}

.katex .mfrac .frac-line {
  border-bottom-width: 0.08em;
  margin: 0.15em 0;
}

.katex .mfrac .mord {
  font-size: 0.95em;
}

.katex .mfrac > span {
  text-align: center;
  margin: 0.15em 0;
}

.katex .mfrac > span > span {
  padding: 0 0.15em;
}

.katex .base {
  margin-top: 3px !important;
}

.katex .vlist {
  display: table-cell;
  vertical-align: middle;
  position: relative;
}

.katex .vlist > span {
  display: block;
  height: 0;
  position: relative;
}

.katex .vlist > span > span {
  display: inline-block;
  margin-top: 0.15em;
}

.katex .msupsub {
  text-align: left;
}

.katex .mord + .mop {
  margin-left: 0.16667em;
}

.katex .mord + .mbin {
  margin-left: 0.22222em;
}

.katex .stretchy {
  width: 100%;
  display: block;
  position: relative;
  overflow: hidden;
}

.katex-display {
  display: block;
  margin: 1em 0;
  text-align: center;
}

.katex-display > .katex {
  display: block;
  text-align: center;
  white-space: nowrap;
}

.katex-error {
  color: #ef4444;
  font-size: 0.9em;
  white-space: normal;
}`;

export function useMathWebView(maxWidth: number) {
  const [webViewWidths, setWebViewWidths] = useState<{[key: string]: number}>({});
  const resizeTimeouts = useRef<{[key: string]: NodeJS.Timeout}>({});

  const generateWebViewContent = (tex: string, displayMode: boolean, key: string) => {
    const html = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'html',
      trust: true,
      strict: false,
      macros: {
        "\\f": "f(#1)",
      },
      fleqn: true,
      errorColor: '#ef4444',
      minRuleThickness: 0.08,
    });

    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      ${KATEX_CSS}
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
        font-size: ${displayMode ? '1.4em' : '1.2em'};
        line-height: 1.4;
        white-space: nowrap;
        color: #1e293b;
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
      .katex .base {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    ${html}
    <script>
      const resizeObserver = new ResizeObserver(entries => {
        const width = Math.ceil(entries[0].contentRect.width);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'resize',
          width: width + 16,
          key: '${key}'
        }));
      });
      resizeObserver.observe(document.body);
    </script>
  </body>
</html>`;
  };

  const handleWebViewMessage = (key: string, data: any) => {
    try {
      if (data.type === 'resize' && data.key === key) {
        if (resizeTimeouts.current[key]) {
          clearTimeout(resizeTimeouts.current[key]);
        }
        resizeTimeouts.current[key] = setTimeout(() => {
          setWebViewWidths(prev => ({
            ...prev,
            [key]: Math.min(data.width, maxWidth),
          }));
        }, 100);
      }
    } catch (error) {
      console.error('WebView message handling error:', error);
    }
  };

  return {
    webViewWidths,
    generateWebViewContent,
    handleWebViewMessage,
  };
}