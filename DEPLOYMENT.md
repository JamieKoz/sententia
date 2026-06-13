# Deployment

## Staging

Push-triggered deploys should publish the default Worker from `wrangler.toml`.
The Worker name is `sententia`, so the staging Workers URL should be:

```text
https://sententia-staging.jamiekozminska.workers.dev
```

The staging deploy command is:

```bash
npm run deploy
```

`npm run deploy` intentionally aliases `npm run deploy:staging`.

## Production

Production deploys to `sententia.tv` are manual only and publish a separate
Worker named `sententia`:

```bash
npm run deploy:production
```

Preview the production deploy without publishing:

```bash
npm run deploy:production:dry-run
```

Keep `sententia.tv` out of the default `wrangler.toml` routes/domains so push-triggered deploys do not publish to production. The staging deploy uses `--keep-vars` so dashboard-managed environment variables are not removed by Wrangler.
