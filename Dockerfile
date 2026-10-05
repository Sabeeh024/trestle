# syntax=docker/dockerfile:1
#
# One Dockerfile, three images (build with --target):
#   api            the API, with the admin panel's static files served from the same origin
#   web-app        the product app (Next.js, standalone server)
#   marketing-app  the marketing site (Next.js, standalone server)
#
#   docker build --target api -t trestle-api .
#
# Stages are ordered so that the slow, rarely-changing work (installing dependencies) is cached until a
# package.json or the lockfile changes, and editing source only repeats the build.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
ENV CI=true NEXT_TELEMETRY_DISABLED=1
# The version the repository pins in package.json, so the lockfile is read by the pnpm that wrote it.
RUN npm install -g pnpm@12.5.1
WORKDIR /repo

# ---- manifests: only what pnpm needs to resolve the workspace
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web-app/package.json apps/web-app/
COPY apps/marketing-app/package.json apps/marketing-app/
COPY apps/admin-panel/package.json apps/admin-panel/
COPY packages/api-client/package.json packages/api-client/
COPY packages/auth/package.json packages/auth/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/forms/package.json packages/forms/
COPY packages/i18n/package.json packages/i18n/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/

# ---- production dependencies of the API only (no dev tools, no test databases)
FROM manifests AS api-deps
RUN pnpm install --frozen-lockfile --prod --filter "api..."

# ---- the admin panel's static build. VITE_API_URL is empty on purpose: the panel then calls "/api/..." on whatever
# origin served it, which is the API, so one build runs in every environment.
FROM manifests AS admin-build
RUN pnpm install --frozen-lockfile --filter "admin-panel..."
COPY packages ./packages
COPY apps/admin-panel ./apps/admin-panel
RUN pnpm --filter @trestle/design-tokens build
ENV VITE_API_URL=
RUN pnpm --filter admin-panel exec vite build

# ---- the API bundled into plain JavaScript
FROM manifests AS api-build
RUN pnpm install --frozen-lockfile --filter "api..."
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter api build

# ---- api
FROM node:${NODE_VERSION}-slim AS api
# The git commit this image was built from; /health reports it.
ARG GIT_SHA=unknown
ENV APP_VERSION=${GIT_SHA}
ENV NODE_ENV=production PORT=4000 ADMIN_DIST=/app/admin MIGRATIONS_DIR=/app/apps/api/drizzle
WORKDIR /app/apps/api
COPY --from=api-deps /repo/node_modules /app/node_modules
COPY --from=api-deps /repo/apps/api/node_modules ./node_modules
COPY --from=api-build /repo/apps/api/package.json ./package.json
COPY --from=api-build /repo/apps/api/dist ./dist
COPY --from=api-build /repo/apps/api/drizzle ./drizzle
COPY --from=admin-build /repo/apps/admin-panel/dist /app/admin
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Migrations are a separate step that runs before a release (`node dist/migrate.js`), never at startup, so several
# instances starting at once cannot race each other.
CMD ["node", "dist/server.js"]

# ---- the Next.js apps, built then reduced to their standalone servers
FROM manifests AS web-build
RUN pnpm install --frozen-lockfile --filter "web-app..."
COPY packages ./packages
COPY apps/web-app ./apps/web-app
ENV STANDALONE=1
RUN pnpm --filter @trestle/design-tokens build && pnpm --filter web-app build

FROM manifests AS marketing-build
RUN pnpm install --frozen-lockfile --filter "marketing-app..."
COPY packages ./packages
COPY apps/marketing-app ./apps/marketing-app
ENV STANDALONE=1
RUN pnpm --filter @trestle/design-tokens build && pnpm --filter marketing-app build

# ---- web-app
FROM node:${NODE_VERSION}-slim AS web-app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=web-build /repo/apps/web-app/.next/standalone ./
COPY --from=web-build /repo/apps/web-app/.next/static ./apps/web-app/.next/static
COPY --from=web-build /repo/apps/web-app/public ./apps/web-app/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/en/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web-app/server.js"]

# ---- marketing-app
FROM node:${NODE_VERSION}-slim AS marketing-app
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=marketing-build /repo/apps/marketing-app/.next/standalone ./
COPY --from=marketing-build /repo/apps/marketing-app/.next/static ./apps/marketing-app/.next/static
COPY --from=marketing-build /repo/apps/marketing-app/public ./apps/marketing-app/public
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/en').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/marketing-app/server.js"]
