import axios from 'axios';

class Exchange {
	constructor() {
		// Yes, this endpoint is hardcoded for now. That would be great if exchange
		// rate apis were standardized wouldn't it? Maybe someone can make a DVM...
		this.EXCHANGE_RATE_SOURCE =
			'https://api.coinbase.com/v2/exchange-rates?currency=BTC';

		this.EXCHANGE_RATE_MAX_AGE = 300;
	}

	// TODO move this function elsewhere
	async getRateUSD() {
		// Don't check the exchange rate more than once every 5 mins
		const EXCHANGE_RATE_MAX_AGE = 300;

		const now = Math.floor(Date.now() / 1000);

		// If not found or stale, fetch new data
		if (!this.data || now - this.data.at > this.EXCHANGE_RATE_MAX_AGE) {
			const resp = await axios.get(this.EXCHANGE_RATE_SOURCE);

			this.data = {
				rate: 1 / (resp.data.data.rates.USD * 0.00000001),
				at: now,
			};
		}

		return this.data.rate;
	}
}

export default Exchange;
