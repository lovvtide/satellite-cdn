import StorageCredit from '../models/StorageCredit.js';


export default async (data) => {

	// Insert the event and check for existing — ensuring that
	// storage credits are uniquely indexed by offer_id
	// prevents creating offers with duplicate ids
	return await StorageCredit.findOneAndUpdate({
		offer_id: data.offer.id
	}, {
		$setOnInsert: {
			pubkey: data.pubkey,
			gb_months: data.gb_months,
			rate_usd: data.rate_usd,
			amount: data.amount,
			created_at: data.created_at,
			offer: JSON.stringify(data.offer)
		}
	}, {
		upsert: true,
		new: true
	}).lean();

};