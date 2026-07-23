import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {
  createWorkletRuntime,
  scheduleOnRN,
  scheduleOnRuntime,
} from 'react-native-worklets';

const apolloRuntime = createWorkletRuntime('apollo');

const EpisodeItem = ({ item }: { item: any }) => {
  const { episode, name } = item;

  return (
    <View style={styles.card}>
      {episode ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{episode}</Text>
        </View>
      ) : null}
      <Text style={styles.cardTitle}>{name}</Text>
    </View>
  );
};

export default function GraphQLExample() {
  return (
    <View style={styles.container}>
      <List />
    </View>
  );
}

function Info() {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>What gets fetched</Text>
      <Text style={styles.infoBody}>
        The Rick and Morty episode catalogue — season/episode codes and titles —
        queried with Apollo Client over GraphQL.
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Source</Text>
        <Text style={styles.metaValue}>rickandmortyapi.com</Text>
      </View>
    </View>
  );
}

function List() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const items = result?.items ?? [];

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>GraphQL Fetch Example</Text>
        <Text style={styles.subtitle}>
          The request, JSON parsing and filtering all happen on a background
          thread in a dedicated Worklet Runtime.
        </Text>

        <Info />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={() => {
            setError(null);
            setLoading(true);
            loadData(setResult, setLoading, setError);
          }}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Fetching…' : 'Load episodes'}
          </Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Request failed</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        {result && !error ? (
          <Text style={styles.resultCount}>
            Showing {items.length} of {result.total} episodes
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Querying on a worklet runtime…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <EpisodeItem item={item} />}
          keyExtractor={item => item.id.toString()}
          ListEmptyComponent={
            error ? null : (
              <Text style={styles.empty}>
                Tap “Load episodes” to fetch a random slice of the catalogue.
              </Text>
            )
          }
        />
      )}
    </>
  );
}

function loadData(setResult: any, setLoading: any, setError: any) {
  scheduleOnRuntime(apolloRuntime, () => {
    'worklet';
    const fail = (error: any) => {
      'worklet';
      scheduleOnRN(
        setError,
        error?.message ? String(error.message) : String(error),
      );
      scheduleOnRN(setLoading, false);
    };

    try {
      const client = new ApolloClient({
        link: new HttpLink({ uri: 'https://rickandmortyapi.com/graphql' }),
        cache: new InMemoryCache(),
      });

      const EPISODES_QUERY = gql`
        query Episodes {
          episodes {
            results {
              id
              episode
              name
            }
          }
        }
      `;
      client
        .query({ query: EPISODES_QUERY })
        .then((result: any) => {
          const episodes = result.data.episodes.results;
          const items = episodes.slice(
            0,
            Math.round(episodes.length * Math.random()),
          );
          scheduleOnRN(setResult, { items, total: episodes.length });
          scheduleOnRN(setLoading, false);
        })
        .catch(fail);
    } catch (error: any) {
      fail(error);
    }
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8e8e93',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  infoBody: {
    fontSize: 15,
    color: '#1c1c1e',
    lineHeight: 21,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e2',
    paddingTop: 8,
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 13,
    color: '#8e8e93',
  },
  metaValue: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
  },
  buttonDisabled: {
    backgroundColor: '#a9cffa',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultCount: {
    fontSize: 13,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 16,
  },
  listContent: {
    padding: 20,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f1ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  empty: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  errorCard: {
    backgroundColor: '#ffe5e5',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a11',
    marginBottom: 4,
  },
  errorBody: {
    fontSize: 13,
    color: '#a11',
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#8e8e93',
  },
});
