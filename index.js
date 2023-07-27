const { getInput, setFailed } = require('@actions/core');

const {
	publishLambdaLayer,
	publishS3LayerArchive,
	getArchiveSize,
	deleteTemporaryArchiveFromS3,
	refreshLambdaLayerVersion
} = require('./helper');


(async () => {
	try {
		const accessKeyId = getInput('access_key_id');
		const secretAccessKey = getInput('secret_access_key');
		const layerName = getInput('layer_name');
		const archive = getInput('archive');
		const region = getInput('region');
		const runtimes = getInput('runtimes') ? JSON.parse(getInput('runtimes')) : [];
		const architectures = getInput('architectures') ? JSON.parse(getInput('architectures')) : [];
		const s3Bucket = getInput('s3_bucket');
		const functionNames = JSON.parse(getInput('functions'));

		console.log(runtimes, architectures);
		const creds = { region, accessKeyId, secretAccessKey };

		const size = getArchiveSize(archive);
		console.log(`Archive size is ${size}`);
		let layerResponse;
		if (size > 10000000) {
			if (!s3Bucket) {
				setFailed('Param s3_bucket is required if layer size exceeds 10MB.');
			}
			// upload s3 archive
			await publishS3LayerArchive({
				...creds,
				s3Bucket,
				archive,
				layerName
			});
			layerResponse = await publishLambdaLayer({
				...creds,
				archive,
				s3Bucket,
				layerName,
				architectures,
				runtimes,
			});
			/**
			 * try to remove the archive from s3 bucket
			 *
			 */
			await deleteTemporaryArchiveFromS3({
				...creds,
				s3Bucket,
				s3Key: `${layerName}.zip`
			});
			/**
			 * refresh the lambda functions to use the latest layer
			 */
		} else {
			layerResponse = await publishLambdaLayer({
				...creds,
				archive,
				layerName,
				architectures,
				runtimes,
			});
		}
		if (functionNames.length) {
			// trigger functions update
			await refreshLambdaLayerVersion({
				...creds,
				functionNames,
				layerARN: layerResponse.LayerVersionArn
			});
		}
	} catch (err) {
		setFailed(err.message);
	}
})();