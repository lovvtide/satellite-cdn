import Mongoose from 'mongoose';

// Record of upload attempt - this is useful becuase it allows
// the server to enforce a one time use policy for upload tokens.
// Also, by comparing the timestamp of the upload event to the
// timestamp of the completed upload, we can track how long each
// upload is taking to complete.

const UploadAttempt = new Mongoose.Schema({

	// Id of auth event
	id: { type: String, index: true },

	// Timestamp when upload started
	created: { type: Number }
	
});

export default Mongoose.model('UploadAttempt', UploadAttempt);
