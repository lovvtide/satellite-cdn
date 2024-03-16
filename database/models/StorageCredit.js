import Mongoose from 'mongoose';


const StorageCredit = new Mongoose.Schema({

	// ID of the offer event
	offer_id: { type: String, index: true },

	// Pubkey of person for whom the offer was created
	pubkey: { type: String, index: true },

	// Timestamp of when offer was signed
	created_at: { type: Number, index: true },

	// Timestamp payment was received by lightning server
	paid_at: { type: Number, index: true },

	// Pubkey that signed the first zap on the offer
	paid_by: { type: String, index: true },

	// Number of gb months purchased
	gb_months: { type: Number },

	// The price charged for each gb month
	rate_usd: { type: Number },

	// The amount (to be) paid in millisats
	amount: { type: Number },

	// The offer event signed by seller
	offer: { type: String },

	// The zap receipt signed by LN server
	receipt: { type: String }

});

export default Mongoose.model('StorageCredit', StorageCredit);
