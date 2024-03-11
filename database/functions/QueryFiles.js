import File from '../models/File.js';


export default async (query) => {

	return await File.find(query).lean();
};
