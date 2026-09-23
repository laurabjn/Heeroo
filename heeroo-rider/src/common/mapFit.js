// Cadrage d'une carte sur plusieurs points, sans risque de plantage.
//
// react-native-maps délègue à l'API Google native, qui lève une exception
// fatale quand on cadre une carte de taille nulle :
//   « newLatLngBounds: Map size can't be 0. Most likely, layout has not yet
//     occurred for the map view. »
// L'exception vient du code natif : elle ferme l'application et n'est pas
// rattrapable en JavaScript. On ne cadre donc qu'une carte prête (onMapReady)
// et après un court délai, le temps que la mise en page soit faite.

const DEFAULT_PADDING = { top: 60, right: 60, bottom: 60, left: 60 };

function usable(point) {
    return point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude));
}

/**
 * @param {object} mapRef    référence du MapView
 * @param {array}  points    [{ latitude, longitude }, …]
 * @param {object} options   { ready, delay, edgePadding, animated }
 */
export function fitMapToPoints(mapRef, points, options = {}) {
    const { ready = true, delay = 600, edgePadding = DEFAULT_PADDING, animated = true } = options;
    if (!mapRef || !ready || !Array.isArray(points)) return;

    const valid = points.filter(usable).map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
    }));
    if (valid.length < 2) return;

    setTimeout(() => {
        try {
            mapRef.fitToCoordinates(valid, { edgePadding, animated });
        } catch (error) {
            console.log('[Carte] cadrage impossible', error && error.message);
        }
    }, delay);
}
