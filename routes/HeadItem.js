import QueryFiles from '../database/functions/QueryFiles.js';


export default async (req, res) => {

	try {

		const { id } = req.params;

		if (!id) {
			throw { code: 400, message: 'Missing hash' };
		}

		const data = await QueryFiles({
			deleted: { $exists: false },
			sha256: id.split('.')[0]
		});

		res.status(data.length > 0 ? 200 : 404).end();

	} catch (err) {

		res.status(err.code).json({ message: err.message || 'Unknown Error' });
	}
};
