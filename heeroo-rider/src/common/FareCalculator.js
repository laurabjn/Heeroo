import countryCurrency from './../constants/countryCurrency.json'
import { exchange_access_key } from "./key";

export async function farehelper(distance, time, rateDetails, country) {

    console.log("distance", distance)
    console.log("time", time)
    console.log("rateDetails", rateDetails)
    console.log("country", country)

    let result
    let currency = countryCurrency[country]
    await fetch(`http://api.exchangeratesapi.io/v1/latest?access_key=${exchange_access_key}&base=EUR`, {
        type: 'GET'
    }).catch()
        .then(data => data.json())
        .then(res => {

            if (res.error) {
                //throw new Error(res.error)
                console.log('error in farencal due to api exchange 1')
                console.log(res)
                result = res.error
            } else {
                let currencyRate = res.rates[currency]
                if (currencyRate == undefined) {
                    console.log('Error in currencyRate -> currencyRate=unedfined  -> country = ""')
                    console.log('country = ', country)
                    console.log('currency = ', currency)
                    console.log('res = ', res)

                }
                let ratePerKm = rateDetails.rate_per_kilometer;
                let ratePerHour = rateDetails.rate_per_hour;


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
                    currencyRate: currencyRate,
                    time: time,
                    DistanceInKM: DistanceInKM,
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
            console.log('error in farencal due to api exchange 2')
            console.log(err)
            result = err

        })
    return result

}