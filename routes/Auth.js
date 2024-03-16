import { verifySignature } from 'nostr-tools';


export default (req, res, next) => {

	let verified;

	try {

		if (!req.headers.authorization) {
			throw { code: 401 }; 
		}

		// Parse the auth header
		req.blossom = {
			auth: JSON.parse(Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString())
		}

		// Optionally allow post-dated auth to account for
		// client's clock not being perfectly synchronized
		const authTolerance = process.env.AUTH_TOLERANCE_SECONDS
		? parseInt(process.env.AUTH_TOLERANCE_SECONDS) : 0;

		const now = Math.floor(Date.now() / 1000);

		if (
			!verifySignature(req.blossom.auth)
			|| req.blossom.auth.kind !== 24242
			|| isNaN(req.blossom.auth.created_at)
			|| req.blossom.auth.created_at > (now + authTolerance)
		) {
			throw { code: 401 };
		}

		let expires;

		for (let tag of req.blossom.auth.tags) {

			if (tag[0] === 'expiration') {

				// Prevent multiple `expiration` tags
				if (expires) {
					throw { code: 401 };
				}

				expires = parseInt(tag[1]);

			} else if (tag[0] === 't') {

				// Prevent multiple `t` tags
				if (req.blossom.verb) {
					throw { code: 401 };
				}

				req.blossom.verb = tag[1];
			}
		}

		if (
			!expires
			|| expires <= now
		) {
			throw { code: 401 };
		}

		next();

	} catch (err) {
		console.log('err', err);
		res.status(err.code || 500).send();
	}

};
