import React, { Component } from 'react';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { Image } from 'react-native';
import { customMapStyle, colors } from '../common/theme';
import { Pin, Car } from '../icons';


export default class MapComponent extends Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        const { mapRegion, markerCord, mapStyle, currentPosition, mapRef } = this.props;
        return (
            <MapView
                ref={mapRef}
                customMapStyle={customMapStyle}
                provider={PROVIDER_GOOGLE}
                showsUserLocation={false}
                showsMyLocationButton={false}
                //mapPadding={{ top: 0, right: 0, bottom: 220, left: 0 }} 
                style={[mapStyle]}
                initialRegion={mapRegion}
            >
                {currentPosition && <Marker
                    tracksViewChanges={false}
                    coordinate={currentPosition}>
                    <Car height={40} width={30} />
                </Marker>}

                <Marker
                    tracksViewChanges={false}
                    coordinate={markerCord}
                    title={'marker_title'}
                    description={'marker_description'}
                >
                    <Pin height={40} width={30} />
                </Marker>



            </MapView>
        );
    }
}
