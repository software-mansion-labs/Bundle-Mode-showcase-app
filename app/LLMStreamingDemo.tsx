import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ComponentRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import {
  EnrichedMarkdownText,
  type LinkPressEvent,
} from 'react-native-enriched-markdown';
import { processRemendInWorklet } from './remendWorklet';
import { streamOpenAIResponse } from './openAIStream';

const BASE_SYSTEM_PROMPT = [
  'You are a helpful assistant. Respond using CommonMark markdown',
  '(headers, bullet points, bold, italic, fenced code blocks).',
  'CRITICAL — LaTeX rules:',
  '  • ALWAYS use single dollar signs: $F=ma$',
  '  • NEVER use double dollar signs: $$F=ma$$ ← this is FORBIDDEN',
  '  • NEVER use \\(...\\) or \\[...\\] syntax',
  '  • Keep every equation short enough to fit inline',
  'Do not use GitHub Flavored Markdown (no tables, no strikethrough).',
].join('\n');

const PRESETS = [
  { label: '🌍 Solar system', prompt: 'Tell me about the solar system.' },
  {
    label: '⚛️ Physics equations',
    prompt:
      'List the five most important equations in physics with a one-sentence explanation each. Use inline LaTeX for every equation.',
  },
  {
    label: '🚀 Space exploration',
    prompt: 'Give me a brief history of human space exploration.',
  },
] as const;

export default function LLMStreamingDemo() {
  const [prompt, setPrompt] = useState<string>(PRESETS[0].prompt);
  const [activePreset, setActivePreset] = useState<number>(0);
  const [optimisticMarkdown, setOptimisticMarkdown] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const markdownRef = useRef('');
  const versionRef = useRef(0);

  const handleChunk = useCallback((token: string) => {
    markdownRef.current += token;
    const raw = markdownRef.current.replace(/\$\$/g, '$');
    const currentVersion = ++versionRef.current;
    processRemendInWorklet(raw, (processed) => {
      if (currentVersion === versionRef.current) {
        setOptimisticMarkdown(processed);
      }
    });
  }, []);

  const handleComplete = useCallback(() => {
    setIsStreaming(false);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    setIsStreaming(false);
  }, []);

  const selectPreset = useCallback((index: number) => {
    const preset = PRESETS[index];
    if (!preset) return;
    setActivePreset(index);
    setPrompt(preset.prompt);
  }, []);

  const startStreaming = useCallback(() => {
    if (!prompt.trim() || isStreaming) return;
    versionRef.current = 0;
    markdownRef.current = '';
    setOptimisticMarkdown('');
    setError(null);
    setIsStreaming(true);
    streamOpenAIResponse(
      prompt.trim(),
      handleChunk,
      handleComplete,
      handleError,
      BASE_SYSTEM_PROMPT
    );
  }, [prompt, isStreaming, handleChunk, handleComplete, handleError]);

  const reset = useCallback(() => {
    versionRef.current = 0;
    markdownRef.current = '';
    setOptimisticMarkdown('');
    setError(null);
    setIsStreaming(false);
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (isStreaming) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [isStreaming]);

  const handleLinkPress = useCallback((event: LinkPressEvent) => {
    const { url } = event;
    Alert.alert('Link Pressed', `Open: ${url}`, [
      { text: 'Open', onPress: () => Linking.openURL(url) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  useEffect(() => {
    return () => {
      markdownRef.current = '';
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inputSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={styles.presetRow}
        >
          {PRESETS.map((preset, index) => (
            <TouchableOpacity
              key={preset.label}
              style={[styles.chip, activePreset === index && styles.chipActive]}
              onPress={() => selectPreset(index)}
              disabled={isStreaming}
            >
              <Text
                style={[
                  styles.chipText,
                  activePreset === index && styles.chipTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={(text) => {
            setPrompt(text);
            setActivePreset(-1);
          }}
          placeholder="Ask anything…"
          placeholderTextColor="#999"
          multiline
          editable={!isStreaming}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.sendButton,
              (!prompt.trim() || isStreaming) && styles.disabled,
            ]}
            onPress={startStreaming}
            disabled={!prompt.trim() || isStreaming}
          >
            {isStreaming ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Send</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={reset}
            disabled={isStreaming}
          >
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={handleContentSizeChange}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : optimisticMarkdown.length > 0 ? (
          <>
            <EnrichedMarkdownText
              markdown={optimisticMarkdown}
              streamingAnimation
              selectable={!isStreaming}
              onLinkPress={handleLinkPress}
            />
            {isStreaming && (
              <Text style={styles.streamingDot}>● Streaming…</Text>
            )}
          </>
        ) : (
          <Text style={styles.placeholder}>Response will appear here…</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inputSection: {
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  presetScroll: {
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  chipActive: {
    backgroundColor: '#FF9500',
  },
  chipText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    padding: 10,
    fontSize: 14,
    color: '#111',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: { backgroundColor: '#FF9500' },
  resetButton: { backgroundColor: '#8E8E93' },
  disabled: { opacity: 0.4 },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  placeholder: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 48,
  },
  streamingDot: {
    marginTop: 8,
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
});
