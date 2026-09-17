import React, { Component } from 'react';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { customMapStyle, colors } from '../common/theme';
import { Car, Pin } from '../icons';
import {
    Text, View,
} from 'react-native';

export default class MapComponent extends Component {
    constructor(props) {
        super(props);
        this.state = {
            marginBottom: 0,
        }
    }

    render() {
        const { mapRegion, mapStyle, nearby, onRegionChangeComplete, coords, passData, setMapRef } = this.props;
        return (
            <MapView
                //ref={setMapRef}
                customMapStyle={customMapStyle}
                provider={PROVIDER_GOOGLE}
                showsUserLocation={false}
                showsMyLocationButton={true}
                loadingEnabled={false}
                style={[mapStyle, { marginBottom: this.state.marginBottom }]}
                region={mapRegion}
                onRegionChangeComplete={onRegionChangeComplete}
                onMapReady={() => this.setState({ marginBottom: 1 })}
            >

                {
                    nearby &&
                    nearby.map((item, index) => {
                        return (
                            <Marker.Animated
                                tracksViewChanges={false}
                                coordinate={{ latitude: item.location ? item.location.lat : 0.00, longitude: item.location ? item.location.lng : 0.00 }}
                                key={index}
                            //tracksViewChanges={this.state.tracksViewChanges}
                            >
                                <Car height={40} width={30} />
                            </Marker.Animated>

                        )
                    })
                }

                {passData.wherelatitude != 0 && passData.wherelongitude != 0 && <Marker.Animated
                    tracksViewChanges={false}
                    coordinate={{
                        latitude: passData.wherelatitude,
                        longitude: passData.wherelongitude
                    }}>
                    <Pin height={40} width={30} color={colors.SECONDARY} />
                </Marker.Animated>}

                {passData.droplatitude != 0 && passData.droplongitude != 0 && <Marker.Animated
                    tracksViewChanges={false}
                    coordinate={{
                        latitude: passData.droplatitude,
                        longitude: passData.droplongitude
                    }}>
                    <Pin height={40} width={30} />
                </Marker.Animated>}

                {
                    <Polyline
                        coordinates={coords ? coords : [{ latitude: 0.00, longitude: 0.00 }]}
                        strokeWidth={4}
                        strokeColor={colors.SECONDARY}
                    />
                }
            </MapView>
        );
    }
}