// Dates et heures affichées en français.
//
// `toLocaleString()` sans argument suit la locale de l'appareil, pas celle de
// l'application : un téléphone en anglais affichait « 9/20/2026, 2:07:56 PM »
// dans une interface entièrement française. La locale est donc imposée ici.
const LOCALE = 'fr-FR';

const DATE_TIME = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

/** « 20/09/2026 14:07 », ou une chaîne vide si la date est absente ou invalide. */
export function formatDateTime(value) {
    if (value === undefined || value === null || value === '') return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(LOCALE, DATE_TIME);
}
