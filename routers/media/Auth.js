import { verifyEvent } from 'nostr-tools';


export default async (req, res, next) => {

	let verified;

	try {

		if (!req.query.auth) {
			throw { code: 403 }; 
		}

		const auth = JSON.parse(decodeURIComponent(req.query.auth));

		if (!verifyEvent(auth)) {
			throw { code: 403 };
		}

		if (auth.kind !== 22242) {
			throw { code: 403 };
		}

		req.auth = auth;

		next();

	} catch (err) {

		console.log('err', err);

		res.status(err.code || 500).send();
	}

};