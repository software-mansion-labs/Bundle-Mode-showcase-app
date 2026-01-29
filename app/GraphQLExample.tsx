import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  Button,
} from 'react-native';
import {
  createWorkletRuntime,
  scheduleOnRN,
  scheduleOnRuntime,
} from 'react-native-worklets';

const apolloRuntime = createWorkletRuntime('apollo');

const ChapterItem = ({ chapter }: { chapter: any }) => {
  const { number, title } = chapter;
  let header, subheader;

  if (number) {
    header = `Chapter ${number}`;
    subheader = title;
  } else {
    header = title;
  }

  return (
    <Pressable style={styles.item}>
      <Text style={styles.header}>{header}</Text>
      {subheader && <Text style={styles.subheader}>{subheader}</Text>}
    </Pressable>
  );
};

export default function GraphQLExample() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GraphQL Fetch Example</Text>
      <Text style={styles.subheader}>
        Data is fetched on a background thread and filtered there!
      </Text>
      <List />
    </View>
  );
}

function List() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  return (
    <>
      <Button
        title="Load data"
        onPress={() => {
          setLoading(true);
          loadData(setData, setLoading);
        }}
      />
      {loading && <Loading />}
      <FlatList
        data={data || []}
        renderItem={({ item }) => <ChapterItem chapter={item} />}
        keyExtractor={chapter => chapter.id.toString()}
      />
    </>
  );
}

function loadData(setData: any, setLoading: any) {
  scheduleOnRuntime(apolloRuntime, () => {
    'worklet';
    const client = new ApolloClient({
      link: new HttpLink({ uri: 'https://api.graphql.guide/graphql' }),
      cache: new InMemoryCache(),
    });

    const CHAPTERS_QUERY = gql`
      query Chapters {
        chapters {
          id
          number
          title
        }
      }
    `;
    client.query({ query: CHAPTERS_QUERY }).then((result: any) => {
      const data = result.data.chapters.slice(
        0,
        Math.round(result.data.chapters.length * Math.random()),
      );
      scheduleOnRN(setData, data);
      scheduleOnRN(setLoading, false);
    });
  });
}

function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={'pink'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loader: {
    marginTop: 20,
  },
  dataContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  dataText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  item: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 20,
    paddingRight: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  header: {
    fontWeight: 'bold',
  },
  subheader: {
    paddingTop: 10,
    marginBottom: 5,
  },
});
