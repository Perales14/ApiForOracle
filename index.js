const express = require('express');
const AWS = require('aws-sdk');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: true })); // permite cualquier frontend, solo para pruebas
const { spawn } = require('child_process');

const DEPLOY_SECRET = process.env.DEPLOY_SECRET;

// Configurar AWS con variables de entorno
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// const { execSync } = require('child_process');

function getGitVersion() {
    const script = '/home/ubuntu/scriptgit/getversion.sh';

  try {
    const child = spawn(script, [], {
    // detached: true,
    // stdio: 'ignore',
    // env: process.env,
    // shell: true,
    encoding: 'utf-8' 
    });
    const child2 = spawn(script, {
    // detached: true,
    // stdio: 'ignore',
    // env: process.env,
    // shell: true,
    encoding: 'utf-8' 
    });
    console.log(child);
    console.log(child2);
    return spawn('/home/ubuntu/scriptgit/getversion.sh', { encoding: 'utf-8' }).trim();
  } catch (e) {
    console.error('Error obteniendo versión git:', e);
    return 'unknown';
  }
}


// Función para obtener commit actual
// function getGitVersion() {
//   try {
//     // return execSync('git rev-parse --short HEAD', { cwd: __dirname })
//     return execSync('git rev-parse --short HEAD', { cwd: '/home/ubuntu/ApiForOracle' })
//       .toString()
//       .trim();
//   } catch (e) {
//     return 'unknown';
//   }
// }

const s3 = new AWS.S3();

app.get('/health', (req, res) => {
  const version = getGitVersion();
  res.status(200).json({ status: 'ok', timestamp: new Date(), version });
});

// app.get('/health', (req, res) => {
//   res.status(200).json({ status: 'ok', timestamp: new Date(), version:1 });
// });



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

app.post('/deploy', express.json(), (req, res) => {
  const token = req.headers['x-deploy-token'];
  if (!token || token !== DEPLOY_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Ruta absoluta del script
  const script = '/home/ubuntu/scriptgit/deploy.sh';
  
  const versionBefore = getGitVersion();
  console.log(`Deploy started, current commit: ${versionBefore}`);


  // Lanzar en detached para que siga corriendo aun si este proceso muere
  const child = spawn(script, [], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
    shell: true
  });

  // desapegarlo del proceso padre
  child.unref();

  // responder inmediatamente: deploy en background
  return res.json({ ok: 'deploy started', versionBefore });
});


const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`API escuchando en puerto ${PORT}`));
app.listen(PORT, '0.0.0.0', () => console.log(`API escuchando en puerto ${PORT}`));


