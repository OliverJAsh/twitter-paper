# twitter-paper

Read Twitter like a newspaper. Yesterday's tweets, published each morning.

## Docker

```bash
docker-compose up
```

## Creating and configuring new Heroku app

```bash
heroku apps:create
heroku container:push web
heroku config:set \
    TWITTER_CONSUMER_KEY=CHANGE_ME \
    TWITTER_CONSUMER_SECRET=CHANGE_ME \
    HEROKU_URL=$(heroku info -s | grep web_url | cut -d= -f2) \
    EXPRESS_SESSION_SECRET=CHANGE_ME \
    NODE_ENV=production
heroku addons:create heroku-redis:hobby-dev
```
