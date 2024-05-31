rm -rf dist/

npx tsup \
  --config tsup.config.ts \
  admin/index.tsx admin/global.css admin/launcher.tsx admin/**/*.ts admin/**/*.tsx

# After building, copy everything in dist into the package root
# This is because typescript doesn't seem to support reading the `exports` package.json key.
cp -R dist/* .

# Combine css files together
cat dist/global.css dist/index.css dist/controls/*.css > styles.css
