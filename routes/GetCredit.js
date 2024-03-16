import { getPublicKey, getEventHash, getSignature } from 'nostr-tools';

import CreateStorageCredit from '../database/functions/CreateStorageCredit.js';
import GetExchangeRate from '../database/functions/GetExchangeRate.js';


export default async (req, res) => {

	try {

		if (req.blossom.verb !== 'account') {
			throw { code: 401 };
		}

		let gb_months;

		for (let tag of req.blossom.auth.tags) {

			if (tag[0] === 'gb_months') {

				gb_months = parseFloat(tag[1]);

				if (isNaN(gb_months) || !isFinite(gb_months)) {
					throw { code: 400 };
				}

				break;
			}
		}

		if (!gb_months) {
			throw { code: 400 };
		}

		const xr = await GetExchangeRate('USD');
		
		const amount = Math.round(xr * gb_months * parseFloat(process.env.STORAGE_RATE_USD)) * 1000;
		const content = `PURCHASE OF CDN STORAGE (${gb_months} GB MONTHS)`;
		const created_at = Math.floor(Date.now() / 1000);

		const offer = {
			content,
			created_at,
			pubkey: getPublicKey(process.env.APP_SECRET_KEY),
			kind: 9733,
			tags: [
				[ 'amount', String(amount) ],
				[ 'gb_months', String(gb_months) ],
				[ 'product', 'cdn' ]
			]
		}

		offer.id = getEventHash(offer);
		offer.sig = getSignature(offer, process.env.APP_SECRET_KEY);

		const payment = {
			content,
			created_at,
			pubkey: req.blossom.auth.pubkey,
			kind: 9734,
			tags: [
				[ 'relays', ...process.env.LISTENER_RELAYS.split(',') ],
				[ 'amount', String(amount) ],
				[ 'p', offer.pubkey ],
				[ 'e', offer.id ]
			]
		}

		const credit = await CreateStorageCredit({
			offer_id: offer.id,
			pubkey: req.blossom.auth.pubkey,
			rate_usd: parseFloat(process.env.STORAGE_RATE_USD),
			gb_months,
			created_at,
			amount,
			offer
		});

		res.json({
			callback: process.env.LIGHTNING_CALLBACK_URL,
			rateFiat: { usd: parseFloat(process.env.STORAGE_RATE_USD) },
			amount,
			offer,
			payment
		});

	} catch (err) {
		console.log(err);
		res.status(err.code || 500).send(err.message || 'Unknown Error');
	}
};
