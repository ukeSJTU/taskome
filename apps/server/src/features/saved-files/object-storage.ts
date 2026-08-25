import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ObjectStorage {
  deleteObject(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  issueDownloadUrl(key: string): Promise<string>;
  issueUploadUrl(key: string, sizeBytes: number): Promise<string>;
}

export function createS3ObjectStorage(config: {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  secretAccessKey: string;
}): ObjectStorage {
  const client = new S3Client({
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: "us-east-1",
  });
  return {
    async deleteObject(key) {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    issueDownloadUrl: (key) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
        expiresIn: 60 * 15,
      }),
    issueUploadUrl: (key, sizeBytes) =>
      getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentLength: sizeBytes }),
        { expiresIn: 60 * 5 },
      ),
  };
}
