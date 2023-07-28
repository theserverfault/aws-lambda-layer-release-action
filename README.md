# Custom GitHub Action for Lambda Layer Release

![GitHub Action Version](https://img.shields.io/badge/version-v0.0.0-blue)
![GitHub Action Workflow](https://img.shields.io/badge/workflow-CI/CD-green)
![License](https://img.shields.io/badge/license-MIT-orange)

This GitHub Action simplifies the process of releasing AWS Lambda layers by automating the deployment and updating of Lambda functions that depend on the layer. It provides a seamless experience for releasing Lambda layers with a failsafe mechanism for larger layers, automatically handling uploads via an S3 bucket when needed.

## Features

1. **Seamless Lambda Layer Release:** This action streamlines the release process for AWS Lambda layers, making it easy and straightforward. With just a few configuration settings, you can deploy your layer effortlessly.

2. **Failsafe Mechanism for Larger Layers:** For larger Lambda layers that might exceed AWS Lambda's maximum layer size limit, this action automatically handles the upload via an S3 bucket. This ensures a smooth deployment process without any size-related issues.

3. **Update Dependent Lambdas:** When you release a new version of the Lambda layer, this action provides an option to automatically update the configuration of all Lambda functions that utilize this layer. This helps in keeping all Lambda functions up-to-date with the latest layer version.

## Usage

To use this action in your workflow, you need to create a workflow file (e.g., `.github/workflows/release_layer.yml`) and add the following steps:

```yaml
name: Release Lambda Layer

on:
  push:
    branches:
      - main

jobs:
  release:
    name: Release Layer
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v2

      - name: Release Lambda Layer
        uses: theserverfault/aws-lambda-layer-release-action@v0.1
        with:
          access_key_id: ${{ secrets.AWS_DEV_ACCESS_KEY_ID }}
          secret_access_key: ${{ secrets.AWS_DEV_SECRET_ACCESS_KEY }}
          layer_name: <LAYER_NAME>
          archive: nodejs.zip
          architectures: '["x86_64"]'
          runtimes: '["nodejs16.x","nodejs18.x"]'
          s3_bucket: '<S3_BUCKET_NAME>'
          functions: '["<LAMBDA_NAME1>", <LAMBDA_NAME2>]'
```
Replace the placeholders with the appropriate values:

- `access_key_id`: AWS Access Key Id (Recommeneded to save this safely in secrets)<br/>
- `secret_access_key`: AWS Secret Access Key (Recommeneded to save this safely in secrets)<br/>
- `layer_name`: Name of the layer where you want to publish this version. This layer name must already exist on AWS Lambda layers.`access_key_id` and `secret_access_key` must be allowed to interact with this layer.<br/>
- `archive`: Refers the path of the zip archive to upload as layer. The archive creation process is not part of this action since the build steps may vary from application to application and it should be taken care as a separate step. Refer below for a quick example to how to do this for a NodeJS application.<br/>
- `architectures`: String containing array of architectures that this new layer will support. Valid values are `[x_86_64 || arm64]`.<br/>
- `runtimes`: The list of valid runtimes that this layer can support. The valid values are `["nodejs" || "nodejs4.3" || "nodejs6.10" || "nodejs8.10" || "nodejs10.x" || "nodejs12.x" || "nodejs14.x" || "nodejs16.x" || "java8" || "java8.al2" || "java11" || "python2.7" || "python3.6" || "python3.7" || "python3.8" || "python3.9" || "dotnetcore1.0" || "dotnetcore2.0" || "dotnetcore2.1" || "dotnetcore3.1" || "dotnet6" || "nodejs4.3-edge" || "go1.x" || "ruby2.5" || "ruby2.7" || "provided" || "provided.al2" || "nodejs18.x" || "python3.10" || "java17" || "ruby3.2" || "python3.11"]`<br/>
- `s3_bucket`: An optional parameter for S3 Bucket Name In case if layer exceeds the allocated threshold size. We recommend to always provide with this value since if this value is present then action will try to upload layer via S3 automatically as failsafe mechanism for larger layers. Overcoming the limitation of direct AWS Lambda Layer size constraints over SDK.
- `functions`: An Optional array of functions to refresh the layer to the latest uploaded version. It is recommended to pass down all the functions in this argument that uses this layer. Action will try to refresh all the dependent functions to use the latest layer version automatically.

This GitHub Action is distributed under the MIT License. See LICENSE for more information.

## Example
This example demonstrated generating the archive and then publishing the layer via this githb action
```yaml
name: Release Layer

on:
  push:
    branches: [main]
    paths: ["package.json"]

jobs:
  build:
    if: "!contains(github.event.head_commit.message, '[skip-ci]')"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Nodejs
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install Dependencies, Build application and Zip dist file
        run: yarn install --frozen-lockfile
      - name: Bundle the layer zip
        run: mkdir nodejs
      - run: mv package.json nodejs/
      - run: mv yarn.lock nodejs/
      - run: mv node_modules nodejs/

      - name: Packing up the zip file
        run: zip -r nodejs.zip -r nodejs

      - name: Publish Layer
        uses: theserverfault/aws-lambda-layer-release-action@v0.0
        with:
          access_key_id: ${{ secrets.AWS_DEV_ACCESS_KEY_ID }}
          secret_access_key: ${{ secrets.AWS_DEV_SECRET_ACCESS_KEY }}
          layer_name: my-custom-layer
          archive: nodejs.zip
          architectures: ["x86_64"]
          runtimes: ["nodejs16.x","nodejs18.x"]
          s3_bucket: my-layers-bucket
          functions: ["function1-using-layer", "function2-using-layer"]
```

## Contributions

Contributions to this project are welcome. If you find any issues or want to add new features, feel free to submit a pull request.

By using this custom GitHub Action, you can simplify the release process of your AWS Lambda layers, automate the handling of larger layers, and ensure all dependent Lambda functions are updated with the latest layer version. Happy coding!

> Stay tuned to wonderful tech content at https://theserverfault.com