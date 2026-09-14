import countryCurrency from './../constants/countryCurrency.json'
import { exchange_access_key } from "./key";

export async function farehelper(distance, time, rateDetails, country) {
    let result
    await fetch(`http://api.exchangeratesapi.io/v1/latest?access_key=${exchange_access_key}&base=EUR`, {
        type: 'GET'
    })
        .then(data => data.json())
        .then(res => {

            if (res.error) {
                //throw new Error(res.error)
                result = res.error
            } else {

                let ratePerKm = rateDetails.rate_per_kilometer;
                let ratePerHour = rateDetails.rate_per_hour;

                let currency = countryCurrency[country]
                let currencyRate = res.rates[currency]

                ratePerHour *= currencyRate
                ratePerKm *= currencyRate

                ratePerHour = ratePerHour.toFixed(0)
                ratePerKm = ratePerKm.toFixed(0)

                let ratePerSecond = ratePerHour / 3600;
                let minFare = rateDetails.min_fare;
                let DistanceInKM = parseFloat(distance / 1000).toFixed(0);
                let estimateRateForKM = parseFloat(DistanceInKM * ratePerKm).toFixed(0) * 1;
                let estimateRateForhour = parseFloat(time * ratePerSecond).toFixed(0);
                let total = (parseFloat(estimateRateForKM) + parseFloat(estimateRateForhour)) > minFare ? (parseFloat(estimateRateForKM) + parseFloat(estimateRateForhour)) : minFare;

                let convenienceFee = (total * rateDetails.convenience_fees / 100);


                let grandtotal = parseFloat(total) + parseFloat(convenienceFee);
                let calculateData = {
                    distaceRate: estimateRateForKM,
                    timeRate: estimateRateForhour,
                    totalCost: total, grandTotal: grandtotal,
                    convenience_fees: convenienceFee
                }
                result = calculateData
            }
        })
        .catch(err => {
            //throw new Error(err)
            result = err

        })
    return result

}
