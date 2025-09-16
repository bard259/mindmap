import React from 'react';
import { View, StyleSheet } from 'react-native';
import MindMap from './components/MindMap';

export default function App() {
  return (
    <View style={styles.container}>
      <MindMap />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c10',
    width: '100%',
    height: '100%',
  },
});