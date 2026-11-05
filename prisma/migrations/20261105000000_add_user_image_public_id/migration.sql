-- Migration: add_user_image_public_id
-- Adds the Cloudinary public_id field to the User table so old assets can
-- be cleaned up when a profile picture is replaced or removed.

ALTER TABLE "user" ADD COLUMN "imagePublicId" TEXT;
