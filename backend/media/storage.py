import os
import boto3
import logging
from botocore.exceptions import ClientError
from boto3.session import Config
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

logger = logging.getLogger(__name__)


class CustomB2Storage:
    """
    Custom Backblaze B2 S3-compatible storage that generates pre-signed URLs
    with detailed debugging logs for troubleshooting.
    """

    def __init__(self):
        # logger.debug("Initializing CustomB2Storage...")

        # Load configuration from environment variables
        self.access_key = os.getenv("B2_ACCOUNT_ID")
        self.secret_key = os.getenv("B2_APPLICATION_KEY")
        self.bucket_name = os.getenv("B2_BUCKET_NAME")
        self.endpoint_url = os.getenv("B2_S3_ENDPOINT_URL", "https://s3.eu-central-003.backblazeb2.com")
        self.region_name = os.getenv("B2_REGION_NAME", "eu-central-003")
        self.signature_version = os.getenv("B2_SIGNATURE_VERSION", "s3v4")
        self.expiration = int(os.getenv("B2_URL_EXPIRATION", 3600))  # Default: 1 hour

        # logger.debug(f"Storage Config: endpoint={self.endpoint_url}, region={self.region_name}, "
        #              f"bucket={self.bucket_name}, sigv={self.signature_version}, expire={self.expiration}")

        # Internal cache to avoid repeated bucket checks
        self._bucket_verified = None

        # Initialize S3 client
        try:
            # logger.debug("Initializing boto3 S3 client for Backblaze B2...")
            self.s3_client = boto3.client(
                "s3",
                region_name=self.region_name,
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(signature_version=self.signature_version),
            )
            logger.info("✅ S3 client initialized successfully.")
        except Exception as e:
            logger.exception("❌ Failed to initialize S3 client.")
            raise

    def _verify_bucket_once(self):
        """Verify bucket access only once per process to avoid repeated logs."""
        logger.debug(f"Verifying access to bucket '{self.bucket_name}'...")

        if self._bucket_verified is not None:
            # logger.debug(f"Bucket verification cached: {self._bucket_verified}")
            return self._bucket_verified

        try:
            logger.debug("Attempting head_bucket request...")
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            # logger.info(f"✅ Verified access to bucket '{self.bucket_name}'.")
            self._bucket_verified = True
        except ClientError as e:
            logger.error(f"❌ Cannot access bucket '{self.bucket_name}': {e}")
            self._bucket_verified = False
        except Exception as e:
            logger.exception(f"⚠️ Unexpected error while verifying bucket '{self.bucket_name}': {e}")
            self._bucket_verified = False

        return self._bucket_verified

    def url(self, name: str, expire: int | None = None) -> str:
        """Return a pre-signed URL for the given object key."""
        # logger.debug(f"Generating pre-signed URL for key: {name}")

        if not name:
            logger.warning("⚠️ Empty object key provided. Returning empty string.")
            return ""

        try:
            # Check bucket access only once
            if not self._verify_bucket_once():
                # logger.warning(f"⚠️ Falling back to unsigned URL for key: {name}")
                return self._default_url(name)

            expires_in = expire or self.expiration
            logger.debug(f"Using expiration time: {expires_in} seconds")

            # Generate pre-signed URL
            logger.debug("Calling generate_presigned_url()...")
            presigned_url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": name},
                ExpiresIn=expires_in,
            )

            # logger.info(f"✅ Successfully generated pre-signed URL for {name}")
            return presigned_url

        except ClientError as e:
            logger.error(f"❌ ClientError generating pre-signed URL for '{name}': {e}")
            return self._default_url(name)
        except Exception as e:
            logger.exception(f"⚠️ Unexpected error generating pre-signed URL for '{name}': {e}")
            return self._default_url(name)

    def _default_url(self, name: str) -> str:
        """Fallback to a public-style URL if pre-signed URL generation fails."""
        fallback_url = f"{self.endpoint_url}/{self.bucket_name}/{name}"
        # logger.debug(f"Returning fallback URL: {fallback_url}")
        return fallback_url
