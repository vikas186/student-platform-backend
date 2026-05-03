// const path = require("path");
// const AWS = require("aws-sdk");

// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION,
// });

// const uploadToS3 = async (file) => {
//   console.log(`Uploading`, file);
//   try {
//     if (!file || !file.originalname) {
//       throw new Error("File is undefined or has no originalname property.");
//     }

//     console.log("Uploading file:", file.originalname);
//     // const ext = path.extname(file.originalname.toString());
//     let keyName;

//     if (file.fieldname === "logo" || file.fieldname === "banner") {
//       // keyName = `uploads/business/${Date.now()}${ext}`;
//       keyName = `uploads/business/${file.modifiedName}`;
//     }

//     if (file.fieldname === "profilePhoto") {
//       // keyName = `uploads/business/${Date.now()}${ext}`;
//       keyName = `uploads/profile/${file.modifiedName}`;
//     }

//     const params = {
//       Bucket: process.env.S3_BUCKET_NAME,
//       Key: keyName,
//       Body: file.buffer,
//       ContentType: file.mimetype,
//     };

//     const data = await s3.upload(params).promise();
//     console.log("File uploaded successfully. Location:", data.Location);
//     return data.Location;
//   } catch (error) {
//     console.error("Error uploading file:", JSON.stringify(error, null, 2));
//     throw error;
//   }
// };

// const getSignedUrl = async (key) => {
//   try {
//     const params = {
//       Bucket: process.env.S3_BUCKET_NAME,
//       Key: key,
//       Expires: 60 * 5, // URL expires in 5 minutes (adjust as needed)
//     };

//     const signedUrl = s3.getSignedUrl("getObject", params);
//     // console.log("Generated signed URL:", signedUrl);
//     return signedUrl;
//   } catch (error) {
//     console.error("Error generating signed URL:", error);
//     throw error;
//   }
// };

// module.exports = {
//   uploadToS3,
//   getSignedUrl
// };
