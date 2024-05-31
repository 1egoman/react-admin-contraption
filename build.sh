npx tsup \
  --clean \
  --minify \
  --dts \
  --external react \
  --external react-dom \
  --external next \
  admin/index.tsx admin/global.css admin/**/*.ts admin/**/*.tsx

# After building, copy everything in dist into the package root
# This is because typescript doesn't seem to support reading the `exports` package.json key.
cp -R dist/* .
