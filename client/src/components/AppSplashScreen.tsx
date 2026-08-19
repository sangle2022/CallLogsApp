import React from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function AppSplashScreen() {
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View style={styles.content}>
        <Image
          source={require('../assets/app-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* <Text style={styles.appName}>
          Call Manager
        </Text> */}

        {/* <ActivityIndicator
          size="large"
          style={styles.loader}
        />

        <Text style={styles.loadingText}>
          Loading...
        </Text> */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    width: 330,
    height: 330,
  },

  appName: {
    marginTop: 20,
    fontSize: 25,
    fontWeight: '700',
    color: '#111827',
  },

  loader: {
    marginTop: 32,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
});