const express = require('express');
const AWS = require('aws-sdk');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: true })); // permite cualquier frontend, solo para pruebas

// Configurar AWS con variables de entorno
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

app.post('/generate-presigned', async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) return res.status(400).json({ error: 'filename y contentType requeridos' });

  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: filename,
    Expires: 60, // segundos
    ContentType: contentType,
    ACL: 'private'
  };

  try {
    const url = await s3.getSignedUrlPromise('putObject', params);
    res.json({ url });
  } catch (err) {
    console.error('Error generando presigned:', err);
    res.status(500).json({ error: 'error generando URL' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en puerto ${PORT}`));
