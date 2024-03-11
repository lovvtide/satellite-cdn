import mongoose from 'mongoose';


export default (params) => {

	// Connect to the database and start server
	return mongoose.connect(params.connection, {
		useUnifiedTopology: true,
		useNewUrlParser: true
	});
};
