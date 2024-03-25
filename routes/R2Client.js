import { S3Client } from '@aws-sdk/client-s3';

export default () => {
	return new S3Client({
		region: 'auto',
		endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
			accessKeyId: process.env.S3_ACCESS_KEY_ID,
		},
	});
};
