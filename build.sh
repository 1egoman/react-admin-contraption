npx tsup \
  --clean \
  --minify \
  --dts \
  --external react \
  --external react-dom \
  --external next \
  admin/index.tsx admin/global.css admin/**/*.ts admin/**/*.tsx
