import QueryFiles from '../../database/functions/QueryFiles.js';


export default async (req, res) => {

	try {

		const { auth } = req;

		const files = await QueryFiles({
			pubkey: auth.pubkey
		});

		res.json(files);

	} catch (err) {
		console.log(err);
		res.status(err.code || 500).send(err.message || 'Unknown Error');
	}
};
