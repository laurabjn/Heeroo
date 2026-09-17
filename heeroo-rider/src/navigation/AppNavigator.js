import React from 'react';
import {
  View,
  StatusBar,
  Text,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthNavigator, RootNavigator } from './MainNavigator';
import { AuthLoadingScreen } from '../screens/AuthLoadingScreen';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const AppNavigatorStack = createStackNavigator();

function AppNavigator() {
  return (
    <AppNavigatorStack.Navigator initialRouteName='AuthLoading' screenOptions={{ headerShown: false }} >
      <AppNavigatorStack.Screen name="AuthLoading" component={AuthLoadingScreen} />
      <AppNavigatorStack.Screen name="Auth" component={AuthNavigator} />
      <AppNavigatorStack.Screen name="Root" component={RootNavigator} />
    </AppNavigatorStack.Navigator>
  );
}


class AppContainer extends React.Component {
  render() {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['bottom']}>
          <NavigationContainer>
            <StatusBar translucent={true} backgroundColor={"transparent"} barStyle={"dark-content"} />
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }
}
export default AppContainer;
