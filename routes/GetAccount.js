import Account from '../database/functions/Account.js';


export default async (req, res) => {

	try {

		if (req.blossom.verb !== 'account') {
			throw { code: 401 };
		}

		const account = await Account(req.blossom.auth.pubkey);

		res.json(account);

	} catch (err) {
		console.log(err);
		res.status(err.code || 500).send(err.message || 'Unknown Error');
	}
};
