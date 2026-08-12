# Security policy

Report a suspected vulnerability privately to the repository owner before public disclosure. Do not
include real wallet keys, account credentials, private endpoints, or production data in a report.

## Supported scope

The current supported release is `0.1.x`. Security-sensitive boundaries include validation bypass,
path escape, unsafe MCP profile acceptance, environment-variable injection, secret reflection,
constraint/evidence misreporting, and evaluation false allows.

## Explicit exclusions

This project does not accept custody, sign transactions, submit transactions, deploy contracts, or
certify zkApps. If any workflow requests these capabilities, stop and report it as a policy violation.
