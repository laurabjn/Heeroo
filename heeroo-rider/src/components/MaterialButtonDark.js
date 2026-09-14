import React, { Component } from "react";
import { StyleSheet, TouchableOpacity, Text,ActivityIndicator } from "react-native";
import { colors } from '../common/theme';

function MaterialButtonDark(props) {
  return (
    <TouchableOpacity style={[styles.container, props.style]} onPress={()=>{props.onPress()}}>
      {props.loading?
        <ActivityIndicator color="#2d3037" size="small" />
        :
        <Text style={styles.caption}>{props.children}</Text>
      }
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.PRIMARY,
  },
  caption: {
    fontSize: 12,
    fontFamily: "Montserrat-Bold",
    color: colors.BUTTON_TEXT
  }
});

export default MaterialButtonDark;
