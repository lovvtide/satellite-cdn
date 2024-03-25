export default async (req, res) => {
	try {
		const { id } = req.params;

		if (!id) {
			throw { code: 400, message: 'Missing hash' };
		}

		const blob = req.app.db.getBlob(id.split('.')[0]);

		res.status(blob ? 200 : 404).end();
	} catch (err) {
		res.status(err.code).json({ message: err.message || 'Unknown Error' });
	}
};
