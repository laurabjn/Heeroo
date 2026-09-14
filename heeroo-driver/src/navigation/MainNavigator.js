import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
    EmptyNotificationPage,
    DriverTripCompleteSreen,
    ProfileScreen,
    TaskListIgnorePopup,
    RideListPage,
    NotificationPage,
    LoginScreen,
    DriverStartTrip,
    DriverCompleteTrip,
    RideDetails,
    DriverTripAccept,
    DriverRegistrationPage,
    EditProfilePage,
    AboutPage,
    OnlineChat,

    EmailLoginScreen,
    DriverIncomePage,
    EmailRegisterScreen
} from '../screens';
import SideMenu from '../components/SideMenu';
import { Dimensions } from 'react-native';
var { width, height } = Dimensions.get('window');
import languageJSON from '../common/language';
//app stack for user end
export const AppStack = {
    DriverFare: {
        screen: DriverTripCompleteSreen,
        navigationOptions: {
            header: null
        }
    },
    TaskListIgnorePopUp: {
        screen: TaskListIgnorePopup
    },
    RideList: {
        screen: RideListPage,
        navigationOptions: {
            header: null,
        }

    },
    Notifications: {
        screen: NotificationPage,
        navigationOptions: {
            header: null,
        }
    },
    EmptyNotification: {
        screen: EmptyNotificationPage,
        navigationOptions: {
            header: null,
        }
    },

    Profile: {
        screen: ProfileScreen,
        navigationOptions: {
            header: null
        }
    },
    MyEarning: {
        screen: DriverIncomePage,
        navigationOptions: {
            header: null
        }
    },
    DriverTripAccept: {
        screen: DriverTripAccept,
        navigationOptions: {
            header: null
        }
    },
    RideDetails: {
        screen: RideDetails,
        navigationOptions: {
            header: null
        }
    },
    DriverTripStart: {
        screen: DriverStartTrip,
        navigationOptions: {
            header: null
        }
    },
    Chat: {
        screen: OnlineChat,
    },
    DriverTripComplete: {
        screen: DriverCompleteTrip,
        navigationOptions: {
            header: null
        }
    },
    editUser: {
        screen: EditProfilePage,
        navigationOptions: {
            header: null
        }
    },
    About: {
        screen: AboutPage,
        navigationOptions: {
            header: null
        }
    },
}

const AuthStack = createStackNavigator();
const DriverTripStack = createStackNavigator();
const RootDrawer = createDrawerNavigator();
const RideListStack = createStackNavigator();
const ProfileStack = createStackNavigator();

export function ProfileNavigator(props) {
    return (
        <ProfileStack.Navigator initialRouteName="ProfileScreen" screenOptions={{ headerShown: false }} >
            <ProfileStack.Screen name="ProfileScreen" component={ProfileScreen} />
            <ProfileStack.Screen name="editUser" component={EditProfilePage} />
        </ProfileStack.Navigator>
    );
}
export function RideListNavigator(props) {
    return (
        <RideListStack.Navigator initialRouteName="RideListScreen" screenOptions={{ headerShown: false }} >
            <RideListStack.Screen name="RideListScreen" component={RideListPage} />
            <RideListStack.Screen name="RideDetails" component={RideDetails} />
            <RideListStack.Screen name="DriverTripComplete" component={DriverCompleteTrip} />
        </RideListStack.Navigator>
    );
} export function AuthNavigator(props) {
    return (
        <AuthStack.Navigator initialRouteName="EmailLogin" screenOptions={{ headerShown: false }} >
            <AuthStack.Screen name="DriverReg" component={DriverRegistrationPage} />
            <AuthStack.Screen name="EmailLogin" component={EmailLoginScreen} />
            <AuthStack.Screen name="EmailRegister" component={EmailRegisterScreen} />
        </AuthStack.Navigator>
    );
}

export function DriverTripNavigator(props) {
    return (
        <DriverTripStack.Navigator initialRouteName="DriverTripAcceptScreen" screenOptions={{ headerShown: false }} >
            <DriverTripStack.Screen name="DriverTripAcceptScreen" component={DriverTripAccept} />
            <DriverTripStack.Screen name="DriverTripStart" component={DriverStartTrip} />
            <DriverTripStack.Screen name="RideDetails" component={RideDetails} />
            <DriverTripStack.Screen name="DriverTripComplete" component={DriverCompleteTrip} />
            <DriverTripStack.Screen name="DriverFare" component={DriverTripCompleteSreen} />
            <DriverTripStack.Screen name="Chat" component={OnlineChat} />


        </DriverTripStack.Navigator>
    );
}

export function RootNavigator(props) {
    return (
        <RootDrawer.Navigator
            initialRouteName="DriverTripAccept"
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
            <RootDrawer.Screen name="DriverTripAccept" options={{ title: languageJSON.booking_request }} component={DriverTripNavigator} />
            <RootDrawer.Screen name="RideList" options={{ title: languageJSON.my_bookings }} component={RideListNavigator} />
            <RootDrawer.Screen name="Profile" options={{ title: languageJSON.my_profile }} component={ProfileNavigator} />
            {/*<RootDrawer.Screen name="Notifications" options={{ title: 'Notifications' }} component={Notifications} />*/}
            {<RootDrawer.Screen name="MyEarning" options={{ title: languageJSON.incomeText }} component={DriverIncomePage} />}
            <RootDrawer.Screen name="About" options={{ title: languageJSON.about_us }} component={AboutPage} />
        </RootDrawer.Navigator>
    );
}