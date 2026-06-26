const fs = require('fs');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
);

const clientId = env.GOOGLE_CLIENT_ID;
if (!clientId || clientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
  console.error('Renseignez GOOGLE_CLIENT_ID dans .env');
  process.exit(1);
}

const manifest = fs.readFileSync('manifest.json', 'utf8');
const patched = manifest.replace(/YOUR_CLIENT_ID\.apps\.googleusercontent\.com/, clientId);
fs.writeFileSync('manifest.json', patched, 'utf8');
console.log('manifest.json patché avec le client_id.');
