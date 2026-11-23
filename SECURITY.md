# Security policy

Shop Planner is a static site: it has no server, no accounts and no database. Plans are kept only in each visitor's browser storage.

## Reporting a problem

Please report security problems privately through GitHub: **Security → Report a vulnerability** on this repository. Don't open a public issue for them.

Helpful to include: what you found, steps or a file that shows it, and which browser you used. You'll get a reply within 7 days.

## What's in scope

- Script injection (XSS) in the planner, including through saved or imported layouts
- Data that stops the planner from starting or freezes the tab
- Anything that makes the site load code or data from another site
- Problems in this repository's GitHub Actions workflows

## How the project checks itself

See the CI/CD section of the README: security tests run on every pull request, and CodeQL, dependency review, a secret scan and a workflow lint run on every push and weekly.
