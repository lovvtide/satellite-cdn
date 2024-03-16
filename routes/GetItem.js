
export default (req, res) => {

	try {

		const { id } = req.params;

		if (!id) {
			throw { code: 400 };
		}

		// Redirect to object storage endpoint sans extension
		res.redirect(301, `${process.env.BLOB_ENDPOINT}/${id.split('.')[0]}`);

	} catch (err) {

		res.status(err.code).send();
	}
};
