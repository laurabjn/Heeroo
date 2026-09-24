// Sonnerie de nouvelle demande de course.
//
// Le chauffeur conduit : une notification silencieuse ne sert à rien. La
// sonnerie retentit une fois, au volume maximum, et s'entend même si le
// téléphone est en mode silencieux ou vibreur (playsInSilentMode).
//
// Une seule fois et non en boucle : le chauffeur regarde son téléphone dès le
// premier son, et une alarme qui insiste pendant qu'il conduit dérange plus
// qu'elle n'aide.
//
// Un seul lecteur pour toute l'application : appeler plusieurs fois
// setRideAlert n'empile pas les sonneries.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Sonnerie retenue parmi les trois produites par tools/make-alert-sound.js
// (nouvelle-course, sirene, carillon) : changer ce chemin suffit.
const RINGTONE = require('../../assets/sounds/carillon.wav');

// Durée du carillon, un peu arrondie : passé ce délai le son s'est tu de
// lui-même et une nouvelle demande pourra sonner à son tour.
const RING_MS = 3200;

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
    player.loop = false;
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
            stopTimer = setTimeout(() => { ringing = false; stopTimer = null; }, RING_MS);
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
