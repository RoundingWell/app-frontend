#!/usr/bin/env node

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { getCredentials, getRegion } from './lib/aws.js';

function resolveInputs(values) {
  const bucket = values.bucket || process.env.ARTIFACT_BUCKET || 'rw-frontend-artifacts';
  const prefix = values.prefix || process.env.ARTIFACT_PREFIX || 'app-frontend';
  const tag = values.tag || process.env.ARTIFACT_TAG;
  const artifactPath = values.artifact || process.env.ARTIFACT_PATH || '/tmp/dist.tar.gz';
  const checksumPath = values.checksum || process.env.ARTIFACT_CHECKSUM_PATH || '/tmp/dist.tar.gz.sha256';

  if (!tag) {
    throw new Error('Tag is required (--tag or ARTIFACT_TAG)');
  }

  return {
    bucket,
    prefix,
    tag,
    artifactPath,
    checksumPath,
  };
}

function isNotFoundError(error) {
  return error.name === 'NotFound'
    || error.name === 'NoSuchKey'
    || error.$metadata?.httpStatusCode === 404;
}

async function objectExists(s3Client, bucket, key) {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return true;
  } catch(error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

async function assertReadable(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`File not found: ${ filePath }`);
  }
}

async function uploadFile(s3Client, bucket, key, filePath, contentType) {
  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: contentType,
  }));
}

async function main() {
  const { values } = parseArgs({
    options: {
      bucket: { type: 'string' },
      prefix: { type: 'string' },
      tag: { type: 'string' },
      artifact: { type: 'string' },
      checksum: { type: 'string' },
    },
  });

  const inputs = resolveInputs(values);
  await assertReadable(inputs.artifactPath);
  await assertReadable(inputs.checksumPath);

  const artifactFileName = path.basename(inputs.artifactPath);
  const checksumFileName = path.basename(inputs.checksumPath);
  const artifactKey = `${ inputs.prefix }/${ inputs.tag }/${ artifactFileName }`;
  const checksumKey = `${ inputs.prefix }/${ inputs.tag }/${ checksumFileName }`;

  const s3Client = new S3Client({
    region: getRegion(),
    credentials: getCredentials(),
  });

  const artifactAlreadyExists = await objectExists(s3Client, inputs.bucket, artifactKey);
  if (artifactAlreadyExists) {
    throw new Error(`Artifact already exists for tag ${ inputs.tag }: s3://${ inputs.bucket }/${ artifactKey }`);
  }

  await uploadFile(s3Client, inputs.bucket, artifactKey, inputs.artifactPath, 'application/gzip');
  await uploadFile(s3Client, inputs.bucket, checksumKey, inputs.checksumPath, 'text/plain');

  process.stdout.write(`Uploaded artifact: s3://${ inputs.bucket }/${ artifactKey }\n`);
}

main().catch(error => {
  process.stderr.write(`Artifact publish failed: ${ error.message }\n`);
  process.exit(1);
});
