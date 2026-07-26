require('dotenv').config({ path: '.env.local' });
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Using cloud_name:', process.env.CLOUDINARY_CLOUD_NAME);

cloudinary.uploader
  .upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', { folder: 'siko-mendo-test' })
  .then((r) => console.log('SUCCESS:', r.secure_url))
  .catch((e) => console.error('FAILED:', e));