pwHelper - a simple, self-service password reset tool using Node.js on FreeBSD
David Horton https://github.com/DavesCodeMusings/pwHelper

What does it do?
pwHelper provides a way for users to reset system passwords they may have
forgotten. Resetting passwords is allowed if the user can provide the correct
pre-defined secret phrase.

How does it work?
Secret phrases are SHA512 encoded and stored in a file alongside the user's
name. pwhelper.js provides a web form that allows users to enter a secret for
verification along with the new password they would like to use.

If the secret matches what's stored in the file, the password change is handed
over to the pwhelper.sh script. The script is able to change system passwords
and Samba passwords, but may be customized for additional services.

What makes a good secret?
It's really up to you and your users. Remember, it's not a word, but a phrase,
and longer is better. "My dog Rover has fleas, but I love him anyway." won't
work as a password, but it's a perfectly good secret.

How do I make it go?
Short answer: Unzip the package under /root and run sh ./install.sh
Long answer:
1. Unzip the archive in a directory under root's home.
2. Set the execute permission on any shell scripts (*.sh).
3. Verify node.js if installed or run 'pkg install node' to get it.
4. Create a self-signed HTTPS certificate with this command:
   openssl req -x509 -newkey rsa:4096 -keyout etc/ssl/ssl.key \
   -out etc/ssl/ssl.cer -days 730 -nodes -subj "/CN=$HOSTNAME"
5. Install the pwHelper service, as root, by copying etc/rc.d/pwhelper to
   /usr/local/etc, running sysrc enable_pwhelper="YES", and starting the
   service.
6. Ask users to visit https://yourhost:9000 to enter their name, secret and
   the password they want to use. if it's their first time using pwhelper,
   the new secret is recorded. After that, they'll need to get it right to
   proceed.

Can I predefine secrets?
Yes, though letting users choose their own means it is more likely they will
remember what they've chosen.
The format of the secrets file is:
{
  "user1": "sha512HexEncodedSecret1",
  "user2": "sha512HexEncodedSecret2",
  ...
}
To generate a secret, use the command: 'sha512 -s "Some secret only I know."'

Is pwHelper secure?
Short answer: No.
It's a program that runs as root with the intention of bypassing normal system
security. That's just wrong on so many levels. But, for a small home LAN
environment where you trust your users, it's probably fine.

Are there bugs?
Probably. These are some I know about:
1. If a user doesn't have a secret yet, a malicious user could create one.
2. Password changes for non-existent users will appear to succeed and not
   generate any error messages.
3. There is no provision to enforce a minimum length secret or password.
4. Secrets can only be changed by the root user manually deleting an entry. 
5. Secrets should probably be salted.
