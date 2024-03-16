import express from 'express';

import Auth from './Auth.js';
//import GetAccount from './GetAccount.js';
//import GetAccountCredit from './GetAccountCredit.js';
import GetItem from './GetItem.js';
import GetList from './GetList.js';
import PutUpload from './PutUpload.js';
import DeleteItem from './DeleteItem.js';


export default () => {

	const router = express.Router();

	// Redirect to object storage
	router.get('/:id', GetItem);

	// Check auth header
	router.use(Auth);

	// List all files for one pubkey
	router.get('/list/:pubkey', GetList);

	// Add a file
	router.put('/upload', PutUpload);

	// Remove a file
	router.delete('/:hash', DeleteItem);

	// Return 400 for unknown api routes
	router.get('*', (req, res) => {
		res.status(404).send();
	});

	return router;
};
