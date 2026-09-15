import React from 'react';
import { 
  StyleSheet,
  View
} from 'react-native';
import { colors } from '../common/theme';
import { Icon } from '@rneui/themed';

export default class Path extends React.Component {

  render() {
    const { border } =this.props;
    return (
      <View style={[styles.leftViewStyle]} >
          <Icon
              name='location-pin'
              type='simple-line-icon'
              color={colors.SECONDARY}
              size={20}
          />
          {Array(border).fill(null).map((value, index) => (
            <View style={styles.line} key={index} />
          ))}
          <Icon
              name='location-pin'
              type='simple-line-icon'
              color={colors.PRIMARY}
              size={20}
          />
      </View>
    );
  }
}

//style for this component
const styles = StyleSheet.create({
  leftViewStyle:{
    alignItems  : 'center',
    justifyContent:"space-between",
    marginRight:10,
    minWidth:20
  },
  line:{
    height:5,
    width:1.5,
    backgroundColor:colors.SECONDARY,
    alignSelf:"center",
    marginVertical:2
  },
});
