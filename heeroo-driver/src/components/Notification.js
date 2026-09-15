import React from 'react';
import { View, Text, Dimensions, FlatList, StyleSheet, Image } from 'react-native';
import { Icon } from '@rneui/themed'
import { colors } from '../common/theme';
const devWidth=Dimensions.get("window").width;


export default class Notifications extends React.Component {

    constructor(props){
        super(props);
        this.state={
            data: [
                {Status:'Your Booking with GT908753 is confirm,please wait for ride',time:'2 mins ago'},
                {Status:'Your Booking with GT908753 is cancelled successfully',time:'10 mins ago'},
                {Status:'Your payment Successfully submitted',time:'2 days ago'},
                {Status:'Hey Sudipta!Your ride is completed',time:'10 Oct,2018'},
                {Status:'Your Booking with GT908753 is confirm,please wait for ride',time:'5 Oct,2018'},
                {Status:'Your Booking with GT908753 is confirm,please wait for ride',time:'2 mins ago'},
                {Status:'Your Booking with GT908753 is cancelled successfully',time:'10 mins ago'},
                {Status:'Your payment Successfully submitted',time:'2 days ago'},
                {Status:'Hey Sudipta!Your ride is completed',time:'10 Oct,2018'},
                {Status:'Your Booking with GT908753 is confirm,please wait for ride',time:'5 Oct,2018'},
                {Status:'Your Booking with GT908753 is confirm,please wait for ride',time:'2 mins ago'},
                {Status:'Your Booking with GT908753 is cancelled successfully',time:'10 mins ago'},
                {Status:'Your payment Successfully submitted',time:'2 days ago'},
                {Status:'Hey Sudipta!Your ride is completed',time:'10 Oct,2018'},
                {Status:'Your Booking with GT908753 is confirm,please wait for ride',time:'5 Oct,2018'},
            ],
        } 
      }
      onPressButton(){ 
         alert("hello");
      }

     newData = ({item}) =>{
        return(
        <View style={styles.item}>
            <View style={styles.statusView}>
                <Text style={styles.textNotif}>{item.Status}</Text>
                <Text style={styles.textTime}>{item.time}</Text>
            </View>
        </View>
         )
     }
    render(){    
    return(
        <View style={{flex:1}}>
            <FlatList
                keyExtractor={(item, index) => index.toString()}
                data={this.state.data}
                renderItem={this.newData}
            />
        </View>
    ); 
}
};

//style for this component
const styles = StyleSheet.create({
    item:{
        flex:1,
        borderBottomWidth:8,
        borderColor:colors.ITEM,
        flexDirection:"row",
        paddingHorizontal:20,
        paddingVertical:10,
    },
    cabLogoStyle:{
        width:60,
        height:60,
        borderRadius:60/2,
        backgroundColor:colors.ITEM,
        resizeMode:"contain",
        marginRight:10,
    },
    statusView:{
        flex:1,
    },
    textTime:{
        fontFamily:"Montserrat-Light",
        fontSize:12,
        color:colors.TEXT
    },
    textNotif:{
        flex:1,
        fontFamily:"Montserrat-Regular",
        fontSize:14,
        color:colors.TEXT,
        marginBottom:10
    },
    
});