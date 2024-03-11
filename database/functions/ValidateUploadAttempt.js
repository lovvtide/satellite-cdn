import UploadAttempt from '../models/UploadAttempt.js';


export default async (auth) => {

	// Upsert event
	const attempt = await UploadAttempt.findOneAndUpdate({
		id: auth.id
	}, {
		$setOnInsert: {
			created: Math.floor(Date.now() / 1000)
		}
	}, {
		upsert: true
	}).lean();

	// If record already exists, return false to indicate
	// that request should fail (i.e. client is trying to
	// reuse the upload auth). The 
	return !attempt;
};
