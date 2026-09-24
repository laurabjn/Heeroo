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

// Etendue minimale du cadrage, en degres — environ 450 metres. Cadrer deux
// points confondus, ce qui arrive des que le chauffeur est arrive au point de
// depart, envoie la carte au zoom maximum sur une zone sans aucun detail.
const MIN_SPAN = 0.004;

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

    const latitudes = valid.map((p) => p.latitude);
    const longitudes = valid.map((p) => p.longitude);
    const latSpan = Math.max(...latitudes) - Math.min(...latitudes);
    const lngSpan = Math.max(...longitudes) - Math.min(...longitudes);
    if (latSpan < MIN_SPAN && lngSpan < MIN_SPAN) {
        const centerLat = (Math.max(...latitudes) + Math.min(...latitudes)) / 2;
        const centerLng = (Math.max(...longitudes) + Math.min(...longitudes)) / 2;
        valid.push({ latitude: centerLat - MIN_SPAN / 2, longitude: centerLng - MIN_SPAN / 2 });
        valid.push({ latitude: centerLat + MIN_SPAN / 2, longitude: centerLng + MIN_SPAN / 2 });
    }

    setTimeout(() => {
        try {
            mapRef.fitToCoordinates(valid, { edgePadding, animated });
        } catch (error) {
            console.log('[Carte] cadrage impossible', error && error.message);
        }
    }, delay);
}
