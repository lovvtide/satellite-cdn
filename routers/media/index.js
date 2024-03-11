import express from 'express';

import Auth from './Auth.js';
import GetAccount from './GetAccount.js';
//import GetAccountCredit from './GetAccountCredit.js';
import PutItem from './PutItem.js';
import DeleteItem from './DeleteItem.js';


export default () => {

	const router = express.Router();

	router.use(Auth);

	router.put('/item', PutItem);

	router.delete('/item', DeleteItem);

	router.get('/account', GetAccount);

	//router.get('/account/credit', GetAccountCredit);

	// Return 400 for unknown api routes
	router.get('*', (req, res) => {
		res.status(404).send();
	});

	return router;
};
