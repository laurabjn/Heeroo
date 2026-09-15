import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
    DriverTripCompleteSreen,
    ProfileScreen,
    CardDetailsScreen,
    RideListPage,
    MapScreen,
    BookedCabScreen,
    RegistrationPage,
    LoginScreen,
    FareScreen,
    RideDetails,
    //SearchScreen,
    EditProfilePage,
    TrackNow,
    AboutPage,
    OnlineChat,
    WalletDetails,
    AddMoneyScreen,
    EmailLoginScreen,
    EmailRegisterScreen,
    EmptyNotificationPage,
    NotificationPage,
} from '../screens';
import SideMenu from '../components/SideMenu';
import { Dimensions } from 'react-native';
var { width, height } = Dimensions.get('window');
import languageJSON from '../common/language';

const AuthStack = createStackNavigator();
const RootDrawer = createDrawerNavigator();
const ProfileStack = createStackNavigator();
const MapStack = createStackNavigator();
const RideDetailsStack = createStackNavigator();

export function RideDetailsStackNavigator(props) {
    return (
        <RideDetailsStack.Navigator initialRouteName="RideListPageScreen" screenOptions={{ headerShown: false }} >
            <RideDetailsStack.Screen name="RideListPageScreen" component={RideListPage} />
            <RideDetailsStack.Screen name="RideDetails" component={RideDetails} />
            <RideDetailsStack.Screen name="trackRide" component={TrackNow} />
            <RideDetailsStack.Screen name="CardDetails" component={CardDetailsScreen} />

        </RideDetailsStack.Navigator>
    );
}

export function ProfileNavigator(props) {
    return (
        <ProfileStack.Navigator initialRouteName="ProfileScreen" screenOptions={{ headerShown: false }} >
            <ProfileStack.Screen name="ProfileScreen" component={ProfileScreen} />
            <ProfileStack.Screen name="editUser" component={EditProfilePage} />
        </ProfileStack.Navigator>
    );
}

export function MapNavigator(props) {
    return (
        <MapStack.Navigator initialRouteName="MapScreen" screenOptions={{ headerShown: false }} >
            <MapStack.Screen name="MapScreen" component={MapScreen} />
            <MapStack.Screen name="FareDetails" component={FareScreen} />
            <MapStack.Screen name="BookedCab" component={BookedCabScreen} />
            <MapStack.Screen name="trackRide" component={TrackNow} />
            <RideDetailsStack.Screen name="CardDetails" component={CardDetailsScreen} />
            <RideDetailsStack.Screen name="onlineChat" component={OnlineChat} />
            <RootDrawer.Screen name="ratingPage" component={DriverTripCompleteSreen} />

        </MapStack.Navigator>
    );
}

export function AuthNavigator(props) {
    return (
        <AuthStack.Navigator initialRouteName="EmailLogin" screenOptions={{ headerShown: false }} >
            <AuthStack.Screen name="Reg" component={RegistrationPage} />
            <AuthStack.Screen name="EmailLogin" component={EmailLoginScreen} />
            <AuthStack.Screen name="EmailRegister" component={EmailRegisterScreen} />
        </AuthStack.Navigator>
    );
}

export function RootNavigator(props) {
    return (
        <RootDrawer.Navigator
            initialRouteName="Map"
            screenOptions={{
                headerShown: false,

                drawerStyle: {
                    backgroundColor: 'transparent',
                    opacity: 0.9,
                },

                drawerItemStyle: {
                    alignContent: 'center',
                    textAlign: 'center',
                },

                drawerLabelStyle: {
                    color: 'white',
                    fontFamily: 'Montserrat-Regular',
                    textAlign: 'center',
                    width: '100%',
                    fontSize: 12,
                    textTransform: 'uppercase',
                },
                drawerActiveBackgroundColor: 'transparent'
            }}
            drawerContent={(props) => <SideMenu {...props} />} >

            <RootDrawer.Screen name="Map" options={{ title: languageJSON.book_your_ride_menu }} component={MapNavigator} />
            <RootDrawer.Screen name="Profile" options={{ title: languageJSON.profile_setting_menu }} component={ProfileNavigator} />
            <RootDrawer.Screen name="RideList" options={{ title: languageJSON.my_rides_menu }} component={RideDetailsStackNavigator} />
            <RootDrawer.Screen name="About" options={{ title: languageJSON.about_us_menu }} component={AboutPage} />
            {/*<RootDrawer.Screen name="Notifications" options={{ title: 'a definir' }} component={NotificationPage} />*/}
            {/*<RootDrawer.Screen name="wallet" options={{ title: 'a definir' }} component={WalletDetails} />*/}
        </RootDrawer.Navigator>
    );
}