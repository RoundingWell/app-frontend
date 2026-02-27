#!/usr/bin/env node

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
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

async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function downloadObject(s3Client, bucket, key, destinationPath) {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));

  if (!response.Body) {
    throw new Error(`Empty S3 response body for s3://${ bucket }/${ key }`);
  }

  await ensureParentDirectory(destinationPath);
  await pipeline(response.Body, createWriteStream(destinationPath));
}

async function calculateSha256(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

function parseChecksumFile(content) {
  return content.trim().split(/\s+/)[0];
}

async function verifyChecksum(artifactPath, checksumPath) {
  const checksumContent = await fs.readFile(checksumPath, 'utf8');
  const expectedChecksum = parseChecksumFile(checksumContent);
  const actualChecksum = await calculateSha256(artifactPath);

  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Artifact checksum mismatch: expected=${ expectedChecksum }, actual=${ actualChecksum }`);
  }
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
  const artifactFileName = path.basename(inputs.artifactPath);
  const checksumFileName = path.basename(inputs.checksumPath);
  const artifactKey = `${ inputs.prefix }/${ inputs.tag }/${ artifactFileName }`;
  const checksumKey = `${ inputs.prefix }/${ inputs.tag }/${ checksumFileName }`;

  const s3Client = new S3Client({
    region: getRegion(),
    credentials: getCredentials(),
  });

  await downloadObject(s3Client, inputs.bucket, artifactKey, inputs.artifactPath);
  await downloadObject(s3Client, inputs.bucket, checksumKey, inputs.checksumPath);
  await verifyChecksum(inputs.artifactPath, inputs.checksumPath);

  process.stdout.write(`Downloaded and verified: s3://${ inputs.bucket }/${ artifactKey }\n`);
}

main().catch(error => {
  process.stderr.write(`Artifact download failed: ${ error.message }\n`);
  process.exit(1);
});
