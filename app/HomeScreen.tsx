import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationProp } from '@react-navigation/native';

type Props = {
  navigation: NavigationProp<any>;
};

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bundle Mode Showcase</Text>
      <Text style={styles.subtitle}>
        Navigate to different examples demonstrating the capabilities of
        offloading work to background threads with react-native-worklets
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('GPU')}
      >
        <Text style={styles.buttonText}>GPU Animation Example</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('GraphQL')}
      >
        <Text style={styles.buttonText}>GraphQL Example</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.markdownButton]}
        onPress={() => navigation.navigate('StreamingMarkdown')}
      >
        <Text style={styles.buttonText}>Streaming Markdown</Text>
        <Text style={styles.buttonSubtext}>remend on background worklet</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.llmButton]}
        onPress={() => navigation.navigate('LLMStreaming')}
      >
        <Text style={styles.buttonText}>LLM Streaming</Text>
        <Text style={styles.buttonSubtext}>live OpenAI response</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginVertical: 10,
    minWidth: 250,
  },
  markdownButton: {
    backgroundColor: '#34C759',
  },
  llmButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
});
