import File from '../models/File.js';


export default async ({ sha256, pubkey }) => {

	return await File.findOneAndUpdate({
		deleted: { $exists: false },
		pubkey,
		sha256
	}, {
		$set: {
			deleted: Math.floor(Date.now() / 1000)
		}
	}, {
		new: true
	}).lean();
};
