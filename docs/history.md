# Project history

This repository moved through earlier frontend-only and server-mock iterations.
Those prototypes included a five-method catalogue, a preview result gallery, an
offline demo gateway and a mock payment provider. All of that code and the
corresponding routes have been removed from the shipped application.

The current build is the Checkout.com Flow integration described in
[implementation.md](implementation.md) and [architecture.md](architecture.md):
Cards and Apple Pay, server-owned pricing, Payment Sessions, provider
verification and signed webhooks. Test doubles exist only inside the automated
test suites.
