#!/bin/sh
#
# install.sh - install pwHelper and necessary components.

HOSTNAME=$(hostname)

# Check who's installing.
echo -n "Checking root privileges. "
if [ "$(id -u)" == "0" ]; then
  echo "OK."
else
  echo "Sorry, Charlie. You must be root to run the install script."
  exit 1
fi

# Fix execute permissions (.ZIP files won't remember perms.)
find . -name '*.sh' | xargs chmod +x

# Check node.js
echo "Checking for Node.js..."
pkg info node
if [ $? != 0 ]; then
  pkg update
  pkg -y install node
fi

# Install as a service.
echo "Installing pwHelper as a service..."
install -o0 -g0 -m555 etc/rc.d/pwhelper /usr/local/etc/rc.d
sysrc pwhelper_enable="YES"
sysrc pwhelper_home=${PWD}

# Create self-signed SSL cert.
echo "Generating SSL certificate for encryption..."
openssl req -x509 -newkey rsa:4096 -keyout etc/ssl/ssl.key -out etc/ssl/ssl.cer -days 730 -nodes -subj "/CN=$HOSTNAME"

# Start the service
service pwhelper start

# Finish
echo "Visit https://${HOSTNAME}:9000 to get started."
