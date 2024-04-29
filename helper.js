const { readFileSync, statSync } = require('fs');
const { LambdaClient, PublishLayerVersionCommand, UpdateFunctionConfigurationCommand, ListFunctionsCommand } = require('@aws-sdk/client-lambda');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const non_error_response_codes = [200, 201, 204];

/**
 * Reusable function to initiate the lambda client
 * @param {*} param0
 * @returns
 */
const lambdaClient = ({ region, accessKeyId, secretAccessKey }) => new LambdaClient({
	region,
	credentials: { accessKeyId, secretAccessKey }
});
/**
 * Reusable function to initiate the s3 client
 * @param {*} param0
 * @returns
 */
const s3Client = ({ region, accessKeyId, secretAccessKey }) => new S3Client({
	region,
	credentials: { accessKeyId, secretAccessKey }
})

const errored = response => non_error_response_codes.indexOf(response.$metadata.httpStatusCode) == -1 ? true : false;

exports.getArchiveSize = archive => statSync(archive).size
/**
 * Resuable function to publish lambda layer. This function dynamically identifies the config
 * based on whether to pick archive from file or S3
 * @param {*} param0
 */
exports.publishLambdaLayer = async ({
																			region,
																			accessKeyId,
																			secretAccessKey,
																			layerName,
																			archive,
																			architectures,
																			runtimes,
																			s3Bucket = null
																		}) => {
	/**
	 * Initiate the lambda client
	 */
	const client = lambdaClient({ region, accessKeyId, secretAccessKey });
	const payload = {
		LayerName: layerName,
		Description: "",
		/**
		 * If s3Bucket is defined in the input Parameters then value S3 uploaded layer.
		 */
		Content: s3Bucket ? {
			S3Bucket: s3Bucket,
			S3Key: `${layerName}.zip`
		} : {
			/**
			 * Direct parse layer only if s3Bucket is null in params
			 */
			ZipFile: readFileSync(archive)
		},
		CompatibleArchitectures: architectures,
		CompatibleRuntimes: runtimes
	}
	const command = new PublishLayerVersionCommand(payload);
	const response = await client.send(command);
	if (errored(response)) {
		console.log(JSON.stringify(response));
		throw new Error("Error While publishing layer. If you feel this is a bug, raise a ticket on the repo.");
	}
	console.log("Success Uploading Layer!");
	return response;
};
/**
 * Reusable function that will publish layer to S3 just in case of layer size is higher than
 * the expected size. The code will identify whether this archive can be directly uploaded and if not,
 * It should be uploaded to S3 first using this function and then layer parsing is done by dynamoc Content config
 * in @function publishLambdaLayer
 * @param {*} param0
 */
exports.publishS3LayerArchive = async ({
																				 region,
																				 accessKeyId,
																				 secretAccessKey,
																				 s3Bucket,
																				 layerName,
																				 archive
																			 }) => {
	const client = s3Client({ region, accessKeyId, secretAccessKey });
	const command = new PutObjectCommand({
		Bucket: s3Bucket,
		Key: `${layerName}.zip`,
		Body: readFileSync(archive)
	});
	const response = await client.send(command);
	if (errored(response)) {
		console.log(JSON.stringify(response));
		throw new Error("Error While publishing layer to S3. If you feel this is a bug, raise a ticket on the repo.");
	}
	console.log("Success Uoloading Layer to S3!");
	return response;
}
/**
 * Reusable function to cleanup the temporary created layer archive on S3 to reduce the accumulating charges over time.
 * @param {*} param0
 */
exports.deleteTemporaryArchiveFromS3 = async ({
																								region,
																								accessKeyId,
																								secretAccessKey,
																								s3Bucket,
																								s3Key
																							}) => {
	const client = s3Client({ region, accessKeyId, secretAccessKey });
	const command = new DeleteObjectCommand({
		Bucket: s3Bucket,
		Key: s3Key
	});
	const response = await client.send(command);
	if (errored(response)) {
		console.log(JSON.stringify(response));
		throw new Error("Error While Deleting Layer From S3. If you feel this is a bug, raise a ticket on the repo.");
	}
	console.log("Success Deleting Layer From S3!");
	return response;
}
/**
 * Refresh lambda function to use the latest version of layer
 */
exports.refreshLambdaLayerVersion = async ({
																						 region,
																						 accessKeyId,
																						 secretAccessKey,
																						 functionNames,
																						 layerARN,
																					 }) => {
	const client = lambdaClient({ region, accessKeyId, secretAccessKey });
	const commands = []
	for (const functionName of functionNames)
		commands.push(client.send(new UpdateFunctionConfigurationCommand({
			FunctionName: functionName,
			Layers: [layerARN]
		})));
	
	const response = await Promise.all(commands);
	return response;
}

/**
 * List all the lambda functions that use the specified layer
 */
exports.listLambdaFunctionsWithLayer = async ({
																								region,
																								accessKeyId,
																								secretAccessKey,
																								layerARN
																							}) => {
	try {
		const client = lambdaClient({ region, accessKeyId, secretAccessKey });
		
		const allFunctions = [];
		let nextMarker = null;
		do {
			const listFunctionsCommand = new ListFunctionsCommand({ Marker: nextMarker });
			const { Functions: functions, NextMarker: nextPageMarker } = await client.send(listFunctionsCommand);
			
			allFunctions.push(...functions);
			nextMarker = nextPageMarker;
		} while (nextMarker);
		
		const layerARNWithoutVersion = layerARN.split(':').slice(0, -1).join(':')
		const matchinFunctions = allFunctions.filter((func) => func.Layers && func.Layers.some((layer) => layer.Arn.includes(layerARNWithoutVersion)))
		const functionNames = matchinFunctions.map((func) => func.FunctionName);
		return functionNames;
	} catch (error) {
		console.error("Error:", error);
		return [];
	}
}