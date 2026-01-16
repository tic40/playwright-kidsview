## Run workflow locally with act

```bash
brew install act

# create .secrets from sample and fill in your values
cp .secrets.sample .secrets

pnpm act_nursery  # Run nursery workflow
pnpm act_home     # Run home workflow
```
