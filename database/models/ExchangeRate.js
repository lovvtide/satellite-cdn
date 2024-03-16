import Mongoose from 'mongoose';


const ExchangeRate = new Mongoose.Schema({

	// Currency code, e.g. USD
	currency: { type: String, index: true },

	// Timestamp when exchange rate was retreived
	timestamp: { type: Number, index: true },

	// Exchange rate to BTC
	rate: { type: Number }

});

export default Mongoose.model('ExchangeRate', ExchangeRate);
