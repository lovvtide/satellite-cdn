export default (req, res) => {
	try {
		if (req.blossom.verb !== 'account') {
			throw { code: 401, message: "Expected t tag value 'account'" };
		}

		const account = req.app.db.getAccount(req.blossom.auth.pubkey);

		res.json(account);
	} catch (err) {
		console.log(err);
		res
			.status(err.code || 500)
			.json({ message: err.message || 'Unknown Error' });
	}
};
