// src/config/aws.config.ts
import { registerAs } from '@nestjs/config';

export const awsConfig = registerAs('aws', () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.AWS_S3_BUCKET,
  cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
}));
