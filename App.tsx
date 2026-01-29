import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './app/HomeScreen';
import GPUExample from './app/GPUExample';
import GraphQLExample from './app/GraphQLExample';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Bundle Mode Showcase' }}
        />
        <Stack.Screen
          name="GPU"
          component={GPUExample}
          options={{ title: 'GPU Animation' }}
        />
        <Stack.Screen
          name="GraphQL"
          component={GraphQLExample}
          options={{ title: 'GraphQL Example' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
