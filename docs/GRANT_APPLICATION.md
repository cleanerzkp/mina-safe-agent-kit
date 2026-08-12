# Provisional Mina Builder Grant application

Status: **application-ready after the public v0.1.0 release and green release-commit CI. No form has
been submitted.**

## Project

**Mina Safe Agent Kit** — an open-source, versioned Agent Skill, validator, o1js conformance suite,
read-only Mina MCP policy, and deterministic evaluation corpus for AI-assisted Mina development.

## Applicant

Applicant identity, jurisdiction, contracting form, and prior-work links are intentionally omitted
from this public repository. Supply them only through the official private application process. The
proposal is independent and contains no unrelated employer, client, or private project material.

## Problem

Coding agents can invent stale repository commands, mix experimental and stable o1js APIs, leave
private witnesses underconstrained, accept proofs without the matching verification key, or enable
wallet-capable MCP tools. A compile or green unit test can then be overstated as security evidence.

## Existing pre-application MVP

- a source-locked safe-development Skill;
- a validator with stable diagnostics for five unsafe categories;
- a real o1js 2.15 compile/prove/verify and JSON round-trip fixture;
- a negative constraint case that emits no proof;
- a fail-closed wrapper around the official Mina MCP 0.7.3 read-only devnet mode;
- a deterministic 20-task scorer with safe and unsafe synthetic controls;
- CI, source locks, threat model, maintenance plan, and evidence report.

There is no current Mina user adoption, maintainer endorsement, deployment, or production usage.
The existing MVP is unfunded prework and is not included in the requested milestone budget.

## Requested funding

Choose **Builder Grant** and request **USD 30,000** for 14 weeks. Do not select the USD 100k+
Partnership/Investment category. The public program has no USD 50k lane.

| Milestone | Deliverables and acceptance | Amount |
| --- | --- | ---: |
| M1 — demand and overlap evidence | five recorded Mina developer interviews, public overlap matrix, five written pilot commitments, and a fixed prompt-only baseline protocol | USD 4,000 |
| M2 — expanded rule and skill pack | four net-new task skills, ten new Rule IDs with positive/negative fixtures, schemas, migration notes, and editor/CI examples | USD 7,000 |
| M3 — expanded conformance matrix | at least 25 net-new o1js fixtures for state preconditions, recursive proofs, tamper cases, and stable-versus-Mesa drift, each with executable oracles | USD 8,000 |
| M4 — expanded distributable v1.0 integration | tagged installable v1.0 release, package artifact test, tool-surface snapshot diff, macOS/Linux launcher tests, and independent security review closure | USD 5,000 |
| M5 — measured adoption | 100-task model A/B report, ten external pilots, five public repository integrations, issue/adoption metrics, and a 12-month maintenance plan | USD 6,000 |
| **Total** |  | **USD 30,000** |

## Target outcomes

- 100 versioned evaluation tasks;
- ten external pilot developers;
- five public repositories using the kit;
- five portable Agent Skills;
- zero wallet-secret or write-tool exposure in the supported profile;
- measured prompt-only versus skill-assisted safety results under identical model settings.

The target users are o1js application developers and maintainers who use coding agents during proof,
state, serialization, and Mina MCP work. Distribution will use a tagged GitHub release, ecosystem
workshops, pilot integrations, o1js/Mina community feedback, and reusable CI examples. These channels
are hypotheses until the submission gates produce interview, pilot, and adoption evidence.

## Sustainability

The open-source core remains free and versioned with o1js releases. Possible post-grant support is a
hosted team evaluation service, paid integration work, sponsorship, and ecosystem contributions.
These are plans, not current revenue or customers.

## Mina alignment and differentiation

The project supports Mina's ZK programmability work by making agent-assisted o1js changes easier to
review with versioned, executable evidence. Official documentation explains APIs and secure patterns.
The official MCP server exposes Mina data. This kit adds the missing enforcement and measurement
layer: repository-command validation, constraint and proof conformance, a wallet-free launch boundary,
and a deterministic evaluation protocol. The overlap claim must be validated with external developers
before submission.

## Submission gates

Before submission:

1. publish the repository with a clean ownership history;
2. publish the tagged, installable v0.1.0 prework release with green CI and preserved reports;
3. provide applicant identity, contact email, prior-work links, and the IP/conflict boundary only
   through the official private application;
4. disclose that developer feedback, pilots, genuine model A/B evidence, adoption, endorsement,
   deployment, production usage, and revenue are not yet evidenced;
5. select **Builder Grant**, state the USD 30,000 request, and describe interviews, pilots, and genuine
   prompt-only versus skill-assisted evaluation as future funded milestones.

The public program accepts developers and teams that are building with Mina or looking to start. Its
Builder lane requires a credible adoption plan, not fabricated existing adoption. The five developer
reviews, pilot signals, and genuine model evaluation are therefore milestone deliverables rather than
pre-application claims.

## Pre-contract acceptance gates

Do not sign an agreement or accept funds until the applicant receives these terms in writing:

1. eligible jurisdiction and contracting form, contracting entity, and governing law;
2. payment asset, conversion date, token lockup, KYC, sanctions screening, tax, and withholding terms;
3. background and foreground IP ownership plus any open-source obligations;
4. milestone acceptance, cure, termination, clawback, invoicing, and payment timing.
