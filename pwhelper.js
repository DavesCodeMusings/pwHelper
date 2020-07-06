#!/usr/bin/env node

/**
 * pwhelper -- a simple, self-service password reset tool using Node.js on FreeBSD
 * @author David Horton https://github.com/DavesCodeMusings/pwhelper
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const childProcess = require('child_process');
const crypto = require('crypto');

// TCP port to run the https server on.
const tcpPort = 9000;

// Create new, empty secrets file if it does not already exist.
const autoCreateSecretsFile = true;

// Create new user secret for any username not found in the secrets file.
const autoCreateUserSecrets = true;

// File paths for important stuff.
const pidFile = path.join('/var/run', path.basename(__filename, '.js') + '.pid');
const htmlForm = path.join(__dirname, 'htdocs', 'pwhelper.html')
const pwChangeScript = path.join(__dirname, 'lib', 'pwhelper.sh');
const secretsFile = path.join(__dirname, 'etc', 'secrets');
const sslCert = path.join(__dirname, 'etc', 'ssl', 'ssl.cer');
const sslKey = path.join(__dirname, 'etc', 'ssl', 'ssl.key');

// Associative array in the format of: "username": "secret".
var secrets = {};

// Prepare for secure web server start up by fetching the SSL certificate and key. 
const httpsOptions = {
  cert: fs.readFileSync(sslCert),
  key: fs.readFileSync(sslKey)
};

// Check if secrets exists. If not, try to create it. Otherwise, read it in.
fs.stat(secretsFile, (err, stats) => {
  if (err) {

    // A missing file can be remedied. Anything else throws an error.
    if (err.code = 'ENOENT' && autoCreateSecretsFile) {
      fs.writeFile(secretsFile, JSON.stringify(secrets, null, 2), (err) => {
        if (err) throw err;
        fs.chmod(secretsFile, 0o600, (err) => {
          if (err) throw err;
          console.log('WARNING: No secrets file found. Creating a new one.');
        });
      });  
    }
    else {
      throw err;
    }
  }
  else {
    if (stats.mode != 0o100600) console.log(`WARNING: Set file permissions to 0600 on ${secretsFile} to prevent tampering.`);
    if (stats.uid != 0) console.log(`WARNING: Set file ownership to root on ${secretsFile} to prevent tampering.`);
    if (stats.size != 0) secrets = JSON.parse(fs.readFileSync(secretsFile));
  }
});

// Log startup info.
console.log ('Starting pwHelper\nCopyright (c)2020 David Horton https://davescodemusings.github.io/pwHelper/');
fs.writeFile(pidFile, process.pid, (error) => {
  if (!error) console.log(`PID ${process.pid} written to ${pidFile}`);
  else console.log(`${pidFile} is stale. Don't trust it. Actual PID is: ${process.pid}`);
});

// Signal handlers for shutdown.
function sigHandler(signal) {
  console.log(`Caught signal: ${signal}. Shutting down.`);
  if (signal == 'SIGINT' || signal == 'SIGTERM') {
    fs.unlinkSync(pidFile);
    process.exit(0);
  }
}
process.on('SIGINT', sigHandler);
process.on('SIGTERM', sigHandler);

// Start the HTTPS server.
https.createServer(httpsOptions, (request, response) => {
  request.setEncoding('utf8');
  let body = '';

  // Keep adding chunks of data to the body as they come in.
  request.on('data', chunk => {
      body += chunk;
  });

  // Request is entirely read in. Time to act.
  request.on('end', () => {

    // For a GET request, reply with the HTML form.
    if (request.method == 'GET' && request.url == '/') {
      let content = fs.readFileSync(htmlForm);
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(content);
    }

    // For a POST request, verify the secret and change passwords if it's correct.
    else if (request.method == 'POST' && request.url == '/') {
      let credentials = querystring.parse(body);

      // Hash the secret that was sent.
      const sha512 = crypto.createHash('sha512');
      sha512.update(credentials.secret, 'utf8');
      const hash = sha512.digest('hex');

      // If there's no entry in the secrets file yet, create one if it's allowed.
      if (!secrets[credentials.username] && autoCreateUserSecrets) {
        secrets[credentials.username] = hash;
        fs.writeFile(secretsFile, JSON.stringify(secrets, null, 2), function (err) {
          if (err) throw err;
          console.log(`New secret added for ${credentials.username}.`);
        });    
      }
 
      // Verify the secret sent against the one on file. 
      if (hash == secrets[credentials.username]) {
        console.log(`Secret verified for ${credentials.username}.`);
        let httpCode = 200;
        let result = '';
        try {
          result = childProcess.execSync(pwChangeScript + ' ' + credentials.username, { cwd: __dirname, input: credentials.password });
        }
        catch {
          httpCode = 500;
          result = 'Password change command failed. ' + result;
        }
        console.log(result.toString());
        response.writeHead(httpCode, {'Content-Type': 'text/plain'});
        response.end(result);
      }
      else {
        console.log(`Wrong secret for ${credentials.username}.`);
        response.writeHead(403, {'Content-Type': 'text/plain'});
        response.end('Invalid secret.');
      }
    }
  });
}).listen(tcpPort);
