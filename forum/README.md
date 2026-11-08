# The forum

Lemmy 0.19.21 at `https://forum.alaguillotine.com`, skinned to match the site
and framed inside `https://alaguillotine.com/forum`.

## What lives where

| Path | What it is |
| --- | --- |
| `theme/resistance.css` | The full Lemmy theme. `darkly-red.css` from the image plus the A LA GUILLOTINE overrides at the end. |
| `theme/embed.js` | Adds `.ala-embedded` to `<html>` when the forum is inside a frame, so the theme can drop the duplicate brand and footer. |
| `no-email.sql` | Postgres trigger that turns an empty email into `NULL`, so approving a registration does not try to send mail. |

## Server layout

```
/opt/lemmy/
  docker-compose.yml
  lemmy.hjson
  .env
  no-email.sql
  themes/
    resistance.css
    embed.js
    jetbrains-mono-latin.woff2
```

`docker-compose.yml`, under `lemmy-ui`:

```yaml
volumes:
  - ./themes/resistance.css:/app/dist/assets/css/themes/resistance.css:ro
```

The font and `embed.js` are served by nginx because lemmy-ui's `/css/themes/`
route only serves `.css`:

```nginx
location = /css/themes/embed.js {
    alias /opt/lemmy/themes/embed.js;
    default_type application/javascript;
}

location = /css/themes/jetbrains-mono-latin.woff2 {
    alias /opt/lemmy/themes/jetbrains-mono-latin.woff2;
    default_type font/woff2;
}
```

`embed.js` is injected into every HTML response in `location /`:

```nginx
proxy_set_header Accept-Encoding "";
sub_filter '</head>' '<script src="/css/themes/embed.js" defer></script></head>';
sub_filter_once on;
sub_filter_types text/html;
```

## Theme

The site default is set through the API (`PUT /api/v3/site`):

```json
{ "default_theme": "resistance" }
```

The theme is a compiled Bootstrap theme, so the simplest way to change it is to
edit the override block at the end of `theme/resistance.css` and restart the UI
container. The CSS is read from disk on every request, so a restart is only
needed when the mount changes.

Palette:

- background `#0B0B0C`
- panels `#111113`, cards `#18181B`
- borders `#27272A`
- text `#F4F4F5`, muted `#71717A`
- crimson `#E11D48`, neon `#22C55E`
- font: JetBrains Mono (self-hosted, weight 300–800)

## No email

Registration is `RequireApplication`. The email field is optional, and the
trigger in `no-email.sql` is what makes approval work without SMTP. Apply it
with:

```sh
docker compose exec -T postgres psql -U lemmy -d lemmy < no-email.sql
```

Without the trigger, Lemmy stores `''`, treats it as present, tries to send a
notification on approval, and returns `no_email_setup` after the approval has
already committed.