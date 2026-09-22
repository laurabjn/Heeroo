import countryCurrency from './../constants/countryCurrency.json'

// Calcul du prix d'une course à partir des tarifs de rates/car_type.
//
// Les tarifs sont saisis en euros dans le back-office et convertis dans la
// monnaie du pays de départ. Le franc CFA étant arrimé à l'euro à une parité
// fixe et légale, aucune conversion en ligne n'est nécessaire pour les pays
// desservis (France, Sénégal, Bénin, Cameroun).
//
// L'implémentation précédente interrogeait une API de change externe en HTTP
// non chiffré : dès qu'elle échouait (quota, panne, blocage du texte clair par
// Android), le taux valait `undefined` et tous les prix devenaient NaN.
const FIXED_RATES = {
    EUR: 1,
    XOF: 655.957,   // franc CFA UEMOA (Sénégal, Bénin) — parité fixe
    XAF: 655.957,   // franc CFA CEMAC (Cameroun) — parité fixe
};

/** Nombre utilisable, ou 0 : évite qu'un tarif absent ne propage un NaN. */
function num(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

export async function farehelper(distance, time, rateDetails, country) {
    const currency = countryCurrency[country] || 'EUR';
    const currencyRate = FIXED_RATES[currency] || 1;
    if (!FIXED_RATES[currency]) {
        console.log('[Tarif] monnaie inconnue', currency, 'pour le pays', country, '— tarifs appliqués tels quels');
    }

    const rates = rateDetails && typeof rateDetails === 'object' ? rateDetails : {};
    const ratePerKm = num(rates.rate_per_kilometer) * currencyRate;
    const ratePerHour = num(rates.rate_per_hour) * currencyRate;
    const minFare = num(rates.min_fare) * currencyRate;

    const distanceInKM = num(distance) / 1000;
    const estimateRateForKM = distanceInKM * ratePerKm;
    const estimateRateForHour = (num(time) / 3600) * ratePerHour;

    const computed = estimateRateForKM + estimateRateForHour;
    const total = computed > minFare ? computed : minFare;
    const convenienceFee = total * num(rates.convenience_fees) / 100;

    return {
        currencyRate,
        time,
        DistanceInKM: distanceInKM.toFixed(0),
        distaceRate: estimateRateForKM.toFixed(0),
        timeRate: estimateRateForHour.toFixed(0),
        totalCost: total,
        grandTotal: total + convenienceFee,
        convenience_fees: convenienceFee,
    };
}
