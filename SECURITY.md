# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainer for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove passwords, tokens, usernames and addresses
  first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Your Wolf SmartSet credentials

The integration needs the username and the password of your Wolf SmartSet
account, because Wolf offers no other way to sign in (no API key, no OAuth
consent screen for third parties). They are stored by Gladys in the
configuration of the integration, sent only to `www.wolf-smartset.com` over
HTTPS, and never written to the logs. The access token is kept in memory only.

If you think your credentials leaked, change your password in the Wolf
SmartSet portal, then update it in the configuration of the integration.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the Wolf SmartSet cloud, the Wolf gateways and the heating appliances, which
belong to WOLF GmbH — report their vulnerabilities to Wolf.
