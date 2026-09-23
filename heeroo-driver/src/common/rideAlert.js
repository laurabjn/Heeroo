// Sonnerie de nouvelle demande de course.
//
// Le chauffeur conduit : une notification silencieuse ne sert à rien. La
// sonnerie tourne en boucle tant qu'une demande attend une réponse, au volume
// maximum, et continue même si le téléphone est en mode silencieux ou vibreur
// (playsInSilentMode) — c'est le comportement attendu d'une application de
// service, comparable à une alarme.
//
// Un seul lecteur pour toute l'application : appeler plusieurs fois setRideAlert
// n'empile pas les sonneries.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const RINGTONE = require('../../assets/sounds/nouvelle-course.wav');

// Garde-fou : si le chauffeur ne répond pas (téléphone dans une poche, course
// déjà prise par un autre), la sonnerie s'arrête d'elle-même plutôt que de
// sonner indéfiniment.
const MAX_RING_MS = 45000;

let player = null;
let ringing = false;
let stopTimer = null;

function getPlayer() {
    if (player) return player;
    setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
    }).catch((error) => console.log('[Sonnerie] mode audio refusé', error && error.message));
    player = createAudioPlayer(RINGTONE);
    player.loop = true;
    player.volume = 1;
    return player;
}

/** Démarre ou arrête la sonnerie. Sans effet si elle est déjà dans cet état. */
export function setRideAlert(active) {
    try {
        if (active && !ringing) {
            const current = getPlayer();
            current.seekTo(0);
            current.play();
            ringing = true;
            stopTimer = setTimeout(() => setRideAlert(false), MAX_RING_MS);
        } else if (!active && ringing) {
            if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
            player.pause();
            player.seekTo(0);
            ringing = false;
        }
    } catch (error) {
        // Un défaut de la sonnerie ne doit jamais empêcher le chauffeur de voir
        // la demande : on trace et on continue.
        console.log('[Sonnerie]', error && error.message);
        ringing = false;
    }
}

/** À appeler quand l'écran des demandes disparaît. */
export function stopRideAlert() {
    setRideAlert(false);
}
