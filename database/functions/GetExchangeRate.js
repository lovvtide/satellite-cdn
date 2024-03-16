import axios from 'axios';

import ExchangeRate from '../models/ExchangeRate.js';


export default async (currency) => {

	// Don't check the exchange rate more than once every 5 mins
	const EXCHANGE_RATE_MAX_AGE = 300;
	
	let rate;

	// Try to look up a recent exchange rate
	const saved = await ExchangeRate.findOne({
		timestamp: { $gt: Math.ceil(Date.now() / 1000) - EXCHANGE_RATE_MAX_AGE },
		currency
	});

	// If not found, fetch new data
	if (saved) {

		rate = saved.rate;

	} else {

		// Yes, this endpoint is hardcoded for now. That would be great if exchange
		// rate apis were standardized wouldn't it? Maybe someone can make a DVM...
		const resp = await axios.get('https://api.coinbase.com/v2/exchange-rates?currency=BTC');

		rate = (1 / (resp.data.data.rates.USD * 0.00000001));

		await ExchangeRate.findOneAndUpdate({
			currency
		}, {
			$set: {
				timestamp: Math.ceil(Date.now() / 1000),
				rate
			}
		}, {
			upsert: true
		});
	}

	return rate;
};
